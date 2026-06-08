import Foundation
import SwiftUI
import Combine

@MainActor
final class TileStore: ObservableObject {
    @Published var tiles: [TileItem] = []
    @Published var wallpapers: [SavedWallpaper] = []
    @Published var albums: [Album] = []

    /// Deletion tombstones (id -> deletedAt) so sync can propagate deletes.
    private(set) var deletedTiles: [String: Date] = [:]
    private(set) var deletedAlbums: [String: Date] = [:]

    /// Called after every user-driven mutation (not remote applies) — the sync
    /// engine hooks this to schedule a debounced push.
    var onLocalMutation: (() -> Void)?
    private var applyingRemote = false

    private let storageKey = "tile-tales-ios-state"

    init() {
        loadState()
        if tiles.isEmpty {
            tiles = TileItem.samples
        }
    }

    // MARK: - Tiles CRUD

    func addTile(_ tile: TileItem) {
        var stamped = tile
        if stamped.updatedAt == nil { stamped.updatedAt = Date() }
        tiles.append(stamped)
        saveState()
    }

    func updateTile(id: String, name: String? = nil, memory: String? = nil,
                    date: String? = nil, tags: [String]? = nil,
                    latitude: Double?? = nil, longitude: Double?? = nil) {
        guard let index = tiles.firstIndex(where: { $0.id == id }) else { return }
        if let name { tiles[index].name = name }
        if let memory { tiles[index].memory = memory }
        if let date { tiles[index].date = date }
        if let tags { tiles[index].tags = tags }
        // Double-optional: outer nil = leave untouched, inner nil = clear coordinate.
        if let latitude { tiles[index].latitude = latitude }
        if let longitude { tiles[index].longitude = longitude }
        tiles[index].updatedAt = Date()
        saveState()
    }

    func deleteTile(id: String) {
        tiles.removeAll { $0.id == id }
        // Remove the tile from any album that referenced it.
        for i in albums.indices where albums[i].tileIds.contains(id) {
            albums[i].tileIds.removeAll { $0 == id }
            albums[i].updatedAt = Date()
        }
        deletedTiles[id] = Date()
        saveState()
    }

    func toggleFavorite(id: String) {
        guard let index = tiles.firstIndex(where: { $0.id == id }) else { return }
        tiles[index].favorite.toggle()
        tiles[index].updatedAt = Date()
        saveState()
    }

    // MARK: - Tags

    var allTags: [String] {
        let tagSet = Set(tiles.flatMap { $0.tags })
        return tagSet.sorted()
    }

    /// Tags present only on geolocated tiles — used by the map filter chips.
    var geolocatedTags: [String] {
        let tagSet = Set(geolocatedTiles.flatMap { $0.tags })
        return tagSet.sorted()
    }

    // MARK: - Filtering / search / sort

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

    /// Applies filter → search → sort, the same pipeline the web grid uses.
    func displayedTiles(filter: TileFilter, query: String, sort: SortOrder) -> [TileItem] {
        var result = filteredTiles(filter: filter)

        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !trimmed.isEmpty {
            result = result.filter { tile in
                tile.name.lowercased().contains(trimmed) ||
                tile.tags.contains { $0.lowercased().contains(trimmed) }
            }
        }

        switch sort {
        case .recent:
            // Newest first = reverse of insertion order (matches web).
            result = result.reversed()
        case .aToZ:
            result = result.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        case .favorites:
            result = result.enumerated()
                .sorted { lhs, rhs in
                    if lhs.element.favorite != rhs.element.favorite { return lhs.element.favorite }
                    return lhs.offset < rhs.offset
                }
                .map { $0.element }
        }
        return result
    }

    var geolocatedTiles: [TileItem] {
        tiles.filter { $0.latitude != nil && $0.longitude != nil }
    }

    // MARK: - Albums

    @discardableResult
    func addAlbum(name: String) -> Album {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let album = Album(
            id: "a-\(UUID().uuidString)",
            name: trimmed.isEmpty ? "Untitled album" : trimmed,
            tileIds: [],
            createdAt: Date(),
            updatedAt: Date()
        )
        albums.insert(album, at: 0)
        saveState()
        return album
    }

    func renameAlbum(id: String, name: String) {
        guard let index = albums.firstIndex(where: { $0.id == id }) else { return }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            albums[index].name = trimmed
            albums[index].updatedAt = Date()
        }
        saveState()
    }

    func deleteAlbum(id: String) {
        albums.removeAll { $0.id == id }
        deletedAlbums[id] = Date()
        saveState()
    }

    /// Adds the tile to the album if missing; removes it if already present.
    func toggleTileInAlbum(albumId: String, tileId: String) {
        guard let index = albums.firstIndex(where: { $0.id == albumId }) else { return }
        if let pos = albums[index].tileIds.firstIndex(of: tileId) {
            albums[index].tileIds.remove(at: pos)
        } else {
            albums[index].tileIds.append(tileId)
        }
        albums[index].updatedAt = Date()
        saveState()
    }

    func getAlbumsForTile(_ tileId: String) -> [Album] {
        albums.filter { $0.tileIds.contains(tileId) }
    }

    func tiles(in album: Album) -> [TileItem] {
        album.tileIds.compactMap { id in tiles.first { $0.id == id } }
    }

    // MARK: - Wallpapers

    func addWallpaper(image: UIImage) {
        let wp = SavedWallpaper(
            id: "wp-\(UUID().uuidString)",
            imageData: image.pngData(),
            createdAt: Date()
        )
        wallpapers.insert(wp, at: 0)
        if wallpapers.count > 10 {
            wallpapers = Array(wallpapers.prefix(10))
        }
        saveState()
    }

    func removeWallpaper(id: String) {
        wallpapers.removeAll { $0.id == id }
        saveState()
    }

    // MARK: - Backup import

    /// Merges imported tiles and albums, skipping any whose id already exists so
    /// restoring a backup is idempotent. Returns counts of what was added.
    @discardableResult
    func importData(tiles incoming: [TileItem], albums incomingAlbums: [Album]) -> (addedTiles: Int, addedAlbums: Int) {
        let existingTileIds = Set(tiles.map { $0.id })
        let newTiles = incoming.filter { !existingTileIds.contains($0.id) }
        let existingAlbumIds = Set(albums.map { $0.id })
        let newAlbums = incomingAlbums.filter { !existingAlbumIds.contains($0.id) }
        tiles.append(contentsOf: newTiles)
        albums.append(contentsOf: newAlbums)
        saveState()
        return (newTiles.count, newAlbums.count)
    }

    // MARK: - Sync support

    /// Applies a batch of remote changes without re-stamping updatedAt (so they
    /// aren't pushed back) and without firing onLocalMutation. Updates keep
    /// their array position (order is semantic: "recent" sort reverses it).
    func applyRemoteChanges(
        upsertTiles: [TileItem] = [],
        upsertAlbums: [Album] = [],
        deleteTileIds: [String] = [],
        deleteAlbumIds: [String] = [],
        clearTileTombstones: [String] = [],
        clearAlbumTombstones: [String] = []
    ) {
        applyingRemote = true
        defer { applyingRemote = false }

        let deleteTiles = Set(deleteTileIds)
        let deleteAlbumsSet = Set(deleteAlbumIds)
        let upsertTileMap = Dictionary(uniqueKeysWithValues: upsertTiles.map { ($0.id, $0) })
        let upsertAlbumMap = Dictionary(uniqueKeysWithValues: upsertAlbums.map { ($0.id, $0) })

        let existingTileIds = Set(tiles.map { $0.id })
        tiles = tiles
            .filter { !deleteTiles.contains($0.id) }
            .map { upsertTileMap[$0.id] ?? $0 }
            + upsertTiles.filter { !existingTileIds.contains($0.id) }

        let validIds = Set(tiles.map { $0.id })
        let existingAlbumIds = Set(albums.map { $0.id })
        albums = (albums
            .filter { !deleteAlbumsSet.contains($0.id) }
            .map { upsertAlbumMap[$0.id] ?? $0 }
            + upsertAlbums.filter { !existingAlbumIds.contains($0.id) })
            .map { album in
                var a = album
                a.tileIds = a.tileIds.filter { validIds.contains($0) }
                return a
            }

        clearTileTombstones.forEach { deletedTiles.removeValue(forKey: $0) }
        clearAlbumTombstones.forEach { deletedAlbums.removeValue(forKey: $0) }
        saveState()
    }

    // MARK: - Persistence

    private func saveState() {
        let encoder = JSONEncoder()
        let snapshot = StorageState(
            tiles: tiles, wallpapers: wallpapers, albums: albums,
            deletedTiles: deletedTiles, deletedAlbums: deletedAlbums
        )
        if let data = try? encoder.encode(snapshot) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
        if !applyingRemote { onLocalMutation?() }
    }

    private func loadState() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let state = try? JSONDecoder().decode(StorageState.self, from: data) else {
            return
        }
        tiles = state.tiles
        wallpapers = state.wallpapers
        albums = state.albums
        deletedTiles = state.deletedTiles
        deletedAlbums = state.deletedAlbums
        // Drop dangling tile references inside albums.
        let validIds = Set(tiles.map { $0.id })
        for i in albums.indices {
            albums[i].tileIds.removeAll { !validIds.contains($0) }
        }
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

enum SortOrder: String, CaseIterable, Identifiable {
    case recent
    case aToZ
    case favorites

    var id: String { rawValue }

    var label: String {
        switch self {
        case .recent: return "Recent"
        case .aToZ: return "A–Z"
        case .favorites: return "Favorites first"
        }
    }
}

private struct StorageState: Codable {
    let tiles: [TileItem]
    let wallpapers: [SavedWallpaper]
    var albums: [Album] = []
    var deletedTiles: [String: Date] = [:]
    var deletedAlbums: [String: Date] = [:]
}
