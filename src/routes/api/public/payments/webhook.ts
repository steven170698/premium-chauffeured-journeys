import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, type StripeEnv } from "@/lib/stripe.server";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          if (
            event.type === "checkout.session.completed" ||
            event.type === "transaction.completed"
          ) {
            const session = event.data.object as {
              id?: string;
              payment_intent?: string | null;
              amount_total?: number | null;
              metadata?: { booking_id?: string; balance_payment?: string } | null;
            };
            const bookingId = session.metadata?.booking_id;
            const isBalancePayment = session.metadata?.balance_payment === "true";
            if (!bookingId) {
              console.warn("webhook: missing booking_id in metadata");
              return Response.json({ received: true });
            }

            // Load current booking to re-check status and expiry.
            const { data: booking } = await supabaseAdmin
              .from("bookings")
              .select(
                "id, trip_status, payment_deadline_at, pickup_at, estimated_end_at, amount_paid, final_fare, total",
              )
              .eq("id", bookingId)
              .maybeSingle();
            if (!booking) {
              console.warn("webhook: booking not found", bookingId);
              return Response.json({ received: true });
            }


            const paid = (session.amount_total ?? 0) / 100;
            const stripePi =
              typeof session.payment_intent === "string" ? session.payment_intent : null;

            // Only confirm if the booking is still awaiting payment and not past its deadline.
            const stillAwaiting = booking.trip_status === "awaiting_payment";
            const withinWindow =
              !booking.payment_deadline_at ||
              new Date(booking.payment_deadline_at) >= new Date();

            if (stillAwaiting && withinWindow) {
              const { error } = await supabaseAdmin
                .from("bookings")
                .update({
                  payment_status: "paid",
                  amount_paid: paid,
                  balance_due: 0,
                  stripe_payment_intent: stripePi,
                  trip_status: "confirmed",
                })
                .eq("id", bookingId)
                .eq("trip_status", "awaiting_payment");
              if (error) {
                // e.g. overlap trigger blocked (someone took the slot). Refund.
                console.error("webhook confirm failed:", error);
              }
            } else {
              // Payment landed after we already expired/declined the booking.
              // Record the payment so admin can refund from the dashboard.
              await supabaseAdmin
                .from("bookings")
                .update({
                  payment_status: "paid",
                  amount_paid: paid,
                  stripe_payment_intent: stripePi,
                })
                .eq("id", bookingId);
              console.warn(
                "webhook: payment received for stale booking, needs refund",
                bookingId,
                booking.trip_status,
              );
            }
          } else if (event.type === "transaction.payment_failed") {
            // Nothing to do — booking stays in awaiting_payment until customer
            // retries or the payment deadline expires it.
          }

          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
