import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, type SelectedPlace } from "@/lib/useGoogleMaps";

type Suggestion = {
  placeId: string;
  primary: string;
  secondary: string;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelect: (place: SelectedPlace | null) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
};

const NY_NJ_BIAS = {
  // Rough bounding box around NY / NJ
  low: { latitude: 39.4, longitude: -75.6 },
  high: { latitude: 41.6, longitude: -73.0 },
};

export function PlaceAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  required,
  className,
  id,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const placesLibRef = useRef<google.maps.PlacesLibrary | null>(null);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(async (g) => {
        if (cancelled) return;
        const places = (await g.maps.importLibrary("places")) as google.maps.PlacesLibrary;
        placesLibRef.current = places;
        sessionTokenRef.current = new places.AutocompleteSessionToken();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  function scheduleFetch(text: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchSuggestions(text), 180);
  }

  async function fetchSuggestions(input: string) {
    const places = placesLibRef.current;
    if (!places || !input.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      setLoading(true);
      const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionTokenRef.current ?? undefined,
        includedRegionCodes: ["us"],
        locationBias: NY_NJ_BIAS,
      });
      const mapped: Suggestion[] = suggestions
        .map((s) => {
          const p = s.placePrediction;
          if (!p) return null;
          return {
            placeId: p.placeId,
            primary: p.mainText?.toString() ?? p.text?.toString() ?? "",
            secondary: p.secondaryText?.toString() ?? "",
          } as Suggestion;
        })
        .filter((x): x is Suggestion => !!x);
      setSuggestions(mapped);
      setOpen(true);
    } catch (e) {
      console.error("autocomplete failed", e);
    } finally {
      setLoading(false);
    }
  }

  async function pickSuggestion(s: Suggestion) {
    const places = placesLibRef.current;
    if (!places) return;
    try {
      const place = new places.Place({ id: s.placeId });
      await place.fetchFields({ fields: ["location", "formattedAddress", "types"] });
      const loc = place.location;
      if (!loc) return;
      const types = place.types ?? [];
      const isAirport = types.includes("airport");
      const selected: SelectedPlace = {
        placeId: s.placeId,
        address: place.formattedAddress ?? `${s.primary}, ${s.secondary}`,
        lat: loc.lat(),
        lng: loc.lng(),
        isAirport,
      };
      onChange(selected.address);
      onSelect(selected);
      setSuggestions([]);
      setOpen(false);
      // New session for next lookup
      sessionTokenRef.current = new places.AutocompleteSessionToken();
    } catch (e) {
      console.error("place fetch failed", e);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        required={required}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v);
          onSelect(null);
          scheduleFetch(v);
        }}
        onFocus={() => suggestions.length && setOpen(true)}
        autoComplete="off"
      />
      {open && (loading || suggestions.length > 0) && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-border/70 bg-card shadow-xl">
          {loading && (
            <div className="px-4 py-3 text-xs text-muted-foreground">Searching…</div>
          )}
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => pickSuggestion(s)}
              className="flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left text-sm last:border-0 hover:bg-secondary/60"
            >
              <span className="text-gold">◆</span>
              <span>
                <span className="block font-medium text-foreground">{s.primary}</span>
                <span className="block text-xs text-muted-foreground">{s.secondary}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
