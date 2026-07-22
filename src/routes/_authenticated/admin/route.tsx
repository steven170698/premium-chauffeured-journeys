import { createFileRoute, Outlet, Link, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, CalendarDays, Settings2, ClipboardList, Star, Car,
  Search, Bell, LogOut, Menu, X,
} from "lucide-react";
import { globalAdminSearch, getAdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ context }) => {
    const ctx = context as { user?: { id?: string } };
    const userId = ctx.user?.id;
    if (!userId) throw redirect({ to: "/auth" });
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error || !data) throw redirect({ to: "/dashboard" });
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", icon: LayoutDashboard, label: "Overview", exact: true },
  { to: "/admin/driver", icon: Car, label: "Driver" },
  { to: "/admin/bookings", icon: ClipboardList, label: "Bookings" },
  { to: "/admin/calendar", icon: CalendarDays, label: "Calendar" },
  { to: "/admin/reviews", icon: Star, label: "Reviews" },
  { to: "/admin/settings", icon: Settings2, label: "Settings" },
] as const;

function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <TopBar onMenu={() => setMobileOpen((v) => !v)} mobileOpen={mobileOpen} />
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.28em] text-gold">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
          Control Center
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Desktop tabs */}
      <nav className="mb-8 hidden flex-wrap gap-2 border-b border-border/60 pb-3 md:flex">
        {NAV.map((n) => (
          <NavTab key={n.to} to={n.to} icon={<n.icon className="h-4 w-4" />} label={n.label} exact={n.exact} />
        ))}
      </nav>

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <div className="mb-6 grid gap-2 rounded-2xl border border-border/60 bg-card/90 p-3 md:hidden">
          {NAV.map((n) => (
            <NavTab key={n.to} to={n.to} icon={<n.icon className="h-4 w-4" />} label={n.label} exact={n.exact} />
          ))}
        </div>
      )}

      <Outlet />
    </div>
  );
}

function TopBar({ onMenu, mobileOpen }: { onMenu: () => void; mobileOpen: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data: search } = useQuery({
    queryKey: ["admin-global-search", q],
    queryFn: () => globalAdminSearch({ data: { q } }),
    enabled: q.trim().length >= 2,
  });

  // Notification bell — reuse overview counts as a light-weight badge source.
  const { data: overview } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getAdminOverview(),
    refetchInterval: 30_000,
  });
  const notifCount =
    (overview?.counts.pending ?? 0) +
    (overview?.counts.awaitingPayment ?? 0) +
    (overview?.counts.unreadSupport ?? 0);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setOpen(false);
    navigate({ to: "/admin/bookings", search: { q } as never });
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="mb-6 flex items-center gap-2">
      <button
        onClick={onMenu}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 md:hidden"
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      <form onSubmit={onSubmit} className="relative flex-1" ref={boxRef}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search reservation, customer, phone or email…"
          className="w-full rounded-full border border-border/60 bg-card px-9 py-2 text-sm outline-none focus:border-gold/60"
        />
        {open && q.trim().length >= 2 && (search?.bookings.length || search?.customers.length) ? (
          <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-auto rounded-2xl border border-border/60 bg-card p-2 shadow-xl">
            {search?.bookings.length ? (
              <div className="px-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Bookings</div>
            ) : null}
            {search?.bookings.map((b: any) => (
              <button
                key={b.id}
                type="button"
                onClick={() => { setOpen(false); navigate({ to: "/admin/bookings", search: { q: b.reservation_number } as never }); }}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary/40"
              >
                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-gold">{b.reservation_number}</div>
                  <div className="text-xs">{b.full_name} <span className="text-muted-foreground">· {b.email}</span></div>
                </div>
                <div className="text-xs text-muted-foreground">{new Date(b.pickup_at).toLocaleDateString()}</div>
              </button>
            ))}
            {search?.customers.length ? (
              <div className="mt-1 px-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Customers</div>
            ) : null}
            {search?.customers.map((c: any) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setOpen(false); navigate({ to: "/admin/bookings", search: { q: c.email ?? c.full_name } as never }); }}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-secondary/40"
              >
                <div>
                  <div className="text-sm">{c.full_name || "(no name)"}</div>
                  <div className="text-xs text-muted-foreground">{c.email} · {c.phone}</div>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </form>

      <Link
        to="/admin"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 hover:border-gold/40"
        aria-label={`${notifCount} items need attention`}
      >
        <Bell className="h-4 w-4" />
        {notifCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-gold-foreground">
            {notifCount > 99 ? "99+" : notifCount}
          </span>
        )}
      </Link>

      <button
        onClick={signOut}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-border/60 px-3 text-xs uppercase tracking-widest text-muted-foreground hover:border-gold/40 hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
}

function NavTab({ to, icon, label, exact }: { to: string; icon: React.ReactNode; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      activeProps={{ className: "border-gold text-gold bg-gold/10" }}
      className="inline-flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-sm text-muted-foreground transition hover:border-gold/40 hover:text-foreground"
    >
      {icon}
      {label}
    </Link>
  );
}
