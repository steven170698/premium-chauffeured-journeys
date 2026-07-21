import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const supportInputSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(200),
  email: z.string().trim().email("Please enter a valid email"),
  phone: z.string().trim().max(40).optional().nullable(),
  message: z.string().trim().min(1, "Please enter a message").max(5000),
  // Honeypot — real users leave this empty; bots fill it.
  company: z.string().max(0).optional().nullable(),
});

type SupportResult = { ok: true } | { error: string };

/**
 * Contact / support form submission.
 *  - Persists to `support_requests` (durable; best-effort until the table exists).
 *  - Emails the business an alert and the customer an acknowledgement.
 * Never throws through to the client; returns a friendly error instead.
 */
export const submitSupportRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => supportInputSchema.parse(data))
  .handler(async ({ data }): Promise<SupportResult> => {
    // Drop silently on honeypot hit (pretend success so bots don't learn).
    if (data.company) return { ok: true };

    let persisted = false;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("support_requests" as never).insert({
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        message: data.message,
        status: "new",
        source: "contact_form",
      } as never);
      persisted = !error;
    } catch {
      /* table may not exist yet, or service key not configured — fall back to email */
    }

    let emailed = false;
    try {
      const { sendRendered, adminAlertRecipients } = await import("@/lib/email.server");
      const { supportRequestEmail, supportAckEmail } = await import("@/lib/email-templates");

      const alert = await sendRendered(
        adminAlertRecipients(),
        supportRequestEmail({
          name: data.name,
          email: data.email,
          phone: data.phone ?? undefined,
          message: data.message,
        }),
        { eventType: "support_request", replyTo: data.email },
      );
      // Acknowledge the customer (non-critical if it fails).
      await sendRendered(data.email, supportAckEmail({ name: data.name }), {
        eventType: "support_ack",
      });
      emailed = alert.ok;
    } catch (e) {
      console.error("[support] email error:", e instanceof Error ? e.message : e);
    }

    if (!persisted && !emailed) {
      // Nothing was durably captured — surface a graceful error so the customer
      // can call instead of assuming we received it.
      return {
        error:
          "We couldn't send your message right now. Please call us at 929-299-9747 and we'll help right away.",
      };
    }
    return { ok: true };
  });
