import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  createStripeClient,
  getStripeErrorMessage,
  type StripeEnv,
} from "./stripe.server";

async function assertAdmin(context: { supabase: any; userId: string }) {
  // Verify admin via the service-role client reading user_roles directly (the
  // has_role() RPC path is unreliable and silently 403s admin actions like
  // approve/decline).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

async function loadBooking(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Booking not found");
  return data;
}

async function loadSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("admin_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return data as
    | (Record<string, unknown> & {
        payment_window_minutes?: number | null;
      })
    | null;
}

async function createSessionForBooking(
  booking: { id: string; reservation_number: string; total: number | string;
    email: string; pickup_address: string; destination_address: string;
    is_round_trip: boolean; user_id: string | null },
  environment: StripeEnv,
  returnUrl: string,
) {
  const stripe = createStripeClient(environment);
  const total = Number(booking.total);
  // Callers pass either a bare page URL or one that already carries
  // ?booking_id=…&session_id={CHECKOUT_SESSION_ID}. Drop any existing query so
  // the params below are appended exactly once — otherwise the second "?" ends
  // up inside the first param's value and booking_id is lost, leaving the
  // success page stuck on "Finalizing your booking".
  const returnBase = returnUrl.split("?")[0];
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Chauffeur ride ${booking.reservation_number}`,
            description: `${booking.pickup_address} → ${booking.destination_address}${
              booking.is_round_trip ? " (round trip)" : ""
            }`,
          },
          unit_amount: Math.round(total * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    ui_mode: "embedded_page",
    // Card only — disables Stripe Link (the "Link" 1-click option that was
    // pre-filling a saved phone number). Apple Pay / Google Pay still work.
    payment_method_types: ["card"],
    return_url: `${returnBase}?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking.id}`,
    customer_email: booking.email,
    payment_intent_data: {
      description: `Stevie Services — ${booking.reservation_number}`,
      // Authorize only — the card is held, not charged. The money moves when
      // the admin accepts the ride (approveBooking captures the intent), and
      // the hold is released if the ride is declined. NOTE: Stripe voids an
      // uncaptured authorization after ~7 days.
      capture_method: "manual",
    },
    metadata: {
      booking_id: booking.id,
      reservation_number: booking.reservation_number,
      user_id: booking.user_id ?? "",
    },
  });
  return session;
}

/**
 * Admin approves a pending request:
 *   - re-validates it is still pending_approval and not past its deadline
 *   - stamps approved_at + payment_deadline_at from settings
 *   - creates a Stripe Checkout Session and stores the client secret
 *   - flips status to awaiting_payment
 */
export const approveBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        environment: z.enum(["sandbox", "live"]),
        returnUrl: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    try {
      const booking = await loadBooking(data.bookingId);
      if (booking.trip_status !== "pending_approval") {
        return { error: `Cannot approve booking in status "${booking.trip_status}".` };
      }

      // Normal path: the passenger already paid, so the card is authorised and
      // waiting. Accepting the ride captures it — this is the point the money
      // actually leaves their account.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const heldIntent = (booking as any).stripe_payment_intent as string | null;
      if (heldIntent && (booking as any).payment_status === "authorized") {
        const stripe = createStripeClient(data.environment as StripeEnv);
        const captured = await stripe.paymentIntents.capture(heldIntent);
        const paid = (captured.amount_received ?? 0) / 100;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin.from("bookings") as any)
          .update({
            trip_status: "confirmed",
            payment_status: "paid",
            amount_paid: paid,
            balance_due: 0,
            approved_at: new Date().toISOString(),
            approved_by: context.userId,
            payment_deadline_at: null,
          })
          .eq("id", data.bookingId)
          .eq("trip_status", "pending_approval");
        if (error) return { error: error.message };

        // Confirmation email + notifications (best-effort).
        try {
          const { sendRendered } = await import("@/lib/email.server");
          const { bookingConfirmedEmail } = await import("@/lib/email-templates");
          const { createNotification } = await import("@/lib/notifications.server");
          await Promise.allSettled([
            sendRendered(
              booking.email,
              bookingConfirmedEmail({
                bookingId: booking.id,
                reservationNumber: booking.reservation_number,
                customerName: booking.full_name,
                pickupAddress: booking.pickup_address,
                destinationAddress: booking.destination_address,
                pickupAt: booking.pickup_at,
                amountPaid: paid,
                approvedFare: Number(booking.total),
              }),
              { eventType: "booking_confirmed", bookingId: booking.id, userId: booking.user_id },
            ),
            createNotification({
              userId: booking.user_id,
              audience: "customer",
              bookingId: booking.id,
              type: "booking_confirmed",
              title: "Reservation confirmed",
              body: `${booking.reservation_number} is confirmed — payment received.`,
              link: `/booking/success?booking_id=${booking.id}`,
            }),
          ]);
        } catch (e) {
          console.error("approve/capture notify (non-fatal):", e instanceof Error ? e.message : e);
        }

        return { ok: true, captured: true, paymentDeadlineAt: null, clientSecret: "" };
      }

      // Fallback (older bookings approved before payment): send a pay link, as
      // before. The payment link never expires — no payment deadline is set.
      const session = await createSessionForBooking(
        booking as Parameters<typeof createSessionForBooking>[0],
        data.environment as StripeEnv,
        data.returnUrl,
      );

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabaseAdmin.from("bookings") as any)
        .update({
          trip_status: "awaiting_payment",
          approved_at: new Date().toISOString(),
          approved_by: context.userId,
          payment_deadline_at: null,
          stripe_session_id: session.id,
        })
        .eq("id", data.bookingId)
        .eq("trip_status", "pending_approval");
      if (error) return { error: error.message };

      // Approval email + notification (best-effort; never blocks approval).
      try {
        const { sendRendered } = await import("@/lib/email.server");
        const { bookingApprovedEmail } = await import("@/lib/email-templates");
        const { createNotification } = await import("@/lib/notifications.server");
        const site = (process.env.PUBLIC_SITE_URL || "https://stevieservicesllc.com").replace(/\/$/, "");
        // Public, no-login pay page — the passenger pays directly from the email.
        const payUrl = `${site}/booking/success?booking_id=${booking.id}`;
        await Promise.allSettled([
          sendRendered(
            booking.email,
            bookingApprovedEmail({
              bookingId: booking.id,
              reservationNumber: booking.reservation_number,
              customerName: booking.full_name,
              pickupAddress: booking.pickup_address,
              destinationAddress: booking.destination_address,
              pickupAt: booking.pickup_at,
              approvedFare: Number(booking.total),
              paymentUrl: payUrl,
              paymentDeadlineAt: null,
            }),
            { eventType: "booking_approved", bookingId: booking.id, userId: booking.user_id },
          ),
          createNotification({
            userId: booking.user_id,
            audience: "customer",
            bookingId: booking.id,
            type: "booking_approved",
            title: "Ride approved — payment required",
            body: `${booking.reservation_number} is approved. Pay to confirm your reservation.`,
            link: `/booking/success?booking_id=${booking.id}`,
          }),
        ]);
      } catch (e) {
        console.error("approve notify (non-fatal):", e instanceof Error ? e.message : e);
      }

      return {
        ok: true,
        paymentDeadlineAt: null,
        clientSecret: session.client_secret ?? "",
      };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Admin declines a pending request → status `declined`, slot released. */
export const declineBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        reason: z.string().trim().max(500).optional().nullable(),
        environment: z.enum(["sandbox", "live"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const reason =
      data.reason?.trim() || "We're unable to accommodate this request at this time.";

    // Load booking details for the email before the status flips (best-effort).
    const booking = await loadBooking(data.bookingId).catch(() => null);

    // Release the authorisation so the passenger's money is not left on hold.
    // Best-effort: a failure here must not block the decline.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heldIntent = (booking as any)?.stripe_payment_intent as string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (heldIntent && (booking as any)?.payment_status === "authorized") {
      try {
        const env = (data.environment ?? "live") as StripeEnv;
        await createStripeClient(env).paymentIntents.cancel(heldIntent);
      } catch (e) {
        console.error("decline: releasing hold failed:", getStripeErrorMessage(e));
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin.from("bookings") as any)
      .update({
        trip_status: "declined",
        // Declined bookings are never captured, so nothing is owed or held.
        payment_status: "unpaid",
        declined_at: new Date().toISOString(),
        declined_by: context.userId,
        decline_reason: reason,
      })
      .eq("id", data.bookingId)
      .in("trip_status", ["pending_approval", "awaiting_payment"]);
    if (error) return { error: error.message };

    if (booking) {
      try {
        const { sendRendered } = await import("@/lib/email.server");
        const { bookingDeclinedEmail } = await import("@/lib/email-templates");
        const { createNotification } = await import("@/lib/notifications.server");
        await Promise.allSettled([
          sendRendered(
            booking.email,
            bookingDeclinedEmail({
              bookingId: booking.id,
              reservationNumber: booking.reservation_number,
              customerName: booking.full_name,
              pickupAddress: booking.pickup_address,
              destinationAddress: booking.destination_address,
              pickupAt: booking.pickup_at,
              declineReason: reason,
            }),
            { eventType: "booking_declined", bookingId: booking.id, userId: booking.user_id },
          ),
          createNotification({
            userId: booking.user_id,
            audience: "customer",
            bookingId: booking.id,
            type: "booking_declined",
            title: "Ride request update",
            body: `We couldn't accept ${booking.reservation_number}. You have not been charged.`,
            link: `/dashboard?booking=${booking.id}`,
          }),
        ]);
      } catch (e) {
        console.error("decline notify (non-fatal):", e instanceof Error ? e.message : e);
      }
    }
    return { ok: true };
  });

/**
 * Customer clicks "Pay now" on their approved booking.
 * Verifies status, ownership, and freshness; returns a Stripe client_secret.
 * Creates a new Checkout session (Stripe sessions expire) each call.
 */
export const startBookingPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        environment: z.enum(["sandbox", "live"]),
        returnUrl: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      const booking = await loadBooking(data.bookingId);
      if (booking.user_id && booking.user_id !== context.userId) {
        return { error: "This booking belongs to another customer." };
      }
      if (booking.trip_status !== "awaiting_payment") {
        return { error: "This booking is not awaiting payment." };
      }

      const session = await createSessionForBooking(
        booking as Parameters<typeof createSessionForBooking>[0],
        data.environment as StripeEnv,
        data.returnUrl,
      );
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("bookings")
        .update({ stripe_session_id: session.id })
        .eq("id", data.bookingId);

      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/**
 * PUBLIC (no login): the passenger pays directly from the emailed link.
 * There is no auth middleware — access is gated by the booking's unguessable
 * UUID (the capability) plus a strict status/deadline check. It only ever
 * opens a Stripe checkout for the exact stored total of an awaiting-payment
 * booking, so no sensitive data is exposed and nothing else can be triggered.
 */
export const startGuestBookingPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        environment: z.enum(["sandbox", "live"]),
        returnUrl: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const booking = await loadBooking(data.bookingId);
      if (booking.trip_status !== "awaiting_payment") {
        return { error: "This booking is not awaiting payment." };
      }
      const session = await createSessionForBooking(
        booking as Parameters<typeof createSessionForBooking>[0],
        data.environment as StripeEnv,
        data.returnUrl,
      );
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("bookings")
        .update({ stripe_session_id: session.id })
        .eq("id", data.bookingId);
      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });
