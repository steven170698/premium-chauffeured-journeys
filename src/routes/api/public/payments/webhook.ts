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
              metadata?: { booking_id?: string; user_id?: string } | null;
            };
            const bookingId = session.metadata?.booking_id;
            if (bookingId) {
              // Read approval mode from admin_settings; only auto-confirm when
              // require_approval is off. Manual-approval mode leaves the trip
              // in pending_approval and admin confirms from the dashboard.
              const { data: settings } = await supabaseAdmin
                .from("admin_settings")
                .select("require_approval")
                .eq("id", 1)
                .maybeSingle();
              const requireApproval = Boolean(settings?.require_approval);

              const paid = (session.amount_total ?? 0) / 100;
              const stripePi =
                typeof session.payment_intent === "string" ? session.payment_intent : null;
              if (requireApproval) {
                await supabaseAdmin
                  .from("bookings")
                  .update({
                    payment_status: "paid",
                    amount_paid: paid,
                    balance_due: 0,
                    stripe_payment_intent: stripePi,
                  })
                  .eq("id", bookingId);
              } else {
                await supabaseAdmin
                  .from("bookings")
                  .update({
                    payment_status: "paid",
                    amount_paid: paid,
                    balance_due: 0,
                    stripe_payment_intent: stripePi,
                    trip_status: "confirmed",
                  })
                  .eq("id", bookingId);
              }
            } else {
              console.warn("checkout.session.completed with no booking_id");
            }
          } else if (event.type === "transaction.payment_failed") {
            const session = event.data.object as {
              metadata?: { booking_id?: string } | null;
            };
            const bookingId = session.metadata?.booking_id;
            if (bookingId) {
              // No dedicated 'failed' payment_status enum value — leave as
              // unpaid and cancel the trip so the slot frees up.
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
