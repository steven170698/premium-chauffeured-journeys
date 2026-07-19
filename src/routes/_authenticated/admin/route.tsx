import { createFileRoute, Outlet, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, CalendarDays, Settings2, ClipboardList, Star } from "lucide-react";

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

function AdminLayout() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.28em] text-gold">Admin</p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
          Operations
        </h1>
      </div>
      <nav className="mb-8 flex flex-wrap gap-2 border-b border-border/60 pb-3">
        <NavTab to="/admin" icon={<LayoutDashboard className="h-4 w-4" />} label="Overview" exact />
        <NavTab to="/admin/bookings" icon={<ClipboardList className="h-4 w-4" />} label="Bookings" />
        <NavTab to="/admin/calendar" icon={<CalendarDays className="h-4 w-4" />} label="Calendar" />
        <NavTab to="/admin/reviews" icon={<Star className="h-4 w-4" />} label="Reviews" />
        <NavTab to="/admin/settings" icon={<Settings2 className="h-4 w-4" />} label="Settings" />
      </nav>
      <Outlet />
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
