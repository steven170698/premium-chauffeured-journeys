import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listCalendarBookings } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/calendar")({
  head: () => ({ meta: [{ title: "Admin Calendar — Stevie Services" }] }),
  component: AdminCalendar;,
});

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function AdminCalendar() {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(anchor.getTime() + i * 86_400_000)),
    [anchor],
  );
  const end = new Date(anchor.getTime() + 7 * 86_400_000);

  const { data: bookings = [] } = useQuery({
    queryKey: ["calendar-bookings", anchor.toISOString()],
    queryFn: () =>
      listCalendarBookings({
        data: { start: anchor.toISOString(), end: end.toISOString() },
      }),
  });

  const byDay: Record<string, any[]> = {};
  days.forEach((d) => (byDay[d.toDateString()] = []));
  for (const b of bookings as any[]) {
    const key = new Date(b.pickup_at).toDateString();
    if (byDay[key]) byDay[key].push(b);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-lg">
            {anchor.toLocaleDateString(undefined, { month: "long", day: "numeric" })} —{" "}
            {new Date(end.getTime() - 86_400_000).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
          </div>
          <div className="text-xs text-muted-foreground">Week view of confirmed & pending rides.</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAnchor(new Date(anchor.getTime() - 7 * 86_400_000))}
            className="rounded-full border border-border/60 p-2 hover:border-gold/40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAnchor(startOfWeek(new Date()))}
            className="rounded-full border border-border/60 px-3 py-1.5 text-xs uppercase tracking-widest hover:border-gold/40"
          >
            Today
          </button>
          <button
            onClick={() => setAnchor(new Date(anchor.getTime() + 7 * 86_400_000))}
            className="rounded-full border border-border/60 p-2 hover:border-gold/40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {days.map((d) => {
          const isToday = d.toDateString() === new Date().toDateString();
          const dayBookings = byDay[d.toDateString()] ?? [];
          return (
            <div
              key={d.toISOString()}
              className={`min-h-[220px] rounded-2xl border p-3 ${
                isToday ? "border-gold/50 bg-gold/5" : "border-border/60 bg-card/50"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </div>
                <div className={`text-lg font-display ${isToday ? "text-gold" : ""}`}>{d.getDate()}</div>
              </div>
              <div className="space-y-2">
                {dayBookings.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border/50 p-2 text-[10px] text-muted-foreground">
                    Available
                  </div>
                )}
                {dayBookings.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-lg border border-gold/30 bg-card p-2 text-xs"
                    title={`${b.pickup_address} → ${b.destination_address}`}
                  >
                    <div className="font-mono text-[10px] uppercase tracking-widest text-gold">
                      {new Date(b.pickup_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="mt-0.5 truncate font-medium">{b.full_name}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {b.trip_status.replace(/_/g, " ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
