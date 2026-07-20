import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Stevie Services LLC" },
      { name: "description", content: "Answers to common questions about booking, pricing, payment, cancellations, and service areas at Stevie Services LLC." },
      { property: "og:title", content: "Frequently Asked Questions — Stevie Services LLC" },
      { property: "og:description", content: "Booking, pricing, payment, and policy answers." },
      { property: "og:url", content: "https://stevieservicesllc.com/faq" },
    ],
    links: [{ rel: "canonical", href: "https://stevieservicesllc.com/faq" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQS.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }),
    }],
  }),
  component: FaqPage,
});

const FAQS = [
  { q: "What areas do you serve?", a: "New York City (all five boroughs), Long Island, Westchester, and all of New Jersey. Long-distance rides available on request." },
  { q: "How do I book a ride?", a: "Use the online booking form to request your ride. You'll receive a confirmation once the driver approves, then a secure payment link." },
  { q: "When am I charged?", a: "You are NOT charged when you submit a request. Payment is collected only after the driver approves your booking, via a secure Stripe checkout link valid for 30 minutes." },
  { q: "What if my actual fare differs from the estimate?", a: "We track actual mileage and time. If the final fare is lower, we automatically refund the difference. If higher (capped at 20% over the estimate), we send a balance payment link." },
  { q: "Can I cancel or edit my booking?", a: "Yes — anytime before the driver approves your request, you can cancel or edit for free from your customer dashboard." },
  { q: "What vehicle will I ride in?", a: "A well-maintained 2024 Honda CR-V. Clean, comfortable, and seats up to 4 passengers with luggage." },
  { q: "Do you offer flight tracking?", a: "Yes, complimentary on all airport pickups. We adjust to your actual arrival time." },
  { q: "How can I contact you?", a: "Call or text 929-299-9747, or use the contact form on our website. We're available 24/7." },
];

function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.28em] text-gold">FAQ</p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Frequently asked questions</h1>
      <div className="mt-10 space-y-6">
        {FAQS.map(({ q, a }) => (
          <div key={q} className="rounded-2xl border border-border/60 bg-secondary/40 p-6">
            <h3 className="font-semibold text-foreground">{q}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
