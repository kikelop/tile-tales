import SwiftUI

struct TileGridView: View {
    @EnvironmentObject var store: TileStore
    @Binding var navigationPath: NavigationPath
    @State private var activeFilter: TileFilter = .all
    @State private var showAddMenu = false
    @State private var showCamera = false
    @State private var showLibrary = false
    @State private var capturedImage: UIImage?
    @State private var columns = 3
    @StateObject private var locationService = LocationService()

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)

    private var gridColumns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 2), count: columns)
    }

    private var filters: [TileFilter] {
        var f: [TileFilter] = [.all, .favorites]
        f += store.allTags.map { .tag($0) }
        return f
    }

    private var filteredTiles: [TileItem] {
        store.filteredTiles(filter: activeFilter)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            bgColor.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                HStack {
                    Text("Tile Tales")
                        .font(.system(size: 28, weight: .bold))
                        .tracking(-0.5)
                        .foregroundColor(fgColor)

                    Text("\(store.tiles.count)")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(mutedColor)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(Color.black.opacity(0.06))
                        .clipShape(Capsule())

                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 12)

                // Tile grid
                ScrollView {
                    if filteredTiles.isEmpty {
                        VStack {
                            Spacer(minLength: 100)
                            Text("No tiles match this filter")
                                .foregroundColor(mutedColor)
                                .font(.system(size: 15))
                            Spacer()
                        }
                        .frame(maxWidth: .infinity)
                    } else {
                        LazyVGrid(columns: gridColumns, spacing: 2) {
                            ForEach(filteredTiles) { tile in
                                TileGridCell(tile: tile) {
                                    if let index = store.tiles.firstIndex(where: { $0.id == tile.id }) {
                                        navigationPath.append(AppScreen.viewer(initialIndex: index))
                                    }
                                }
                            }
                        }
                    }
                }

                // Bottom bar
                bottomBar
            }
        }
        .navigationBarHidden(true)
        .sheet(isPresented: $showCamera) {
            CameraPicker(image: $capturedImage)
        }
        .sheet(isPresented: $showLibrary) {
            PhotoLibraryPicker(image: $capturedImage)
        }
        .onChange(of: capturedImage) { _, newImage in
            guard let image = newImage else { return }
            addNewTile(image: image)
            capturedImage = nil
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

    // MARK: - Bottom Bar

    private var bottomBar: some View {
        HStack(spacing: 8) {
            // Filter chips
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(filters, id: \.self) { filter in
                        Button {
                            withAnimation(.easeOut(duration: 0.2)) {
                                activeFilter = filter
                            }
                        } label: {
                            Text(filter == .favorites ? "\u{2665} Favorites" : filter.label)
                                .font(.system(size: 13, weight: .medium))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 6)
                                .background(activeFilter == filter ? fgColor : Color.black.opacity(0.06))
                                .foregroundColor(activeFilter == filter ? .white : fgColor)
                                .clipShape(Capsule())
                        }
                    }
                }
                .padding(.leading, 4)
            }

            // Map button
            Button {
                navigationPath.append(AppScreen.map)
            } label: {
                Image(systemName: "mappin.circle")
                    .font(.system(size: 18))
                    .foregroundColor(fgColor)
                    .frame(width: 40, height: 40)
                    .background(Color.black.opacity(0.06))
                    .clipShape(Circle())
            }

            // Wallpaper button
            Button {
                navigationPath.append(AppScreen.wallpaper)
            } label: {
                Image(systemName: "square.grid.2x2")
                    .font(.system(size: 16))
                    .foregroundColor(fgColor)
                    .frame(width: 40, height: 40)
                    .background(Color.black.opacity(0.06))
                    .clipShape(Circle())
            }

            // Add button
            Menu {
                Button {
                    showCamera = true
                } label: {
                    Label("Take photo", systemImage: "camera")
                }
                Button {
                    showLibrary = true
                } label: {
                    Label("Choose from library", systemImage: "photo.on.rectangle")
                }
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(.white)
                    .frame(width: 40, height: 40)
                    .background(fgColor)
                    .clipShape(Circle())
                    .shadow(color: .black.opacity(0.15), radius: 4, y: 2)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            bgColor.opacity(0.92)
                .background(.ultraThinMaterial)
        )
    }

    // MARK: - Add Tile

    private func addNewTile(image: UIImage) {
        Task {
            let location = await locationService.getCurrentLocation()
            let tile = TileItem.create(
                name: "Tile #\(store.tiles.count + 1)",
                image: image,
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
                    // Placeholder with gradient for sample tiles
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
