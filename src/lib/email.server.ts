/**
 * Server-only email sender (Resend).
 *
 * SECURITY: server-only. Import dynamically inside server handlers:
 *   const { sendEmail } = await import("@/lib/email.server");
 * Never import from route files or *.functions.ts top-level (those ship to the
 * client bundle).
 *
 * Design rules (Prompt 2):
 *  - Never throws. A delivery failure must not cancel or delete a booking.
 *  - Degrades gracefully: with no RESEND_API_KEY it logs and returns
 *    { ok:false, skipped:true } so the surrounding flow continues.
 *  - Best-effort logging to the `email_logs` table when it exists; missing
 *    table / columns are swallowed.
 */
import { Resend } from "resend";
import { BRAND, type RenderedEmail } from "./email-templates";

const FROM = process.env.EMAIL_FROM || `${BRAND.name} <${BRAND.email}>`;

/** Recipients for internal admin/driver alerts (comma-separated env). */
export function adminAlertRecipients(): string[] {
  const raw = process.env.ADMIN_ALERT_EMAILS || process.env.BOOKINGS_EMAIL || BRAND.email;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** For logging/analytics; e.g. "booking_received". */
  eventType?: string;
  /** For logging correlation. */
  bookingId?: string | null;
  userId?: string | null;
}

export interface SendEmailResult {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}

let _resend: Resend | null | undefined;
function client(): Resend | null {
  if (_resend === undefined) {
    const key = process.env.RESEND_API_KEY;
    _resend = key ? new Resend(key) : null;
  }
  return _resend;
}

async function logAttempt(input: SendEmailInput, result: SendEmailResult): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const recipients = Array.isArray(input.to) ? input.to.join(", ") : input.to;
    // Best-effort: table may not exist yet. Any error here is swallowed.
    await supabaseAdmin.from("email_logs" as never).insert({
      booking_id: input.bookingId ?? null,
      user_id: input.userId ?? null,
      event_type: input.eventType ?? "generic",
      recipient: recipients,
      subject: input.subject,
      status: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
      provider_id: result.id ?? null,
      error_message: result.error ?? null,
    } as never);
  } catch {
    /* logging is best-effort; ignore (e.g. table not created yet) */
  }
}

/** Send one email. Never throws. */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = client();
  if (!resend) {
    const result: SendEmailResult = { ok: false, skipped: true, error: "RESEND_API_KEY not configured" };
    console.warn(`[email] skipped "${input.subject}" — RESEND_API_KEY not set`);
    await logAttempt(input, result);
    return result;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });
    const result: SendEmailResult = error
      ? { ok: false, error: error.message }
      : { ok: true, id: data?.id };
    if (!result.ok) console.error(`[email] send failed "${input.subject}":`, result.error);
    await logAttempt(input, result);
    return result;
  } catch (e) {
    const result: SendEmailResult = { ok: false, error: e instanceof Error ? e.message : "send failed" };
    console.error(`[email] send threw "${input.subject}":`, result.error);
    await logAttempt(input, result);
    return result;
  }
}

/** Convenience: send a rendered template to a recipient. */
export function sendRendered(
  to: string | string[],
  email: RenderedEmail,
  meta: Pick<SendEmailInput, "eventType" | "bookingId" | "userId" | "replyTo"> = {},
): Promise<SendEmailResult> {
  return sendEmail({ to, subject: email.subject, html: email.html, text: email.text, ...meta });
}
