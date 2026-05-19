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
