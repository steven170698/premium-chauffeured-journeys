import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "./stripe.server";

const placeSchema = z.object({
  placeId: z.string().min(1),
  address: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  isAirport: z.boolean().optional(),
});

const checkoutInputSchema = z.object({
  environment: z.enum(["sandbox", "live"]),
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().min(3).max(40),
  pickup: placeSchema,
  destination: placeSchema,
  pickupAt: z.string().min(1),
  isRoundTrip: z.boolean().optional().default(false),
  returnAt: z.string().optional().nullable(),
  passengers: z.number().int().min(1).max(8).optional().default(1),
  bags: z.number().int().min(0).max(20).optional().default(0),
  extraStop: z.string().optional().nullable(),
  flightNumber: z.string().optional().nullable(),
  specialInstructions: z.string().optional().nullable(),
  returnUrl: z.string().url(),
});

type CheckoutResult = { clientSecret: string; bookingId: string } | { error: string };

export const createBookingCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkoutInputSchema.parse(data))
  .handler(async ({ data }): Promise<CheckoutResult> => {
    try {
      // 1. Recompute quote server-side (never trust the client)
      const { computeQuoteInternal } = await import("./quote.server");
      const quote = await computeQuoteInternal({
        pickup: data.pickup,
        destination: data.destination,
        extraStops: data.extraStop ? 1 : 0,
        roundTrip: data.isRoundTrip,
      });

      // 2. Insert booking row (admin client bypasses RLS — guest bookings allowed)
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const pickupAt = new Date(data.pickupAt);
      const estimatedEndAt = new Date(
        pickupAt.getTime() + quote.durationMinutes * 60 * 1000,
      );

      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .insert({
          full_name: data.fullName,
          email: data.email,
          phone: data.phone,
          pickup_address: data.pickup.address,
          pickup_lat: data.pickup.lat,
          pickup_lng: data.pickup.lng,
          destination_address: data.destination.address,
          destination_lat: data.destination.lat,
          destination_lng: data.destination.lng,
          pickup_at: pickupAt.toISOString(),
          is_round_trip: data.isRoundTrip,
          return_at: data.returnAt ? new Date(data.returnAt).toISOString() : null,
          passengers: data.passengers,
          bags: data.bags,
          extra_stops: data.extraStop || null,
          special_instructions: data.specialInstructions || null,
          distance_miles: quote.distanceMiles,
          duration_minutes: quote.durationMinutes,
          estimated_end_at: estimatedEndAt.toISOString(),
          base_fare: quote.baseFare,
          mileage_charge: quote.mileage,
          time_charge: quote.time,
          booking_fee: quote.bookingFee,
          airport_stop_fees: quote.airportSurcharge + quote.stopsFee,
          toll_estimate: quote.tollsEstimate,
          subtotal: quote.subtotal,
          total: quote.total,
          balance_due: quote.total,
          trip_status: "pending_approval",
          payment_status: "unpaid",
        })
        .select("id, reservation_number, total")
        .single();

      if (bookingError || !booking) {
        console.error("Booking insert failed:", bookingError);
        return { error: bookingError?.message ?? "Could not save your booking." };
      }

      // 3. Create Stripe Checkout session (embedded, one-time payment)
      const stripe = createStripeClient(data.environment as StripeEnv);
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Chauffeur ride ${booking.reservation_number}`,
                description: `${data.pickup.address} → ${data.destination.address}${
                  data.isRoundTrip ? " (round trip)" : ""
                }`,
              },
              unit_amount: Math.round(Number(booking.total) * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: `${data.returnUrl}?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking.id}`,
        customer_email: data.email,
        payment_intent_data: {
          description: `Stevie Services — ${booking.reservation_number}`,
        },
        metadata: {
          booking_id: booking.id,
          reservation_number: booking.reservation_number,
        },
      });

      // 4. Save session id on the booking so we can reconcile later
      await supabaseAdmin
        .from("bookings")
        .update({ stripe_session_id: session.id })
        .eq("id", booking.id);

      return {
        clientSecret: session.client_secret ?? "",
        bookingId: booking.id,
      };
    } catch (error) {
      console.error("createBookingCheckout error:", error);
      return { error: getStripeErrorMessage(error) };
    }
  });
