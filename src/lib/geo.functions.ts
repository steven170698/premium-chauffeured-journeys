import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** A place chosen by the customer, used across the booking flow. */
export type SelectedPlace = {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
  isAirport: boolean;
};

/** An autocomplete suggestion. Google returns no coordinates here — they are
 *  resolved with placeDetails() when the customer picks a suggestion. */
export type PlaceSuggestion = {
  placeId: string;
  primary: string;
  secondary: string;
  address: string;
};

// NY / NJ bias so local addresses surface first.
const BIAS_LAT = 40.73;
const BIAS_LON = -74.0;

/**
 * Server-proxied Google Places (New) autocomplete. Keeps the API key server-side
 * (Lovable secret GOOGLE_MAPS_API_KEY) so nothing is exposed in the browser and
 * it works on any domain. Best-effort: returns [] on any failure so the booking
 * UI degrades gracefully instead of throwing.
 */
export const placeAutocomplete = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }): Promise<PlaceSuggestion[]> => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return [];
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
        body: JSON.stringify({
          input: data.query,
          includedRegionCodes: ["us"],
          locationBias: {
            circle: {
              center: { latitude: BIAS_LAT, longitude: BIAS_LON },
              radius: 50000,
            },
          },
        }),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        suggestions?: Array<{
          placePrediction?: {
            placeId?: string;
            text?: { text?: string };
            structuredFormat?: {
              mainText?: { text?: string };
              secondaryText?: { text?: string };
            };
          };
        }>;
      };
      return (json.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => !!p && !!p.placeId)
        .map((p) => ({
          placeId: p.placeId as string,
          primary: p.structuredFormat?.mainText?.text || p.text?.text || "",
          secondary: p.structuredFormat?.secondaryText?.text || "",
          address: p.text?.text || "",
        }));
    } catch {
      return [];
    }
  });

/**
 * Resolve a placeId to coordinates + a formatted address (Google Place Details
 * New). Called when the customer selects a suggestion. Returns null on failure.
 */
export const placeDetails = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ placeId: z.string().trim().min(1).max(400) }).parse(data),
  )
  .handler(async ({ data }): Promise<SelectedPlace | null> => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return null;
    try {
      const url =
        `https://places.googleapis.com/v1/places/${encodeURIComponent(data.placeId)}` +
        `?fields=location,formattedAddress,types`;
      const res = await fetch(url, { headers: { "X-Goog-Api-Key": key } });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        location?: { latitude?: number; longitude?: number };
        formattedAddress?: string;
        types?: string[];
      };
      const lat = json.location?.latitude;
      const lng = json.location?.longitude;
      if (typeof lat !== "number" || typeof lng !== "number") return null;
      return {
        placeId: data.placeId,
        address: json.formattedAddress || "",
        lat,
        lng,
        isAirport: (json.types ?? []).includes("airport"),
      };
    } catch {
      return null;
    }
  });
