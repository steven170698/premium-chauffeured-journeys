// Server-only pure helpers for trip tracking & final-fare computation.
// Imported dynamically inside server function handlers.

export type LatLng = { lat: number; lng: number };

/** Great-circle distance in miles between two coords. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.7613; // miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Sum of segment distances, ignoring segments > 2mi (GPS jumps) or accuracy > 100m. */
export function sumTrackDistance(
  points: Array<{ lat: number; lng: number; accuracy?: number | null }>,
): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const c = points[i];
    if ((c.accuracy ?? 0) > 100) continue;
    const seg = haversineMiles(p, c);
    if (seg > 2) continue; // outlier jump (loss of signal)
    total += seg;
  }
  return total;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type FareInputs = {
  actualDistanceMiles: number;
  actualDurationMinutes: number;
  billableWaitingMinutes: number;
  tolls: number;
  parking: number;
  airportSurcharge: number;
  stopsFee: number;
  isRoundTrip: boolean;
};

export type Settings = {
  base_fare: number;
  per_mile_rate: number;
  per_minute_rate: number;
  booking_fee: number;
  pickup_waiting_rate: number;
  max_waiting_charge: number;
  max_automatic_fare_increase: number; // percent, e.g. 20 = +20%
};

export type FareBreakdown = {
  baseFare: number;
  mileage: number;
  time: number;
  bookingFee: number;
  airportSurcharge: number;
  stopsFee: number;
  waitingCharge: number;
  tolls: number;
  parking: number;
  subtotal: number;
  computedFinal: number;
  cappedFinal: number;
  capApplied: boolean;
};

/**
 * Compute the final fare from actuals. Applies an automatic-increase cap
 * relative to the estimated fare so a bad GPS or an unusually slow trip
 * cannot balloon the customer's bill without admin review.
 */
export function computeFinalFare(
  inputs: FareInputs,
  settings: Settings,
  estimatedFare: number,
): FareBreakdown {
  const mileage = round2(inputs.actualDistanceMiles * Number(settings.per_mile_rate));
  const time = round2(inputs.actualDurationMinutes * Number(settings.per_minute_rate));
  const rawWait = inputs.billableWaitingMinutes * Number(settings.pickup_waiting_rate);
  const waitingCharge = round2(
    Math.min(rawWait, Number(settings.max_waiting_charge ?? Infinity)),
  );
  const baseFare = Number(settings.base_fare);
  const bookingFee = Number(settings.booking_fee);

  const subtotal = round2(
    baseFare +
      mileage +
      time +
      bookingFee +
      inputs.airportSurcharge +
      inputs.stopsFee +
      waitingCharge +
      inputs.tolls +
      inputs.parking,
  );
  const computedFinal = inputs.isRoundTrip ? round2(subtotal * 2) : subtotal;

  const pct = Number(settings.max_automatic_fare_increase ?? 20);
  const cap = round2(estimatedFare * (1 + pct / 100));
  const cappedFinal = estimatedFare > 0 && computedFinal > cap ? cap : computedFinal;

  return {
    baseFare: round2(baseFare),
    mileage,
    time,
    bookingFee: round2(bookingFee),
    airportSurcharge: round2(inputs.airportSurcharge),
    stopsFee: round2(inputs.stopsFee),
    waitingCharge,
    tolls: round2(inputs.tolls),
    parking: round2(inputs.parking),
    subtotal,
    computedFinal,
    cappedFinal,
    capApplied: cappedFinal < computedFinal,
  };
}
