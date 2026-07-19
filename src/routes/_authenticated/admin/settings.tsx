import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAdminSettings, updateAdminSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Admin Settings — Stevie Services" }] }),
  component: AdminSettings,
});

type FormState = {
  base_fare: string;
  per_mile_rate: string;
  per_minute_rate: string;
  booking_fee: string;
  airport_surcharge: string;
  stop_fee: string;
  deposit_percentage: string;
  require_approval: boolean;
  approval_deadline_minutes: string;
  payment_window_minutes: string;
  hold_during_approval: boolean;
  auto_confirm_future_bookings: boolean;
  sms_enabled: boolean;
  google_calendar_id: string;
};

function AdminSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => getAdminSettings(),
  });

  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (data && !form) {
      setForm({
        base_fare: String(data.base_fare ?? 0),
        per_mile_rate: String(data.per_mile_rate ?? 0),
        per_minute_rate: String(data.per_minute_rate ?? 0),
        booking_fee: String(data.booking_fee ?? 0),
        airport_surcharge: String(data.airport_surcharge ?? 0),
        stop_fee: String(data.stop_fee ?? 0),
        deposit_percentage: String(data.deposit_percentage ?? 25),
        require_approval: Boolean(data.require_approval),
        approval_deadline_minutes: String(data.approval_deadline_minutes ?? 60),
        payment_window_minutes: String((data as any).payment_window_minutes ?? 30),
        hold_during_approval: Boolean((data as any).hold_during_approval ?? true),
        auto_confirm_future_bookings: Boolean((data as any).auto_confirm_future_bookings ?? false),
        sms_enabled: Boolean(data.sms_enabled),
        google_calendar_id: String(data.google_calendar_id ?? ""),
      });
    }
  }, [data, form]);

  const mut = useMutation({
    mutationFn: (v: FormState) =>
      updateAdminSettings({
        data: {
          base_fare: Number(v.base_fare),
          per_mile_rate: Number(v.per_mile_rate),
          per_minute_rate: Number(v.per_minute_rate),
          booking_fee: Number(v.booking_fee),
          airport_surcharge: Number(v.airport_surcharge),
          stop_fee: Number(v.stop_fee),
          deposit_percentage: Number(v.deposit_percentage),
          require_approval: v.require_approval,
          approval_deadline_minutes: Number(v.approval_deadline_minutes),
          sms_enabled: v.sms_enabled,
          google_calendar_id: v.google_calendar_id || null,
        },
      }),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const update = (k: keyof FormState, v: any) => setForm({ ...form, [k]: v });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate(form);
      }}
      className="space-y-8"
    >
      <Section title="Fare rates" desc="These drive every quote on the booking page.">
        <NumField label="Base fare ($)" value={form.base_fare} onChange={(v) => update("base_fare", v)} />
        <NumField label="Per mile ($)" value={form.per_mile_rate} onChange={(v) => update("per_mile_rate", v)} />
        <NumField label="Per minute ($)" value={form.per_minute_rate} onChange={(v) => update("per_minute_rate", v)} />
        <NumField label="Booking fee ($)" value={form.booking_fee} onChange={(v) => update("booking_fee", v)} />
        <NumField label="Airport surcharge ($)" value={form.airport_surcharge} onChange={(v) => update("airport_surcharge", v)} />
        <NumField label="Extra stop fee ($)" value={form.stop_fee} onChange={(v) => update("stop_fee", v)} />
      </Section>

      <Section title="Payments" desc="Deposit percentage is available for future partial-payment mode.">
        <NumField label="Deposit %" value={form.deposit_percentage} onChange={(v) => update("deposit_percentage", v)} />
      </Section>

      <Section title="Approval workflow" desc="When manual approval is on, paid bookings stay in pending_approval until you approve them from the Bookings page.">
        <Toggle
          label="Require manual approval on every booking"
          value={form.require_approval}
          onChange={(v) => update("require_approval", v)}
        />
        <NumField
          label="Approval deadline (minutes)"
          value={form.approval_deadline_minutes}
          onChange={(v) => update("approval_deadline_minutes", v)}
        />
      </Section>

      <Section title="Notifications & calendar">
        <Toggle
          label="SMS notifications enabled"
          value={form.sms_enabled}
          onChange={(v) => update("sms_enabled", v)}
        />
        <TextField
          label="Google Calendar ID (leave blank to use primary)"
          value={form.google_calendar_id}
          onChange={(v) => update("google_calendar_id", v)}
        />
      </Section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={mut.isPending}
          className="rounded-full bg-gold-gradient px-6 py-2.5 text-sm font-semibold text-gold-foreground shadow-gold-glow disabled:opacity-50"
        >
          {mut.isPending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/60 p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-xs text-muted-foreground">{desc}</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-sm outline-none focus:border-gold/60"
      />
    </label>
  );
}
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block sm:col-span-2">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-sm outline-none focus:border-gold/60"
      />
    </label>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-3 sm:col-span-2">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition ${value ? "bg-gold" : "bg-secondary"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition ${
            value ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}
