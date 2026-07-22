/**
 * Server-only: notify the passenger of a trip-status change (email + in-app).
 * Shared by the driver dashboard (trip.functions) and the admin bookings list
 * (admin.functions) so the passenger is notified no matter where the step is
 * triggered. Best-effort — never throws, so a notification failure can't break
 * the flow. Email uses the passenger's booking email (reaches guests too); the
 * link is the public, no-login ride page.
 *
 * SECURITY: server-only. Import dynamically inside server handlers.
 */

export type TripStepStatus =
  | "driver_en_route"
  | "driver_arrived"
  | "picked_up"
  | "completed";

const STEP_TITLES: Record<TripStepStatus, string> = {
  driver_en_route: "Your driver is on the way",
  driver_arrived: "Your driver has arrived",
  picked_up: "You're on your way",
  completed: "Trip complete — thank you",
};

export async function notifyTripStep(bookingId: string, step: TripStepStatus) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: b } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, reservation_number, full_name, email, user_id, pickup_address, destination_address, pickup_at, passengers, amount_paid",
      )
      .eq("id", bookingId)
      .maybeSingle();
    if (!b) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const booking = b as any;
    const { sendRendered } = await import("@/lib/email.server");
    const { tripUpdateEmail } = await import("@/lib/email-templates");
    const { createNotification } = await import("@/lib/notifications.server");
    await Promise.allSettled([
      booking.email
        ? sendRendered(
            booking.email,
            tripUpdateEmail(
              {
                bookingId: booking.id,
                reservationNumber: booking.reservation_number,
                customerName: booking.full_name,
                pickupAddress: booking.pickup_address,
                destinationAddress: booking.destination_address,
                pickupAt: booking.pickup_at,
                passengers: booking.passengers,
                amountPaid: booking.amount_paid,
              },
              step,
            ),
            { eventType: `trip_${step}`, bookingId: booking.id, userId: booking.user_id },
          )
        : Promise.resolve(),
      createNotification({
        userId: booking.user_id,
        audience: "customer",
        bookingId: booking.id,
        type: `trip_${step}`,
        title: STEP_TITLES[step],
        body: `${booking.reservation_number}: ${STEP_TITLES[step].toLowerCase()}.`,
        link: `/booking/success?booking_id=${booking.id}`,
      }),
    ]);
  } catch (e) {
    console.error(`[trip] step notify (${step}) non-fatal:`, e instanceof Error ? e.message : e);
  }
}
