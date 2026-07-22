import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listApprovedReviews } from "@/lib/reviews.functions";
import {
  Plane,
  Building2,
  MapPin,
  CalendarRange,
  Route as RouteIcon,
  ShieldCheck,
  BadgeCheck,
  Clock3,
  Award,
  Star,
  Phone,
  Mail,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import heroCar from "@/assets/hero-car.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stevie Services LLC — Luxury Chauffeur & Private Transportation" },
      {
        name: "description",
        content:
          "Professional, reliable, comfortable chauffeur service in New York and New Jersey. Airport transfers, business travel, events, and long-distance trips. Instant online booking.",
      },
      { property: "og:title", content: "Stevie Services LLC — Luxury Chauffeur Service" },
      {
        property: "og:description",
        content: "Professional • Reliable • Comfortable Transportation. Instant online booking.",
      },
    ],
  }),
  component: HomePage,
});

const services = [
  { icon: Plane, title: "Airport Transportation", desc: "On-time transfers to JFK, LGA, EWR and beyond. Flight tracking included." },
  { icon: MapPin, title: "Local Transportation", desc: "City rides across NYC boroughs and New Jersey with a professional touch." },
  { icon: Building2, title: "Business Transportation", desc: "Executive travel, roadshows, and client transport with discretion." },
  { icon: CalendarRange, title: "Event Transportation", desc: "Weddings, galas, concerts — arrive in comfort and style." },
  { icon: RouteIcon, title: "Long Distance Trips", desc: "Intercity travel throughout the Northeast, priced transparently." },
];

const values = [
  { icon: ShieldCheck, title: "Safe", desc: "Defensive-driving certified, spotless record." },
  { icon: BadgeCheck, title: "Professional", desc: "Dressed for the occasion, every occasion." },
  { icon: Clock3, title: "On-Time", desc: "Real-time monitoring keeps you punctual." },
  { icon: Award, title: "Licensed", desc: "TLC-licensed operator you can trust." },
  { icon: ShieldCheck, title: "Insured", desc: "Fully covered — passengers first, always." },
];

const testimonials = [
  { name: "Marcus H.", role: "Investment Banker", quote: "The most consistent car service I've used in NYC. Stevie makes 5:30 a.m. flights feel civilized." },
  { name: "Priya S.", role: "Event Planner", quote: "Immaculate presentation. My VIP clients ask for him specifically now — every single time." },
  { name: "Daniel R.", role: "Tech Executive", quote: "Booked last minute at midnight — car was outside in 12 minutes. Absolute pro." },
];

const faqs = [
  { q: "How do I get an instant quote?", a: "Enter your pickup and destination on the Book page. Our system calculates driving distance, time, and estimated fare in seconds using live routing data." },
  { q: "What's included in the fare?", a: "Base fare, mileage, driving time, booking fee, applicable airport or extra-stop fees, and estimated tolls. Waiting time, parking, and route changes may adjust the final fare." },
  { q: "Can I pay a deposit instead of the full amount?", a: "Yes. By default we accept a 25% deposit to hold your reservation. You can also pay in full at checkout." },
  { q: "What's your cancellation policy?", a: "Free cancellation with sufficient advance notice. Details are shown at checkout and confirmed by email." },
  { q: "Do you serve airports?", a: "Yes — JFK, LGA, EWR, and Teterboro, with flight tracking so we adjust to your arrival time automatically." },
];

function HomePage() {
  return (
    <div className="relative">
      <Hero />
      <Services />
      <WhyChooseUs />
      <Testimonials />
      <FAQ />
      <Contact />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img src={heroCar} alt="Luxury chauffeur car at night in New York" className="h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/60 to-background" />
        <div className="absolute inset-0 bg-radial-gold" />
      </div>

      <div className="mx-auto flex max-w-7xl flex-col items-center px-6 pt-20 pb-24 text-center md:pt-28 md:pb-36">
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-background/50 px-4 py-1.5 text-[11px] uppercase tracking-[0.28em] text-gold animate-fade-up">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          Available 24/7 in New York & New Jersey
        </div>

        <h1 className="mt-6 max-w-4xl font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl animate-fade-up">
          Professional <span className="text-gold-gradient">Reliable</span> Comfortable
          <span className="block text-muted-foreground/90">Transportation</span>
        </h1>

        <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg animate-fade-up">
          A private chauffeur service built around punctuality, discretion, and detail.
          Book in under a minute — pay online, receive instant confirmation.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row animate-fade-up">
          <Link
            to="/book"
            className="group inline-flex items-center justify-center gap-2 rounded-full bg-gold-gradient px-7 py-4 text-sm font-semibold text-gold-foreground shadow-gold-glow transition-transform hover:-translate-y-0.5"
          >
            Book a Ride
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-6 text-left sm:grid-cols-4 animate-fade-up">
          {[
            { k: "24/7", v: "Dispatch" },
            { k: "TLC", v: "Licensed" },
            { k: "100%", v: "Insured" },
            { k: "★ 5.0", v: "Client Rating" },
          ].map((s) => (
            <div key={s.v} className="rounded-2xl border border-border/60 bg-card/40 px-5 py-4 backdrop-blur">
              <div className="font-display text-2xl font-semibold text-gold">{s.k}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-xs uppercase tracking-[0.32em] text-gold">{eyebrow}</div>
      <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl md:text-5xl">{title}</h2>
      {sub && <p className="mt-4 text-base text-muted-foreground">{sub}</p>}
      <div className="hairline mx-auto mt-8 w-24" />
    </div>
  );
}

function Services() {
  return (
    <section id="services" className="mx-auto max-w-7xl px-6 py-24">
      <SectionHeader
        eyebrow="Services"
        title="Every trip, elevated"
        sub="From daily commutes to once-in-a-lifetime events — one standard of service."
      />
      <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {services.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-7 backdrop-blur transition-all hover:-translate-y-1 hover:border-gold/40 hover:shadow-elegant"
          >
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/10 text-gold ring-1 ring-gold/20 transition-transform group-hover:scale-110">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-6 font-display text-xl font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        ))}
      </div>
    </section>
  );
}

function WhyChooseUs() {
  return (
    <section className="relative border-y border-border/60 bg-secondary/20">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeader eyebrow="Why Choose Us" title="Five reasons clients stay" />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {values.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-gold-gradient text-gold-foreground shadow-gold-glow">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 font-display text-lg font-semibold">{title}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const { data: reviews = [] } = useQuery({
    queryKey: ["approved-reviews"],
    queryFn: () => listApprovedReviews(),
    staleTime: 60_000,
  });
  const items = reviews.length > 0
    ? reviews.map((r) => ({
        name: "Verified rider",
        role: new Date(r.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        quote: r.comment ?? "",
        rating: r.rating,
      })).filter((r) => r.quote)
    : testimonials.map((t) => ({ ...t, rating: 5 }));
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <SectionHeader eyebrow="Testimonials" title="Trusted by discerning riders" />
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {items.slice(0, 6).map((t, i) => (
          <figure key={i} className="flex flex-col rounded-3xl border border-border/60 bg-card/60 p-7">
            <div className="flex gap-1 text-gold">
              {Array.from({ length: t.rating }).map((_, j) => (
                <Star key={j} className="h-4 w-4 fill-current" />
              ))}
            </div>
            <blockquote className="mt-5 font-display text-lg leading-snug text-foreground">
              "{t.quote}"
            </blockquote>
            <figcaption className="mt-6 border-t border-border/60 pt-4">
              <div className="text-sm font-semibold">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.role}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="border-t border-border/60 bg-secondary/20">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <SectionHeader eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mt-12 space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="overflow-hidden rounded-2xl border border-border/60 bg-card/60">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="font-medium">{f.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-gold transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-border/60 p-5 text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="mx-auto max-w-7xl px-6 py-24">
      <SectionHeader eyebrow="Contact" title="Book, ask, or say hello" />
      <div className="mt-14 grid gap-6 md:grid-cols-2">
        <a
          href="tel:9292999747"
          className="group flex items-center gap-5 rounded-3xl border border-border/60 bg-card/60 p-7 transition-all hover:-translate-y-1 hover:border-gold/40 hover:shadow-elegant"
        >
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gold-gradient text-gold-foreground shadow-gold-glow">
            <Phone className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.28em] text-gold">Call anytime</div>
            <div className="mt-1 font-display text-2xl font-semibold">929-299-9747</div>
            <div className="text-sm text-muted-foreground">Available 24/7 for reservations</div>
          </div>
        </a>
        <Link
          to="/contact"
          className="group flex items-center gap-5 rounded-3xl border border-border/60 bg-card/60 p-7 transition-all hover:-translate-y-1 hover:border-gold/40 hover:shadow-elegant"
        >
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-secondary text-gold ring-1 ring-gold/30">
            <Mail className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.28em] text-gold">Message us</div>
            <div className="mt-1 font-display text-2xl font-semibold">Send a note</div>
            <div className="text-sm text-muted-foreground">Contact form, business hours, and directions</div>
          </div>
        </Link>
      </div>
    </section>
  );
}
