import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Calendar, CheckCircle2, Clock } from "lucide-react";
import { getAdminStats } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Overview — Stevie Services" }] }),
  component: AdminHome,
});

function AdminHome() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getAdminStats(),
    refetchInterval: 30_000,
  });

  const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-lg font-semibold">Revenue</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={<DollarSign className="h-5 w-5 text-gold" />} label="Today" value={money(data?.revenue.today ?? 0)} />
          <Stat icon={<DollarSign className="h-5 w-5 text-gold" />} label="Last 7 days" value={money(data?.revenue.week ?? 0)} />
          <Stat icon={<DollarSign className="h-5 w-5 text-gold" />} label="This month" value={money(data?.revenue.month ?? 0)} />
          <Stat icon={<DollarSign className="h-5 w-5 text-gold" />} label="All time" value={money(data?.revenue.allTime ?? 0)} />
        </div>
      </section>
      <section>
        <h2 className="font-display text-lg font-semibold">Bookings</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={<Clock className="h-5 w-5 text-gold" />} label="Awaiting approval" value={String(data?.counts.pending ?? 0)} />
          <Stat icon={<Calendar className="h-5 w-5 text-gold" />} label="Upcoming" value={String(data?.counts.upcoming ?? 0)} />
          <Stat icon={<CheckCircle2 className="h-5 w-5 text-gold" />} label="Completed" value={String(data?.counts.completed ?? 0)} />
          <Stat icon={<CheckCircle2 className="h-5 w-5 text-gold" />} label="Total rides" value={String(data?.counts.totalRides ?? 0)} />
        </div>
      </section>
      <section className="rounded-3xl border border-gold/30 bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">Manage bookings</h3>
            <p className="text-sm text-muted-foreground">Approve, dispatch, and complete rides.</p>
          </div>
          <Link
            to="/admin/bookings"
            className="rounded-full bg-gold-gradient px-5 py-2 text-sm font-semibold text-gold-foreground shadow-gold-glow"
          >
            Open bookings
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}
