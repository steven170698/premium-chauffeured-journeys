import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Phone, Mail, MapPin, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { submitSupportRequest } from "@/lib/support.functions";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Stevie Services LLC" },
      { name: "description", content: "Reach Stevie Services LLC. Call 929-299-9747 or send us a message. Available 24/7 in New York and New Jersey." },
      { property: "og:title", content: "Contact — Stevie Services LLC" },
      { property: "og:description", content: "Call 929-299-9747 or send us a message. Available 24/7 in New York and New Jersey." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const runSupport = useServerFn(submitSupportRequest);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please add your name, email, and a message.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await runSupport({
        data: { name, email, phone: phone || null, message, company: company || null },
      });
      if ("error" in result) throw new Error(result.error);
      setSent(true);
      toast.success("Message sent — we'll be in touch shortly.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[420px] -z-10 bg-radial-gold" />
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.32em] text-gold">Contact</div>
          <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl md:text-6xl">
            Let's plan your <span className="text-gold-gradient">next ride</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Call anytime, or send a note — we usually reply within the hour.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          <InfoCard icon={<Phone className="h-5 w-5" />} label="Call" value="929-299-9747" href="tel:9292999747" />
          <InfoCard icon={<Mail className="h-5 w-5" />} label="Website" value="StevieServicesLLC.com" href="https://StevieServicesLLC.com" />
          <InfoCard icon={<Clock className="h-5 w-5" />} label="Hours" value="Available 24/7" />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
          {sent ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-border/60 bg-card/60 p-8 text-center backdrop-blur">
              <CheckCircle2 className="h-12 w-12 text-gold" />
              <h2 className="font-display text-xl font-semibold">Message sent</h2>
              <p className="text-sm text-muted-foreground">
                Thanks for reaching out — we usually reply within the hour. For anything urgent, please call us directly.
              </p>
              <a href="tel:9292999747" className="inline-flex items-center justify-center rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold-glow">
                Call 929-299-9747
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-border/60 bg-card/60 p-6 md:p-8 backdrop-blur">
              <h2 className="font-display text-xl font-semibold">Send us a message</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full Name"><input value={name} onChange={(e) => setName(e.target.value)} type="text" autoComplete="name" className={inputCls} placeholder="Your name" /></Field>
                <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" className={inputCls} placeholder="Phone number" /></Field>
              </div>
              <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className={inputCls} placeholder="you@example.com" /></Field>
              <Field label="Message"><textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className={inputCls} placeholder="How can we help?" /></Field>
              {/* Honeypot — hidden from users, catches bots */}
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" disabled={submitting} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold-glow disabled:opacity-60">
                  {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>) : "Send Message"}
                </button>
                <a href="tel:9292999747" className="inline-flex flex-1 items-center justify-center rounded-full border border-border bg-secondary/60 px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary">
                  Call Now
                </a>
              </div>
            </form>
          )}

          <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/60">
            <div className="relative aspect-[4/3] w-full bg-secondary/40">
              <iframe
                title="Stevie Services LLC — service area"
                src="https://www.google.com/maps?q=New+York,NY&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 h-full w-full grayscale-[0.2] contrast-125"
              />
            </div>
            <div className="flex items-start gap-4 p-6">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold-gradient text-gold-foreground">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <div className="font-display text-lg font-semibold">Service Area</div>
                <p className="text-sm text-muted-foreground">
                  Based in New York and New Jersey — serving NYC, JFK, LGA, EWR, and long-distance destinations across the Northeast.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const inner = (
    <>
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold-gradient text-gold-foreground shadow-gold-glow">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-[0.28em] text-gold">{label}</div>
        <div className="mt-1 font-display text-lg font-semibold truncate">{value}</div>
      </div>
    </>
  );
  const cls = "group flex items-center gap-4 rounded-3xl border border-border/60 bg-card/60 p-6 transition-all hover:-translate-y-1 hover:border-gold/40 hover:shadow-elegant";
  return href ? <a href={href} className={cls}>{inner}</a> : <div className={cls}>{inner}</div>;
}
