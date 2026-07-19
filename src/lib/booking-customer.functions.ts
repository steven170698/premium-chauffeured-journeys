import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const placeSchema = z.object({
  placeId: z.string().min(1),
  address: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  isAirport: z.boolean().optional(),
});

async function tryReadUserId(): Promise<string | null> {
  try {
    const req = getRequest();
    const auth = req?.headers.get("authorization");
    if (!auth || !auth.startsWith("Bearer ")) return null;
    const token = auth.slice(7).trim();
    if (!token || token.split(".").length !== 3) return null;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return null;
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data } = await client.auth.getClaims(token);
    return data?.claims?.sub ?? null;
  } catch {
    return null;
  }
}

async function loadOwnedBooking(bookingId: string) {
  const userId = await tryReadUserId();
  if (!userId) return { error: "You must be signed in." as const };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .select("id, user_id, trip_status")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!booking) return { error: "Booking not found." as const };
  if (booking.user_id !== userId) return { error: "Not allowed." as const };
  return { booking, userId };
}

/**
 * Customer cancels their own ride. Allowed while status is
 * pending_approval or awaiting_payment (i.e. before the trip is confirmed
 * and started). Confirmed/started/completed rides go through admin.
 */
export const cancelMyBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ bookingId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const owned = await loadOwnedBooking(data.bookingId);
    if ("error" in owned) return { error: owned.error };
    const { booking } = owned;
    if (!["pending_approval", "awaiting_payment"].includes(booking.trip_status)) {
      return { error: "This ride can no longer be canceled here. Please contact us." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ trip_status: "canceled" })
      .eq("id", booking.id);
    if (error) return { error: error.message };
    return { ok: true as const };
  });

const editSchema = z.object({
  bookingId: z.string().uuid(),
  pickup: placeSchema,
  destination: placeSchema,
  pickupAt: z.string().min(1),
  isRoundTrip: z.boolean().optional().default(false),
  returnAt: z.string().optional().nullable(),
  passengers: z.number().int().min(1).max(8).optional().default(1),
  bags: z.number().int().min(0).max(20).optional().default(0),
  extraStop: z.string().optional().nullable(),
  flightNumber: z.string().optional().nullable(),
  specialInstructions: z.string().optional().nullable(),
});

/**
 * Customer edits their own ride request. Only permitted while status is
 * `pending_approval` — once the admin approves (awaiting_payment) or later,
 * edits go through admin. Recomputes the quote server-side.
 */
export const updateMyBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => editSchema.parse(data))
  .handler(async ({ data }) => {
    const owned = await loadOwnedBooking(data.bookingId);
    if ("error" in owned) return { error: owned.error };
    const { booking } = owned;
    if (booking.trip_status !== "pending_approval") {
      return {
        error:
          "This ride can only be edited while it is awaiting driver approval.",
      };
    }

    const { computeQuoteInternal } = await import("./quote.server");
    const quote = await computeQuoteInternal({
      pickup: data.pickup,
      destination: data.destination,
      extraStops: data.extraStop ? 1 : 0,
      roundTrip: data.isRoundTrip,
    });

    const pickupAt = new Date(data.pickupAt);
    const estimatedEndAt = new Date(
      pickupAt.getTime() + quote.durationMinutes * 60 * 1000,
    );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({
        pickup_address: data.pickup.address,
        pickup_lat: data.pickup.lat,
        pickup_lng: data.pickup.lng,
        destination_address: data.destination.address,
        destination_lat: data.destination.lat,
        destination_lng: data.destination.lng,
        pickup_at: pickupAt.toISOString(),
        is_round_trip: data.isRoundTrip,
        return_at: data.returnAt ? new Date(data.returnAt).toISOString() : null,
        passengers: data.passengers,
        bags: data.bags,
        extra_stops: data.extraStop || null,
        special_instructions: data.specialInstructions || null,
        distance_miles: quote.distanceMiles,
        duration_minutes: quote.durationMinutes,
        estimated_end_at: estimatedEndAt.toISOString(),
        base_fare: quote.baseFare,
        mileage_charge: quote.mileage,
        time_charge: quote.time,
        booking_fee: quote.bookingFee,
        airport_stop_fees: quote.airportSurcharge + quote.stopsFee,
        toll_estimate: quote.tollsEstimate,
        subtotal: quote.subtotal,
        total: quote.total,
        balance_due: quote.total,
      })
      .eq("id", booking.id);
    if (error) return { error: error.message };
    return { ok: true as const, total: quote.total };
  });
