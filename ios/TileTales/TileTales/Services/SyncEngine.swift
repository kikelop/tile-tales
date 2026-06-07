import Foundation
import Supabase

// Local-first sync engine — direct port of the web app's lib/sync.ts.
//
//  - pull:  fetch all remote rows (incl. soft-deleted), last-write-wins per row
//  - push:  upload local rows newer than their remote counterpart, plus
//           tombstones as soft deletes; captured images go to private storage
//  - first sign-in: everything local counts as "newer than missing" and gets
//    pushed — that IS the initial migration
//
// Conflict model: LWW comparing local updatedAt with remote updated_at (the
// server re-stamps on write, so "last push wins" across devices).

// MARK: - Row types

private struct TileRow: Codable {
    var user_id: String
    var id: String
    var name: String
    var image_ref: String
    var memory: String
    var date: String
    var tags: [String]
    var favorite: Bool
    var lat: Double?
    var lng: Double?
    var updated_at: String?
    var deleted_at: String?
}

/// Push variant: encodes nils as explicit JSON null (so clearing a location or
/// resurrecting a soft-deleted row actually overwrites the remote column) and
/// omits updated_at (the server trigger stamps it).
private struct PushTileRow: Encodable {
    var user_id: String
    var id: String
    var name: String
    var image_ref: String
    var memory: String
    var date: String
    var tags: [String]
    var favorite: Bool
    var lat: Double?
    var lng: Double?
    var deleted_at: String?

    enum CodingKeys: String, CodingKey {
        case user_id, id, name, image_ref, memory, date, tags, favorite, lat, lng, deleted_at
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(user_id, forKey: .user_id)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
        try c.encode(image_ref, forKey: .image_ref)
        try c.encode(memory, forKey: .memory)
        try c.encode(date, forKey: .date)
        try c.encode(tags, forKey: .tags)
        try c.encode(favorite, forKey: .favorite)
        try c.encode(lat, forKey: .lat)        // nil -> null
        try c.encode(lng, forKey: .lng)        // nil -> null
        try c.encode(deleted_at, forKey: .deleted_at)
    }
}

private struct AlbumRow: Codable {
    var user_id: String
    var id: String
    var name: String
    var created_at: String?
    var updated_at: String?
    var deleted_at: String?
}

private struct AlbumTileRow: Codable {
    var user_id: String
    var album_id: String
    var tile_id: String
}

// MARK: - Timestamp helpers

private let isoWithFraction: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()
private let isoPlain: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
}()

private func parseTimestamp(_ s: String?) -> Date {
    guard let s else { return .distantPast }
    return isoWithFraction.date(from: s) ?? isoPlain.date(from: s) ?? .distantPast
}

private func isoNow() -> String {
    isoWithFraction.string(from: Date())
}

// MARK: - Engine

@MainActor
final class SyncEngine: ObservableObject {
    enum State: Equatable {
        case off, syncing, idle
        case error(String)
    }

    @Published private(set) var state: State = .off
    @Published private(set) var lastSyncAt: Date?

    private weak var store: TileStore?
    private var currentUid: String?
    private var syncTask: Task<Void, Never>?
    private var rerunQueued = false
    private var debounceTask: Task<Void, Never>?
    private var authWatchTask: Task<Void, Never>?

    private let bucket = "tiles"
    private let storagePrefix = "storage:"
    private let assetRefPrefix = "/tiles/"

    func start(store: TileStore, auth: AuthService) {
        guard authWatchTask == nil else { return }
        self.store = store

        store.onLocalMutation = { [weak self] in
            guard let self, self.currentUid != nil else { return }
            self.debounceTask?.cancel()
            self.debounceTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                guard !Task.isCancelled else { return }
                self?.requestSync()
            }
        }

        authWatchTask = Task { [weak self] in
            for await (_, session) in supabase.auth.authStateChanges {
                guard let self else { return }
                let uid = session?.user.id.uuidString.lowercased()
                if uid != self.currentUid {
                    self.currentUid = uid
                    if uid != nil {
                        self.state = .idle
                        self.requestSync()
                    } else {
                        self.state = .off
                    }
                }
            }
        }
    }

    func requestSync() {
        guard let uid = currentUid else { return }
        if syncTask != nil {
            rerunQueued = true
            return
        }
        state = .syncing
        syncTask = Task { [weak self] in
            guard let self else { return }
            do {
                try await self.syncCycle(uid: uid)
                self.state = .idle
                self.lastSyncAt = Date()
            } catch {
                self.state = .error(error.localizedDescription)
            }
            self.syncTask = nil
            if self.rerunQueued {
                self.rerunQueued = false
                self.requestSync()
            }
        }
    }

    // MARK: - Cycle

    private func syncCycle(uid: String) async throws {
        guard let store else { return }

        // ----- pull everything (one user's collection: tiny) -----
        let remoteTileRows: [TileRow] = try await supabase.from("tiles").select().execute().value
        let remoteAlbumRows: [AlbumRow] = try await supabase.from("albums").select().execute().value
        let memberRows: [AlbumTileRow] = try await supabase.from("album_tiles").select().execute().value

        let remoteTiles = Dictionary(uniqueKeysWithValues: remoteTileRows.map { ($0.id, $0) })
        let remoteAlbums = Dictionary(uniqueKeysWithValues: remoteAlbumRows.map { ($0.id, $0) })
        var remoteMembers: [String: [String]] = [:]
        for m in memberRows { remoteMembers[m.album_id, default: []].append(m.tile_id) }

        let localTiles = Dictionary(uniqueKeysWithValues: store.tiles.map { ($0.id, $0) })
        let localAlbums = Dictionary(uniqueKeysWithValues: store.albums.map { ($0.id, $0) })
        let tileTombstones = store.deletedTiles
        let albumTombstones = store.deletedAlbums

        // ----- reconcile tiles -----
        var upsertLocalTiles: [TileItem] = []
        var deleteLocalTileIds: [String] = []
        var pushTiles: [TileItem] = []
        var pushDeleteTileIds: [String] = []

        for (id, row) in remoteTiles {
            let localTile = localTiles[id]
            let remoteTs = parseTimestamp(row.updated_at)
            if let deletedAt = row.deleted_at {
                if let localTile {
                    if (localTile.updatedAt ?? .distantPast) > parseTimestamp(deletedAt) {
                        pushTiles.append(localTile) // edited after the remote delete
                    } else {
                        deleteLocalTileIds.append(id)
                    }
                }
                continue
            }
            guard let localTile else {
                if tileTombstones[id] != nil {
                    pushDeleteTileIds.append(id) // deleted locally while offline
                } else if let tile = await materializeRemoteTile(row) {
                    upsertLocalTiles.append(tile)
                }
                continue
            }
            let localTs = localTile.updatedAt ?? .distantPast
            if remoteTs > localTs {
                if let tile = await materializeRemoteTile(row, existing: localTile) {
                    upsertLocalTiles.append(tile)
                }
            } else if localTs > remoteTs {
                pushTiles.append(localTile)
            }
        }
        for tile in store.tiles where remoteTiles[tile.id] == nil {
            pushTiles.append(tile) // never seen remotely -> initial upload
        }
        for id in tileTombstones.keys {
            if let row = remoteTiles[id], row.deleted_at == nil {
                pushDeleteTileIds.append(id)
            }
        }

        // ----- reconcile albums -----
        var upsertLocalAlbums: [Album] = []
        var deleteLocalAlbumIds: [String] = []
        var pushAlbums: [Album] = []
        var pushDeleteAlbumIds: [String] = []

        for (id, row) in remoteAlbums {
            let localAlbum = localAlbums[id]
            let remoteTs = parseTimestamp(row.updated_at)
            if let deletedAt = row.deleted_at {
                if let localAlbum {
                    if (localAlbum.updatedAt ?? .distantPast) > parseTimestamp(deletedAt) {
                        pushAlbums.append(localAlbum)
                    } else {
                        deleteLocalAlbumIds.append(id)
                    }
                }
                continue
            }
            let remoteAlbum = Album(
                id: row.id,
                name: row.name,
                tileIds: remoteMembers[row.id] ?? [],
                createdAt: parseTimestamp(row.created_at),
                updatedAt: remoteTs
            )
            guard let localAlbum else {
                if albumTombstones[id] != nil {
                    pushDeleteAlbumIds.append(id)
                } else {
                    upsertLocalAlbums.append(remoteAlbum)
                }
                continue
            }
            let localTs = localAlbum.updatedAt ?? .distantPast
            if remoteTs > localTs {
                upsertLocalAlbums.append(remoteAlbum)
            } else if localTs > remoteTs {
                pushAlbums.append(localAlbum)
            }
        }
        for album in store.albums where remoteAlbums[album.id] == nil {
            pushAlbums.append(album)
        }
        for id in albumTombstones.keys {
            if let row = remoteAlbums[id], row.deleted_at == nil {
                pushDeleteAlbumIds.append(id)
            }
        }

        // ----- apply remote -> local (one batch) -----
        if !upsertLocalTiles.isEmpty || !upsertLocalAlbums.isEmpty
            || !deleteLocalTileIds.isEmpty || !deleteLocalAlbumIds.isEmpty {
            store.applyRemoteChanges(
                upsertTiles: upsertLocalTiles,
                upsertAlbums: upsertLocalAlbums,
                deleteTileIds: deleteLocalTileIds,
                deleteAlbumIds: deleteLocalAlbumIds
            )
        }

        // ----- push local -> remote -----
        for tile in pushTiles {
            if let data = tile.imageData {
                try await supabase.storage.from(bucket).upload(
                    storagePath(uid: uid, tileId: tile.id),
                    data: data,
                    options: FileOptions(cacheControl: "3600", contentType: "image/jpeg", upsert: true)
                )
            }
            try await supabase.from("tiles").upsert(pushRow(for: tile, uid: uid)).execute()
        }

        if !pushDeleteTileIds.isEmpty {
            try await supabase.from("tiles")
                .update(["deleted_at": isoNow()])
                .in("id", values: pushDeleteTileIds)
                .execute()
            // Best-effort: free storage objects of deleted captures
            _ = try? await supabase.storage.from(bucket)
                .remove(paths: pushDeleteTileIds.map { storagePath(uid: uid, tileId: $0) })
        }

        for album in pushAlbums {
            try await supabase.from("albums").upsert(AlbumRow(
                user_id: uid,
                id: album.id,
                name: album.name,
                created_at: isoWithFraction.string(from: album.createdAt),
                updated_at: nil,
                deleted_at: nil
            )).execute()
            // Membership: replace wholesale (collections are small)
            try await supabase.from("album_tiles").delete().eq("album_id", value: album.id).execute()
            if !album.tileIds.isEmpty {
                let rows = album.tileIds.map { AlbumTileRow(user_id: uid, album_id: album.id, tile_id: $0) }
                try await supabase.from("album_tiles").insert(rows).execute()
            }
        }

        if !pushDeleteAlbumIds.isEmpty {
            try await supabase.from("albums")
                .update(["deleted_at": isoNow()])
                .in("id", values: pushDeleteAlbumIds)
                .execute()
        }

        // ----- tombstones propagated; clear them -----
        let clearTiles = tileTombstones.keys.filter { id in
            pushDeleteTileIds.contains(id) || remoteTiles[id] == nil || remoteTiles[id]?.deleted_at != nil
        }
        let clearAlbums = albumTombstones.keys.filter { id in
            pushDeleteAlbumIds.contains(id) || remoteAlbums[id] == nil || remoteAlbums[id]?.deleted_at != nil
        }
        if !clearTiles.isEmpty || !clearAlbums.isEmpty {
            store.applyRemoteChanges(
                clearTileTombstones: Array(clearTiles),
                clearAlbumTombstones: Array(clearAlbums)
            )
        }
    }

    // MARK: - Mapping

    private func storagePath(uid: String, tileId: String) -> String {
        "\(uid)/\(tileId).webp"
    }

    private func pushRow(for tile: TileItem, uid: String) -> PushTileRow {
        let imageRef: String
        if tile.imageData != nil {
            imageRef = storagePrefix + storagePath(uid: uid, tileId: tile.id)
        } else if let asset = tile.assetName {
            imageRef = "\(assetRefPrefix)\(asset).webp" // same ref the web uses
        } else {
            imageRef = ""
        }
        return PushTileRow(
            user_id: uid,
            id: tile.id,
            name: tile.name,
            image_ref: imageRef,
            memory: tile.memory,
            date: tile.date,
            tags: tile.tags,
            favorite: tile.favorite,
            lat: tile.latitude,
            lng: tile.longitude,
            deleted_at: nil
        )
    }

    /// Builds the local TileItem for a remote row, downloading the image from
    /// storage when needed (reusing the bytes already on device if present).
    /// Returns nil if a storage-backed image can't be fetched — the next sync
    /// retries instead of inserting a broken tile.
    private func materializeRemoteTile(_ row: TileRow, existing: TileItem? = nil) async -> TileItem? {
        var imageData: Data?
        var assetName: String?

        if row.image_ref.hasPrefix(storagePrefix) {
            if let existingData = existing?.imageData {
                imageData = existingData // same capture, just metadata changed
            } else {
                let path = String(row.image_ref.dropFirst(storagePrefix.count))
                guard let data = try? await supabase.storage.from(bucket).download(path: path) else {
                    return nil
                }
                imageData = data
            }
        } else if row.image_ref.hasPrefix(assetRefPrefix) {
            assetName = String(row.image_ref.dropFirst(assetRefPrefix.count))
                .replacingOccurrences(of: ".webp", with: "")
        }

        return TileItem(
            id: row.id,
            name: row.name,
            imageData: imageData,
            assetName: assetName,
            memory: row.memory,
            date: row.date,
            tags: row.tags,
            favorite: row.favorite,
            latitude: row.lat,
            longitude: row.lng,
            createdAt: existing?.createdAt ?? Date(),
            updatedAt: parseTimestamp(row.updated_at)
        )
    }
}
