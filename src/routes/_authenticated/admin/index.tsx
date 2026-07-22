import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign, Calendar, CheckCircle2, Clock, CreditCard, Activity,
  XCircle, LifeBuoy, Users, TrendingUp, TrendingDown, Minus, MapPin,
} from "lucide-react";
import { getAdminOverview, listTodayOperations } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Overview — Stevie Services" }] }),
  component: AdminHome,
});

function AdminHome() {
  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
    refetchInterval: 30_000,
  });
  const { data: ops } = useQuery({
    queryKey: ["admin-today-ops"],
    queryFn: () => listTodayOperations(),
    refetchInterval: 30_000,
  });

  const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;

  const rev = data?.revenue;
  const c = data?.counts;

  return (
    <div className="space-y-8">
      {/* Quick actions */}
      <section className="flex flex-wrap gap-2">
        <QA to="/admin/bookings" search={{ status: "pending_approval" }}>Review pending</QA>
        <QA to="/admin/bookings" search={{ status: "awaiting_payment" }}>Chase payments</QA>
        <QA to="/admin/driver">Open driver dash</QA>
        <QA to="/admin/calendar">Today's schedule</QA>
        <QA to="/admin/settings">Update pricing</QA>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">Revenue</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={<DollarSign className="h-5 w-5 text-gold" />} label="Today" value={money(rev?.today ?? 0)} delta={delta(rev?.today, rev?.prevDay)} />
          <Stat icon={<DollarSign className="h-5 w-5 text-gold" />} label="Last 7 days" value={money(rev?.week ?? 0)} delta={delta(rev?.week, rev?.prevWeek)} />
          <Stat icon={<DollarSign className="h-5 w-5 text-gold" />} label="This month" value={money(rev?.month ?? 0)} delta={delta(rev?.month, rev?.prevMonth)} />
          <Stat icon={<DollarSign className="h-5 w-5 text-gold" />} label="All time" value={money(rev?.allTime ?? 0)} />
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">Bookings</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LinkStat to="/admin/bookings" search={{ status: "pending_approval" }} icon={<Clock className="h-5 w-5 text-gold" />} label="Pending approval" value={String(c?.pending ?? 0)} accent={c?.pending ? "warn" : undefined} />
          <LinkStat to="/admin/bookings" search={{ status: "awaiting_payment" }} icon={<CreditCard className="h-5 w-5 text-gold" />} label="Awaiting payment" value={String(c?.awaitingPayment ?? 0)} />
          <LinkStat to="/admin/driver" icon={<Activity className="h-5 w-5 text-gold" />} label="Active trips" value={String(c?.activeTrips ?? 0)} accent={c?.activeTrips ? "live" : undefined} />
          <LinkStat to="/admin/bookings" search={{ status: "confirmed" }} icon={<Calendar className="h-5 w-5 text-gold" />} label="Upcoming" value={String(c?.upcoming ?? 0)} />
          <LinkStat to="/admin/bookings" search={{ status: "completed" }} icon={<CheckCircle2 className="h-5 w-5 text-gold" />} label="Completed" value={String(c?.completed ?? 0)} />
          <LinkStat to="/admin/bookings" search={{ status: "canceled" }} icon={<XCircle className="h-5 w-5 text-gold" />} label="Cancelled today" value={String(c?.cancelledToday ?? 0)} />
          <Stat icon={<LifeBuoy className="h-5 w-5 text-gold" />} label="Unread support" value={String(c?.unreadSupport ?? 0)} accent={c?.unreadSupport ? "warn" : undefined} />
          <Stat icon={<Users className="h-5 w-5 text-gold" />} label="Total customers" value={String(c?.totalCustomers ?? 0)} />
        </div>
      </section>

      {/* Today's Operations */}
      <section className="rounded-3xl border border-border/60 bg-card/60 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Today's operations</h2>
            <p className="text-xs text-muted-foreground">Pickups scheduled for today, sorted by pickup time.</p>
          </div>
          <Link to="/admin/calendar" className="text-xs uppercase tracking-widest text-gold hover:underline">
            Open calendar
          </Link>
        </div>
        <div className="mt-4 divide-y divide-border/60">
          {(!ops || ops.today.length === 0) && (
            <p className="py-8 text-center text-sm text-muted-foreground">No pickups scheduled for today.</p>
          )}
          {ops?.today.map((b: any) => {
            const at = new Date(b.pickup_at);
            const urgent = b.trip_status === "pending_approval" || b.trip_status === "awaiting_payment";
            return (
              <div key={b.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-widest text-gold">{b.reservation_number}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${urgent ? "border-yellow-500/50 text-yellow-400" : "border-gold/30 text-gold"}`}>
                      {String(b.trip_status).replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm">
                    <span className="font-medium">{at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                    <span className="text-muted-foreground"> · {b.full_name}</span>
                  </div>
                  <div className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-gold" />
                    <span className="truncate">{b.pickup_address} → {b.destination_address}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`tel:${b.phone}`} className="rounded-full border border-border/60 px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground hover:border-gold/40">Call</a>
                  <Link to="/admin/bookings" search={{ q: b.reservation_number } as never} className="rounded-full bg-gold-gradient px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-gold-foreground">
                    Open
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function delta(cur?: number, prev?: number) {
  if (cur == null || prev == null) return undefined;
  if (prev === 0 && cur === 0) return { pct: 0, dir: "flat" as const };
  if (prev === 0) return { pct: 100, dir: "up" as const };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { pct: Math.abs(pct), dir: pct > 0 ? ("up" as const) : pct < 0 ? ("down" as const) : ("flat" as const) };
}

function Stat({
  icon, label, value, delta, accent,
}: {
  icon: React.ReactNode; label: string; value: string;
  delta?: { pct: number; dir: "up" | "down" | "flat" };
  accent?: "warn" | "live";
}) {
  const accentCls = accent === "warn" ? "border-yellow-500/40" : accent === "live" ? "border-green-500/40" : "border-border/60";
  return (
    <div className={`rounded-2xl border ${accentCls} bg-card/60 p-5`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="font-display text-2xl font-semibold">{value}</div>
        {delta && (
          <span className={`inline-flex items-center gap-0.5 text-xs ${
            delta.dir === "up" ? "text-green-400" : delta.dir === "down" ? "text-red-400" : "text-muted-foreground"
          }`}>
            {delta.dir === "up" ? <TrendingUp className="h-3 w-3" /> : delta.dir === "down" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {delta.pct}%
          </span>
        )}
      </div>
    </div>
  );
}

function LinkStat(props: React.ComponentProps<typeof Stat> & { to: string; search?: Record<string, unknown> }) {
  const { to, search, ...rest } = props;
  return (
    <Link to={to} search={search as never} className="block">
      <Stat {...rest} />
    </Link>
  );
}

function QA({ to, search, children }: { to: string; search?: Record<string, unknown>; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      search={search as never}
      className="rounded-full border border-border/60 bg-card/60 px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground transition hover:border-gold/40 hover:text-foreground"
    >
      {children}
    </Link>
  );
}
