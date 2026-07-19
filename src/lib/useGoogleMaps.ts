/// <reference types="google.maps" />
import { useEffect, useState } from "react";

declare global {
  interface Window {
    google?: typeof google;
    __stevieMapsLoader?: Promise<typeof google>;
    __stevieInitMap?: () => void;
  }
}


const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as
  | string
  | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as
  | string
  | undefined;

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (window.__stevieMapsLoader) return window.__stevieMapsLoader;
  if (!BROWSER_KEY) return Promise.reject(new Error("Missing Google Maps browser key"));

  window.__stevieMapsLoader = new Promise<typeof google>((resolve, reject) => {
    window.__stevieInitMap = () => {
      if (window.google) resolve(window.google);
      else reject(new Error("Google Maps failed to initialize"));
    };
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      libraries: "places",
      callback: "__stevieInitMap",
      v: "weekly",
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return window.__stevieMapsLoader;
}

export function useGoogleMaps() {
  const [ready, setReady] = useState<boolean>(
    typeof window !== "undefined" && !!window.google?.maps,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, error };
}

export type SelectedPlace = {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
  isAirport: boolean;
};
