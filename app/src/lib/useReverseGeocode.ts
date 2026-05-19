"use client";

import { useState, useEffect } from "react";
import { reverseGeocode, getCachedReverse } from "./geo";

/**
 * Resolves lat/lng to a "City, Country" label via Nominatim.
 * Returns the cached label synchronously when available, otherwise
 * debounces a fetch (250ms) and updates state once it resolves.
 */
export function useReverseGeocode(
  lat: number | undefined | null,
  lng: number | undefined | null
): string | null {
  const initialCached =
    lat != null && lng != null ? getCachedReverse(lat, lng) : null;
  const [label, setLabel] = useState<string | null>(initialCached);

  useEffect(() => {
    if (lat == null || lng == null) {
      setLabel(null);
      return;
    }
    const cached = getCachedReverse(lat, lng);
    if (cached) {
      setLabel(cached);
      return;
    }
    setLabel(null);
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const result = await reverseGeocode(lat, lng, controller.signal);
      if (!cancelled && result) setLabel(result);
    }, 250);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [lat, lng]);

  return label;
}
