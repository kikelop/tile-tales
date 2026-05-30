import SwiftUI
import CoreLocation

struct TileGridView: View {
    @EnvironmentObject var store: TileStore
    @Binding var navigationPath: NavigationPath
    @State private var activeFilter: TileFilter = .all
    @State private var showCamera = false
    @State private var showLibrary = false
    @State private var cameraPhotos: [CapturedPhoto] = []
    @State private var libraryPhotos: [CapturedPhoto] = []
    @State private var cropQueue: [CapturedPhoto] = []
    @State private var searchVisible = false
    @State private var searchQuery = ""
    @AppStorage("tt-grid-columns") private var columns = 3
    @AppStorage("tt-sort-order") private var sortRaw = SortOrder.recent.rawValue
    @StateObject private var locationService = LocationService()

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)

    private var sortOrder: SortOrder { SortOrder(rawValue: sortRaw) ?? .recent }

    private var gridColumns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 2), count: columns)
    }

    private var filters: [TileFilter] {
        var f: [TileFilter] = [.all, .favorites]
        f += store.allTags.map { .tag($0) }
        return f
    }

    private var displayedTiles: [TileItem] {
        store.displayedTiles(filter: activeFilter, query: searchQuery, sort: sortOrder)
    }

    private var hasCapturedTiles: Bool {
        store.tiles.contains { $0.isCaptured }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            bgColor.ignoresSafeArea()

            VStack(spacing: 0) {
                header

                if searchVisible {
                    searchField
                }

                if !hasCapturedTiles {
                    onboardingBanner
                }

                // Tile grid
                ScrollView {
                    if displayedTiles.isEmpty {
                        VStack {
                            Spacer(minLength: 100)
                            Text(searchQuery.isEmpty ? "No tiles match this filter" : "No tiles match \u{201C}\(searchQuery)\u{201D}")
                                .foregroundColor(mutedColor)
                                .font(.system(size: 15))
                            Spacer()
                        }
                        .frame(maxWidth: .infinity)
                    } else {
                        LazyVGrid(columns: gridColumns, spacing: 2) {
                            ForEach(displayedTiles) { tile in
                                TileGridCell(tile: tile) {
                                    if let index = store.tiles.firstIndex(where: { $0.id == tile.id }) {
                                        navigationPath.append(AppScreen.viewer(initialIndex: index))
                                    }
                                }
                            }
                        }
                    }
                }

                navTabBar
            }
        }
        .overlay(alignment: .bottomTrailing) {
            addFAB
                .padding(.trailing, 20)
                .padding(.bottom, 76)
        }
        .navigationBarHidden(true)
        .sheet(isPresented: $showCamera) {
            CameraPicker(photos: $cameraPhotos)
        }
        .sheet(isPresented: $showLibrary) {
            PhotoLibraryPicker(photos: $libraryPhotos)
        }
        .fullScreenCover(isPresented: Binding(
            get: { !cropQueue.isEmpty },
            set: { if !$0 { cropQueue = [] } }
        )) {
            CropView(
                photos: cropQueue,
                onConfirm: { photo, cropped in saveTile(from: photo, cropped: cropped) },
                onClose: { cropQueue = [] }
            )
        }
        .onChange(of: cameraPhotos) { _, photos in
            guard !photos.isEmpty else { return }
            cropQueue = photos
            cameraPhotos = []
        }
        .onChange(of: libraryPhotos) { _, photos in
            guard !photos.isEmpty else { return }
            cropQueue = photos
            libraryPhotos = []
        }
        // Pinch to zoom columns
        .gesture(
            MagnificationGesture()
                .onEnded { value in
                    withAnimation(.easeOut(duration: 0.2)) {
                        if value < 0.8 {
                            columns = min(6, columns + 1)
                        } else if value > 1.2 {
                            columns = max(1, columns - 1)
                        }
                    }
                }
        )
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 10) {
            Text("Tile Tales")
                .font(.system(size: 28, weight: .bold))
                .tracking(-0.5)
                .foregroundColor(fgColor)

            // Count → opens Stats
            Button {
                navigationPath.append(AppScreen.stats)
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "chart.bar.fill")
                        .font(.system(size: 10, weight: .semibold))
                    Text("\(store.tiles.count)")
                        .font(.system(size: 14, weight: .medium))
                }
                .foregroundColor(mutedColor)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Color.black.opacity(0.06))
                .clipShape(Capsule())
            }

            Spacer()

            viewMenu
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 12)
    }

    private var viewMenu: some View {
        Menu {
            Picker("Filter", selection: $activeFilter) {
                ForEach(filters, id: \.self) { filter in
                    Text(filter.label).tag(filter)
                }
            }

            Divider()

            Picker("Sort", selection: Binding(
                get: { sortOrder },
                set: { sortRaw = $0.rawValue }
            )) {
                ForEach(SortOrder.allCases) { order in
                    Text(order.label).tag(order)
                }
            }

            Divider()

            Button {
                withAnimation(.easeOut(duration: 0.2)) { columns = max(1, columns - 1) }
            } label: { Label("Bigger tiles", systemImage: "plus.magnifyingglass") }

            Button {
                withAnimation(.easeOut(duration: 0.2)) { columns = min(6, columns + 1) }
            } label: { Label("Smaller tiles", systemImage: "minus.magnifyingglass") }

            Divider()

            Button {
                withAnimation { searchVisible.toggle(); if !searchVisible { searchQuery = "" } }
            } label: { Label(searchVisible ? "Hide search" : "Search", systemImage: "magnifyingglass") }
        } label: {
            Image(systemName: "slider.horizontal.3")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(fgColor)
                .frame(width: 40, height: 40)
                .background(Color.black.opacity(0.06))
                .clipShape(Circle())
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundColor(mutedColor)
            TextField("Search name or tags", text: $searchQuery)
                .font(.system(size: 15))
                .autocorrectionDisabled()
            if !searchQuery.isEmpty {
                Button { searchQuery = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundColor(mutedColor)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .background(Color.black.opacity(0.05))
        .clipShape(Capsule())
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
    }

    private var onboardingBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "hand.tap.fill")
                .foregroundColor(fgColor)
            Text("These are sample tiles. Tap + to capture your first real one.")
                .font(.system(size: 13))
                .foregroundColor(fgColor.opacity(0.8))
            Spacer()
        }
        .padding(12)
        .background(Color.black.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
    }

    // MARK: - Bottom Bar (navigation only — Albums / Map / Wallpaper, centered)

    private var navTabBar: some View {
        HStack(spacing: 28) {
            navButton(systemName: "rectangle.stack", size: 19) { navigationPath.append(AppScreen.albums) }
            navButton(systemName: "mappin.circle", size: 21) { navigationPath.append(AppScreen.map) }
            navButton(systemName: "square.grid.2x2", size: 19) { navigationPath.append(AppScreen.wallpaper) }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(bgColor.opacity(0.92).background(.ultraThinMaterial))
    }

    // Large FAB floating above the tab bar
    private var addFAB: some View {
        Menu {
            Button { showCamera = true } label: { Label("Take photo", systemImage: "camera") }
            Button { showLibrary = true } label: { Label("Choose from library", systemImage: "photo.on.rectangle") }
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 24, weight: .semibold))
                .foregroundColor(.white)
                .frame(width: 56, height: 56)
                .background(fgColor)
                .clipShape(Circle())
                .shadow(color: .black.opacity(0.2), radius: 6, y: 3)
        }
    }

    private func navButton(systemName: String, size: CGFloat, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: size))
                .foregroundColor(fgColor)
                .frame(width: 40, height: 40)
                .background(Color.black.opacity(0.06))
                .clipShape(Circle())
        }
    }

    // MARK: - Save captured tile

    private func saveTile(from photo: CapturedPhoto, cropped: UIImage) {
        Task {
            var location: CLLocation?
            switch photo.source {
            case .camera:
                location = await locationService.getCurrentLocation()
            case .library:
                if let c = photo.coordinate {
                    location = CLLocation(latitude: c.latitude, longitude: c.longitude)
                }
            }
            let tile = TileItem.create(
                name: "Tile #\(store.tiles.count + 1)",
                image: cropped,
                location: location
            )
            store.addTile(tile)
        }
    }
}

// MARK: - Grid Cell

struct TileGridCell: View {
    let tile: TileItem
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            ZStack(alignment: .topTrailing) {
                if let image = tile.image {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(1, contentMode: .fill)
                        .clipped()
                } else {
                    LinearGradient(
                        colors: [
                            Color(red: 74/255, green: 111/255, blue: 165/255).opacity(0.3),
                            Color(red: 232/255, green: 220/255, blue: 200/255)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .aspectRatio(1, contentMode: .fill)
                    .overlay(
                        Text(tile.name.prefix(2).uppercased())
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .foregroundColor(.white.opacity(0.8))
                    )
                }

                if tile.favorite {
                    Text("\u{2665}")
                        .font(.system(size: 18))
                        .foregroundColor(.white)
                        .shadow(color: .black.opacity(0.5), radius: 2, y: 1)
                        .padding(6)
                }
            }
        }
        .buttonStyle(.plain)
    }
}
