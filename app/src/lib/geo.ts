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
    const exif = await readExifGps(file);
    if (exif) return exif;
  }
  return requestGeolocation();
}
