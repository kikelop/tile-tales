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
    // Column count captured when a pinch begins, so we can recompute live.
    @State private var pinchBaseColumns: Int? = nil

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)

    private var sortOrder: SortOrder { SortOrder(rawValue: sortRaw) ?? .recent }

    private var gridColumns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 2), count: columns)
    }

    private var filters: [TileFilter] {
        [.all, .favorites]
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
            }
        }
        .overlay(alignment: .bottomTrailing) {
            addFAB
                .padding(.trailing, 20)
                .padding(.bottom, 12)
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
        // Pinch to zoom columns — live: facets resize during the gesture, not on release.
        .gesture(
            MagnificationGesture()
                .onChanged { value in
                    let base = pinchBaseColumns ?? { pinchBaseColumns = columns; return columns }()
                    // Pinch out (value > 1) → fewer columns (bigger tiles), and vice versa.
                    let target = Int((Double(base) / value).rounded())
                    let clamped = min(6, max(1, target))
                    if clamped != columns {
                        withAnimation(.easeOut(duration: 0.18)) { columns = clamped }
                    }
                }
                .onEnded { _ in pinchBaseColumns = nil }
        )
    }

    // MARK: - Header

    private var header: some View {
        // Profile (left) · wordmark (centered) · filters (right).
        // ZStack keeps the wordmark truly centered regardless of side widths.
        ZStack {
            Image("Wordmark")
                .renderingMode(.template)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(height: 22)
                .foregroundColor(fgColor)

            HStack(spacing: 10) {
                // Profile (+ tile count) → account & sync + stats
                Button {
                    navigationPath.append(AppScreen.profile)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "person.crop.circle")
                            .font(.system(size: 13, weight: .semibold))
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
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 12)
    }

    private var viewMenu: some View {
        Menu {
            Picker("Sort", selection: Binding(
                get: { sortOrder },
                set: { sortRaw = $0.rawValue }
            )) {
                ForEach(SortOrder.allCases) { order in
                    Text(order.label).tag(order)
                }
            }

            Divider()

            Picker("Tile size", selection: Binding(
                get: { columns },
                set: { newValue in withAnimation(.easeOut(duration: 0.2)) { columns = newValue } }
            )) {
                Text("Large").tag(2)
                Text("Medium").tag(3)
                Text("Small").tag(4)
            }

            Divider()

            Picker("Filter", selection: $activeFilter) {
                ForEach(filters, id: \.self) { filter in
                    Text(filter.label).tag(filter)
                }
            }

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

    // Large capture FAB (floating, separate from the tab bar)
    private var addFAB: some View {
        Menu {
            Button { showCamera = true } label: { Label("Take photo", systemImage: "camera") }
            Button { showLibrary = true } label: { Label("Choose from library", systemImage: "photo.on.rectangle") }
        } label: {
            if #available(iOS 26, *) {
                Image(systemName: "plus")
                    .font(.system(size: 27, weight: .semibold))
                    .foregroundStyle(fgColor)
                    .frame(width: 64, height: 64)
                    .glassEffect(.regular.interactive(), in: .circle)
            } else {
                Image(systemName: "plus")
                    .font(.system(size: 27, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 64, height: 64)
                    .background(fgColor)
                    .clipShape(Circle())
                    .shadow(color: .black.opacity(0.2), radius: 6, y: 3)
            }
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
                // Square cell derived from the grid column width, then fill + clip.
                Color.clear
                    .aspectRatio(1, contentMode: .fit)
                    .overlay {
                        if let image = tile.image {
                            Image(uiImage: image)
                                .resizable()
                                .scaledToFill()
                        } else {
                            LinearGradient(
                                colors: [
                                    Color(red: 74/255, green: 111/255, blue: 165/255).opacity(0.3),
                                    Color(red: 232/255, green: 220/255, blue: 200/255)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                            .overlay(
                                Text(tile.name.prefix(2).uppercased())
                                    .font(.system(size: 20, weight: .bold, design: .rounded))
                                    .foregroundColor(.white.opacity(0.8))
                            )
                        }
                    }
                    .clipped()

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
