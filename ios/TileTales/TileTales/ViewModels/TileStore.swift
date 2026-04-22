import Foundation
import SwiftUI
import Combine

@MainActor
final class TileStore: ObservableObject {
    @Published var tiles: [TileItem] = []
    @Published var wallpapers: [SavedWallpaper] = []

    private let storageKey = "tile-tales-ios-state"

    init() {
        loadState()
        if tiles.isEmpty {
            tiles = TileItem.samples
        }
    }

    // MARK: - Tiles CRUD

    func addTile(_ tile: TileItem) {
        tiles.append(tile)
        saveState()
    }

    func updateTile(id: String, name: String? = nil, memory: String? = nil, date: String? = nil, tags: [String]? = nil) {
        guard let index = tiles.firstIndex(where: { $0.id == id }) else { return }
        if let name { tiles[index].name = name }
        if let memory { tiles[index].memory = memory }
        if let date { tiles[index].date = date }
        if let tags { tiles[index].tags = tags }
        saveState()
    }

    func deleteTile(id: String) {
        tiles.removeAll { $0.id == id }
        saveState()
    }

    func toggleFavorite(id: String) {
        guard let index = tiles.firstIndex(where: { $0.id == id }) else { return }
        tiles[index].favorite.toggle()
        saveState()
    }

    // MARK: - Tags

    var allTags: [String] {
        let tagSet = Set(tiles.flatMap { $0.tags })
        return tagSet.sorted()
    }

    // MARK: - Wallpapers

    func addWallpaper(image: UIImage) {
        let wp = SavedWallpaper(
            id: UUID().uuidString,
            imageData: image.pngData(),
            createdAt: Date()
        )
        wallpapers.insert(wp, at: 0)
        // Keep max 10
        if wallpapers.count > 10 {
            wallpapers = Array(wallpapers.prefix(10))
        }
        saveState()
    }

    // MARK: - Filtering

    func filteredTiles(filter: TileFilter) -> [TileItem] {
        switch filter {
        case .all:
            return tiles
        case .favorites:
            return tiles.filter { $0.favorite }
        case .tag(let tag):
            return tiles.filter { $0.tags.contains(tag) }
        }
    }

    var geolocatedTiles: [TileItem] {
        tiles.filter { $0.latitude != nil && $0.longitude != nil }
    }

    // MARK: - Persistence

    private func saveState() {
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(StorageState(tiles: tiles, wallpapers: wallpapers)) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    private func loadState() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let state = try? JSONDecoder().decode(StorageState.self, from: data) else {
            return
        }
        tiles = state.tiles
        wallpapers = state.wallpapers
    }
}

enum TileFilter: Equatable, Hashable {
    case all
    case favorites
    case tag(String)

    var label: String {
        switch self {
        case .all: return "All"
        case .favorites: return "Favorites"
        case .tag(let tag): return tag.capitalized
        }
    }
}

private struct StorageState: Codable {
    let tiles: [TileItem]
    let wallpapers: [SavedWallpaper]
}
