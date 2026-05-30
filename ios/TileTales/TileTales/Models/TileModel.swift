import Foundation
import CoreLocation
import UIKit

struct TileItem: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    /// Inline image data for tiles the user captured. Persisted in UserDefaults.
    var imageData: Data?
    /// Bundled asset name for the curated sample tiles. Keeps sample images out
    /// of UserDefaults (mirrors the web app's `/tiles/*.webp` path references vs
    /// `idb:` captured blobs). Exactly one of imageData / assetName is set.
    var assetName: String?
    var memory: String
    var date: String
    var tags: [String]
    var favorite: Bool
    var latitude: Double?
    var longitude: Double?
    var createdAt: Date

    /// True for tiles the user captured (have inline image data), false for the
    /// bundled samples. Used by Stats' "captured by you" count.
    var isCaptured: Bool { imageData != nil }

    var coordinate: CLLocationCoordinate2D? {
        guard let lat = latitude, let lng = longitude else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    var image: UIImage? {
        if let data = imageData {
            return UIImage(data: data)
        }
        if let assetName {
            return UIImage(named: assetName)
        }
        return nil
    }

    static func create(name: String, image: UIImage, location: CLLocation? = nil) -> TileItem {
        TileItem(
            id: "t-\(UUID().uuidString)",
            name: name,
            imageData: image.jpegData(compressionQuality: 0.85),
            assetName: nil,
            memory: "",
            date: "",
            tags: [],
            favorite: false,
            latitude: location?.coordinate.latitude,
            longitude: location?.coordinate.longitude,
            createdAt: Date()
        )
    }
}

struct Album: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    var tileIds: [String]
    var createdAt: Date
}

struct SavedWallpaper: Identifiable, Codable {
    let id: String
    var imageData: Data?
    var createdAt: Date

    var image: UIImage? {
        guard let data = imageData else { return nil }
        return UIImage(data: data)
    }
}

// MARK: - Curated sample tiles

extension TileItem {
    /// One sample, asset-backed. Coordinates and favorites mirror the web app's
    /// curated DEFAULT_TILES (app/src/lib/store.ts).
    private static func sample(_ id: String, _ name: String, _ asset: String,
                               tags: [String], favorite: Bool = false,
                               lat: Double? = nil, lng: Double? = nil) -> TileItem {
        TileItem(id: id, name: name, imageData: nil, assetName: asset, memory: "",
                 date: "", tags: tags, favorite: favorite,
                 latitude: lat, longitude: lng, createdAt: Date())
    }

    /// Order matches the web DEFAULT_TILES: the default "recent" sort reverses
    /// this list, so the last entry (Star Compass) is the hero the grid shows
    /// first and the 3D viewer opens on.
    static let samples: [TileItem] = [
        sample("t7", "Pink Marble", "pink-marble", tags: ["marble"]),
        sample("t4", "Floral Green", "floral-green", tags: ["floral"], lat: 41.1579, lng: -8.6291),
        sample("t12", "Fleur de Lis", "fleur-de-lis-rust", tags: ["classic"], lat: 43.2630, lng: -2.9350),
        sample("t1", "Terrazzo Star", "terrazzo-star", tags: ["geometric"], lat: 38.7223, lng: -9.1393),
        sample("t8", "Yellow Zellige", "yellow-zellige", tags: ["artisan"], favorite: true, lat: 33.9716, lng: -6.8498),
        sample("t13", "Black Baroque", "black-baroque", tags: ["classic"], lat: 41.3874, lng: 2.1686),
        sample("t3", "Geometric Orange", "geometric-orange", tags: ["geometric"], lat: 37.3891, lng: -5.9845),
        sample("t6", "Green Baroque", "green-baroque", tags: ["classic", "geometric"], lat: 41.3874, lng: 2.1686),
        sample("t14", "Ochre Scrollwork", "ochre-scrollwork", tags: ["classic", "floral"], lat: 40.4168, lng: -3.7038),
        sample("t9", "Star Blue Gold", "star-blue-gold", tags: ["geometric"], favorite: true, lat: 37.3891, lng: -5.9845),
        sample("t2", "Zellige Rose", "zellige-rose", tags: ["floral", "artisan"], favorite: true, lat: 34.0331, lng: -5.0003),
        sample("t11", "Blue Floral Delft", "blue-floral-delft", tags: ["floral", "classic"], favorite: true, lat: 52.0116, lng: 4.3571),
        sample("t10", "Star Compass", "star-compass", tags: ["geometric"], favorite: true, lat: 38.7223, lng: -9.1393),
    ]
}
