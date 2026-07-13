import SwiftUI

/// Stats content — rendered inside ProfileView's Stats tab.
struct StatsContent: View {
    @EnvironmentObject var store: TileStore
    @StateObject private var geocoder = GeocodingService.shared

    @State private var placeCounts: [(label: String, count: Int)] = []
    @State private var resolvingPlaces = false

    private let bgColor = Brand.bg
    private let fgColor = Brand.fg
    private let mutedColor = Brand.muted

    private var capturedCount: Int { store.tiles.filter { $0.isCaptured }.count }
    private var favoriteCount: Int { store.tiles.filter { $0.favorite }.count }
    private var locatedCount: Int { store.geolocatedTiles.count }

    private var topTags: [(tag: String, count: Int)] {
        var counts: [String: Int] = [:]
        for tile in store.tiles { for tag in tile.tags { counts[tag, default: 0] += 1 } }
        return counts.sorted { $0.value > $1.value }.prefix(6).map { ($0.key, $0.value) }
    }

    private var countryCount: Int {
        Set(placeCounts.map { $0.label.components(separatedBy: ", ").last ?? $0.label }).count
    }

    var body: some View {
        VStack(spacing: 20) {
            hero
            cardsGrid
            if !topTags.isEmpty { topTagsSection }
            if !placeCounts.isEmpty || resolvingPlaces { placesSection }
        }
        .onAppear(perform: resolvePlaces)
    }

    private var hero: some View {
        VStack(spacing: 4) {
            Text("\(store.tiles.count)")
                .font(.system(size: 56, weight: .bold))
                .foregroundColor(fgColor)
            Text("tiles in your collection")
                .font(.system(size: 15)).foregroundColor(mutedColor)
            if capturedCount > 0 {
                Text("\(capturedCount) captured by you")
                    .font(.system(size: 13, weight: .medium)).foregroundColor(mutedColor)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(Color.black.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var cardsGrid: some View {
        let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
        return LazyVGrid(columns: columns, spacing: 12) {
            statCard("Favorites", value: "\(favoriteCount)", icon: "heart.fill")
            statCard("Located", value: "\(locatedCount)", icon: "mappin.circle.fill")
            // While geocoding is still resolving, show "—" instead of a misleading 0.
            statCard("Countries", value: countriesDisplay, icon: "globe.europe.africa.fill")
            statCard("Albums", value: "\(store.albums.count)", icon: "rectangle.stack.fill")
        }
    }

    private var countriesDisplay: String {
        (resolvingPlaces && placeCounts.isEmpty) ? "—" : "\(countryCount)"
    }

    private func statCard(_ title: String, value: String, icon: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 20)).foregroundColor(fgColor.opacity(0.7))
            VStack(alignment: .leading, spacing: 2) {
                Text(value).font(.system(size: 24, weight: .bold)).foregroundColor(fgColor)
                Text(title).font(.system(size: 12)).foregroundColor(mutedColor)
            }
            Spacer()
        }
        .padding(14)
        .background(Color.black.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var topTagsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Top tags").font(.system(size: 16, weight: .semibold)).foregroundColor(fgColor)
            let maxCount = topTags.first?.count ?? 1
            ForEach(topTags, id: \.tag) { item in
                HStack(spacing: 10) {
                    Text(item.tag.capitalized).font(.system(size: 13)).foregroundColor(fgColor).frame(width: 90, alignment: .leading)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.black.opacity(0.05))
                            Capsule().fill(fgColor.opacity(0.8))
                                .frame(width: geo.size.width * CGFloat(item.count) / CGFloat(maxCount))
                        }
                    }
                    .frame(height: 10)
                    Text("\(item.count)").font(.system(size: 12)).foregroundColor(mutedColor).frame(width: 24)
                }
            }
        }
        .padding(16)
        .background(Color.black.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var placesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Places").font(.system(size: 16, weight: .semibold)).foregroundColor(fgColor)
            if resolvingPlaces && placeCounts.isEmpty {
                Text("Resolving locations…").font(.system(size: 13)).foregroundColor(mutedColor)
            }
            ForEach(placeCounts, id: \.label) { item in
                HStack {
                    Image(systemName: "mappin").foregroundColor(mutedColor)
                    Text(item.label).font(.system(size: 14)).foregroundColor(fgColor)
                    Spacer()
                    Text("\(item.count)").font(.system(size: 13, weight: .medium)).foregroundColor(mutedColor)
                }
                .padding(.vertical, 4)
            }
        }
        .padding(16)
        .background(Color.black.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    /// Resolves "City, Country" for each geolocated tile sequentially (CLGeocoder
    /// throttles), aggregating counts per place.
    private func resolvePlaces() {
        let tiles = store.geolocatedTiles
        guard !tiles.isEmpty else { return }
        resolvingPlaces = true
        Task {
            var counts: [String: Int] = [:]
            for tile in tiles {
                guard let lat = tile.latitude, let lng = tile.longitude else { continue }
                if let label = await geocoder.reverseGeocode(lat: lat, lng: lng) {
                    counts[label, default: 0] += 1
                }
            }
            placeCounts = counts.sorted { $0.value > $1.value }.map { ($0.key, $0.value) }
            resolvingPlaces = false
        }
    }
}


// MARK: - Backup section (Profile's Account tab)

struct BackupSectionView: View {
    @EnvironmentObject var store: TileStore

    @State private var backupURL: URL?
    @State private var showShare = false
    @State private var showImport = false
    @State private var importMessage: String?

    private let fgColor = Brand.fg
    private let mutedColor = Brand.muted

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Backup").font(.system(size: 16, weight: .semibold)).foregroundColor(fgColor)
            Text("Export your collection to a file, or restore from one. Captured tile images are included.")
                .font(.system(size: 12)).foregroundColor(mutedColor)
            HStack(spacing: 10) {
                Button { exportBackup() } label: {
                    Label("Export", systemImage: "square.and.arrow.up")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .background(fgColor).clipShape(RoundedRectangle(cornerRadius: 12))
                }
                Button { showImport = true } label: {
                    Label("Import", systemImage: "square.and.arrow.down")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(fgColor)
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.black.opacity(0.15), lineWidth: 1))
                }
            }
        }
        .padding(16)
        .background(Color.black.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .sheet(isPresented: $showShare) {
            if let url = backupURL { ActivityView(items: [url]) }
        }
        .sheet(isPresented: $showImport) {
            BackupDocumentPicker { data in handleImport(data) }
        }
        .alert("Backup", isPresented: Binding(
            get: { importMessage != nil },
            set: { if !$0 { importMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(importMessage ?? "")
        }
    }

    private func exportBackup() {
        do {
            backupURL = try BackupService.makeBackupFile(tiles: store.tiles, albums: store.albums)
            showShare = true
        } catch {
            importMessage = "Couldn't create the backup file."
        }
    }

    private func handleImport(_ data: Data) {
        guard let manifest = BackupService.decode(data) else {
            importMessage = "That file isn't a valid Tile Tales backup."
            return
        }
        let result = store.importData(tiles: manifest.tiles, albums: manifest.albums)
        importMessage = "Imported \(result.addedTiles) tile\(result.addedTiles == 1 ? "" : "s") and \(result.addedAlbums) album\(result.addedAlbums == 1 ? "" : "s")."
    }
}
