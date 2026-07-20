import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Stevie Services LLC" },
      { name: "description", content: "Stevie Services LLC is a professional private chauffeur service based in New York and New Jersey, dedicated to safe, reliable, and comfortable transportation." },
      { property: "og:title", content: "About Stevie Services LLC" },
      { property: "og:description", content: "Professional private chauffeur based in NY & NJ." },
      { property: "og:url", content: "https://stevieservicesllc.com/about" },
    ],
    links: [{ rel: "canonical", href: "https://stevieservicesllc.com/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.28em] text-gold">About</p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Premium chauffeur service you can trust</h1>
      <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
        <p>Stevie Services LLC is an owner-operated private chauffeur service based in the New York and New Jersey metro area. Every ride is handled personally — same driver, same standards, every time.</p>
        <p>We serve airport transfers (JFK, LGA, EWR), business travel, hourly service, special occasions, and long-distance rides in a well-maintained 2024 Honda CR-V. Clean vehicle, professional driver, transparent pricing, and no surprises.</p>
        <p>We're licensed, insured, and available around the clock. Book online in seconds or reach us directly at <a href="tel:9292999747" className="text-gold hover:underline">929-299-9747</a>.</p>
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/book" className="rounded-full bg-gold-gradient px-6 py-3 text-sm font-semibold text-gold-foreground shadow-gold-glow">Book a Ride</Link>
        <Link to="/contact" className="rounded-full border border-border bg-secondary px-6 py-3 text-sm font-semibold">Contact Us</Link>
      </div>
    </div>
  );
}
