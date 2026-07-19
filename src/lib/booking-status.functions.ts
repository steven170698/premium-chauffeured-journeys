import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Public server fn — returns just the fields the success page needs so it can
 * poll for webhook reconciliation. Uses the service-role client because
 * anonymous bookings have no user_id and RLS would otherwise hide the row.
 * We look up strictly by booking id (uuid); no PII in the response.
 */
export const getBookingStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ bookingId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, reservation_number, trip_status, payment_status, total, pickup_at, pickup_address, destination_address",
      )
      .eq("id", data.bookingId)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!booking) return { error: "Booking not found" };
    return { booking };
  });
