import SwiftUI

struct TileViewer3DView: View {
    @EnvironmentObject var store: TileStore
    @Binding var navigationPath: NavigationPath
    @State var activeIndex: Int
    @State private var showEditSheet = false
    @State private var showCamera = false
    @State private var showLibrary = false
    @State private var capturedImage: UIImage?
    @StateObject private var locationService = LocationService()

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)

    init(initialIndex: Int, navigationPath: Binding<NavigationPath>) {
        _activeIndex = State(initialValue: initialIndex)
        _navigationPath = navigationPath
    }

    private var safeIndex: Int {
        min(activeIndex, max(0, store.tiles.count - 1))
    }

    private var currentTile: TileItem? {
        guard !store.tiles.isEmpty else { return nil }
        return store.tiles[safeIndex]
    }

    var body: some View {
        ZStack {
            bgColor.ignoresSafeArea()

            VStack(spacing: 0) {
                // 3D Canvas
                ZStack(alignment: .top) {
                    if let tile = currentTile {
                        SceneKitTileView(
                            tileImage: tile.image,
                            memoryText: tile.memory,
                            dateText: tile.date,
                            tileName: tile.name
                        )
                    } else {
                        VStack {
                            Spacer()
                            Text("No tiles yet")
                                .foregroundColor(.gray)
                            Spacer()
                        }
                    }

                    // Top bar overlay
                    topBar
                }

                // Tile selector thumbnails
                thumbnailSelector
            }
        }
        .sheet(isPresented: $showEditSheet) {
            if let tile = currentTile {
                TileEditSheet(tile: tile)
            }
        }
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
        .gesture(
            DragGesture(minimumDistance: 50)
                .onEnded { value in
                    let horizontal = value.translation.width
                    let vertical = value.translation.height
                    // Only trigger on primarily horizontal swipes
                    guard abs(horizontal) > abs(vertical) * 1.5 else { return }
                    withAnimation(.easeOut(duration: 0.3)) {
                        if horizontal < -50 && activeIndex < store.tiles.count - 1 {
                            activeIndex += 1
                        } else if horizontal > 50 && activeIndex > 0 {
                            activeIndex -= 1
                        }
                    }
                }
        )
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
            // Back
            Button {
                navigationPath.removeLast()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(fgColor)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
                    .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
            }

            // Title
            if let tile = currentTile {
                Text(tile.name)
                    .font(.system(size: 20, weight: .semibold))
                    .tracking(-0.3)
                    .lineLimit(1)
            }

            Spacer()

            // Favorite
            if let tile = currentTile {
                Button {
                    withAnimation(.easeOut(duration: 0.2)) {
                        store.toggleFavorite(id: tile.id)
                    }
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                } label: {
                    Image(systemName: tile.favorite ? "heart.fill" : "heart")
                        .font(.system(size: 18))
                        .foregroundColor(tile.favorite ? .red : fgColor)
                        .frame(width: 44, height: 44)
                        .background(.ultraThinMaterial)
                        .clipShape(Circle())
                        .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
                }

                // Share
                Button {
                    ShareService.share(tile: tile)
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(fgColor)
                        .frame(width: 44, height: 44)
                        .background(.ultraThinMaterial)
                        .clipShape(Circle())
                        .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
                }

                // Edit
                Button {
                    showEditSheet = true
                } label: {
                    Image(systemName: "pencil")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(fgColor)
                        .frame(width: 44, height: 44)
                        .background(.ultraThinMaterial)
                        .clipShape(Circle())
                        .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
    }

    // MARK: - Thumbnails

    private var thumbnailSelector: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(store.tiles.enumerated()), id: \.element.id) { index, tile in
                        Button {
                            withAnimation(.easeOut(duration: 0.2)) {
                                activeIndex = index
                            }
                        } label: {
                            Group {
                                if let image = tile.image {
                                    Image(uiImage: image)
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                } else {
                                    LinearGradient(
                                        colors: [.blue.opacity(0.3), .white.opacity(0.5)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                }
                            }
                            .frame(width: 60, height: 60)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(index == safeIndex ? fgColor : Color.clear, lineWidth: 2)
                            )
                            .opacity(index == safeIndex ? 1 : 0.6)
                        }
                        .id(tile.id)
                    }

                    // Add button in thumbnails
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
                            .font(.system(size: 20, weight: .medium))
                            .foregroundColor(.white)
                            .frame(width: 60, height: 60)
                            .background(fgColor)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }
            .onChange(of: activeIndex) { _, newIndex in
                if let tile = store.tiles[safe: newIndex] {
                    withAnimation {
                        proxy.scrollTo(tile.id, anchor: .center)
                    }
                }
            }
        }
        .background(bgColor.opacity(0.92).background(.ultraThinMaterial))
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
            activeIndex = store.tiles.count - 1
        }
    }
}

// Safe array subscript
extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
