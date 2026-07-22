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
        "id, reservation_number, trip_status, payment_status, total, payment_deadline_at, pickup_at, pickup_address, destination_address, pickup_lat, pickup_lng, destination_lat, destination_lng",
      )
      .eq("id", data.bookingId)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!booking) return { error: "Booking not found" };
    return { booking };
  });

const ACTIVE_TRIP_STATUSES = ["driver_en_route", "driver_arrived", "picked_up"];

/**
 * Public server fn — the driver's latest GPS point for a booking, for the live
 * tracking map on the public ride page. Only returns a location while the trip
 * is actively in progress (en route / arrived / picked up); otherwise null, so
 * the driver's position is never exposed before or after the ride. Looked up
 * strictly by booking id.
 */
export const getDriverLocation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ bookingId: z.string().uuid() }).parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      tripStatus: string | null;
      location: { lat: number; lng: number; recordedAt: string } | null;
    }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: booking } = await supabaseAdmin
        .from("bookings")
        .select("trip_status")
        .eq("id", data.bookingId)
        .maybeSingle();
      const tripStatus = (booking as { trip_status?: string } | null)?.trip_status ?? null;
      if (!tripStatus || !ACTIVE_TRIP_STATUSES.includes(tripStatus)) {
        return { tripStatus, location: null };
      }
      const { data: pt } = await supabaseAdmin
        .from("trip_location_points")
        .select("latitude, longitude, recorded_at")
        .eq("booking_id", data.bookingId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const p = pt as { latitude?: number; longitude?: number; recorded_at?: string } | null;
      if (!p || p.latitude == null || p.longitude == null) {
        return { tripStatus, location: null };
      }
      return {
        tripStatus,
        location: { lat: Number(p.latitude), lng: Number(p.longitude), recordedAt: p.recorded_at ?? "" },
      };
    },
  );
