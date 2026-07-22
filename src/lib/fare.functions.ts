import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const placeSchema = z.object({
  placeId: z.string().min(1),
  address: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  isAirport: z.boolean().optional(),
});

const quoteInputSchema = z.object({
  pickup: placeSchema,
  destination: placeSchema,
  extraStops: z.number().int().min(0).max(10).optional().default(0),
  roundTrip: z.boolean().optional().default(false),
  pickupAt: z.string().optional().nullable(),
  serviceType: z.string().optional().nullable(),
  hourlyHours: z.number().min(0).max(24).optional().nullable(),
  meetAndGreet: z.boolean().optional().default(false),
  childSeat: z.boolean().optional().default(false),
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;

export type QuoteResult = {
  distanceMiles: number;
  durationMinutes: number;
  hourly: boolean;
  hours: number;
  hourlyCharge: number;
  baseFare: number;
  mileage: number;
  time: number;
  bookingFee: number;
  airportSurcharge: number;
  stopsFee: number;
  meetGreetFee: number;
  childSeatFee: number;
  surcharges: number;
  tollsEstimate: number;
  subtotal: number;
  total: number;
  roundTrip: boolean;
  currency: "USD";
};

export const computeQuote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => quoteInputSchema.parse(data))
  .handler(async ({ data }): Promise<QuoteResult> => {
    const { computeQuoteInternal } = await import("./quote.server");
    return computeQuoteInternal(data);
  });
