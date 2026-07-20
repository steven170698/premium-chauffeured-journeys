import { createFileRoute, Link } from "@tanstack/react-router";
import { Plane, Clock, Briefcase, MapPin, Sparkles, Car } from "lucide-react";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — Stevie Services LLC" },
      { name: "description", content: "Airport transfers, hourly chauffeur, corporate travel, special occasions, and long-distance rides across New York and New Jersey." },
      { property: "og:title", content: "Chauffeur Services — Stevie Services LLC" },
      { property: "og:description", content: "Airport, hourly, corporate, and long-distance transportation." },
      { property: "og:url", content: "https://stevieservicesllc.com/services" },
    ],
    links: [{ rel: "canonical", href: "https://stevieservicesllc.com/services" }],
  }),
  component: ServicesPage,
});

const SERVICES = [
  { icon: Plane, title: "Airport Transportation", desc: "On-time pickups and drop-offs at JFK, LGA, EWR, and regional airports. Flight tracking included." },
  { icon: Clock, title: "Hourly Chauffeur", desc: "By-the-hour service for meetings, shopping, errands, or a day of appointments." },
  { icon: Briefcase, title: "Corporate & Business", desc: "Discreet, professional rides for executives, clients, and business travel." },
  { icon: Sparkles, title: "Special Occasions", desc: "Weddings, anniversaries, proms, and nights out — arrive in style." },
  { icon: MapPin, title: "Long-Distance", desc: "Point-to-point rides across NY, NJ, CT, and PA." },
  { icon: Car, title: "Scheduled Rides", desc: "Recurring or advance-booked transportation with priority scheduling." },
];

function ServicesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.28em] text-gold">Services</p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Transportation, tailored to you</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Every ride is professional, punctual, and comfortable — in a well-maintained 2024 Honda CR-V.</p>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-2xl border border-border/60 bg-secondary/40 p-6">
            <Icon className="h-6 w-6 text-gold" />
            <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-12">
        <Link to="/book" className="rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold-glow">Book a Ride</Link>
      </div>
    </div>
  );
}
