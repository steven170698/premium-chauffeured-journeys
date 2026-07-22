import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, ArrowRight, Loader2, Clock, Info, CreditCard, X } from "lucide-react";
import { toast } from "sonner";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getBookingStatus } from "@/lib/booking-status.functions";
import { startGuestBookingPayment } from "@/lib/payment.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/booking/success")({
  head: () => ({
    meta: [
      { title: "Booking Received — Stevie Services LLC" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { session_id?: string; booking_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
    booking_id: typeof search.booking_id === "string" ? search.booking_id : undefined,
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const { booking_id, session_id } = Route.useSearch();
  const cameFromStripe = Boolean(session_id);

  const { data, isLoading } = useQuery({
    enabled: Boolean(booking_id),
    queryKey: ["booking-status", booking_id],
    queryFn: async () => {
      if (!booking_id) return null;
      return getBookingStatus({ data: { bookingId: booking_id } });
    },
    // Poll only if we came back from Stripe (waiting on webhook).
    refetchInterval: (q) => {
      if (!cameFromStripe) return false;
      const d = q.state.data as { booking?: { trip_status?: string } } | null | undefined;
      if (d?.booking?.trip_status === "confirmed") return false;
      return 1500;
    },
    refetchIntervalInBackground: false,
  });

  const booking = data && "booking" in data && data.booking ? data.booking : null;
  const status = booking?.trip_status;

  let title = "Request received";
  let body =
    "Thanks — your ride request is in. We'll review it shortly and email you a secure payment link once it's approved. No charge has been made.";
  let icon = <Info className="h-8 w-8" />;

  if (isLoading || (!booking && cameFromStripe)) {
    icon = <Loader2 className="h-8 w-8 animate-spin" />;
    title = "Finalizing your booking";
    body = "Verifying your payment — this only takes a moment.";
  } else if (status === "confirmed") {
    icon = <CheckCircle2 className="h-8 w-8" />;
    title = "Ride confirmed";
    body =
      "Payment received and your ride is confirmed. A receipt has been sent to your email.";
  } else if (status === "awaiting_payment") {
    icon = <Info className="h-8 w-8" />;
    title = "Approved — pay to confirm";
    body =
      "Your ride has been approved. Pay securely below to lock in your reservation — no account or login needed.";
  } else if (status === "declined") {
    title = "Request declined";
    body = "Unfortunately the driver isn't able to take this ride. No charge was made.";
  } else if (status === "payment_expired") {
    title = "Payment window expired";
    body =
      "The secure payment window expired before this booking was paid. You can submit a new request anytime.";
  } else if (status === "pending_approval") {
    title = "Awaiting driver approval";
    body =
      "Your request is with the driver. We'll email you a secure payment link once it's approved. No charge yet.";
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold/10 text-gold ring-1 ring-gold/30">
        {icon}
      </div>
      <h1 className="mt-8 font-display text-4xl font-semibold sm:text-5xl">
        <span className="text-gold-gradient">{title}</span>
      </h1>
      <p className="mx-auto mt-4 max-w-md text-muted-foreground">{body}</p>
      {booking && (
        <div className="mx-auto mt-5 flex flex-col items-center gap-1 text-xs uppercase tracking-[0.28em] text-muted-foreground/80">
          <span>Reservation · {booking.reservation_number}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(booking.pickup_at).toLocaleString()}
          </span>
        </div>
      )}
      {booking && status === "awaiting_payment" && (
        <GuestPayNow
          bookingId={booking.id}
          total={Number(booking.total)}
          deadlineAt={booking.payment_deadline_at}
        />
      )}
      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-border/60 px-6 py-3 text-sm text-foreground hover:border-gold/50"
        >
          Back to home
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function GuestPayNow({
  bookingId,
  total,
  deadlineAt,
}: {
  bookingId: string;
  total: number;
  deadlineAt?: string | null;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const start = async () => {
    setLoading(true);
    try {
      const res = await startGuestBookingPayment({
        data: {
          bookingId,
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/booking/success?booking_id=${bookingId}&session_id={CHECKOUT_SESSION_ID}`,
        },
      });
      if ("error" in res) throw new Error(res.error);
      if (!res.clientSecret) throw new Error("Could not start payment.");
      setClientSecret(res.clientSecret);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mx-auto mt-8 w-full max-w-sm rounded-2xl border border-gold/40 bg-gold/5 p-5">
      <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Amount due</div>
      <div className="mt-1 font-display text-3xl font-semibold">${total.toFixed(2)}</div>
      {deadlineAt && (
        <div className="mt-2 text-xs text-muted-foreground">
          Pay by {new Date(deadlineAt).toLocaleString()}
        </div>
      )}
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold-glow disabled:opacity-50"
      >
        <CreditCard className="h-4 w-4" /> {loading ? "Loading…" : "Pay now — secure checkout"}
      </button>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Secure payment by Stripe. No account needed.
      </p>
      {clientSecret && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4">
          <div className="relative mt-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-gold/30 bg-card shadow-elegant">
            <button
              type="button"
              onClick={() => setClientSecret(null)}
              className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
              aria-label="Close checkout"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="p-2 sm:p-4">
              <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
