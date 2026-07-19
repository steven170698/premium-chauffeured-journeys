import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ArrowRight, Loader2, Clock, Info } from "lucide-react";
import { getBookingStatus } from "@/lib/booking-status.functions";

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
    title = "Approved — awaiting payment";
    body =
      "Your ride has been approved. Complete payment from your dashboard to lock in the booking.";
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
      <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold-glow"
        >
          View my rides
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to="/"
          className="rounded-full border border-border/60 px-6 py-3 text-sm text-foreground hover:border-gold/50"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
