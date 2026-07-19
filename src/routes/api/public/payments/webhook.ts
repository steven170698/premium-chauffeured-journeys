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
              currency?: string | null;
              metadata?: { booking_id?: string } | null;
            };
            const bookingId = session.metadata?.booking_id;
            if (bookingId) {
              const paid = (session.amount_total ?? 0) / 100;
              await supabaseAdmin
                .from("bookings")
                .update({
                  payment_status: "paid",
                  trip_status: "confirmed",
                  amount_paid: paid,
                  balance_due: 0,
                  stripe_payment_intent:
                    typeof session.payment_intent === "string" ? session.payment_intent : null,
                })
                .eq("id", bookingId);
            } else {
              console.warn("checkout.session.completed with no booking_id");
            }
          } else if (event.type === "transaction.payment_failed") {
            const session = event.data.object as {
              metadata?: { booking_id?: string } | null;
            };
            const bookingId = session.metadata?.booking_id;
            if (bookingId) {
              await supabaseAdmin
                .from("bookings")
                .update({ trip_status: "canceled" })
                .eq("id", bookingId);
            }
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
