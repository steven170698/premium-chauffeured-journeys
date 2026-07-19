import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";

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
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold/10 text-gold ring-1 ring-gold/30">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h1 className="mt-8 font-display text-4xl font-semibold sm:text-5xl">
        Payment <span className="text-gold-gradient">received</span>
      </h1>
      <p className="mx-auto mt-4 max-w-md text-muted-foreground">
        Your ride is confirmed. A receipt has been sent to your email. We'll be in touch shortly
        with driver details.
      </p>
      {booking_id && (
        <p className="mt-3 text-xs uppercase tracking-[0.28em] text-muted-foreground/80">
          Booking ID · {booking_id.slice(0, 8)}
        </p>
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
