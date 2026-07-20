import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/services/airport")({
  head: () => ({
    meta: [
      { title: "Airport Transportation — JFK, LGA, EWR | Stevie Services LLC" },
      { name: "description", content: "Reliable airport transfers to and from JFK, LaGuardia, and Newark. Flight tracking, meet-and-greet, and on-time guarantee." },
      { property: "og:title", content: "Airport Transportation — Stevie Services LLC" },
      { property: "og:description", content: "JFK, LGA, EWR transfers with flight tracking." },
      { property: "og:url", content: "https://stevieservicesllc.com/services/airport" },
    ],
    links: [{ rel: "canonical", href: "https://stevieservicesllc.com/services/airport" }],
  }),
  component: AirportPage,
});

function AirportPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.28em] text-gold">Airport Transportation</p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">JFK · LGA · EWR — on time, every time</h1>
      <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
        <p>We monitor your flight in real time and adjust pickup to actual arrival, so early or delayed doesn't cost you anything. Complimentary wait time on airport pickups.</p>
        <p>Every airport trip includes: professional greeting, luggage assistance, bottled water, and phone chargers. Clean, comfortable 2024 Honda CR-V with room for up to 4 passengers.</p>
        <ul className="ml-6 list-disc space-y-2">
          <li>Serving JFK, LGA, EWR, HPN, TEB, and regional airports</li>
          <li>Flight tracking included at no charge</li>
          <li>Curbside or meet-and-greet arrival options</li>
          <li>Transparent flat-rate or metered pricing</li>
        </ul>
      </div>
      <div className="mt-10">
        <Link to="/book" className="rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold-glow">Book Airport Transfer</Link>
      </div>
    </div>
  );
}
