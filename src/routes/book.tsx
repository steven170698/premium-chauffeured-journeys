import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  MapPin,
  Navigation,
  Calendar,
  Clock,
  Users,
  Briefcase,
  Plane,
  Repeat,
  Info,
  ArrowRight,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import type { SelectedPlace } from "@/lib/useGoogleMaps";
import { computeQuote, type QuoteResult } from "@/lib/fare.functions";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book a Ride — Stevie Services LLC" },
      {
        name: "description",
        content:
          "Reserve professional chauffeur transportation in New York and New Jersey. Get an instant fare estimate and pay securely online.",
      },
      { property: "og:title", content: "Book a Ride — Stevie Services LLC" },
      {
        property: "og:description",
        content:
          "Instant fare estimate in New York and New Jersey. Secure online payment. Confirmation by email.",
      },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const [roundTrip, setRoundTrip] = useState(false);
  const [pickupText, setPickupText] = useState("");
  const [destText, setDestText] = useState("");
  const [pickup, setPickup] = useState<SelectedPlace | null>(null);
  const [destination, setDestination] = useState<SelectedPlace | null>(null);
  const [extraStopText, setExtraStopText] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  const extraStops = useMemo(() => (extraStopText.trim() ? 1 : 0), [extraStopText]);
  const runQuote = useServerFn(computeQuote);

  useEffect(() => {
    if (!pickup || !destination) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let cancelled = false;
    setLoadingQuote(true);
    setQuoteError(null);
    runQuote({ data: { pickup, destination, extraStops, roundTrip } })
      .then((res) => {
        if (!cancelled) setQuote(res);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setQuoteError(e.message);
          setQuote(null);
          toast.error(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingQuote(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickup, destination, extraStops, roundTrip, runQuote]);

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[520px] -z-10 bg-radial-gold" />

      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-background/60 px-4 py-1.5 text-[11px] uppercase tracking-[0.28em] text-gold">
            <Sparkles className="h-3 w-3" />
            Instant Quote
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold sm:text-5xl md:text-6xl">
            Reserve your <span className="text-gold-gradient">chauffeur</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Enter your trip details — we'll estimate distance, time, and fare in seconds.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Form */}
          <form className="space-y-8 rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur md:p-9">
            <Fieldset title="Contact Information" step="01">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full Name" required>
                  <input type="text" required className={inputCls} placeholder="Jane Doe" />
                </Field>
                <Field label="Phone Number" required>
                  <input type="tel" required className={inputCls} placeholder="(929) 555-0000" />
                </Field>
                <Field label="Email Address" required className="sm:col-span-2">
                  <input type="email" required className={inputCls} placeholder="jane@example.com" />
                </Field>
              </div>
            </Fieldset>

            <Divider />

            <Fieldset title="Trip Details" step="02">
              <div className="space-y-4">
                <Field label="Pickup Address" required icon={<MapPin className="h-4 w-4 text-gold" />}>
                  <PlaceAutocomplete
                    value={pickupText}
                    onChange={setPickupText}
                    onSelect={setPickup}
                    className={inputCls}
                    placeholder="Start typing your pickup address…"
                    required
                  />
                  <Hint>Powered by Google Maps · biased to NY / NJ.</Hint>
                </Field>
                <Field
                  label="Destination Address"
                  required
                  icon={<Navigation className="h-4 w-4 text-gold" />}
                >
                  <PlaceAutocomplete
                    value={destText}
                    onChange={setDestText}
                    onSelect={setDestination}
                    className={inputCls}
                    placeholder="Where are you going?"
                    required
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Pickup Date" required icon={<Calendar className="h-4 w-4 text-gold" />}>
                    <input type="date" required className={inputCls} />
                  </Field>
                  <Field label="Pickup Time" required icon={<Clock className="h-4 w-4 text-gold" />}>
                    <input type="time" required className={inputCls} />
                  </Field>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-border/60 bg-secondary/40 p-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roundTrip}
                    onChange={(e) => setRoundTrip(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[var(--gold)]"
                  />
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <Repeat className="h-4 w-4 text-gold" />
                      Round Trip
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Add a return leg (fare doubles).
                    </div>
                  </div>
                </label>

                {roundTrip && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Return Date">
                      <input type="date" className={inputCls} />
                    </Field>
                    <Field label="Return Time">
                      <input type="time" className={inputCls} />
                    </Field>
                  </div>
                )}
              </div>
            </Fieldset>

            <Divider />

            <Fieldset title="Passengers & Vehicle" step="03">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Passengers" icon={<Users className="h-4 w-4 text-gold" />}>
                  <input type="number" min={1} defaultValue={1} className={inputCls} />
                </Field>
                <Field label="Bags" icon={<Briefcase className="h-4 w-4 text-gold" />}>
                  <input type="number" min={0} defaultValue={0} className={inputCls} />
                </Field>
                <Field label="Vehicle Type">
                  <select className={inputCls} defaultValue="Honda CR-V 2024">
                    <option>Honda CR-V 2024</option>
                  </select>
                  <Hint>Our current fleet — spacious, comfortable, impeccably maintained.</Hint>
                </Field>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Flight Number (optional)" icon={<Plane className="h-4 w-4 text-gold" />}>
                  <input type="text" className={inputCls} placeholder="e.g. DL 402" />
                </Field>
                <Field label="Additional Stop (optional)">
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Address of an extra stop"
                    value={extraStopText}
                    onChange={(e) => setExtraStopText(e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Special Instructions">
                  <textarea
                    rows={3}
                    className={inputCls}
                    placeholder="Child seat, meet & greet, preferred route…"
                  />
                </Field>
              </div>
            </Fieldset>

            <div className="rounded-2xl border border-gold/20 bg-gold/5 p-4 text-xs leading-relaxed text-muted-foreground">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <p>
                  Rates are benchmarked against Uber &amp; Lyft in NY/NJ and set roughly 10–15%
                  lower. Tolls, waiting time, parking, and route changes may adjust the final fare.
                </p>
              </div>
            </div>
          </form>

          {/* Estimate panel */}
          <aside className="lg:sticky lg:top-24 h-fit">
            <div className="overflow-hidden rounded-3xl border border-gold/30 bg-card shadow-elegant">
              <div className="border-b border-border/60 bg-gold-gradient p-5 text-gold-foreground">
                <div className="text-[10px] uppercase tracking-[0.3em] opacity-80">Fare Estimate</div>
                <div className="mt-1 font-display text-2xl font-semibold">Your Quote</div>
              </div>
              <div className="space-y-5 p-6">
                {!pickup || !destination ? (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-secondary/30 p-6 text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold/10 text-gold ring-1 ring-gold/20">
                      <Navigation className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Select a pickup and destination from the suggestions to calculate distance,
                      drive time, and fare.
                    </p>
                  </div>
                ) : loadingQuote ? (
                  <div className="flex items-center justify-center rounded-2xl border border-dashed border-border/80 bg-secondary/30 p-6 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-gold" />
                    Calculating your fare…
                  </div>
                ) : quoteError ? (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
                    {quoteError}
                  </div>
                ) : null}

                <BreakdownRow
                  label="Distance"
                  value={quote ? `${quote.distanceMiles} mi` : "—"}
                />
                <BreakdownRow
                  label="Travel Time"
                  value={quote ? `${quote.durationMinutes} min` : "—"}
                />
                <div className="hairline" />
                <BreakdownRow label="Base Fare" value={money(quote?.baseFare)} />
                <BreakdownRow label="Mileage" value={money(quote?.mileage)} />
                <BreakdownRow label="Time" value={money(quote?.time)} />
                <BreakdownRow label="Booking Fee" value={money(quote?.bookingFee)} />
                <BreakdownRow
                  label="Airport Surcharge"
                  value={money(quote?.airportSurcharge)}
                />
                <BreakdownRow label="Extra Stops" value={money(quote?.stopsFee)} />
                <BreakdownRow label="Estimated Tolls" value={money(quote?.tollsEstimate)} />
                {quote?.roundTrip && (
                  <BreakdownRow label="Round Trip" value="× 2" />
                )}
                <div className="hairline" />
                <div className="flex items-baseline justify-between">
                  <div className="text-xs uppercase tracking-[0.28em] text-gold">
                    Estimated Total
                  </div>
                  <div className="font-display text-3xl font-semibold">
                    {quote ? `$${quote.total.toFixed(2)}` : "$—"}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!quote}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-gradient px-6 py-4 text-sm font-semibold text-gold-foreground shadow-gold-glow disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue to Payment
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
                <p className="text-center text-[11px] text-muted-foreground">
                  Choose full payment or a 25% deposit at checkout (coming next).
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30";

function money(n: number | undefined | null) {
  if (n === undefined || n === null) return "—";
  return `$${n.toFixed(2)}`;
}

function Fieldset({
  title,
  step,
  children,
}: {
  title: string;
  step: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-gold/40 bg-gold/10 font-display text-xs text-gold">
          {step}
        </span>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  icon,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
        {required && <span className="text-gold">*</span>}
      </span>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block text-[11px] text-muted-foreground/80">{children}</span>;
}

function Divider() {
  return <div className="hairline" />;
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
