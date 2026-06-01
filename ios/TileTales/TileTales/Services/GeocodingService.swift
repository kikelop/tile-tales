import Foundation
import CoreLocation

/// Native replacement for the web app's Nominatim usage. Uses CLGeocoder:
/// free, no API key, and Apple handles throttling. Results are cached in
/// memory keyed by rounded coordinates / query so repeated lookups are instant.
@MainActor
final class GeocodingService: ObservableObject {
    static let shared = GeocodingService()

    private let geocoder = CLGeocoder()
    private var reverseCache: [String: String] = [:]

    private func key(_ lat: Double, _ lng: Double) -> String {
        // ~11m precision, same rounding the web cache used.
        String(format: "%.4f,%.4f", lat, lng)
    }

    /// Synchronous cache hit, if any — lets views render a label immediately.
    func cachedLabel(lat: Double, lng: Double) -> String? {
        reverseCache[key(lat, lng)]
    }

    /// "City, Country" for a coordinate, or nil if it can't be resolved.
    func reverseGeocode(lat: Double, lng: Double) async -> String? {
        let cacheKey = key(lat, lng)
        if let cached = reverseCache[cacheKey] { return cached }

        let location = CLLocation(latitude: lat, longitude: lng)
        guard let placemark = try? await geocoder.reverseGeocodeLocation(location).first else {
            return nil
        }
        let label = Self.label(from: placemark)
        if let label { reverseCache[cacheKey] = label }
        return label
    }

    /// Forward search for the "Search a place" flow. Returns up to a handful of
    /// matches with a display label and coordinate.
    func searchPlaces(query: String) async -> [PlaceResult] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return [] }
        guard let placemarks = try? await geocoder.geocodeAddressString(trimmed) else {
            return []
        }
        return placemarks.compactMap { placemark in
            guard let coordinate = placemark.location?.coordinate else { return nil }
            let label = Self.label(from: placemark) ?? placemark.name ?? trimmed
            return PlaceResult(label: label, latitude: coordinate.latitude, longitude: coordinate.longitude)
        }
    }

    /// Builds "City, Country" — falls back through the administrative levels the
    /// way the web's trimDisplayName did (first meaningful segment + country).
    private static func label(from placemark: CLPlacemark) -> String? {
        let primary = placemark.locality
            ?? placemark.subAdministrativeArea
            ?? placemark.administrativeArea
            ?? placemark.name
        let country = placemark.country
        switch (primary, country) {
        case let (p?, c?): return "\(p), \(c)"
        case let (p?, nil): return p
        case let (nil, c?): return c
        default: return nil
        }
    }
}

struct PlaceResult: Identifiable {
    let id = UUID()
    let label: String
    let latitude: Double
    let longitude: Double
}
