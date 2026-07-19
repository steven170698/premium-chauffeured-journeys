import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MapPin, Clock, Gift, Star, Sparkles, Plus, Copy, CreditCard, X } from "lucide-react";
import { toast } from "sonner";
import { submitReview } from "@/lib/reviews.functions";
import { startBookingPayment } from "@/lib/payment.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "My Dashboard — Stevie Services" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useRouteContext();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["my-bookings", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .order("pickup_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: loyalty } = useQuery({
    queryKey: ["loyalty", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("loyalty_accounts").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: referral } = useQuery({
    queryKey: ["referral", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("referrals").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["roles", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return data ?? [];
    },
  });

  const isAdmin = roles?.some((r) => r.role === "admin");
  const now = new Date();
  const terminal = new Set(["completed", "canceled", "declined", "payment_expired"]);
  const upcoming = (bookings ?? []).filter((b) => new Date(b.pickup_at) >= now && !terminal.has(b.trip_status));
  const past = (bookings ?? []).filter((b) => terminal.has(b.trip_status));
  const referralLink = referral ? `${typeof window !== "undefined" ? window.location.origin : ""}/book?ref=${referral.referral_code}` : "";

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-gold">My Dashboard</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link to="/admin" className="rounded-full border border-gold/40 bg-gold/10 px-5 py-2.5 text-sm font-semibold text-gold hover:bg-gold/20">
              Admin dashboard
            </Link>
          )}
          <Link to="/book" className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 text-sm font-semibold text-gold-foreground shadow-gold-glow">
            <Plus className="h-4 w-4" /> Book a ride
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Calendar className="h-5 w-5 text-gold" />} label="Upcoming" value={upcoming.length.toString()} />
        <StatCard icon={<Clock className="h-5 w-5 text-gold" />} label="Completed rides" value={(loyalty?.completed_rides ?? 0).toString()} />
        <StatCard icon={<Sparkles className="h-5 w-5 text-gold" />} label="Loyalty tier" value={profile?.loyalty_tier ?? "standard"} />
        <StatCard icon={<Gift className="h-5 w-5 text-gold" />} label="Referrals" value={(referral?.successful_referrals ?? 0).toString()} />
      </div>

      <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="Upcoming rides">
            {upcoming.length === 0 ? (
              <EmptyState label="No upcoming rides yet." cta />
            ) : (
              <div className="space-y-3">
                {upcoming.map((b) => <BookingRow key={b.id} b={b} />)}
              </div>
            )}
          </Card>

          <Card title="Ride history">
            {past.length === 0 ? (
              <EmptyState label="Your completed rides will appear here." />
            ) : (
              <div className="space-y-3">
                {past.slice(0, 10).map((b) => <BookingRow key={b.id} b={b} />)}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Refer a friend" accent>
            <p className="text-sm text-muted-foreground">
              Share your link. When they complete a qualifying ride, you both earn a reward.
            </p>
            <div className="mt-3 rounded-xl border border-gold/30 bg-gold/5 p-3 text-xs font-mono break-all">
              {referralLink}
            </div>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(referralLink); toast.success("Copied!"); }}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-gold-gradient px-4 py-2 text-xs font-semibold text-gold-foreground"
            >
              <Copy className="h-3 w-3" /> Copy link
            </button>
            <div className="mt-4 text-xs text-muted-foreground">
              Successful referrals: <span className="text-foreground font-semibold">{referral?.successful_referrals ?? 0}</span>
            </div>
          </Card>

          <Card title="Loyalty progress" accent>
            <div className="text-sm text-muted-foreground">
              {loyalty?.completed_rides ?? 0} completed rides
            </div>
            <div className="mt-3 h-2 rounded-full bg-secondary">
              <div className="h-full rounded-full bg-gold-gradient" style={{ width: `${Math.min(100, ((loyalty?.completed_rides ?? 0) / 20) * 100)}%` }} />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {(loyalty?.completed_rides ?? 0) < 5 && `${5 - (loyalty?.completed_rides ?? 0)} more rides until 5% off`}
              {(loyalty?.completed_rides ?? 0) >= 5 && (loyalty?.completed_rides ?? 0) < 10 && `${10 - (loyalty?.completed_rides ?? 0)} more until 10% off`}
              {(loyalty?.completed_rides ?? 0) >= 10 && (loyalty?.completed_rides ?? 0) < 20 && `${20 - (loyalty?.completed_rides ?? 0)} more until VIP`}
              {(loyalty?.completed_rides ?? 0) >= 20 && "🏆 You're a VIP customer"}
            </div>
          </Card>
        </aside>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold capitalize">{value}</div>
    </div>
  );
}
function Card({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-3xl border ${accent ? "border-gold/30 bg-card" : "border-border/60 bg-card/60"} p-6`}>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}
function EmptyState({ label, cta }: { label: string; cta?: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-secondary/30 p-8 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      {cta && (
        <Link to="/book" className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2 text-xs font-semibold text-gold-foreground">
          <Plus className="h-3 w-3" /> Book your first ride
        </Link>
      )}
    </div>
  );
}
function BookingRow({ b }: { b: any }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">{b.reservation_number}</div>
          <div className="mt-1 flex items-center gap-2 text-sm"><MapPin className="h-3 w-3 text-gold" />{b.pickup_address}</div>
          <div className="mt-1 flex items-center gap-2 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{b.destination_address}</div>
          <div className="mt-2 text-xs text-muted-foreground">{new Date(b.pickup_at).toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="rounded-full bg-gold/10 px-3 py-1 text-[10px] uppercase tracking-widest text-gold border border-gold/30">
            {b.trip_status.replace(/_/g, " ")}
          </div>
          <div className="mt-2 font-display text-lg font-semibold">${Number(b.total).toFixed(2)}</div>
        </div>
      </div>
      {b.trip_status === "awaiting_payment" && <PayNow bookingId={b.id} deadlineAt={b.payment_deadline_at} />}
      {b.trip_status === "completed" && <ReviewPrompt bookingId={b.id} />}
    </div>
  );
}

function PayNow({ bookingId, deadlineAt }: { bookingId: string; deadlineAt?: string | null }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const start = async () => {
    setLoading(true);
    try {
      const res = await startBookingPayment({
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
    <div className="mt-3 rounded-xl border border-gold/40 bg-gold/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Approved — pay now to confirm.
          {deadlineAt && (
            <> Payment window ends{" "}
              <span className="text-foreground">{new Date(deadlineAt).toLocaleString()}</span>.
            </>
          )}
        </div>
        <button
          type="button"
          onClick={start}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold-gradient px-4 py-1.5 text-xs font-semibold text-gold-foreground shadow-gold-glow disabled:opacity-50"
        >
          <CreditCard className="h-3 w-3" /> {loading ? "Loading…" : "Pay now"}
        </button>
      </div>
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

function ReviewPrompt({ bookingId }: { bookingId: string }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const mut = useMutation({
    mutationFn: () => submitReview({ data: { bookingId, rating, comment: comment || null } }),
    onSuccess: () => {
      toast.success("Thanks for the review — it will appear once approved.");
      setOpen(false);
      setRating(0);
      setComment("");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold/40 px-3 py-1 text-[11px] uppercase tracking-widest text-gold hover:bg-gold/10"
      >
        <Star className="h-3 w-3" /> Leave a review
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-xl border border-gold/30 bg-card p-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`p-1 ${n <= rating ? "text-gold" : "text-muted-foreground/40"}`}
          >
            <Star className={`h-5 w-5 ${n <= rating ? "fill-current" : ""}`} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="How was your ride? (optional)"
        className="mt-2 w-full rounded-lg border border-border/60 bg-background p-2 text-sm outline-none focus:border-gold/60"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
        <button
          type="button"
          disabled={rating === 0 || mut.isPending}
          onClick={() => mut.mutate()}
          className="rounded-full bg-gold-gradient px-4 py-1.5 text-xs font-semibold text-gold-foreground disabled:opacity-50"
        >
          {mut.isPending ? "Sending…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
