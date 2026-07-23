import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Phone,
  MessageSquare,
  Mail,
  Copy,
  MapPin,
  Navigation,
  Route as RouteIcon,
  StickyNote,
  DollarSign,
  RefreshCcw,
  CalendarClock,
  Ban,
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  listTodayRides,
  listUpcomingRides,
  updateTripStatus,
  saveDriverNotes,
  recordPayment,
  issueRefund,
  todayEarnings,
  getAvailability,
  setAvailability,
  deleteAvailability,
} from "@/lib/driver.functions";
import {
  startTrip,
  markArrivedAtPickup,
  markPickedUp,
  logTripLocation,
  endTrip,
  abortTrip,
} from "@/lib/trip.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/_authenticated/admin/driver")({
  component: DriverDashboard,
});

type Tab = "today" | "upcoming" | "earnings" | "availability";

const TRIP_FLOW = [
  { key: "confirmed", label: "Confirmed" },
  { key: "driver_preparing", label: "Preparing" },
  { key: "driver_en_route", label: "En Route" },
  { key: "driver_arrived", label: "Arrived" },
  { key: "picked_up", label: "Picked Up" },
  { key: "completed", label: "Completed" },
  { key: "canceled", label: "Canceled" },
] as const;

const FILTER_STATUSES = [
  { key: "all", label: "All" },
  { key: "pending_approval", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "driver_preparing", label: "Preparing" },
  { key: "driver_en_route", label: "En Route" },
  { key: "driver_arrived", label: "Arrived" },
  { key: "picked_up", label: "Picked Up" },
  { key: "completed", label: "Completed" },
  { key: "canceled", label: "Canceled" },
] as const;

function fmtMoney(n: number | string | null | undefined) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function DriverDashboard() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-background pb-24 sm:-mx-6 sm:-my-10">
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold">Driver</p>
          <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-4">
        <nav className="flex gap-2 overflow-x-auto pb-3">
          {[
            { k: "today", label: "Today" },
            { k: "upcoming", label: "Upcoming" },
            { k: "earnings", label: "Earnings" },
            { k: "availability", label: "Availability" },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as Tab)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                tab === t.k
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "today" && <TodayView />}
        {tab === "upcoming" && <UpcomingView />}
        {tab === "earnings" && <EarningsView />}
        {tab === "availability" && <AvailabilityView />}
      </div>
    </div>
  );
}

/* ---------- TODAY ---------- */

function TodayView() {
  const fetchToday = useServerFn(listTodayRides);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["driver", "today"],
    queryFn: () => fetchToday(),
    refetchInterval: 30000,
  });
  const fetchEarnings = useServerFn(todayEarnings);
  const earnings = useQuery({
    queryKey: ["driver", "earnings"],
    queryFn: () => fetchEarnings(),
    refetchInterval: 30000,
  });

  if (isLoading) return <Loading />;
  const rides = data ?? [];
  return (
    <div className="space-y-4 pt-2">
      {earnings.data && <EarningsSummary compact data={earnings.data} />}
      {rides.length === 0 ? (
        <EmptyState msg="No rides scheduled today." />
      ) : (
        rides.map((r: any) => <RideCard key={r.id} ride={r} onChange={() => { refetch(); earnings.refetch(); }} />)
      )}
    </div>
  );
}

/* ---------- UPCOMING ---------- */

function UpcomingView() {
  const [range, setRange] = useState<"today" | "tomorrow" | "week" | "month">("week");
  const [status, setStatus] = useState<string>("all");
  const fetchUpcoming = useServerFn(listUpcomingRides);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["driver", "upcoming", range, status],
    queryFn: () => fetchUpcoming({ data: { range, ...(status !== "all" ? { status: status as any } : {}) } }),
  });

  return (
    <div className="space-y-4 pt-2">
      <div className="flex gap-2 overflow-x-auto">
        {[
          { k: "today", l: "Today" },
          { k: "tomorrow", l: "Tomorrow" },
          { k: "week", l: "This Week" },
          { k: "month", l: "This Month" },
        ].map((r) => (
          <button
            key={r.k}
            onClick={() => setRange(r.k as any)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${
              range === r.k
                ? "border-gold bg-gold/10 text-gold"
                : "border-border/60 text-muted-foreground"
            }`}
          >
            {r.l}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {FILTER_STATUSES.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
              status === f.key
                ? "border-gold bg-gold/10 text-gold"
                : "border-border/60 text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Loading />
      ) : (data ?? []).length === 0 ? (
        <EmptyState msg="No rides in this range." />
      ) : (
        (data ?? []).map((r: any) => <RideCard key={r.id} ride={r} onChange={() => refetch()} />)
      )}
    </div>
  );
}

/* ---------- RIDE CARD ---------- */

function RideCard({ ride, onChange }: { ride: any; onChange: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [notes, setNotes] = useState(ride.driver_notes ?? "");
  const qc = useQueryClient();

  const changeStatus = useServerFn(updateTripStatus);
  const statusMut = useMutation({
    mutationFn: (payload: { status: string; confirmDemote?: boolean }) =>
      changeStatus({ data: { bookingId: ride.id, status: payload.status as any, confirmDemote: payload.confirmDemote } }),
    onSuccess: () => {
      toast.success("Status updated");
      onChange();
      qc.invalidateQueries({ queryKey: ["driver"] });
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("Completed trips require") && ride.trip_status === "completed") {
        if (window.confirm("Revert a completed trip? Please confirm.")) {
          statusMut.mutate({ status: pendingRef.current!, confirmDemote: true });
        }
      } else {
        toast.error(msg || "Failed");
      }
    },
  });
  const pendingRef = { current: null as string | null };

  const saveNotesFn = useServerFn(saveDriverNotes);
  const notesMut = useMutation({
    mutationFn: () => saveNotesFn({ data: { bookingId: ride.id, notes } }),
    onSuccess: () => toast.success("Notes saved"),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const routeUrl = useMemo(() => {
    const params = new URLSearchParams({
      api: "1",
      origin: ride.pickup_address,
      destination: ride.destination_address,
      travelmode: "driving",
    });
    const stops = (ride.extra_stops ?? "").split("\n").map((s: string) => s.trim()).filter(Boolean);
    if (stops.length) params.set("waypoints", stops.join("|"));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [ride]);

  const balance = Number(ride.balance_due ?? 0);
  const paid = Number(ride.amount_paid ?? 0);
  const total = Number(ride.total ?? 0);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 shadow-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
              {fmtTime(ride.pickup_at)}
            </span>
            <StatusPill status={ride.trip_status} />
          </div>
          <p className="mt-2 truncate font-semibold">{ride.full_name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <MapPin className="mr-1 inline h-3 w-3" />
            {ride.pickup_address}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            <Navigation className="mr-1 inline h-3 w-3" />
            {ride.destination_address}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-semibold">{fmtMoney(total)}</p>
          {balance > 0 && <p className="text-xs text-amber-500">Bal {fmtMoney(balance)}</p>}
          <ChevronDown
            className={`ml-auto mt-1 h-4 w-4 text-muted-foreground transition ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border/60 p-4">
          {/* Trip Tracker (GPS + guided state machine) */}
          <TripTracker ride={ride} onChange={onChange} />


          {/* Contact actions */}
          <div className="grid grid-cols-4 gap-2">
            <ContactBtn icon={<Phone />} label="Call" href={`tel:${ride.phone}`} />
            <ContactBtn icon={<MessageSquare />} label="Text" href={`sms:${ride.phone}`} />
            <ContactBtn
              icon={<Copy />}
              label="Copy"
              onClick={() => {
                navigator.clipboard.writeText(ride.phone);
                toast.success("Phone copied");
              }}
            />
            <ContactBtn icon={<Mail />} label="Email" href={`mailto:${ride.email}`} />
          </div>

          {/* Maps actions */}
          <div className="grid grid-cols-3 gap-2">
            <MapBtn
              label="Pickup"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ride.pickup_address)}`}
            />
            <MapBtn
              label="Dest"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ride.destination_address)}`}
            />
            <MapBtn label="Route" href={routeUrl} icon={<RouteIcon className="h-4 w-4" />} />
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-muted/30 p-3 text-xs">
            <Detail label="Phone" value={ride.phone} />
            <Detail label="Passengers" value={`${ride.passengers ?? 1}`} />
            <Detail label="Distance" value={`${Number(ride.distance_miles ?? 0).toFixed(1)} mi`} />
            <Detail label="Duration" value={`${ride.duration_minutes ?? 0} min`} />
            <Detail label="Paid" value={fmtMoney(paid)} />
            <Detail label="Balance" value={fmtMoney(balance)} />
            <Detail label="Payment" value={ride.payment_status} />
            <Detail label="Res #" value={ride.reservation_number} />
          </div>

          {ride.special_instructions && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Customer Notes
              </p>
              <p className="mt-1 text-sm">{ride.special_instructions}</p>
            </div>
          )}

          {/* Driver notes */}
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gold">
              <StickyNote className="h-3 w-3" /> Private Driver Notes
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Gate code, car seat, cash collect, etc."
              className="min-h-[70px] w-full rounded-lg border border-border/60 bg-background p-2 text-sm"
            />
            <button
              onClick={() => notesMut.mutate()}
              disabled={notesMut.isPending}
              className="mt-1 text-xs font-medium text-gold"
            >
              {notesMut.isPending ? "Saving…" : "Save notes"}
            </button>
          </div>

          {/* Status controls */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Update Status
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TRIP_FLOW.map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    pendingRef.current = s.key;
                    statusMut.mutate({ status: s.key });
                  }}
                  disabled={statusMut.isPending || ride.trip_status === s.key}
                  className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${
                    ride.trip_status === s.key
                      ? "border-gold bg-gold text-black"
                      : s.key === "canceled"
                        ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                        : "border-border/60 hover:border-gold/40 hover:text-gold"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payments */}
          <div>
            <button
              onClick={() => setShowPay((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-border/60 p-3 text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gold" /> Payments
              </span>
              <ChevronDown className={`h-4 w-4 transition ${showPay ? "rotate-180" : ""}`} />
            </button>
            {showPay && <PaymentPanel ride={ride} onChange={onChange} />}
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentPanel({ ride, onChange }: { ride: any; onChange: () => void }) {
  const [amount, setAmount] = useState<string>(String(ride.balance_due ?? 0));
  const [refundAmt, setRefundAmt] = useState<string>("");
  const recordFn = useServerFn(recordPayment);
  const refundFn = useServerFn(issueRefund);
  const env = getStripeEnvironment();

  const record = useMutation({
    mutationFn: (method: "cash" | "card" | "other") =>
      recordFn({ data: { bookingId: ride.id, amount: Number(amount), method } }),
    onSuccess: () => {
      toast.success("Payment recorded");
      onChange();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const refund = useMutation({
    mutationFn: () =>
      refundFn({
        data: {
          bookingId: ride.id,
          environment: env,
          ...(refundAmt ? { amount: Number(refundAmt) } : {}),
        },
      }),
    onSuccess: (r: any) => {
      toast.success(`Refunded ${fmtMoney(r.refundedAmount)}`);
      onChange();
    },
    onError: (e: any) => toast.error(e?.message ?? "Refund failed"),
  });

  return (
    <div className="space-y-3 rounded-lg border border-border/60 border-t-0 bg-muted/20 p-3">
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="text-muted-foreground">Total</p>
          <p className="font-semibold">{fmtMoney(ride.total)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Paid</p>
          <p className="font-semibold text-emerald-500">{fmtMoney(ride.amount_paid)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Balance</p>
          <p className="font-semibold text-amber-500">{fmtMoney(ride.balance_due)}</p>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Record payment amount</label>
        <input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border/60 bg-background p-2 text-sm"
        />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            onClick={() => record.mutate("cash")}
            disabled={record.isPending || !Number(amount)}
            className="rounded-lg border border-border/60 py-2 text-xs font-medium hover:border-gold"
          >
            Cash
          </button>
          <button
            onClick={() => record.mutate("card")}
            disabled={record.isPending || !Number(amount)}
            className="rounded-lg border border-border/60 py-2 text-xs font-medium hover:border-gold"
          >
            Card
          </button>
          <button
            onClick={() => record.mutate("other")}
            disabled={record.isPending || !Number(amount)}
            className="rounded-lg border border-border/60 py-2 text-xs font-medium hover:border-gold"
          >
            Other
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Refund amount (blank = full)</label>
        <div className="mt-1 flex gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Full refund"
            value={refundAmt}
            onChange={(e) => setRefundAmt(e.target.value)}
            className="flex-1 rounded-lg border border-border/60 bg-background p-2 text-sm"
          />
          <button
            onClick={() => refund.mutate()}
            disabled={refund.isPending || !ride.stripe_payment_intent}
            className="rounded-lg border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <RefreshCcw className="mr-1 inline h-3 w-3" />
            Refund
          </button>
        </div>
        {!ride.stripe_payment_intent && (
          <p className="mt-1 text-[10px] text-muted-foreground">No Stripe payment on file.</p>
        )}
      </div>

      <button
        onClick={() => window.print()}
        className="w-full rounded-lg border border-border/60 py-2 text-xs font-medium"
      >
        Print / Download Receipt
      </button>
    </div>
  );
}

/* ---------- EARNINGS ---------- */

function EarningsView() {
  const fn = useServerFn(todayEarnings);
  const { data, isLoading } = useQuery({
    queryKey: ["driver", "earnings", "full"],
    queryFn: () => fn(),
    refetchInterval: 30000,
  });
  if (isLoading || !data) return <Loading />;
  return <EarningsSummary data={data} />;
}

function EarningsSummary({ data, compact }: { data: any; compact?: boolean }) {
  const cards = [
    { label: "Paid Today", val: data.totalPaidToday, accent: "text-gold" },
    { label: "Deposits", val: data.deposits },
    { label: "Balances Due", val: data.balancesDue, accent: "text-amber-500" },
    { label: "Completed Revenue", val: data.completedRevenue, accent: "text-emerald-500" },
    { label: "Pending Revenue", val: data.pendingRevenue },
    { label: "Avg Fare", val: data.avgFare },
  ];
  return (
    <div>
      <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border/60 bg-card/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className={`mt-1 font-semibold ${c.accent ?? ""} ${compact ? "text-sm" : "text-lg"}`}>
              {fmtMoney(c.val)}
            </p>
          </div>
        ))}
      </div>
      {!compact && (
        <div className="mt-3 rounded-xl border border-border/60 bg-card/50 p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Completed rides today: </span>
            <span className="font-semibold">{data.completedCount}</span>
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- AVAILABILITY ---------- */

function AvailabilityView() {
  const fetchFn = useServerFn(getAvailability);
  const setFn = useServerFn(setAvailability);
  const delFn = useServerFn(deleteAvailability);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["driver", "availability"],
    queryFn: () => fetchFn(),
  });

  const [status, setStatus] = useState<"available" | "busy" | "vacation" | "offline" | "not_accepting">("available");
  const [starts, setStarts] = useState(() => new Date().toISOString().slice(0, 16));
  const [ends, setEnds] = useState(() => new Date(Date.now() + 3600_000).toISOString().slice(0, 16));
  const [msg, setMsg] = useState(
    "We are currently unavailable for immediate service. Please schedule a future ride.",
  );
  const [allDay, setAllDay] = useState(false);

  const create = useMutation({
    mutationFn: () => {
      let s = starts, e = ends;
      if (allDay) {
        const d = new Date(starts); d.setHours(0, 0, 0, 0);
        const d2 = new Date(starts); d2.setHours(23, 59, 59, 999);
        s = d.toISOString(); e = d2.toISOString();
      } else {
        s = new Date(starts).toISOString();
        e = new Date(ends).toISOString();
      }
      return setFn({
        data: {
          status,
          startsAt: s,
          endsAt: e,
          customerMessage: status === "available" ? null : msg,
        },
      });
    },
    onSuccess: () => {
      toast.success("Availability updated");
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Removed");
      refetch();
    },
  });

  return (
    <div className="space-y-4 pt-2">
      <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
        <p className="mb-2 flex items-center gap-2 font-semibold">
          <CalendarClock className="h-4 w-4 text-gold" /> Set Availability / Block Time
        </p>

        <label className="text-xs text-muted-foreground">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          className="mt-1 w-full rounded-lg border border-border/60 bg-background p-2 text-sm"
        >
          <option value="available">Available</option>
          <option value="busy">Busy</option>
          <option value="vacation">Vacation</option>
          <option value="offline">Offline</option>
          <option value="not_accepting">Not Accepting Rides</option>
        </select>

        <div className="mt-3">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            All-day
          </label>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Starts</label>
            <input
              type="datetime-local"
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border/60 bg-background p-2 text-sm"
            />
          </div>
          {!allDay && (
            <div>
              <label className="text-xs text-muted-foreground">Ends</label>
              <input
                type="datetime-local"
                value={ends}
                onChange={(e) => setEnds(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background p-2 text-sm"
              />
            </div>
          )}
        </div>

        {status !== "available" && (
          <div className="mt-3">
            <label className="text-xs text-muted-foreground">Customer message</label>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              className="mt-1 min-h-[60px] w-full rounded-lg border border-border/60 bg-background p-2 text-sm"
            />
          </div>
        )}

        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="mt-3 w-full rounded-lg bg-gold py-3 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          {create.isPending ? "Saving…" : "Save Availability"}
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Scheduled Windows
        </p>
        {isLoading ? (
          <Loading />
        ) : (data ?? []).length === 0 ? (
          <EmptyState msg="No availability windows set." />
        ) : (
          <div className="space-y-2">
            {(data as any[]).map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/50 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold capitalize">
                    <Ban className="h-3 w-3 text-gold" />
                    {a.status.replace("_", " ")}
                    {a.is_current && (
                      <span className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold">Current</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmtDateTime(a.starts_at)} → {fmtDateTime(a.ends_at)}
                  </p>
                  {a.customer_message && (
                    <p className="mt-1 text-xs italic text-muted-foreground">"{a.customer_message}"</p>
                  )}
                </div>
                <button
                  onClick={() => remove.mutate(a.id)}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Reusable UI ---------- */

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending_approval: "bg-amber-500/10 text-amber-500",
    confirmed: "bg-blue-500/10 text-blue-500",
    driver_preparing: "bg-purple-500/10 text-purple-500",
    driver_en_route: "bg-cyan-500/10 text-cyan-500",
    driver_arrived: "bg-teal-500/10 text-teal-500",
    picked_up: "bg-indigo-500/10 text-indigo-500",
    completed: "bg-emerald-500/10 text-emerald-500",
    canceled: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${map[status] ?? "bg-muted"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ContactBtn({
  icon,
  label,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const cls =
    "flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-background p-3 text-xs font-medium text-foreground transition hover:border-gold hover:text-gold";
  const inner = (
    <>
      <span className="[&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      {label}
    </>
  );
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <button onClick={onClick} className={cls} type="button">
      {inner}
    </button>
  );
}

function MapBtn({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-background p-2.5 text-xs font-medium hover:border-gold hover:text-gold"
    >
      {icon ?? <MapPin className="h-4 w-4" />}
      {label}
    </a>
  );
}

function Detail({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate">{String(value ?? "—")}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-10 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
      {msg}
    </div>
  );
}

/* ---------- TRIP TRACKER ---------- */

function TripTracker({ ride, onChange }: { ride: any; onChange: () => void }) {
  const qc = useQueryClient();
  const env = (() => { try { return getStripeEnvironment(); } catch { return "sandbox" as const; } })();
  const status = ride.trip_status as string;
  const [tolls, setTolls] = useState("0");
  const [parking, setParking] = useState("0");
  const [waitElapsed, setWaitElapsed] = useState<number>(0);
  const [tripElapsed, setTripElapsed] = useState<number>(0);
  const [lastFix, setLastFix] = useState<{ lat: number; lng: number; acc?: number } | null>(null);
  const [result, setResult] = useState<any>(null);
  const watchRef = useRef<number | null>(null);
  const lastPostRef = useRef<number>(0);

  const startFn = useServerFn(startTrip);
  const arrivedFn = useServerFn(markArrivedAtPickup);
  const pickupFn = useServerFn(markPickedUp);
  const logFn = useServerFn(logTripLocation);
  const endFn = useServerFn(endTrip);
  const abortFn = useServerFn(abortTrip);

  // Ticking timers
  useEffect(() => {
    const id = window.setInterval(() => {
      if (ride.waiting_started_at && !ride.waiting_ended_at) {
        setWaitElapsed((Date.now() - new Date(ride.waiting_started_at).getTime()) / 1000);
      }
      if (ride.trip_started_at && !ride.trip_ended_at) {
        setTripElapsed((Date.now() - new Date(ride.trip_started_at).getTime()) / 1000);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [ride.waiting_started_at, ride.waiting_ended_at, ride.trip_started_at, ride.trip_ended_at]);

  // GPS watcher while trip is active
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const active = ["driver_en_route", "driver_arrived", "picked_up"].includes(status);
    if (!active) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          acc: pos.coords.accuracy,
        };
        setLastFix(fix);
        // Broadcast the driver's location the whole time the trip is active
        // (en route, arrived, picked up) so the passenger's live map updates
        // from the moment "En route" is pressed. Throttled to ~10s.
        const now = Date.now();
        if (now - lastPostRef.current > 10000) {
          lastPostRef.current = now;
          void logFn({
            data: { bookingId: ride.id, lat: fix.lat, lng: fix.lng, accuracy: fix.acc },
          }).catch(() => {});
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    watchRef.current = id;
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
  }, [status, ride.id, logFn]);

  const opts = (label: string) => ({
    onSuccess: (r: any) => {
      toast.success(label);
      if (r && typeof r === "object" && "finalFare" in r) setResult(r);
      onChange();
      qc.invalidateQueries({ queryKey: ["driver"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const start = useMutation({
    mutationFn: () => startFn({ data: { bookingId: ride.id, lat: lastFix?.lat, lng: lastFix?.lng, accuracy: lastFix?.acc } }),
    ...opts("On the way to pickup"),
  });
  const arrived = useMutation({
    mutationFn: () => arrivedFn({ data: { bookingId: ride.id } }),
    ...opts("Arrived — waiting clock started"),
  });
  const pickup = useMutation({
    mutationFn: () => pickupFn({ data: { bookingId: ride.id, lat: lastFix?.lat, lng: lastFix?.lng, accuracy: lastFix?.acc } }),
    ...opts("Passenger picked up — trip meter running"),
  });
  const end = useMutation({
    mutationFn: () => endFn({
      data: {
        bookingId: ride.id,
        tolls: Number(tolls) || 0,
        parking: Number(parking) || 0,
        environment: env,
        lat: lastFix?.lat,
        lng: lastFix?.lng,
        accuracy: lastFix?.acc,
      },
    }),
    ...opts("Trip completed"),
  });
  const abort = useMutation({
    mutationFn: () => abortFn({ data: { bookingId: ride.id } }),
    ...opts("Trip reset"),
  });

  if (["completed", "canceled", "declined", "payment_expired", "pending_approval", "awaiting_payment"].includes(status)) {
    return null;
  }

  const fmtDur = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="rounded-2xl border border-gold/40 bg-gold/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">Trip Tracker</p>
        {lastFix ? (
          <span className="text-[10px] text-muted-foreground">
            GPS · ±{Math.round(lastFix.acc ?? 0)}m
          </span>
        ) : (
          <span className="text-[10px] text-amber-500">Waiting for GPS…</span>
        )}
      </div>

      {status === "driver_arrived" && (
        <div className="mb-2 rounded-lg bg-background/60 p-2 text-center text-xs">
          Waiting at pickup · <span className="font-semibold text-gold">{fmtDur(waitElapsed)}</span>
        </div>
      )}
      {status === "picked_up" && (
        <div className="mb-2 rounded-lg bg-background/60 p-2 text-center text-xs">
          Trip in progress · <span className="font-semibold text-gold">{fmtDur(tripElapsed)}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {(status === "confirmed" || status === "driver_preparing") && (
          <button onClick={() => start.mutate()} disabled={start.isPending} className="col-span-2 rounded-lg bg-gold py-3 text-sm font-semibold text-black disabled:opacity-50">
            Start Trip → En route
          </button>
        )}
        {status === "driver_en_route" && (
          <button onClick={() => arrived.mutate()} disabled={arrived.isPending} className="col-span-2 rounded-lg bg-gold py-3 text-sm font-semibold text-black disabled:opacity-50">
            Arrived at Pickup
          </button>
        )}
        {status === "driver_arrived" && (
          <button onClick={() => pickup.mutate()} disabled={pickup.isPending} className="col-span-2 rounded-lg bg-gold py-3 text-sm font-semibold text-black disabled:opacity-50">
            Passenger Picked Up
          </button>
        )}
        {status === "picked_up" && (
          <>
            <label className="text-[10px] text-muted-foreground">
              Tolls ($)
              <input type="number" step="0.01" value={tolls} onChange={(e) => setTolls(e.target.value)} className="mt-0.5 w-full rounded border border-border/60 bg-background p-1.5 text-sm" />
            </label>
            <label className="text-[10px] text-muted-foreground">
              Parking ($)
              <input type="number" step="0.01" value={parking} onChange={(e) => setParking(e.target.value)} className="mt-0.5 w-full rounded border border-border/60 bg-background p-1.5 text-sm" />
            </label>
            <button onClick={() => end.mutate()} disabled={end.isPending} className="col-span-2 rounded-lg bg-gold py-3 text-sm font-semibold text-black disabled:opacity-50">
              End Trip & Finalize Fare
            </button>
          </>
        )}
        {["driver_en_route", "driver_arrived", "picked_up"].includes(status) && (
          <button onClick={() => abort.mutate()} disabled={abort.isPending} className="col-span-2 rounded-lg border border-destructive/40 py-2 text-xs text-destructive">
            Reset trip meter
          </button>
        )}
      </div>

      {result && (
        <div className="mt-3 space-y-1 rounded-lg border border-gold/30 bg-background/60 p-3 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <p className="font-semibold text-gold">Fare Reconciled</p>
            <span className="font-semibold">${Number(result.finalFare).toFixed(2)}</span>
          </div>
          <p className="text-muted-foreground">
            Actual: {result.actualDistanceMiles} mi · {result.actualDurationMinutes} min
          </p>
          {result.capApplied && (
            <p className="text-amber-500">Fare capped at max automatic increase.</p>
          )}
          {result.remainingBalance > 0 && (
            <p className="text-amber-500">Customer owes ${result.remainingBalance.toFixed(2)}.</p>
          )}
          {result.refunded > 0 && (
            <p className="text-emerald-500">Auto-refunded ${result.refunded.toFixed(2)}.</p>
          )}
        </div>
      )}
    </div>
  );
}

