/**
 * Branded transactional email templates for Stevie Services LLC.
 *
 * Pure, dependency-free builders — no secrets, no side effects. Each template
 * returns { subject, html, text } so the sender can deliver both an HTML and a
 * plain-text part. Styling is inline (email clients strip <style> blocks) and
 * uses the site's black / gold / white palette.
 *
 * Business/brand values come from env with safe fallbacks so the templates
 * render correctly even before deployment secrets are set.
 */

export const BRAND = {
  name: "Stevie Services LLC",
  tagline: "Private Chauffeur",
  phone: process.env.BUSINESS_PHONE || "929-299-9747",
  phoneHref: (process.env.BUSINESS_PHONE || "9292999747").replace(/[^\d]/g, ""),
  email: process.env.BOOKINGS_EMAIL || "bookings@stevieservicesllc.com",
  siteUrl: (process.env.PUBLIC_SITE_URL || "https://stevieservicesllc.com").replace(/\/$/, ""),
  // A stable, publicly-hosted logo URL. Falls back to a text wordmark when unset.
  logoUrl: process.env.EMAIL_LOGO_URL || "",
  vehicle: "Honda CR-V",
  colors: {
    bg: "#0a0a0a",
    panel: "#141414",
    border: "#2a2a2a",
    gold: "#d4af37",
    goldSoft: "#e8c96a",
    text: "#f4f1ea",
    muted: "#a5a5a5",
  },
} as const;

const C = BRAND.colors;

export function formatMoney(amount: number | null | undefined): string {
  const n = typeof amount === "number" && isFinite(amount) ? amount : 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function manageUrl(bookingId?: string): string {
  return bookingId ? `${BRAND.siteUrl}/dashboard?booking=${encodeURIComponent(bookingId)}` : `${BRAND.siteUrl}/dashboard`;
}

/** A single label/value row used inside the details panel. */
export type Row = { label: string; value: string };

function rowsHtml(rows: Row[]): string {
  return rows
    .filter((r) => r.value && r.value !== "—")
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 0;color:${C.muted};font-size:13px;white-space:nowrap;vertical-align:top;">${esc(r.label)}</td>
        <td style="padding:8px 0 8px 16px;color:${C.text};font-size:14px;font-weight:600;text-align:right;">${esc(r.value)}</td>
      </tr>`,
    )
    .join("");
}

function logoHtml(): string {
  if (BRAND.logoUrl) {
    return `<img src="${esc(BRAND.logoUrl)}" width="56" height="56" alt="${esc(BRAND.name)}" style="display:block;margin:0 auto 12px;border-radius:50%;" />`;
  }
  return "";
}

function statusBadge(text: string, tone: "gold" | "green" | "red" | "muted" = "gold"): string {
  const map = {
    gold: { bg: "rgba(212,175,55,0.14)", fg: C.gold, br: "rgba(212,175,55,0.4)" },
    green: { bg: "rgba(52,168,83,0.15)", fg: "#7bd88f", br: "rgba(52,168,83,0.4)" },
    red: { bg: "rgba(220,80,80,0.15)", fg: "#f0928f", br: "rgba(220,80,80,0.4)" },
    muted: { bg: "rgba(160,160,160,0.15)", fg: C.muted, br: "rgba(160,160,160,0.35)" },
  }[tone];
  return `<span style="display:inline-block;padding:6px 14px;border:1px solid ${map.br};background:${map.bg};color:${map.fg};border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${esc(text)}</span>`;
}

function button(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 8px;">
      <tr><td style="border-radius:999px;background:linear-gradient(135deg,${C.gold},${C.goldSoft});">
        <a href="${esc(url)}" style="display:inline-block;padding:14px 32px;color:#1a1400;font-size:15px;font-weight:700;text-decoration:none;border-radius:999px;">${esc(label)}</a>
      </td></tr>
    </table>`;
}

/** Full HTML document wrapper. */
function layout(opts: {
  preheader: string;
  heading: string;
  intro?: string;
  badge?: string;
  panel?: string;
  cta?: { label: string; url: string };
  note?: string;
}): string {
  const { preheader, heading, intro, badge, panel, cta, note } = opts;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:${C.bg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.panel};border:1px solid ${C.border};border-radius:20px;overflow:hidden;">
        <tr><td style="padding:32px 32px 8px;text-align:center;">
          ${logoHtml()}
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:${C.text};letter-spacing:0.02em;">${esc(BRAND.name)}</div>
          <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:${C.gold};margin-top:4px;">${esc(BRAND.tagline)}</div>
        </td></tr>
        <tr><td style="padding:24px 32px 0;text-align:center;">
          ${badge ? `<div style="margin-bottom:16px;">${badge}</div>` : ""}
          <h1 style="margin:0;font-family:Georgia,serif;font-size:24px;line-height:1.3;color:${C.text};">${esc(heading)}</h1>
          ${intro ? `<p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:${C.muted};">${esc(intro)}</p>` : ""}
        </td></tr>
        ${
          panel
            ? `<tr><td style="padding:24px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border:1px solid ${C.border};border-radius:14px;padding:8px 20px;">${panel}</table></td></tr>`
            : ""
        }
        ${cta ? `<tr><td style="padding:0 32px;text-align:center;">${button(cta.label, cta.url)}</td></tr>` : ""}
        ${
          note
            ? `<tr><td style="padding:20px 32px 0;"><p style="margin:0;font-size:13px;line-height:1.6;color:${C.muted};background:${C.bg};border:1px solid ${C.border};border-radius:12px;padding:14px 16px;">${note}</p></td></tr>`
            : ""
        }
        <tr><td style="padding:28px 32px 32px;">
          <hr style="border:none;border-top:1px solid ${C.border};margin:0 0 20px;">
          <p style="margin:0;font-size:13px;line-height:1.7;color:${C.muted};text-align:center;">
            Questions? Call <a href="tel:${BRAND.phoneHref}" style="color:${C.gold};text-decoration:none;">${esc(BRAND.phone)}</a>
            &nbsp;·&nbsp; <a href="mailto:${esc(BRAND.email)}" style="color:${C.gold};text-decoration:none;">${esc(BRAND.email)}</a><br>
            <a href="${BRAND.siteUrl}" style="color:${C.muted};text-decoration:none;">${esc(BRAND.siteUrl.replace(/^https?:\/\//, ""))}</a>
            &nbsp;·&nbsp; New York &amp; New Jersey · Available 24/7
          </p>
          <p style="margin:16px 0 0;font-size:11px;color:${C.muted};text-align:center;">© ${new Date().getFullYear()} ${esc(BRAND.name)}. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Shared trip fields used across several templates. */
export interface BookingEmailData {
  bookingId: string;
  reservationNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  pickupAddress: string;
  destinationAddress: string;
  extraStops?: string | null;
  pickupAt: string; // ISO
  passengers?: number;
  estimatedFare?: number | null;
  approvedFare?: number | null;
  amountPaid?: number | null;
  distanceMiles?: number | null;
  durationMinutes?: number | null;
  specialInstructions?: string | null;
  paymentUrl?: string;
  paymentDeadlineAt?: string | null;
  declineReason?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function tripPanel(d: BookingEmailData, extra: Row[] = []): string {
  return rowsHtml([
    { label: "Reservation", value: d.reservationNumber },
    { label: "Pickup", value: d.pickupAddress },
    { label: "Destination", value: d.destinationAddress },
    { label: "Additional stops", value: d.extraStops || "—" },
    { label: "Pickup", value: formatDateTime(d.pickupAt) },
    { label: "Passengers", value: d.passengers ? String(d.passengers) : "—" },
    { label: "Vehicle", value: BRAND.vehicle },
    ...extra,
  ]);
}

function textFor(lines: (string | false | null | undefined)[]): string {
  return lines.filter(Boolean).join("\n") + `\n\n${BRAND.name} · ${BRAND.phone} · ${BRAND.email}\n${BRAND.siteUrl}`;
}

/* ------------------------------------------------------------------ */
/* Customer: booking received (no charge yet)                          */
/* ------------------------------------------------------------------ */
export function bookingReceivedEmail(d: BookingEmailData): RenderedEmail {
  const subject = `We received your ride request — ${d.reservationNumber}`;
  return {
    subject,
    html: layout({
      preheader: `Your request ${d.reservationNumber} is pending approval. You have not been charged.`,
      badge: statusBadge("Pending Approval", "gold"),
      heading: "Your ride request has been received",
      intro: `Thanks, ${d.customerName.split(" ")[0]}. We've got your request and our team will review it shortly. You have not been charged — a secure payment request will be sent only after your ride is approved.`,
      panel: tripPanel(d, [{ label: "Estimated fare", value: formatMoney(d.estimatedFare) }]),
      cta: { label: "View my reservation", url: manageUrl(d.bookingId) },
      note: `<strong style="color:${C.text};">You have not been charged.</strong> Please do not send card information by email or text. Once approved, you'll receive a secure payment link.`,
    }),
    text: textFor([
      `Your ride request has been received — ${d.reservationNumber}`,
      ``,
      `Hi ${d.customerName}, we've received your request and will review it shortly.`,
      `Status: Pending Approval. You have NOT been charged.`,
      ``,
      `Pickup: ${d.pickupAddress}`,
      `Destination: ${d.destinationAddress}`,
      d.extraStops ? `Additional stops: ${d.extraStops}` : null,
      `Pickup time: ${formatDateTime(d.pickupAt)}`,
      d.passengers ? `Passengers: ${d.passengers}` : null,
      `Vehicle: ${BRAND.vehicle}`,
      `Estimated fare: ${formatMoney(d.estimatedFare)}`,
      ``,
      `A secure payment request will be sent after approval.`,
      `Manage your reservation: ${manageUrl(d.bookingId)}`,
    ]),
  };
}

/* ------------------------------------------------------------------ */
/* Admin/Driver: new booking alert                                     */
/* ------------------------------------------------------------------ */
export function newBookingAlertEmail(d: BookingEmailData): RenderedEmail {
  const subject = `New ride request — ${d.reservationNumber} · ${d.customerName}`;
  return {
    subject,
    html: layout({
      preheader: `New request from ${d.customerName} awaiting your review.`,
      badge: statusBadge("Action Required", "gold"),
      heading: "New ride request to review",
      intro: `A new booking is awaiting approval.`,
      panel: rowsHtml([
        { label: "Reservation", value: d.reservationNumber },
        { label: "Customer", value: d.customerName },
        { label: "Phone", value: d.customerPhone || "—" },
        { label: "Email", value: d.customerEmail || "—" },
        { label: "Pickup", value: d.pickupAddress },
        { label: "Destination", value: d.destinationAddress },
        { label: "Additional stops", value: d.extraStops || "—" },
        { label: "Pickup", value: formatDateTime(d.pickupAt) },
        { label: "Passengers", value: d.passengers ? String(d.passengers) : "—" },
        { label: "Distance", value: d.distanceMiles ? `${d.distanceMiles.toFixed(1)} mi` : "—" },
        { label: "Duration", value: d.durationMinutes ? `${Math.round(d.durationMinutes)} min` : "—" },
        { label: "Estimated fare", value: formatMoney(d.estimatedFare) },
        { label: "Special instructions", value: d.specialInstructions || "—" },
      ]),
      cta: { label: "Review booking", url: `${BRAND.siteUrl}/admin/bookings?booking=${encodeURIComponent(d.bookingId)}` },
    }),
    text: textFor([
      `NEW RIDE REQUEST — ${d.reservationNumber}`,
      `Customer: ${d.customerName} (${d.customerPhone || "no phone"})`,
      `Pickup: ${d.pickupAddress}`,
      `Destination: ${d.destinationAddress}`,
      `Pickup time: ${formatDateTime(d.pickupAt)}`,
      `Estimated fare: ${formatMoney(d.estimatedFare)}`,
      d.specialInstructions ? `Notes: ${d.specialInstructions}` : null,
      ``,
      `Review: ${BRAND.siteUrl}/admin/bookings?booking=${d.bookingId}`,
    ]),
  };
}

/* ------------------------------------------------------------------ */
/* Customer: approved — payment required                               */
/* ------------------------------------------------------------------ */
export function bookingApprovedEmail(d: BookingEmailData): RenderedEmail {
  const subject = `Your ride request is approved — payment required (${d.reservationNumber})`;
  const amount = d.approvedFare ?? d.estimatedFare;
  return {
    subject,
    html: layout({
      preheader: `Approved for ${formatMoney(amount)}. Pay securely to confirm ${d.reservationNumber}.`,
      badge: statusBadge("Approved — Awaiting Payment", "gold"),
      heading: "Your ride is approved",
      intro: `Good news, ${d.customerName.split(" ")[0]} — your ride is approved. Your reservation is not confirmed until payment is completed. Use the secure button below to pay.`,
      panel: tripPanel(d, [
        { label: "Approved amount", value: formatMoney(amount) },
        { label: "Payment due by", value: d.paymentDeadlineAt ? formatDateTime(d.paymentDeadlineAt) : "—" },
      ]),
      cta: d.paymentUrl ? { label: "Pay now — secure checkout", url: d.paymentUrl } : { label: "View my reservation", url: manageUrl(d.bookingId) },
      note: `The payment button is a secure Stripe checkout. <strong style="color:${C.text};">Never send card information by email or text.</strong> Your reservation is confirmed only after payment succeeds.`,
    }),
    text: textFor([
      `YOUR RIDE IS APPROVED — PAYMENT REQUIRED (${d.reservationNumber})`,
      ``,
      `Hi ${d.customerName}, your ride is approved for ${formatMoney(amount)}.`,
      `Your reservation is NOT confirmed until payment succeeds.`,
      ``,
      `Pickup: ${d.pickupAddress}`,
      `Destination: ${d.destinationAddress}`,
      `Pickup time: ${formatDateTime(d.pickupAt)}`,
      d.paymentDeadlineAt ? `Pay by: ${formatDateTime(d.paymentDeadlineAt)}` : null,
      ``,
      d.paymentUrl ? `Pay securely: ${d.paymentUrl}` : `Manage reservation: ${manageUrl(d.bookingId)}`,
      `Never send card details by email or text.`,
    ]),
  };
}

/* ------------------------------------------------------------------ */
/* Customer: declined                                                  */
/* ------------------------------------------------------------------ */
export function bookingDeclinedEmail(d: BookingEmailData): RenderedEmail {
  const subject = `Update on your ride request — ${d.reservationNumber}`;
  return {
    subject,
    html: layout({
      preheader: `We were unable to accept request ${d.reservationNumber}.`,
      badge: statusBadge("Declined", "red"),
      heading: "We couldn't accept this request",
      intro: `Hi ${d.customerName.split(" ")[0]}, unfortunately we're unable to accept your ride request for ${formatDateTime(d.pickupAt)}. You have not been charged.`,
      panel: rowsHtml([
        { label: "Reservation", value: d.reservationNumber },
        { label: "Pickup", value: formatDateTime(d.pickupAt) },
        { label: "Reason", value: d.declineReason || "Unable to accommodate this request at this time." },
      ]),
      cta: { label: "Submit another request", url: `${BRAND.siteUrl}/book` },
      note: `We'd love to help with another time or trip. Give us a call at <a href="tel:${BRAND.phoneHref}" style="color:${C.gold};text-decoration:none;">${esc(BRAND.phone)}</a> and we'll do our best to accommodate you.`,
    }),
    text: textFor([
      `Update on your ride request — ${d.reservationNumber}`,
      ``,
      `Hi ${d.customerName}, unfortunately we're unable to accept your request for ${formatDateTime(d.pickupAt)}.`,
      `You have not been charged.`,
      d.declineReason ? `Reason: ${d.declineReason}` : null,
      ``,
      `Submit another request: ${BRAND.siteUrl}/book`,
    ]),
  };
}

/* ------------------------------------------------------------------ */
/* Customer: confirmed (payment received)                              */
/* ------------------------------------------------------------------ */
export function bookingConfirmedEmail(d: BookingEmailData): RenderedEmail {
  const subject = `Your Stevie Services reservation is confirmed — ${d.reservationNumber}`;
  return {
    subject,
    html: layout({
      preheader: `Payment received. ${d.reservationNumber} is confirmed.`,
      badge: statusBadge("Confirmed", "green"),
      heading: "Your reservation is confirmed",
      intro: `Thank you, ${d.customerName.split(" ")[0]}! Your payment was received and your ride is confirmed. We'll see you at pickup.`,
      panel: tripPanel(d, [
        { label: "Amount paid", value: formatMoney(d.amountPaid ?? d.approvedFare) },
        { label: "Payment status", value: "Paid" },
        { label: "Status", value: "Confirmed" },
      ]),
      cta: { label: "View reservation & receipt", url: manageUrl(d.bookingId) },
    }),
    text: textFor([
      `YOUR RESERVATION IS CONFIRMED — ${d.reservationNumber}`,
      ``,
      `Thank you, ${d.customerName}! Payment received; your ride is confirmed.`,
      ``,
      `Pickup: ${d.pickupAddress}`,
      `Destination: ${d.destinationAddress}`,
      `Pickup time: ${formatDateTime(d.pickupAt)}`,
      `Amount paid: ${formatMoney(d.amountPaid ?? d.approvedFare)}`,
      `Vehicle: ${BRAND.vehicle}`,
      ``,
      `View reservation & receipt: ${manageUrl(d.bookingId)}`,
    ]),
  };
}

/* ------------------------------------------------------------------ */
/* Admin: contact / support message                                    */
/* ------------------------------------------------------------------ */
export function supportRequestEmail(d: {
  name: string;
  email: string;
  phone?: string;
  message: string;
}): RenderedEmail {
  const subject = `New contact message — ${d.name}`;
  return {
    subject,
    html: layout({
      preheader: `New website message from ${d.name}.`,
      badge: statusBadge("New Message", "gold"),
      heading: "New contact form message",
      panel: rowsHtml([
        { label: "Name", value: d.name },
        { label: "Email", value: d.email },
        { label: "Phone", value: d.phone || "—" },
      ]),
      note: `<strong style="color:${C.text};">Message:</strong><br>${esc(d.message).replace(/\n/g, "<br>")}`,
      cta: { label: "Reply by email", url: `mailto:${encodeURIComponent(d.email)}` },
    }),
    text: textFor([
      `NEW CONTACT MESSAGE — ${d.name}`,
      `Email: ${d.email}`,
      d.phone ? `Phone: ${d.phone}` : null,
      ``,
      `Message:`,
      d.message,
    ]),
  };
}

/** Auto-reply to a customer who submitted the contact form. */
export function supportAckEmail(d: { name: string }): RenderedEmail {
  const subject = `We received your message — ${BRAND.name}`;
  return {
    subject,
    html: layout({
      preheader: `Thanks for reaching out — we'll reply shortly.`,
      badge: statusBadge("Received", "gold"),
      heading: "Thanks for reaching out",
      intro: `Hi ${d.name.split(" ")[0]}, we've received your message and will get back to you shortly — usually within the hour. For anything urgent, please call us directly.`,
      cta: { label: "Call now", url: `tel:${BRAND.phoneHref}` },
    }),
    text: textFor([
      `Thanks for reaching out, ${d.name}.`,
      `We've received your message and will reply shortly — usually within the hour.`,
      `For urgent matters, call ${BRAND.phone}.`,
    ]),
  };
}
