import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(context: { supabase: any; userId: string }) {
  // Verify the admin role with the service-role client reading user_roles
  // directly. The has_role() RPC path is unreliable — Lovable's security pass
  // can revoke/relocate the function, which then silently 403s every admin
  // action (bookings list, approve/decline, driver, etc.).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden");
}

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

/** Extended overview KPIs used by the Admin dashboard home page. */
export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("mark_abandoned_bookings" as never);

    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);
    const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startPrevWeek = new Date(startOfWeek); startPrevWeek.setDate(startPrevWeek.getDate() - 7);
    const startPrevDay = new Date(startOfDay); startPrevDay.setDate(startPrevDay.getDate() - 1);

    const { data: rev } = await supabaseAdmin
      .from("revenue_records")
      .select("amount, recorded_at");
    const revList = (rev ?? []) as Array<{ amount: number; recorded_at: string }>;
    const between = (from: Date, to: Date) =>
      revList
        .filter((r) => {
          const t = new Date(r.recorded_at);
          return t >= from && t < to;
        })
        .reduce((n, r) => n + Number(r.amount), 0);
    const from = (d: Date) =>
      revList.filter((r) => new Date(r.recorded_at) >= d).reduce((n, r) => n + Number(r.amount), 0);

    const [
      pending,
      awaitingPayment,
      activeTrips,
      upcoming,
      completed,
      cancelledToday,
      unreadSupport,
      customers,
    ] = await Promise.all([
      supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).eq("trip_status", "pending_approval"),
      supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).eq("trip_status", "awaiting_payment"),
      supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).in("trip_status", ["driver_en_route", "driver_arrived", "picked_up"]),
      supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).eq("trip_status", "confirmed").gte("pickup_at", now.toISOString()),
      supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).eq("trip_status", "completed"),
      supabaseAdmin.from("bookings").select("id", { count: "exact", head: true }).in("trip_status", ["canceled", "declined"]).gte("updated_at", startOfDay.toISOString()),
      supabaseAdmin.from("support_requests" as never).select("id", { count: "exact", head: true }).eq("status" as never, "new" as never),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    return {
      revenue: {
        today: from(startOfDay),
        week: from(startOfWeek),
        month: from(startOfMonth),
        allTime: revList.reduce((n, r) => n + Number(r.amount), 0),
        prevDay: between(startPrevDay, startOfDay),
        prevWeek: between(startPrevWeek, startOfWeek),
        prevMonth: between(startPrevMonth, startOfMonth),
      },
      counts: {
        pending: pending.count ?? 0,
        awaitingPayment: awaitingPayment.count ?? 0,
        activeTrips: activeTrips.count ?? 0,
        upcoming: upcoming.count ?? 0,
        completed: completed.count ?? 0,
        cancelledToday: cancelledToday.count ?? 0,
        unreadSupport: unreadSupport.count ?? 0,
        totalCustomers: customers.count ?? 0,
        totalRides: revList.length,
      },
    };
  });

/** Today's pickups + currently active trip for the operations panel. */
export const listTodayOperations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);

    const { data: today } = await supabaseAdmin
      .from("bookings")
      .select("id, reservation_number, full_name, phone, pickup_address, destination_address, pickup_at, trip_status, payment_status, total")
      .gte("pickup_at", startOfDay.toISOString())
      .lt("pickup_at", endOfDay.toISOString())
      .not("trip_status", "in", "(canceled,declined,payment_expired)")
      .order("pickup_at", { ascending: true });

    return {
      today: today ?? [],
    };
  });

/** Global admin search across bookings + customers. */
export const globalAdminSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ q: z.string().trim().min(1).max(120) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const term = `%${data.q}%`;

    const [bookings, customers] = await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("id, reservation_number, full_name, email, pickup_at, trip_status, total")
        .or(`reservation_number.ilike.${term},full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
        .order("pickup_at", { ascending: false })
        .limit(15),
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email, phone")
        .or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
        .limit(10),
    ]);

    return {
      bookings: bookings.data ?? [],
      customers: customers.data ?? [],
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
        // Prompt 3 pricing knobs
        minimum_fare: z.number().min(0).optional(),
        night_surcharge_pct: z.number().min(0).max(500).optional(),
        night_start_hour: z.number().int().min(0).max(23).optional(),
        night_end_hour: z.number().int().min(0).max(23).optional(),
        weekend_surcharge_pct: z.number().min(0).max(500).optional(),
        holiday_surcharge_pct: z.number().min(0).max(500).optional(),
        hourly_rate: z.number().min(0).optional(),
        minimum_hourly_hours: z.number().int().min(1).max(24).optional(),
        meet_greet_fee: z.number().min(0).optional(),
        child_seat_fee: z.number().min(0).optional(),
        surcharge_stacking: z.enum(["stack", "highest"]).optional(),
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

/** All pricing holidays for the admin surcharge table (active + inactive). */
export const listPricingHolidays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("pricing_holidays")
      .select("id, name, holiday_date, surcharge_pct, is_active, notes")
      .order("holiday_date", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      name: string;
      holiday_date: string;
      surcharge_pct: number;
      is_active: boolean;
      notes: string | null;
    }>;
  });

/** Add a pricing holiday. */
export const addPricingHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
        surcharge_pct: z.number().min(0).max(500),
        is_active: z.boolean().optional().default(true),
        notes: z.string().trim().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pricing_holidays")
      .insert(data as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Update a pricing holiday (edit fields or toggle active). */
export const updatePricingHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        surcharge_pct: z.number().min(0).max(500).optional(),
        is_active: z.boolean().optional(),
        notes: z.string().trim().max(500).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin
      .from("pricing_holidays")
      .update(patch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete a pricing holiday. */
export const deletePricingHoliday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pricing_holidays")
      .delete()
      .eq("id", data.id);
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
