import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Stevie Services LLC" },
      { name: "description", content: "Terms and conditions for using Stevie Services LLC transportation services." },
      { property: "og:url", content: "https://stevieservicesllc.com/terms" },
    ],
    links: [{ rel: "canonical", href: "https://stevieservicesllc.com/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.28em] text-gold">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}.</p>
      <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-semibold text-foreground">Booking & approval</h2>
          <p>All ride requests are subject to driver approval based on availability. Requests submitted online do not confirm a ride until you receive an approval notification and complete payment.</p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">Pricing & payment</h2>
          <p>Fares are calculated based on distance and time using our published rates. Estimates are provided at booking; final fares may vary based on actual mileage, time, and applicable tolls or parking, capped at 20% above the estimate.</p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">Passenger conduct</h2>
          <p>Passengers must follow the driver's reasonable safety instructions. We reserve the right to refuse or terminate service for unsafe, abusive, or unlawful behavior.</p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">Liability</h2>
          <p>Stevie Services LLC is licensed and insured. Our liability is limited to the fare paid for the ride in question.</p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">Governing law</h2>
          <p>These terms are governed by the laws of the State of New York.</p>
        </section>
      </div>
    </div>
  );
}
