export interface GeoPoint {
  lat: number;
  lng: number;
}

export function requestGeolocation(): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

export async function readExifGps(file: File): Promise<GeoPoint | null> {
  try {
    const exifr = await import("exifr");
    const gps = await exifr.gps(file);
    if (
      gps &&
      typeof gps.latitude === "number" &&
      typeof gps.longitude === "number" &&
      Number.isFinite(gps.latitude) &&
      Number.isFinite(gps.longitude)
    ) {
      return { lat: gps.latitude, lng: gps.longitude };
    }
  } catch {}
  return null;
}

export async function readGeoForCapture(
  file: File,
  source: "camera" | "gallery"
): Promise<GeoPoint | null> {
  if (source === "gallery") {
    // For library imports we trust EXIF or nothing — the user's current
    // position is rarely where the photo was actually taken.
    return readExifGps(file);
  }
  return requestGeolocation();
}

export interface PlaceResult {
  label: string;
  lat: number;
  lng: number;
}

// --- Reverse geocoding (lat/lng -> "City, Country") ---
// Backed by Nominatim, results cached in localStorage so we don't
// re-hit the endpoint for every render.

const REVERSE_CACHE_KEY = "tile-tales-rgeo-cache";
let reverseCacheMem: Record<string, string> | null = null;
const inFlightReverse = new Map<string, Promise<string | null>>();

function loadReverseCache(): Record<string, string> {
  if (reverseCacheMem) return reverseCacheMem;
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(REVERSE_CACHE_KEY);
    reverseCacheMem = raw ? JSON.parse(raw) : {};
  } catch {
    reverseCacheMem = {};
  }
  return reverseCacheMem!;
}

function persistReverseCache() {
  if (!reverseCacheMem || typeof window === "undefined") return;
  try {
    localStorage.setItem(REVERSE_CACHE_KEY, JSON.stringify(reverseCacheMem));
  } catch {}
}

function reverseCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function getCachedReverse(lat: number, lng: number): string | null {
  const cache = loadReverseCache();
  return cache[reverseCacheKey(lat, lng)] ?? null;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<string | null> {
  const key = reverseCacheKey(lat, lng);
  const cache = loadReverseCache();
  if (key in cache) return cache[key];
  const existing = inFlightReverse.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&zoom=12`;
      const res = await fetch(url, {
        signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        address?: Record<string, string>;
        display_name?: string;
      };
      const address = data.address ?? {};
      const place =
        address.city ||
        address.town ||
        address.village ||
        address.hamlet ||
        address.suburb ||
        address.county ||
        address.state ||
        "";
      const country = address.country || "";
      const label = [place, country].filter(Boolean).join(", ") || null;
      if (label) {
        cache[key] = label;
        persistReverseCache();
      }
      return label;
    } catch {
      return null;
    } finally {
      inFlightReverse.delete(key);
    }
  })();
  inFlightReverse.set(key, promise);
  return promise;
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=6&addressdetails=0`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      display_name?: string;
      lat?: string;
      lon?: string;
    }>;
    return data
      .map((d) => {
        const lat = d.lat ? parseFloat(d.lat) : NaN;
        const lng = d.lon ? parseFloat(d.lon) : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { label: d.display_name ?? `${lat}, ${lng}`, lat, lng };
      })
      .filter((x): x is PlaceResult => x !== null);
  } catch {
    return [];
  }
}
