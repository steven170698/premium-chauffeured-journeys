import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Stevie Services LLC" },
      { name: "description", content: "How Stevie Services LLC collects, uses, and protects your personal information." },
      { property: "og:url", content: "https://stevieservicesllc.com/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://stevieservicesllc.com/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.28em] text-gold">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">This page is maintained by Stevie Services LLC. Last updated: {new Date().toLocaleDateString()}.</p>
      <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-semibold text-foreground">Information we collect</h2>
          <p>When you book a ride we collect your name, email address, phone number, pickup and drop-off addresses, and payment details. Payment card data is processed and stored by Stripe; we never store full card numbers.</p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">How we use your information</h2>
          <p>We use your information to schedule and complete your ride, contact you about your booking, process payments, and provide customer support. We do not sell your personal data.</p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">Service providers</h2>
          <p>We use Stripe (payments), Google Maps (routing and navigation), and Supabase (secure account and booking storage). Each provider handles data under its own privacy policy.</p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">Data retention</h2>
          <p>We retain booking records for tax and accounting purposes. You may request deletion of your account by contacting us.</p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">Contact</h2>
          <p>Questions about this policy? Call <a href="tel:9292999747" className="text-gold hover:underline">929-299-9747</a>.</p>
        </section>
      </div>
    </div>
  );
}
