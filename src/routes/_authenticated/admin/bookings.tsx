import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { listAdminBookings, updateBookingStatus } from "@/lib/admin.functions";
import { MapPin, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/bookings")({
  head: () => ({ meta: [{ title: "Admin Bookings — Stevie Services" }] }),
  component: AdminBookings,
});

type StatusFilter =
  | "all"
  | "pending_approval"
  | "confirmed"
  | "en_route"
  | "arrived"
  | "picked_up"
  | "completed"
  | "canceled";

const NEXT_ACTIONS: Record<string, Array<{ label: string; to: string; variant?: "danger" | "primary" }>> = {
  pending_approval: [
    { label: "Approve", to: "confirmed", variant: "primary" },
    { label: "Decline", to: "canceled", variant: "danger" },
  ],
  confirmed: [
    { label: "En route", to: "en_route", variant: "primary" },
    { label: "Cancel", to: "canceled", variant: "danger" },
  ],
  en_route: [{ label: "Arrived", to: "arrived", variant: "primary" }],
  arrived: [{ label: "Picked up", to: "picked_up", variant: "primary" }],
  picked_up: [{ label: "Complete ride", to: "completed", variant: "primary" }],
};

function AdminBookings() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-bookings", status, search],
    queryFn: () =>
      listAdminBookings({
        data: {
          status: status === "all" ? undefined : status,
          search: search || undefined,
        },
      }),
  });

  const mut = useMutation({
    mutationFn: (v: { bookingId: string; status: string }) =>
      updateBookingStatus({ data: v as never }),
    onSuccess: () => {
      toast.success("Booking updated");
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const filters: StatusFilter[] = [
    "all",
    "pending_approval",
    "confirmed",
    "en_route",
    "arrived",
    "picked_up",
    "completed",
    "canceled",
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reservation, name or email"
            className="w-72 rounded-full border border-border/60 bg-card px-9 py-2 text-sm outline-none focus:border-gold/60"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-xs uppercase tracking-widest transition ${
                status === s
                  ? "border-gold bg-gold/15 text-gold"
                  : "border-border/60 text-muted-foreground hover:border-gold/40"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30 text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Reservation</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Trip</th>
              <th className="px-4 py-3 text-left">Pickup at</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No bookings found.</td></tr>
            )}
            {rows.map((b: any) => {
              const actions = NEXT_ACTIONS[b.trip_status] ?? [];
              return (
                <tr key={b.id} className="border-t border-border/60 align-top">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs uppercase tracking-widest text-gold">{b.reservation_number}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{b.full_name}</div>
                    <div className="text-xs text-muted-foreground">{b.email}</div>
                    <div className="text-xs text-muted-foreground">{b.phone}</div>
                  </td>
                  <td className="px-4 py-3 max-w-[260px]">
                    <div className="flex items-start gap-1.5 text-xs"><MapPin className="mt-0.5 h-3 w-3 shrink-0 text-gold" />{b.pickup_address}</div>
                    <div className="mt-1 flex items-start gap-1.5 text-xs"><MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />{b.destination_address}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{new Date(b.pickup_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-gold">
                      {b.trip_status.replace(/_/g, " ")}
                    </span>
                    <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {b.payment_status.replace(/_/g, " ")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-display">${Number(b.total).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {actions.map((a) => (
                        <button
                          key={a.to}
                          disabled={mut.isPending}
                          onClick={() => mut.mutate({ bookingId: b.id, status: a.to })}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest transition ${
                            a.variant === "danger"
                              ? "border border-red-500/40 text-red-400 hover:bg-red-500/10"
                              : "bg-gold-gradient text-gold-foreground shadow-gold-glow"
                          } disabled:opacity-50`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
