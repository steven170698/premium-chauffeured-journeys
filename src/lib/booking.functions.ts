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

const requestInputSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().min(3).max(40),
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

type RequestResult =
  | {
      bookingId: string;
      reservationNumber: string;
      tripStatus: string;
      total: number;
      approvalDeadlineAt: string | null;
    }
  | { error: string };

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

/**
 * Customer submits a ride request. Never touches Stripe. Inserts a booking as
 * `pending_approval` (or `awaiting_payment` when the admin has opted into
 * auto-confirm) and stamps `approval_deadline_at` so the sweep can expire it.
 */
export const requestBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => requestInputSchema.parse(data))
  .handler(async ({ data }): Promise<RequestResult> => {
    try {
      const userId = await tryReadUserId();

      const { computeQuoteInternal } = await import("./quote.server");
      const quote = await computeQuoteInternal({
        pickup: data.pickup,
        destination: data.destination,
        extraStops: data.extraStop ? 1 : 0,
        roundTrip: data.isRoundTrip,
      });

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Load approval-workflow settings
      const { data: settings } = await supabaseAdmin
        .from("admin_settings")
        .select(
          "require_approval, approval_deadline_minutes, auto_confirm_future_bookings",
        )
        .eq("id", 1)
        .maybeSingle();

      const approvalWindowMin = Number(settings?.approval_deadline_minutes ?? 30);
      const requireApproval = settings?.require_approval !== false;
      const autoConfirm = Boolean(
        (settings as { auto_confirm_future_bookings?: boolean } | null)
          ?.auto_confirm_future_bookings,
      );

      const pickupAt = new Date(data.pickupAt);
      const estimatedEndAt = new Date(
        pickupAt.getTime() + quote.durationMinutes * 60 * 1000,
      );
      const approvalDeadline = new Date(
        Date.now() + approvalWindowMin * 60 * 1000,
      );

      // Skip driver review only when the admin explicitly opted in.
      const initialStatus =
        !requireApproval && autoConfirm ? "awaiting_payment" : "pending_approval";

      const { data: booking, error } = await supabaseAdmin
        .from("bookings")
        .insert({
          user_id: userId,
          full_name: data.fullName,
          email: data.email,
          phone: data.phone,
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
          trip_status: initialStatus,
          payment_status: "unpaid",
          approval_deadline_at: approvalDeadline.toISOString(),
        })
        .select("id, reservation_number, total, trip_status, approval_deadline_at")
        .single();

      if (error || !booking) {
        return { error: error?.message ?? "Could not save your booking." };
      }

      return {
        bookingId: booking.id,
        reservationNumber: booking.reservation_number,
        tripStatus: booking.trip_status,
        total: Number(booking.total),
        approvalDeadlineAt: booking.approval_deadline_at,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not submit request";
      return { error: msg };
    }
  });
