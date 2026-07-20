import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/services/hourly")({
  head: () => ({
    meta: [
      { title: "Hourly Chauffeur Service | Stevie Services LLC" },
      { name: "description", content: "Book a professional chauffeur by the hour for meetings, shopping, events, or a full day of appointments across NY and NJ." },
      { property: "og:title", content: "Hourly Chauffeur — Stevie Services LLC" },
      { property: "og:description", content: "Professional chauffeur by the hour, NY & NJ." },
      { property: "og:url", content: "https://stevieservicesllc.com/services/hourly" },
    ],
    links: [{ rel: "canonical", href: "https://stevieservicesllc.com/services/hourly" }],
  }),
  component: HourlyPage,
});

function HourlyPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.28em] text-gold">Hourly Chauffeur</p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Your driver, on your schedule</h1>
      <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
        <p>Reserve a professional chauffeur by the hour for as long as you need. Perfect for back-to-back meetings, shopping trips, medical appointments, or a full day out.</p>
        <ul className="ml-6 list-disc space-y-2">
          <li>Minimum 2-hour booking</li>
          <li>Same driver, same vehicle for the entire reservation</li>
          <li>Wait time included — no extra charge for stops</li>
          <li>Ideal for business travel, tours, and event days</li>
        </ul>
      </div>
      <div className="mt-10">
        <Link to="/book" className="rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold-glow">Book Hourly Service</Link>
      </div>
    </div>
  );
}
