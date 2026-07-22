import { useEffect, useRef } from "react";

type LatLng = { lat: number; lng: number };

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    __leafletLoader?: Promise<any>;
  }
}

/** Load Leaflet (JS + CSS) from CDN once, on the client. No API key needed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.L) return Promise.resolve(window.L);
  if (window.__leafletLoader) return window.__leafletLoader;
  window.__leafletLoader = new Promise((resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Failed to load map"));
    document.head.appendChild(script);
  });
  return window.__leafletLoader;
}

/**
 * Live tracking map for the public ride page. Shows the pickup pin and the
 * driver's moving marker; the parent polls the driver location and passes it in.
 */
export function LiveMap({ pickup, driver }: { pickup: LatLng; driver: LatLng | null }) {
  const elRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const driverMarkerRef = useRef<any>(null);

  // Initialise the map + pickup pin once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !elRef.current || mapRef.current) return;
        const map = L.map(elRef.current).setView([pickup.lat, pickup.lng], 13);
        mapRef.current = map;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(map);
        L.marker([pickup.lat, pickup.lng], {
          icon: L.divIcon({
            className: "",
            html: '<div style="font-size:26px;line-height:1">📍</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 26],
          }),
        })
          .addTo(map)
          .bindPopup("Pickup");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        driverMarkerRef.current = null;
      }
    };
  }, [pickup.lat, pickup.lng]);

  // Move / create the driver marker whenever a new location comes in.
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    if (!L || !map || !driver) return;
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = L.marker([driver.lat, driver.lng], {
        icon: L.divIcon({
          className: "",
          html:
            '<div style="width:24px;height:24px;border-radius:50%;background:#d4af37;border:3px solid #fff;box-shadow:0 0 0 2px rgba(212,175,55,.5);display:grid;place-items:center;font-size:12px">🚗</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      })
        .addTo(map)
        .bindPopup("Your driver");
    } else {
      driverMarkerRef.current.setLatLng([driver.lat, driver.lng]);
    }
    try {
      map.fitBounds(
        [
          [pickup.lat, pickup.lng],
          [driver.lat, driver.lng],
        ],
        { padding: [45, 45], maxZoom: 14 },
      );
    } catch {
      /* single-point bounds — ignore */
    }
  }, [driver?.lat, driver?.lng, pickup.lat, pickup.lng]);

  return (
    <div
      ref={elRef}
      className="h-72 w-full overflow-hidden rounded-2xl border border-border/60"
    />
  );
}
