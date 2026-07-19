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

export async function computeQuoteInternal(input: {
  pickup: PlaceInput;
  destination: PlaceInput;
  extraStops?: number;
  roundTrip?: boolean;
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
    .from("admin_settings")
    .select("base_fare, per_mile_rate, per_minute_rate, booking_fee, airport_surcharge, stop_fee")
    .eq("id", 1)
    .maybeSingle();

  if (error || !settings) throw new Error("Pricing is not configured yet.");

  const baseFare = Number(settings.base_fare);
  const perMile = Number(settings.per_mile_rate);
  const perMinute = Number(settings.per_minute_rate);
  const bookingFee = Number(settings.booking_fee);
  const airportSurchargeRate = Number(settings.airport_surcharge);
  const stopFeeRate = Number(settings.stop_fee);

  const mileage = round2(distanceMiles * perMile);
  const time = round2(durationMinutes * perMinute);
  const airportSurcharge =
    input.pickup.isAirport || input.destination.isAirport ? airportSurchargeRate : 0;
  const stopsFee = round2((input.extraStops ?? 0) * stopFeeRate);

  let subtotal = round2(
    baseFare + mileage + time + bookingFee + airportSurcharge + stopsFee + tollsEstimate,
  );
  const MIN_FARE = 15;
  if (subtotal < MIN_FARE) subtotal = MIN_FARE;

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
    tollsEstimate: round2(tollsEstimate),
    subtotal: round2(subtotal),
    total: round2(total),
    roundTrip: input.roundTrip ?? false,
    currency: "USD",
  };
}
