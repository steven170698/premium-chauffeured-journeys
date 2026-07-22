import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { supabase: any; userId: string }) {
  // Verify admin via the service-role client reading user_roles directly (the
  // has_role() RPC path is unreliable and silently 403s admin actions).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden");
}

/**
 * Begin driving to pickup. confirmed → driver_en_route.
 * Optional starting GPS point.
 */
export const startTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      bookingId: z.string().uuid(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      accuracy: z.number().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ trip_status: "driver_en_route" })
      .eq("id", data.bookingId)
      .in("trip_status", ["confirmed", "driver_preparing"]);
    if (error) throw new Error(error.message);
    if (data.lat != null && data.lng != null) {
      await supabaseAdmin.from("trip_location_points").insert({
        booking_id: data.bookingId,
        latitude: data.lat,
        longitude: data.lng,
        accuracy: data.accuracy ?? null,
        trip_status: "driver_en_route",
      } as never);
    }
    return { ok: true };
  });

/**
 * Driver arrived at pickup. driver_en_route → driver_arrived.
 * Starts the waiting clock.
 */
export const markArrivedAtPickup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ bookingId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({
        trip_status: "driver_arrived",
        waiting_started_at: new Date().toISOString(),
      })
      .eq("id", data.bookingId)
      .eq("trip_status", "driver_en_route");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Passenger picked up — ride meter starts. driver_arrived → picked_up.
 * Stops the waiting clock and stamps trip_started_at.
 */
export const markPickedUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      bookingId: z.string().uuid(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      accuracy: z.number().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("admin_settings")
      .select("free_pickup_waiting_minutes")
      .eq("id", 1)
      .maybeSingle();
    const freeWait = Number((settings as any)?.free_pickup_waiting_minutes ?? 5);

    const { data: b } = await supabaseAdmin
      .from("bookings")
      .select("waiting_started_at")
      .eq("id", data.bookingId)
      .maybeSingle();
    const now = new Date();
    const waitStart = (b as any)?.waiting_started_at
      ? new Date((b as any).waiting_started_at)
      : now;
    const totalWaitMin = Math.max(0, (now.getTime() - waitStart.getTime()) / 60000);
    const billable = Math.max(0, totalWaitMin - freeWait);

    const { error } = await supabaseAdmin
      .from("bookings")
      .update({
        trip_status: "picked_up",
        trip_started_at: now.toISOString(),
        waiting_ended_at: now.toISOString(),
        pickup_waiting_minutes: Math.round(totalWaitMin),
        free_waiting_minutes: freeWait,
        billable_waiting_minutes: Math.round(billable),
      })
      .eq("id", data.bookingId)
      .eq("trip_status", "driver_arrived");
    if (error) throw new Error(error.message);

    if (data.lat != null && data.lng != null) {
      await supabaseAdmin.from("trip_location_points").insert({
        booking_id: data.bookingId,
        latitude: data.lat,
        longitude: data.lng,
        accuracy: data.accuracy ?? null,
        trip_status: "picked_up",
      } as never);
    }
    return { ok: true, billableWaitingMinutes: Math.round(billable) };
  });

/** Log a GPS point during the trip. Cheap & idempotent-friendly (append-only). */
export const logTripLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      bookingId: z.string().uuid(),
      lat: z.number(),
      lng: z.number(),
      accuracy: z.number().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("trip_location_points").insert({
      booking_id: data.bookingId,
      latitude: data.lat,
      longitude: data.lng,
      accuracy: data.accuracy ?? null,
      trip_status: "picked_up",
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * End trip. picked_up → completed.
 * Computes actual distance from logged GPS points, actual duration, final
 * fare, and reconciles: sets remaining_balance (customer pays via Pay Balance)
 * or issues an automatic Stripe refund when overcharged.
 */
export const endTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      bookingId: z.string().uuid(),
      tolls: z.number().min(0).optional().default(0),
      parking: z.number().min(0).optional().default(0),
      environment: z.enum(["sandbox", "live"]).optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      accuracy: z.number().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sumTrackDistance, computeFinalFare } = await import("./trip.server");

    const { data: b, error: be } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (be || !b) throw new Error("Booking not found");
    const booking = b as any;
    if (booking.trip_status !== "picked_up") {
      throw new Error(`Cannot end trip in status "${booking.trip_status}"`);
    }

    // Log a final point.
    if (data.lat != null && data.lng != null) {
      await supabaseAdmin.from("trip_location_points").insert({
        booking_id: data.bookingId,
        latitude: data.lat,
        longitude: data.lng,
        accuracy: data.accuracy ?? null,
        trip_status: "completed",
      } as never);
    }

    // Pull tracked points from pickup onward (chronological).
    const { data: points } = await supabaseAdmin
      .from("trip_location_points")
      .select("latitude, longitude, accuracy, trip_status, recorded_at")
      .eq("booking_id", data.bookingId)
      .in("trip_status", ["picked_up", "completed"])
      .order("recorded_at", { ascending: true });

    const tracked = ((points ?? []) as any[]).map((p) => ({
      lat: Number(p.latitude),
      lng: Number(p.longitude),
      accuracy: p.accuracy != null ? Number(p.accuracy) : null,
    }));
    const gpsMiles = sumTrackDistance(tracked);
    // Fall back to the original estimate if we didn't get useful GPS.
    const actualDistance = gpsMiles > 0.1
      ? gpsMiles
      : Number(booking.estimated_distance_miles ?? booking.distance_miles ?? 0);

    const endedAt = new Date();
    const startedAt = booking.trip_started_at
      ? new Date(booking.trip_started_at)
      : endedAt;
    const actualDuration = Math.max(
      0,
      (endedAt.getTime() - startedAt.getTime()) / 60000,
    );

    const { data: settings } = await supabaseAdmin
      .from("admin_settings")
      .select(
        "base_fare, per_mile_rate, per_minute_rate, booking_fee, pickup_waiting_rate, max_waiting_charge, max_automatic_fare_increase",
      )
      .eq("id", 1)
      .maybeSingle();

    const breakdown = computeFinalFare(
      {
        actualDistanceMiles: actualDistance,
        actualDurationMinutes: actualDuration,
        billableWaitingMinutes: Number(booking.billable_waiting_minutes ?? 0),
        tolls: Number(data.tolls ?? booking.toll_estimate ?? 0),
        parking: Number(data.parking ?? 0),
        airportSurcharge: Number(booking.airport_stop_fees ?? 0) > 0
          ? Number(booking.airport_stop_fees) - Number(booking.mileage_charge && 0)
          : 0,
        stopsFee: 0, // already rolled into airport_stop_fees on booking
        isRoundTrip: Boolean(booking.is_round_trip),
      },
      {
        base_fare: Number((settings as any)?.base_fare ?? 0),
        per_mile_rate: Number((settings as any)?.per_mile_rate ?? 0),
        per_minute_rate: Number((settings as any)?.per_minute_rate ?? 0),
        booking_fee: Number((settings as any)?.booking_fee ?? 0),
        pickup_waiting_rate: Number((settings as any)?.pickup_waiting_rate ?? 0),
        max_waiting_charge: Number((settings as any)?.max_waiting_charge ?? 999),
        max_automatic_fare_increase: Number(
          (settings as any)?.max_automatic_fare_increase ?? 20,
        ),
      },
      Number(booking.estimated_fare ?? booking.total ?? 0),
    );

    const finalFare = breakdown.cappedFinal;
    const amountPaid = Number(booking.amount_paid ?? 0);
    const remaining = Math.max(0, +(finalFare - amountPaid).toFixed(2));
    const overpaid = Math.max(0, +(amountPaid - finalFare).toFixed(2));

    // Issue automatic refund on overpayment when we have a payment_intent.
    let refunded = 0;
    let paymentStatusUpdate: string | null = null;
    if (
      overpaid > 0 &&
      booking.stripe_payment_intent &&
      data.environment
    ) {
      try {
        const { createStripeClient } = await import("./stripe.server");
        const stripe = createStripeClient(data.environment);
        const refund = await stripe.refunds.create({
          payment_intent: booking.stripe_payment_intent,
          amount: Math.round(overpaid * 100),
        });
        refunded = (refund.amount ?? 0) / 100;
        paymentStatusUpdate =
          amountPaid - refunded <= 0
            ? "refunded"
            : "partially_refunded";
      } catch (e) {
        console.error("Auto-refund failed:", e);
      }
    }

    const newAmountPaid = refunded > 0 ? +(amountPaid - refunded).toFixed(2) : amountPaid;
    const newRemaining = Math.max(0, +(finalFare - newAmountPaid).toFixed(2));
    const paymentStatus =
      paymentStatusUpdate ??
      (newRemaining <= 0 ? "paid" : newAmountPaid > 0 ? "deposit_paid" : "unpaid");

    const { error: upErr } = await supabaseAdmin
      .from("bookings")
      .update({
        trip_status: "completed",
        trip_ended_at: endedAt.toISOString(),
        actual_distance_miles: +actualDistance.toFixed(2),
        actual_duration_minutes: Math.round(actualDuration),
        toll_amount: breakdown.tolls,
        parking_amount: breakdown.parking,
        final_fare: finalFare,
        total: finalFare,
        amount_paid: newAmountPaid,
        remaining_balance: newRemaining,
        balance_due: newRemaining,
        payment_status: paymentStatus as any,
      })
      .eq("id", data.bookingId)
      .eq("trip_status", "picked_up");
    if (upErr) throw new Error(upErr.message);

    return {
      ok: true,
      finalFare,
      breakdown,
      actualDistanceMiles: +actualDistance.toFixed(2),
      actualDurationMinutes: Math.round(actualDuration),
      remainingBalance: newRemaining,
      refunded,
      capApplied: breakdown.capApplied,
    };
  });

/** Cancel the trip meter without completing. picked_up/driver_arrived → confirmed. */
export const abortTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ bookingId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({
        trip_status: "confirmed",
        trip_started_at: null,
        waiting_started_at: null,
        waiting_ended_at: null,
        pickup_waiting_minutes: 0,
        billable_waiting_minutes: 0,
      })
      .eq("id", data.bookingId)
      .in("trip_status", ["driver_en_route", "driver_arrived", "picked_up"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
