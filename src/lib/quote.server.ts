// Server-only fare computation. Imported dynamically inside server function handlers.
export type PlaceInput = {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
  isAirport?: boolean;
};

export type QuoteData = {
  distanceMiles: number;
  durationMinutes: number;
  hourly: boolean;
  hours: number;
  hourlyCharge: number;
  baseFare: number;
  mileage: number;
  time: number;
  bookingFee: number;
  airportSurcharge: number;
  stopsFee: number;
  meetGreetFee: number;
  childSeatFee: number;
  surcharges: number;
  tollsEstimate: number;
  subtotal: number;
  total: number;
  roundTrip: boolean;
  currency: "USD";
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Pickup hour (0-23), weekday (0=Sun), and ISO date (YYYY-MM-DD) in ET. */
function etParts(iso: string): { hour: number; weekday: number; dateStr: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = parseInt(get("hour"), 10) % 24;
  const wd: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hour,
    weekday: wd[get("weekday")] ?? 0,
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export async function computeQuoteInternal(input: {
  pickup: PlaceInput;
  destination: PlaceInput;
  extraStops?: number;
  roundTrip?: boolean;
  pickupAt?: string | null;
  /** Booking service type; "hourly" switches to hourly-charter pricing. */
  serviceType?: string | null;
  /** Requested hours for an hourly charter. */
  hourlyHours?: number | null;
  meetAndGreet?: boolean;
  childSeat?: boolean;
}): Promise<QuoteData> {
  const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY;
  if (!GEOAPIFY_API_KEY) {
    throw new Error("Geoapify credentials are not configured.");
  }

  const routeUrl = new URL("https://api.geoapify.com/v1/routing");
  routeUrl.searchParams.set(
    "waypoints",
    `${input.pickup.lat},${input.pickup.lng}|${input.destination.lat},${input.destination.lng}`,
  );
  routeUrl.searchParams.set("mode", "drive");
  routeUrl.searchParams.set("apiKey", GEOAPIFY_API_KEY);

  const routeRes = await fetch(routeUrl, { headers: { Accept: "application/json" } });
  if (!routeRes.ok) {
    const body = await routeRes.text();
    console.error(`Routing API failed [${routeRes.status}]: ${body}`);
    throw new Error("Could not calculate the route. Please check the addresses.");
  }

  const routeJson = (await routeRes.json()) as {
    features?: Array<{ properties?: { distance?: number; time?: number } }>;
  };
  const routeProps = routeJson.features?.[0]?.properties;
  if (!routeProps || routeProps.distance == null || routeProps.time == null) {
    throw new Error("No driving route found between those addresses.");
  }

  // Geoapify returns distance in meters and time in seconds.
  const distanceMiles = routeProps.distance / 1609.344;
  const durationMinutes = routeProps.time / 60;

  // Geoapify routing does not provide toll price estimates; tolls are reconciled
  // from actuals at trip end.
  const tollsEstimate = 0;

  // Pricing is read server-side with the service-role client. `public_pricing`
  // is a security_invoker view and anon has no SELECT on the underlying
  // admin_settings, so an anon read is denied. This quote always runs
  // server-side, so read the source table directly with elevated rights — only
  // the computed quote is ever returned to the caller.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: settings, error } = await supabaseAdmin
    .from("admin_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !settings) throw new Error("Pricing is not configured yet.");

  const baseFareRate = Number(settings.base_fare);
  const perMile = Number(settings.per_mile_rate);
  const perMinute = Number(settings.per_minute_rate);
  const bookingFee = Number(settings.booking_fee);
  const airportSurchargeRate = Number(settings.airport_surcharge);
  const stopFeeRate = Number(settings.stop_fee);
  const minimumFare = Number(settings.minimum_fare ?? 0);
  const hourlyRate = Number(settings.hourly_rate ?? 0);
  const minHourlyHours = Number(settings.minimum_hourly_hours ?? 0);
  const meetGreetFeeRate = Number(settings.meet_greet_fee ?? 0);
  const childSeatFeeRate = Number(settings.child_seat_fee ?? 0);

  // Hourly charter: billed by booked time, not point-to-point distance.
  const isHourly = input.serviceType === "hourly";
  const hours = isHourly ? Math.max(Number(input.hourlyHours ?? 0), minHourlyHours) : 0;
  const hourlyCharge = isHourly ? round2(hours * hourlyRate) : 0;

  // Distance-based components are not billed on an hourly charter.
  const baseFare = isHourly ? 0 : baseFareRate;
  const mileage = isHourly ? 0 : round2(distanceMiles * perMile);
  const time = isHourly ? 0 : round2(durationMinutes * perMinute);
  const airportSurcharge =
    !isHourly && (input.pickup.isAirport || input.destination.isAirport)
      ? airportSurchargeRate
      : 0;
  const stopsFee = isHourly ? 0 : round2((input.extraStops ?? 0) * stopFeeRate);

  // Trip base, then apply the configurable minimum-fare floor.
  const tripCore = isHourly ? hourlyCharge : round2(baseFare + mileage + time);
  let base = round2(tripCore + bookingFee + airportSurcharge + stopsFee + tollsEstimate);
  if (base < minimumFare) base = minimumFare;

  // Time-based percentage surcharges (night / weekend / holiday), applied only
  // when a pickup time is known.
  let surchargePct = 0;
  if (input.pickupAt) {
    const pcts: number[] = [];
    try {
      const { hour, weekday, dateStr } = etParts(input.pickupAt);
      const nightStart = Number(settings.night_start_hour ?? 22);
      const nightEnd = Number(settings.night_end_hour ?? 5);
      const isNight =
        nightStart <= nightEnd
          ? hour >= nightStart && hour < nightEnd
          : hour >= nightStart || hour < nightEnd;
      if (isNight) pcts.push(Number(settings.night_surcharge_pct ?? 0));
      if (weekday === 0 || weekday === 6) pcts.push(Number(settings.weekend_surcharge_pct ?? 0));

      // Holiday lookup — best-effort; a failure never breaks the quote.
      try {
        const { data: holiday } = await supabaseAdmin
          .from("pricing_holidays")
          .select("surcharge_pct")
          .eq("holiday_date", dateStr)
          .eq("is_active", true)
          .maybeSingle();
        if (holiday) {
          pcts.push(Number(holiday.surcharge_pct ?? settings.holiday_surcharge_pct ?? 0));
        }
      } catch {
        /* pricing_holidays not created yet — skip holiday surcharge */
      }
    } catch {
      /* unparseable pickup time — no time-based surcharge */
    }

    const stacking = String(settings.surcharge_stacking ?? "stack");
    const applicable = pcts.filter((p) => p > 0);
    if (applicable.length) {
      surchargePct =
        stacking === "highest"
          ? Math.max(...applicable)
          : applicable.reduce((a, b) => a + b, 0);
    }
  }

  const surcharges = round2(base * (surchargePct / 100));
  const subtotal = round2(base + surcharges);
  const tripTotal = input.roundTrip ? round2(subtotal * 2) : subtotal;

  // Flat per-booking add-on fees: charged once, not doubled on a round trip
  // and not subject to the time-based percentage surcharges.
  const meetGreetFee = input.meetAndGreet ? round2(meetGreetFeeRate) : 0;
  const childSeatFee = input.childSeat ? round2(childSeatFeeRate) : 0;
  const total = round2(tripTotal + meetGreetFee + childSeatFee);

  return {
    distanceMiles: round2(distanceMiles),
    durationMinutes: Math.round(durationMinutes),
    hourly: isHourly,
    hours,
    hourlyCharge,
    baseFare: round2(baseFare),
    mileage,
    time,
    bookingFee: round2(bookingFee),
    airportSurcharge: round2(airportSurcharge),
    stopsFee,
    meetGreetFee,
    childSeatFee,
    surcharges,
    tollsEstimate: round2(tollsEstimate),
    subtotal: round2(subtotal),
    total: round2(total),
    roundTrip: input.roundTrip ?? false,
    currency: "USD",
  };
}
