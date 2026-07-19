import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  MapPin,
  Navigation,
  Calendar,
  Clock,
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
import { requestBooking } from "@/lib/booking.functions";
import { supabase } from "@/integrations/supabase/client";

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
  // Auth / contact
  const [authChecked, setAuthChecked] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Trip
  const [roundTrip, setRoundTrip] = useState(false);
  const [pickupText, setPickupText] = useState("");
  const [destText, setDestText] = useState("");
  const [pickup, setPickup] = useState<SelectedPlace | null>(null);
  const [destination, setDestination] = useState<SelectedPlace | null>(null);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");

  // Details (defaults kept for signed-in users)
  const [passengers] = useState(1);
  const [bags] = useState(0);
  const [flightNumber] = useState("");
  const [extraStopText] = useState("");
  const [specialInstructions] = useState("");

  // Quote
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  const extraStops = useMemo(() => (extraStopText.trim() ? 1 : 0), [extraStopText]);
  const runQuote = useServerFn(computeQuote);
  const runRequest = useServerFn(requestBooking);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const user = data.user;
      if (user) {
        setIsSignedIn(true);
        const meta = (user.user_metadata ?? {}) as { full_name?: string; phone?: string };
        setFullName(meta.full_name ?? "");
        setEmail(user.email ?? "");
        setPhone(meta.phone ?? "");
      }
      setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const canSubmit = Boolean(
    quote && pickup && destination && fullName && email && phone && pickupDate && pickupTime,
  );

  const handleSubmit = async () => {
    if (!canSubmit || !pickup || !destination) {
      toast.error("Please fill in your name, email, phone, and pickup date/time.");
      return;
    }
    setSubmitting(true);
    try {
      const pickupAtIso = new Date(`${pickupDate}T${pickupTime}`).toISOString();
      const returnAtIso =
        roundTrip && returnDate && returnTime
          ? new Date(`${returnDate}T${returnTime}`).toISOString()
          : null;

      const result = await runRequest({
        data: {
          fullName,
          email,
          phone,
          pickup,
          destination,
          pickupAt: pickupAtIso,
          isRoundTrip: roundTrip,
          returnAt: returnAtIso,
          passengers,
          bags,
          extraStop: extraStopText || null,
          flightNumber: flightNumber || null,
          specialInstructions: specialInstructions || null,
        },
      });

      if ("error" in result) throw new Error(result.error);
      toast.success("Ride request submitted — awaiting driver approval.");
      navigate({
        to: "/booking/success",
        search: { booking_id: result.bookingId },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not submit request";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

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
          <form
            className="space-y-8 rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur md:p-9"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            {!isSignedIn && authChecked && (
              <>
                <Fieldset title="Contact Information" step="01">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Full Name" required>
                      <input
                        type="text"
                        required
                        className={inputCls}
                        placeholder="Jane Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </Field>
                    <Field label="Phone Number" required>
                      <input
                        type="tel"
                        required
                        className={inputCls}
                        placeholder="(929) 555-0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </Field>
                    <Field label="Email Address" required className="sm:col-span-2">
                      <input
                        type="email"
                        required
                        className={inputCls}
                        placeholder="jane@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </Field>
                  </div>
                </Fieldset>

                <Divider />
              </>
            )}

            <Fieldset title="Trip Details" step={isSignedIn ? "01" : "02"}>
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
                    <input
                      type="date"
                      required
                      className={inputCls}
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                    />
                  </Field>
                  <Field label="Pickup Time" required icon={<Clock className="h-4 w-4 text-gold" />}>
                    <input
                      type="time"
                      required
                      className={inputCls}
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                    />
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
                      <input
                        type="date"
                        className={inputCls}
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                      />
                    </Field>
                    <Field label="Return Time">
                      <input
                        type="time"
                        className={inputCls}
                        value={returnTime}
                        onChange={(e) => setReturnTime(e.target.value)}
                      />
                    </Field>
                  </div>
                )}
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

                <BreakdownRow label="Distance" value={quote ? `${quote.distanceMiles} mi` : "—"} />
                <BreakdownRow
                  label="Travel Time"
                  value={quote ? `${quote.durationMinutes} min` : "—"}
                />
                <div className="hairline" />
                <BreakdownRow label="Base Fare" value={money(quote?.baseFare)} />
                <BreakdownRow label="Mileage" value={money(quote?.mileage)} />
                <BreakdownRow label="Time" value={money(quote?.time)} />
                <BreakdownRow label="Booking Fee" value={money(quote?.bookingFee)} />
                <BreakdownRow label="Airport Surcharge" value={money(quote?.airportSurcharge)} />
                <BreakdownRow label="Extra Stops" value={money(quote?.stopsFee)} />
                <BreakdownRow label="Estimated Tolls" value={money(quote?.tollsEstimate)} />
                {quote?.roundTrip && <BreakdownRow label="Round Trip" value="× 2" />}
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
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-gradient px-6 py-4 text-sm font-semibold text-gold-foreground shadow-gold-glow disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting request…
                    </>
                  ) : (
                    <>
                      Request This Ride
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
                <p className="text-center text-[11px] text-muted-foreground">
                  No charge yet. We'll review your request and send a secure payment link once your ride is approved.
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
