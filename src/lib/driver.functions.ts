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

const TRIP_STATUSES = [
  "pending_approval",
  "confirmed",
  "driver_preparing",
  "driver_en_route",
  "driver_arrived",
  "picked_up",
  "completed",
  "canceled",
] as const;

const BOOKING_COLS =
  "id, reservation_number, user_id, full_name, email, phone, pickup_address, destination_address, pickup_at, estimated_end_at, distance_miles, duration_minutes, trip_status, payment_status, total, amount_paid, balance_due, passengers, bags, extra_stops, special_instructions, driver_notes, is_round_trip, return_at, stripe_payment_intent";

/** Rides scheduled for today (chronological). */
export const listTodayRides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select(BOOKING_COLS)
      .gte("pickup_at", start.toISOString())
      .lte("pickup_at", end.toISOString())
      .neq("trip_status", "canceled")
      .order("pickup_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Upcoming rides in a range with optional status filter. */
export const listUpcomingRides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      range: z.enum(["today", "tomorrow", "week", "month"]),
      status: z.enum(TRIP_STATUSES).optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    let start = new Date(now); start.setHours(0, 0, 0, 0);
    let end = new Date(now); end.setHours(23, 59, 59, 999);
    if (data.range === "tomorrow") {
      start.setDate(start.getDate() + 1);
      end.setDate(end.getDate() + 1);
    } else if (data.range === "week") {
      end.setDate(end.getDate() + 7);
    } else if (data.range === "month") {
      end.setDate(end.getDate() + 30);
    }
    let q = supabaseAdmin
      .from("bookings")
      .select(BOOKING_COLS)
      .gte("pickup_at", start.toISOString())
      .lte("pickup_at", end.toISOString())
      .order("pickup_at", { ascending: true });
    if (data.status) q = q.eq("trip_status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Update booking status. Demoting from `completed` requires explicit confirm. */
export const updateTripStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      bookingId: z.string().uuid(),
      status: z.enum(TRIP_STATUSES),
      confirmDemote: z.boolean().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("bookings")
      .select("trip_status")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (fetchErr || !existing) throw new Error("Booking not found");
    if (
      (existing as any).trip_status === "completed" &&
      data.status !== "completed" &&
      !data.confirmDemote
    ) {
      throw new Error("Completed trips require explicit confirmation to revert.");
    }
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ trip_status: data.status })
      .eq("id", data.bookingId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Private driver notes (admin-only). */
export const saveDriverNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      bookingId: z.string().uuid(),
      notes: z.string().max(2000),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ driver_notes: data.notes })
      .eq("id", data.bookingId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Record a manual payment (cash / card in-person / partial). */
export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      bookingId: z.string().uuid(),
      amount: z.number().positive(),
      method: z.enum(["cash", "card", "other"]),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: b, error: fe } = await supabaseAdmin
      .from("bookings")
      .select("total, amount_paid")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (fe || !b) throw new Error("Booking not found");
    const paid = Number((b as any).amount_paid ?? 0) + data.amount;
    const total = Number((b as any).total ?? 0);
    const balance = Math.max(0, total - paid);
    const payment_status = balance <= 0 ? "paid" : "deposit_paid";
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ amount_paid: paid, balance_due: balance, payment_status })
      .eq("id", data.bookingId);
    if (error) throw new Error(error.message);
    return { ok: true, amount_paid: paid, balance_due: balance, payment_status };
  });

/** Issue a Stripe refund (partial or full) against a booking's payment intent. */
export const issueRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      bookingId: z.string().uuid(),
      amount: z.number().positive().optional(),
      environment: z.enum(["sandbox", "live"]),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createStripeClient } = await import("@/lib/stripe.server");
    const { data: b, error: fe } = await supabaseAdmin
      .from("bookings")
      .select("stripe_payment_intent, amount_paid, total")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (fe || !b) throw new Error("Booking not found");
    const pi = (b as any).stripe_payment_intent as string | null;
    if (!pi) throw new Error("No Stripe payment on file for this booking.");
    const stripe = createStripeClient(data.environment);
    const refundAmount = data.amount ? Math.round(data.amount * 100) : undefined;
    const refund = await stripe.refunds.create({
      payment_intent: pi,
      ...(refundAmount ? { amount: refundAmount } : {}),
    });
    const refundedTotal = (refund.amount ?? 0) / 100;
    const currentPaid = Number((b as any).amount_paid ?? 0);
    const newPaid = Math.max(0, currentPaid - refundedTotal);
    const total = Number((b as any).total ?? 0);
    const payment_status =
      newPaid <= 0 ? "refunded" : newPaid < total ? "partially_refunded" : "paid";
    await supabaseAdmin
      .from("bookings")
      .update({
        amount_paid: newPaid,
        balance_due: Math.max(0, total - newPaid),
        payment_status,
      })
      .eq("id", data.bookingId);
    return { ok: true, refundedAmount: refundedTotal };
  });

/** Today's earnings summary. */
export const todayEarnings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);

    const { data: todays } = await supabaseAdmin
      .from("bookings")
      .select("trip_status, payment_status, total, amount_paid, balance_due")
      .gte("pickup_at", start.toISOString())
      .lte("pickup_at", end.toISOString());
    const rows = (todays ?? []) as Array<any>;
    const active = rows.filter(
      (r) => !["refunded", "partially_refunded"].includes(r.payment_status) && r.trip_status !== "canceled",
    );
    const completed = active.filter((r) => r.trip_status === "completed");
    const pending = active.filter((r) => r.trip_status !== "completed");
    const totalPaidToday = active.reduce((n, r) => n + Number(r.amount_paid ?? 0), 0);
    const deposits = active
      .filter((r) => r.payment_status === "deposit_paid")
      .reduce((n, r) => n + Number(r.amount_paid ?? 0), 0);
    const balancesDue = active.reduce((n, r) => n + Number(r.balance_due ?? 0), 0);
    const completedRevenue = completed.reduce((n, r) => n + Number(r.amount_paid ?? 0), 0);
    const pendingRevenue = pending.reduce((n, r) => n + Number(r.amount_paid ?? 0), 0);
    const avgFare = completed.length
      ? completed.reduce((n, r) => n + Number(r.total ?? 0), 0) / completed.length
      : 0;

    return {
      totalPaidToday,
      deposits,
      balancesDue,
      completedRevenue,
      pendingRevenue,
      completedCount: completed.length,
      avgFare,
    };
  });

/** Current driver availability. */
export const getAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("availability_status")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

/** Create a driver availability window (personal time block or status change). */
export const setAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      status: z.enum(["available", "busy", "vacation", "offline", "not_accepting"]),
      startsAt: z.string(),
      endsAt: z.string(),
      customerMessage: z.string().max(500).optional().nullable(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Mark previous windows non-current
    await supabaseAdmin
      .from("availability_status")
      .update({ is_current: false })
      .eq("is_current", true);
    const { error } = await supabaseAdmin.from("availability_status").insert({
      status: data.status,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      customer_message: data.customerMessage ?? null,
      is_current: true,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove an availability window (unblock time). */
export const deleteAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("availability_status")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Fetch trip status history for a booking. */
export const getStatusHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ bookingId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("trip_status_history")
      .select("status, changed_at")
      .eq("booking_id", data.bookingId)
      .order("changed_at", { ascending: true });
    return rows ?? [];
  });
