import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { assertAdmin } from "./authz";

/** Aggregate revenue + booking stats for /admin index. */
export const getAdminStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Kick off cleanup so the calendar is honest
    await supabaseAdmin.rpc("mark_abandoned_bookings" as never);

    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 6); startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: rev } = await supabaseAdmin
      .from("revenue_records")
      .select("amount, recorded_at");
    const revList = (rev ?? []) as Array<{ amount: number; recorded_at: string }>;
    const sum = (from: Date) =>
      revList
        .filter((r) => new Date(r.recorded_at) >= from)
        .reduce((n, r) => n + Number(r.amount), 0);

    const { count: pendingCount } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("trip_status", "pending_approval")
      .eq("payment_status", "paid");

    const { count: upcomingCount } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("trip_status", ["confirmed", "driver_en_route", "driver_arrived", "picked_up"])
      .gte("pickup_at", now.toISOString());

    const { count: completedCount } = await supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("trip_status", "completed");

    return {
      revenue: {
        today: sum(startOfDay),
        week: sum(startOfWeek),
        month: sum(startOfMonth),
        allTime: revList.reduce((n, r) => n + Number(r.amount), 0),
      },
      counts: {
        pending: pendingCount ?? 0,
        upcoming: upcomingCount ?? 0,
        completed: completedCount ?? 0,
        totalRides: revList.length,
      },
    };
  });

const TRIP_STATUSES = [
  "pending_approval",
  "confirmed",
  "driver_en_route",
  "driver_arrived",
  "picked_up",
  "completed",
  "canceled",
] as const;

/** Full bookings list for admin management. */
export const listAdminBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        status: z.enum(TRIP_STATUSES).optional(),
        search: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(500).optional().default(200),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("bookings")
      .select(
        "id, reservation_number, full_name, email, phone, pickup_address, destination_address, pickup_at, estimated_end_at, trip_status, payment_status, total, amount_paid, is_round_trip, passengers, bags, special_instructions, created_at",
      )
      .order("pickup_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("trip_status", data.status);
    if (data.search) {
      const term = `%${data.search}%`;
      q = q.or(
        `reservation_number.ilike.${term},full_name.ilike.${term},email.ilike.${term}`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

/** Change a booking's trip_status with server-side validation. */
export const updateBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        status: z.enum(TRIP_STATUSES),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ trip_status: data.status })
      .eq("id", data.bookingId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Load current admin_settings (all columns). */
export const getAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("admin_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return data;
  });

/** Update admin_settings (rates, approval mode, discounts, calendar id, etc). */
export const updateAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        base_fare: z.number().min(0).optional(),
        per_mile_rate: z.number().min(0).optional(),
        per_minute_rate: z.number().min(0).optional(),
        booking_fee: z.number().min(0).optional(),
        airport_surcharge: z.number().min(0).optional(),
        stop_fee: z.number().min(0).optional(),
        deposit_percentage: z.number().min(0).max(100).optional(),
        require_approval: z.boolean().optional(),
        approval_deadline_minutes: z.number().int().min(0).optional(),
        auto_decline_on_timeout: z.boolean().optional(),
        payment_window_minutes: z.number().int().min(1).optional(),
        hold_during_approval: z.boolean().optional(),
        auto_confirm_future_bookings: z.boolean().optional(),
        sms_enabled: z.boolean().optional(),
        google_calendar_id: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("admin_settings")
      .update(data as never)
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Confirmed / in-progress bookings for the admin calendar view. */
export const listCalendarBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ start: z.string(), end: z.string() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, reservation_number, full_name, pickup_at, estimated_end_at, trip_status, pickup_address, destination_address",
      )
      .in("trip_status", ["confirmed", "driver_en_route", "driver_arrived", "picked_up", "pending_approval"])
      .gte("pickup_at", data.start)
      .lte("pickup_at", data.end)
      .order("pickup_at", { ascending: true });
    return rows ?? [];
  });
