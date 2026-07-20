import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cancellation-policy")({
  head: () => ({
    meta: [
      { title: "Cancellation & Refund Policy — Stevie Services LLC" },
      { name: "description", content: "Our cancellation windows, refund process, and no-show policy." },
      { property: "og:url", content: "https://stevieservicesllc.com/cancellation-policy" },
    ],
    links: [{ rel: "canonical", href: "https://stevieservicesllc.com/cancellation-policy" }],
  }),
  component: CancellationPage,
});

function CancellationPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.28em] text-gold">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Cancellation & Refund Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}.</p>
      <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-semibold text-foreground">Before approval — free</h2>
          <p>You may cancel or edit any pending request at no charge from your customer dashboard, anytime before the driver approves it.</p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">After approval, before pickup</h2>
          <p>Cancellations made more than 2 hours before the scheduled pickup: full refund. Within 2 hours of pickup: 50% cancellation fee. Within 30 minutes of pickup: no refund.</p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">Refunds</h2>
          <p>Approved refunds are issued to the original payment method through Stripe and typically appear within 5–10 business days.</p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">No-shows</h2>
          <p>If the driver arrives and waits 15 minutes with no contact from the customer, the ride is marked as a no-show and no refund is issued. Please call 929-299-9747 if you're running late.</p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">Automatic adjustments</h2>
          <p>If your actual fare is lower than the estimate you paid, the difference is refunded automatically after the trip.</p>
        </section>
      </div>
    </div>
  );
}
