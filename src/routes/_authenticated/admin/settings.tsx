import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getAdminSettings,
  updateAdminSettings,
  listPricingHolidays,
  addPricingHoliday,
  updatePricingHoliday,
  deletePricingHoliday,
} from "@/lib/admin.functions";

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
  minimum_fare: string;
  night_surcharge_pct: string;
  night_start_hour: string;
  night_end_hour: string;
  weekend_surcharge_pct: string;
  holiday_surcharge_pct: string;
  surcharge_stacking: string;
  hourly_rate: string;
  minimum_hourly_hours: string;
  meet_greet_fee: string;
  child_seat_fee: string;
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
        minimum_fare: String(data.minimum_fare ?? 35),
        night_surcharge_pct: String(data.night_surcharge_pct ?? 15),
        night_start_hour: String(data.night_start_hour ?? 22),
        night_end_hour: String(data.night_end_hour ?? 5),
        weekend_surcharge_pct: String(data.weekend_surcharge_pct ?? 10),
        holiday_surcharge_pct: String(data.holiday_surcharge_pct ?? 20),
        surcharge_stacking: String(data.surcharge_stacking ?? "stack"),
        hourly_rate: String(data.hourly_rate ?? 75),
        minimum_hourly_hours: String(data.minimum_hourly_hours ?? 2),
        meet_greet_fee: String(data.meet_greet_fee ?? 0),
        child_seat_fee: String(data.child_seat_fee ?? 0),
        require_approval: Boolean(data.require_approval),
        approval_deadline_minutes: String(data.approval_deadline_minutes ?? 60),
        payment_window_minutes: String(data.payment_window_minutes ?? 30),
        hold_during_approval: Boolean(data.hold_during_approval ?? true),
        auto_confirm_future_bookings: Boolean(data.auto_confirm_future_bookings ?? false),
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
          minimum_fare: Number(v.minimum_fare),
          night_surcharge_pct: Number(v.night_surcharge_pct),
          night_start_hour: Number(v.night_start_hour),
          night_end_hour: Number(v.night_end_hour),
          weekend_surcharge_pct: Number(v.weekend_surcharge_pct),
          holiday_surcharge_pct: Number(v.holiday_surcharge_pct),
          surcharge_stacking: v.surcharge_stacking === "highest" ? "highest" : "stack",
          hourly_rate: Number(v.hourly_rate),
          minimum_hourly_hours: Number(v.minimum_hourly_hours),
          meet_greet_fee: Number(v.meet_greet_fee),
          child_seat_fee: Number(v.child_seat_fee),
          require_approval: v.require_approval,
          approval_deadline_minutes: Number(v.approval_deadline_minutes),
          payment_window_minutes: Number(v.payment_window_minutes),
          hold_during_approval: v.hold_during_approval,
          auto_confirm_future_bookings: v.auto_confirm_future_bookings,
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
    <div className="space-y-8">
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
        <NumField label="Minimum fare ($)" value={form.minimum_fare} onChange={(v) => update("minimum_fare", v)} />
      </Section>

      <Section
        title="Time-based surcharges"
        desc="Percentage add-ons applied to the trip subtotal based on the pickup time (Eastern). Night hours wrap past midnight when the start hour is later than the end hour."
      >
        <NumField label="Night surcharge (%)" value={form.night_surcharge_pct} onChange={(v) => update("night_surcharge_pct", v)} />
        <NumField label="Weekend surcharge (%)" value={form.weekend_surcharge_pct} onChange={(v) => update("weekend_surcharge_pct", v)} />
        <NumField label="Night starts at (hour 0–23)" value={form.night_start_hour} onChange={(v) => update("night_start_hour", v)} />
        <NumField label="Night ends at (hour 0–23)" value={form.night_end_hour} onChange={(v) => update("night_end_hour", v)} />
        <NumField label="Default holiday surcharge (%)" value={form.holiday_surcharge_pct} onChange={(v) => update("holiday_surcharge_pct", v)} />
        <SelectField
          label="When multiple surcharges apply"
          value={form.surcharge_stacking}
          onChange={(v) => update("surcharge_stacking", v)}
          options={[
            { value: "stack", label: "Stack — add them together" },
            { value: "highest", label: "Highest — apply only the largest" },
          ]}
        />
      </Section>

      <Section
        title="Hourly & add-on fees"
        desc="Hourly-charter rate and flat fees for optional extras."
      >
        <NumField label="Hourly rate ($/hr)" value={form.hourly_rate} onChange={(v) => update("hourly_rate", v)} />
        <NumField label="Minimum hourly hours" value={form.minimum_hourly_hours} onChange={(v) => update("minimum_hourly_hours", v)} />
        <NumField label="Meet & greet fee ($)" value={form.meet_greet_fee} onChange={(v) => update("meet_greet_fee", v)} />
        <NumField label="Child seat fee ($)" value={form.child_seat_fee} onChange={(v) => update("child_seat_fee", v)} />
      </Section>

      <Section title="Approval & payment workflow" desc="Customers are never charged until you approve. After approval a secure payment link is sent; the reservation stays held until the payment window ends.">
        <Toggle
          label="Require manual approval on every booking"
          value={form.require_approval}
          onChange={(v) => update("require_approval", v)}
        />
        <Toggle
          label="Auto-confirm future bookings (skip manual approval)"
          value={form.auto_confirm_future_bookings}
          onChange={(v) => update("auto_confirm_future_bookings", v)}
        />
        <Toggle
          label="Hold requested time while awaiting driver approval"
          value={form.hold_during_approval}
          onChange={(v) => update("hold_during_approval", v)}
        />
        <NumField
          label="Approval deadline (minutes)"
          value={form.approval_deadline_minutes}
          onChange={(v) => update("approval_deadline_minutes", v)}
        />
        <NumField
          label="Customer payment window (minutes)"
          value={form.payment_window_minutes}
          onChange={(v) => update("payment_window_minutes", v)}
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

    <HolidaysManager />
    </div>
  );
}

function HolidaysManager() {
  const qc = useQueryClient();
  const { data: holidays } = useQuery({
    queryKey: ["pricing-holidays"],
    queryFn: () => listPricingHolidays(),
  });

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [pct, setPct] = useState("20");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pricing-holidays"] });

  const addMut = useMutation({
    mutationFn: () =>
      addPricingHoliday({
        data: { name: name.trim(), holiday_date: date, surcharge_pct: Number(pct), is_active: true },
      }),
    onSuccess: () => {
      toast.success("Holiday added");
      setName("");
      setDate("");
      setPct("20");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) =>
      updatePricingHoliday({ data: { id: v.id, is_active: v.is_active } }),
    onSuccess: invalidate,
    onError: (e) => toast.error((e as Error).message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deletePricingHoliday({ data: { id } }),
    onSuccess: () => {
      toast.success("Holiday removed");
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canAdd = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && pct !== "";

  return (
    <section className="rounded-3xl border border-border/60 bg-card/60 p-6">
      <h2 className="font-display text-lg font-semibold">Holiday surcharges</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Dates listed here override the default holiday surcharge. Only active dates are applied to
        quotes.
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
              <th className="pb-2 font-medium">Date</th>
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Surcharge</th>
              <th className="pb-2 font-medium">Active</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {(holidays ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground">
                  No holidays configured yet.
                </td>
              </tr>
            )}
            {(holidays ?? []).map((h) => (
              <tr key={h.id} className="border-t border-border/40">
                <td className="py-3 pr-3 font-mono text-xs">{h.holiday_date}</td>
                <td className="py-3 pr-3">{h.name}</td>
                <td className="py-3 pr-3">{Number(h.surcharge_pct)}%</td>
                <td className="py-3 pr-3">
                  <button
                    type="button"
                    aria-label={h.is_active ? "Deactivate" : "Activate"}
                    onClick={() => toggleMut.mutate({ id: h.id, is_active: !h.is_active })}
                    className={`relative h-6 w-11 rounded-full transition ${h.is_active ? "bg-gold" : "bg-secondary"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition ${h.is_active ? "left-5" : "left-0.5"}`}
                    />
                  </button>
                </td>
                <td className="py-3 text-right">
                  <button
                    type="button"
                    onClick={() => delMut.mutate(h.id)}
                    className="text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-3 border-t border-border/40 pt-5 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-sm outline-none focus:border-gold/60"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Name</span>
          <input
            type="text"
            value={name}
            placeholder="e.g. New Year's Eve"
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-sm outline-none focus:border-gold/60"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">%</span>
          <input
            type="number"
            step="1"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            className="mt-1 w-24 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm outline-none focus:border-gold/60"
          />
        </label>
        <button
          type="button"
          disabled={!canAdd || addMut.isPending}
          onClick={() => addMut.mutate()}
          className="h-[38px] rounded-full bg-gold-gradient px-5 text-sm font-semibold text-gold-foreground shadow-gold-glow disabled:opacity-50"
        >
          {addMut.isPending ? "Adding…" : "Add"}
        </button>
      </div>
    </section>
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
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border/60 bg-card px-3 py-2 text-sm outline-none focus:border-gold/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
