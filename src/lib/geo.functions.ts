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

/** An autocomplete suggestion returned to the client. */
export type PlaceSuggestion = {
  placeId: string;
  primary: string;
  secondary: string;
  address: string;
  lat: number;
  lng: number;
  isAirport: boolean;
};

// NY / NJ proximity bias so local addresses surface first.
const BIAS_LON = -74.0;
const BIAS_LAT = 40.73;

/**
 * Server-proxied address autocomplete (Geoapify). Keeps the API key server-side
 * (Lovable secret GEOAPIFY_API_KEY) so nothing is exposed in the browser and it
 * works on any domain. Best-effort: returns [] on any failure so the booking UI
 * degrades gracefully instead of throwing.
 */
export const placeAutocomplete = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }): Promise<PlaceSuggestion[]> => {
    const key = process.env.GEOAPIFY_API_KEY;
    if (!key) return [];
    try {
      const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
      url.searchParams.set("text", data.query);
      url.searchParams.set("format", "json");
      url.searchParams.set("filter", "countrycode:us");
      url.searchParams.set("bias", `proximity:${BIAS_LON},${BIAS_LAT}`);
      url.searchParams.set("limit", "6");
      url.searchParams.set("apiKey", key);

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) return [];
      const json = (await res.json()) as {
        results?: Array<{
          formatted?: string;
          address_line1?: string;
          address_line2?: string;
          lat?: number;
          lon?: number;
          place_id?: string;
          result_type?: string;
          category?: string;
          name?: string;
        }>;
      };

      return (json.results ?? [])
        .filter(
          (r) => typeof r.lat === "number" && typeof r.lon === "number" && !!r.place_id,
        )
        .map((r) => {
          const primary = r.address_line1 || r.name || r.formatted || "";
          const secondary = r.address_line2 || "";
          const hay = `${r.formatted ?? ""} ${r.category ?? ""} ${r.result_type ?? ""}`.toLowerCase();
          const isAirport = hay.includes("airport");
          return {
            placeId: r.place_id as string,
            primary,
            secondary,
            address: r.formatted || [primary, secondary].filter(Boolean).join(", "),
            lat: r.lat as number,
            lng: r.lon as number,
            isAirport,
          } satisfies PlaceSuggestion;
        });
    } catch {
      return [];
    }
  });
