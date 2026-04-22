import Foundation
import CoreLocation
import UIKit

struct TileItem: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    var imageData: Data?
    var memory: String
    var date: String
    var tags: [String]
    var favorite: Bool
    var latitude: Double?
    var longitude: Double?
    var createdAt: Date

    var coordinate: CLLocationCoordinate2D? {
        guard let lat = latitude, let lng = longitude else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    var image: UIImage? {
        guard let data = imageData else { return nil }
        return UIImage(data: data)
    }

    static func create(name: String, image: UIImage, location: CLLocation? = nil) -> TileItem {
        TileItem(
            id: UUID().uuidString,
            name: name,
            imageData: image.jpegData(compressionQuality: 0.85),
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

struct SavedWallpaper: Identifiable, Codable {
    let id: String
    var imageData: Data?
    var createdAt: Date

    var image: UIImage? {
        guard let data = imageData else { return nil }
        return UIImage(data: data)
    }
}

// Sample tiles for demo
extension TileItem {
    static let samples: [TileItem] = [
        TileItem(id: "t1", name: "Terrazzo Star", imageData: nil, memory: "", date: "", tags: ["geometric"], favorite: false, latitude: 38.7223, longitude: -9.1393, createdAt: Date()),
        TileItem(id: "t2", name: "Zellige Rose", imageData: nil, memory: "Found in the Medina", date: "March 2026", tags: ["floral", "artisan"], favorite: true, latitude: 34.0331, longitude: -5.0003, createdAt: Date()),
        TileItem(id: "t3", name: "Geometric Orange", imageData: nil, memory: "", date: "", tags: ["geometric"], favorite: false, latitude: 37.3891, longitude: -5.9845, createdAt: Date()),
        TileItem(id: "t4", name: "Floral Green", imageData: nil, memory: "Beautiful garden wall", date: "April 2026", tags: ["floral"], favorite: true, latitude: 41.1579, longitude: -8.6291, createdAt: Date()),
        TileItem(id: "t5", name: "Green Baroque", imageData: nil, memory: "", date: "", tags: ["classic", "geometric"], favorite: false, latitude: 41.3874, longitude: 2.1686, createdAt: Date()),
        TileItem(id: "t6", name: "Star Blue Gold", imageData: nil, memory: "", date: "", tags: ["geometric"], favorite: false, latitude: 37.3891, longitude: -5.9845, createdAt: Date()),
        TileItem(id: "t7", name: "Blue Floral Delft", imageData: nil, memory: "Delft ceramics museum", date: "", tags: ["floral", "classic"], favorite: true, latitude: 52.0116, longitude: 4.3571, createdAt: Date()),
        TileItem(id: "t8", name: "Ochre Scrollwork", imageData: nil, memory: "", date: "", tags: ["classic", "floral"], favorite: false, latitude: 40.4168, longitude: -3.7038, createdAt: Date()),
    ]
}
