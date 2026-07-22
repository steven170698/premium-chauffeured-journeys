import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  placeAutocomplete,
  placeDetails,
  type PlaceSuggestion,
} from "@/lib/geo.functions";
import type { SelectedPlace } from "@/lib/geo.functions";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelect: (place: SelectedPlace | null) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  id?: string;
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
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const run = useServerFn(placeAutocomplete);
  const resolve = useServerFn(placeDetails);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  function scheduleFetch(text: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchSuggestions(text), 220);
  }

  async function fetchSuggestions(input: string) {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      setLoading(true);
      const results = await run({ data: { query: input } });
      setSuggestions(results);
      setOpen(true);
    } catch (e) {
      console.error("autocomplete failed", e);
    } finally {
      setLoading(false);
    }
  }

  async function pickSuggestion(s: PlaceSuggestion) {
    const label = s.address || [s.primary, s.secondary].filter(Boolean).join(", ");
    onChange(label);
    setSuggestions([]);
    setOpen(false);
    try {
      // Google autocomplete has no coordinates — resolve them via place details.
      const place = await resolve({ data: { placeId: s.placeId } });
      if (place) {
        onChange(place.address || label);
        onSelect(place);
      } else {
        onSelect(null);
      }
    } catch (e) {
      console.error("place details failed", e);
      onSelect(null);
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
