import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isAdmin } from "./authz";

/** Public — approved reviews for the homepage. */
export const listApprovedReviews = createServerFn({ method: "GET" })
  .handler(async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return [];
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
    const { data } = await client
      .from("customer_reviews")
      .select("id, rating, comment, created_at, admin_response")
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(9);
    return (data ?? []) as Array<{
      id: string;
      rating: number;
      comment: string | null;
      created_at: string;
      admin_response: string | null;
    }>;
  });

/** Customer submits a review for a completed ride they own. */
export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(2000).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Verify caller owns the booking & it's completed
    const { data: booking, error: bErr } = await context.supabase
      .from("bookings")
      .select("id, user_id, trip_status")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (bErr || !booking) throw new Error("Booking not found");
    if (booking.user_id !== context.userId) throw new Error("Forbidden");
    if (booking.trip_status !== "completed") {
      throw new Error("You can only review completed rides.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("customer_reviews")
      .upsert(
        {
          user_id: context.userId,
          booking_id: data.bookingId,
          rating: data.rating,
          comment: data.comment ?? null,
          is_approved: false,
        },
        { onConflict: "booking_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin lists all reviews (pending + approved) for moderation. */
export const listAdminReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("customer_reviews")
      .select("id, rating, comment, is_approved, admin_response, created_at, user_id, booking_id")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

/** Admin approves / unapproves / responds to a review. */
export const moderateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        reviewId: z.string().uuid(),
        isApproved: z.boolean().optional(),
        adminResponse: z.string().max(2000).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {};
    if (typeof data.isApproved === "boolean") patch.is_approved = data.isApproved;
    if (data.adminResponse !== undefined) patch.admin_response = data.adminResponse;
    const { error } = await supabaseAdmin
      .from("customer_reviews")
      .update(patch as never)
      .eq("id", data.reviewId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
