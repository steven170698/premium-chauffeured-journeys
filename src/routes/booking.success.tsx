import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ArrowRight, Loader2, Clock } from "lucide-react";
import { getBookingStatus } from "@/lib/booking-status.functions";

export const Route = createFileRoute("/booking/success")({
  head: () => ({
    meta: [
      { title: "Booking Confirmed — Stevie Services LLC" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string; booking_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
    booking_id: typeof search.booking_id === "string" ? search.booking_id : undefined,
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const { booking_id } = Route.useSearch();

  const { data, isLoading } = useQuery({
    enabled: Boolean(booking_id),
    queryKey: ["booking-status", booking_id],
    queryFn: async () => {
      if (!booking_id) return null;
      return getBookingStatus({ data: { bookingId: booking_id } });
    },
    // Poll every 1.5s until payment_status is paid (webhook reconciled)
    refetchInterval: (q) => {
      const d = q.state.data as { booking?: { payment_status?: string } } | null | undefined;
      if (d?.booking?.payment_status === "paid") return false;
      return 1500;
    },
    refetchIntervalInBackground: false,
  });

  const booking =
    data && "booking" in data && data.booking ? data.booking : null;
  const paid = booking?.payment_status === "paid";
  const pendingApproval = booking?.trip_status === "pending_approval";

  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold/10 text-gold ring-1 ring-gold/30">
        {paid ? (
          <CheckCircle2 className="h-8 w-8" />
        ) : (
          <Loader2 className="h-8 w-8 animate-spin" />
        )}
      </div>
      <h1 className="mt-8 font-display text-4xl font-semibold sm:text-5xl">
        {paid ? (
          <>
            Payment <span className="text-gold-gradient">received</span>
          </>
        ) : (
          <>
            Finalizing your <span className="text-gold-gradient">booking</span>
          </>
        )}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-muted-foreground">
        {isLoading || (!paid && !booking)
          ? "Verifying your payment — this only takes a moment."
          : paid && pendingApproval
            ? "Payment received. Your ride is pending owner approval — you'll get a confirmation email once it's approved."
            : paid
              ? "Your ride is confirmed. A receipt has been sent to your email. We'll be in touch shortly with driver details."
              : "Payment is processing. Keep this page open — it will update automatically."}
      </p>
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
