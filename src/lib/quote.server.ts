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
  baseFare: number;
  mileage: number;
  time: number;
  bookingFee: number;
  airportSurcharge: number;
  stopsFee: number;
  surcharges: number;
  tollsEstimate: number;
  subtotal: number;
  total: number;
  roundTrip: boolean;
  currency: "USD";
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

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
}): Promise<QuoteData> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps connector credentials are not configured.");
  }

  const routeRes = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "routes.distanceMeters,routes.duration,routes.travelAdvisory.tollInfo.estimatedPrice",
    },
    body: JSON.stringify({
      origin: { placeId: input.pickup.placeId },
      destination: { placeId: input.destination.placeId },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      extraComputations: ["TOLLS"],
      units: "IMPERIAL",
    }),
  });

  if (!routeRes.ok) {
    const body = await routeRes.text();
    console.error(`Routes API failed [${routeRes.status}]: ${body}`);
    throw new Error("Could not calculate the route. Please check the addresses.");
  }

  const routeJson = (await routeRes.json()) as {
    routes?: Array<{
      distanceMeters?: number;
      duration?: string;
      travelAdvisory?: {
        tollInfo?: {
          estimatedPrice?: Array<{ units?: string; nanos?: number; currencyCode?: string }>;
        };
      };
    }>;
  };

  const route = routeJson.routes?.[0];
  if (!route || !route.distanceMeters || !route.duration) {
    throw new Error("No driving route found between those addresses.");
  }

  const distanceMiles = route.distanceMeters / 1609.344;
  const durationSeconds = Number(route.duration.replace("s", ""));
  const durationMinutes = durationSeconds / 60;

  let tollsEstimate = 0;
  const tolls = route.travelAdvisory?.tollInfo?.estimatedPrice;
  if (tolls && tolls.length) {
    const usd = tolls.find((t) => t.currencyCode === "USD") ?? tolls[0];
    tollsEstimate = Number(usd?.units ?? 0) + Number(usd?.nanos ?? 0) / 1e9;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const { data: settings, error } = await supabase
    .from("public_pricing" as never)
    .select(
      "base_fare, per_mile_rate, per_minute_rate, booking_fee, airport_surcharge, stop_fee, minimum_fare, night_surcharge_pct, night_start_hour, night_end_hour, weekend_surcharge_pct, holiday_surcharge_pct, surcharge_stacking",
    )
    .maybeSingle<{
      base_fare: number;
      per_mile_rate: number;
      per_minute_rate: number;
      booking_fee: number;
      airport_surcharge: number;
      stop_fee: number;
      minimum_fare: number | null;
      night_surcharge_pct: number | null;
      night_start_hour: number | null;
      night_end_hour: number | null;
      weekend_surcharge_pct: number | null;
      holiday_surcharge_pct: number | null;
      surcharge_stacking: string | null;
    }>();

  if (error || !settings) throw new Error("Pricing is not configured yet.");

  const baseFare = Number(settings.base_fare);
  const perMile = Number(settings.per_mile_rate);
  const perMinute = Number(settings.per_minute_rate);
  const bookingFee = Number(settings.booking_fee);
  const airportSurchargeRate = Number(settings.airport_surcharge);
  const stopFeeRate = Number(settings.stop_fee);
  const minimumFare = Number(settings.minimum_fare ?? 0);

  const mileage = round2(distanceMiles * perMile);
  const time = round2(durationMinutes * perMinute);
  const airportSurcharge =
    input.pickup.isAirport || input.destination.isAirport ? airportSurchargeRate : 0;
  const stopsFee = round2((input.extraStops ?? 0) * stopFeeRate);

  // Base trip subtotal, then apply the configurable minimum-fare floor.
  let base = round2(
    baseFare + mileage + time + bookingFee + airportSurcharge + stopsFee + tollsEstimate,
  );
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
        const { data: holiday } = await supabase
          .from("pricing_holidays" as never)
          .select("surcharge_pct")
          .eq("holiday_date", dateStr)
          .eq("is_active", true)
          .maybeSingle<{ surcharge_pct: number }>();
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
  const total = input.roundTrip ? round2(subtotal * 2) : subtotal;

  return {
    distanceMiles: round2(distanceMiles),
    durationMinutes: Math.round(durationMinutes),
    baseFare: round2(baseFare),
    mileage,
    time,
    bookingFee: round2(bookingFee),
    airportSurcharge: round2(airportSurcharge),
    stopsFee,
    surcharges,
    tollsEstimate: round2(tollsEstimate),
    subtotal: round2(subtotal),
    total: round2(total),
    roundTrip: input.roundTrip ?? false,
    currency: "USD",
  };
}
