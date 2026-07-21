/**
 * Server-only in-app notification helpers.
 *
 * SECURITY: server-only. Import dynamically inside server handlers:
 *   const { createNotification } = await import("@/lib/notifications.server");
 *
 * Writes to the `notifications` table (created by the Phase 2 migration).
 * Best-effort: never throws, so a notification failure can't break a booking
 * or payment flow. Until the migration is applied, inserts fail silently.
 */

export type NotificationAudience = "customer" | "admin" | "driver";

export interface NotificationInput {
  /** Recipient user id. Null for role-broadcast rows (audience-only). */
  userId?: string | null;
  audience?: NotificationAudience;
  bookingId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

/** Insert a single in-app notification. Never throws. */
export async function createNotification(input: NotificationInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notifications" as never).insert({
      user_id: input.userId ?? null,
      audience: input.audience ?? "customer",
      booking_id: input.bookingId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    } as never);
  } catch (e) {
    console.error(
      "[notifications] insert failed (non-fatal):",
      e instanceof Error ? e.message : e,
    );
  }
}

/** Insert several notifications concurrently. Never throws. */
export async function createNotifications(inputs: NotificationInput[]): Promise<void> {
  await Promise.allSettled(inputs.map(createNotification));
}

/**
 * Fan-out for a newly submitted booking: notify the customer (if signed in)
 * and the admin/driver audience.
 */
export async function notifyBookingSubmitted(opts: {
  bookingId: string;
  reservationNumber: string;
  customerUserId?: string | null;
  customerName: string;
}): Promise<void> {
  const { bookingId, reservationNumber, customerUserId, customerName } = opts;
  const inputs: NotificationInput[] = [
    {
      userId: null,
      audience: "admin",
      bookingId,
      type: "new_booking",
      title: "New ride request",
      body: `${customerName} · ${reservationNumber} — awaiting approval`,
      link: `/admin/bookings?booking=${bookingId}`,
    },
  ];
  if (customerUserId) {
    inputs.push({
      userId: customerUserId,
      audience: "customer",
      bookingId,
      type: "booking_received",
      title: "Ride request received",
      body: `${reservationNumber} is pending approval. You'll be notified when it's approved.`,
      link: `/dashboard?booking=${bookingId}`,
    });
  }
  await createNotifications(inputs);
}
