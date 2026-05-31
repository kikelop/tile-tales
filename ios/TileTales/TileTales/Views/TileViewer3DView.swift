import SwiftUI

struct TileViewer3DView: View {
    @EnvironmentObject var store: TileStore
    @Binding var navigationPath: NavigationPath
    @State var activeIndex: Int
    @State private var showEditSheet = false
    @State private var resetToken = 0
    @State private var showFlipHint = false
    @State private var debug = ViewerDebugConfig()
    @State private var showDebug = false
    @AppStorage("tt-flip-hint-seen") private var flipHintSeen = false

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
                            tileName: tile.name,
                            resetToken: resetToken,
                            debug: debug
                        )
                        .onTapGesture(count: 2) {
                            resetToken += 1
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        }
                    } else {
                        VStack {
                            Spacer()
                            Text("No tiles yet")
                                .foregroundColor(.gray)
                            Spacer()
                        }
                    }

                    topBar

                    // Flip hint
                    if showFlipHint {
                        VStack {
                            Spacer()
                            Text("Drag to rotate · flip to see the memory")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(.white)
                                .padding(.horizontal, 16).padding(.vertical, 9)
                                .background(fgColor.opacity(0.82))
                                .clipShape(Capsule())
                                .padding(.bottom, 24)
                                .transition(.opacity.combined(with: .move(edge: .bottom)))
                        }
                    }

                    if showDebug {
                        VStack {
                            Spacer()
                            debugPanel
                        }
                    }
                }

                thumbnailSelector
            }
        }
        .sheet(isPresented: $showEditSheet) {
            if let tile = currentTile {
                TileEditSheet(tile: tile)
            }
        }
        .onAppear(perform: maybeShowFlipHint)
    }

    private func maybeShowFlipHint() {
        guard !flipHintSeen else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            withAnimation(.easeOut(duration: 0.3)) { showFlipHint = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.5) {
                withAnimation(.easeOut(duration: 0.3)) { showFlipHint = false }
                flipHintSeen = true
            }
        }
    }

    // MARK: - Top Bar

    private var topBar: some View {
        HStack {
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

            if let tile = currentTile {
                Text(tile.name)
                    .font(.system(size: 20, weight: .semibold))
                    .tracking(-0.3)
                    .lineLimit(1)
            }

            Spacer()

            Button { showDebug.toggle() } label: {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(showDebug ? .white : fgColor)
                    .frame(width: 44, height: 44)
                    .background(showDebug ? AnyShapeStyle(fgColor) : AnyShapeStyle(.ultraThinMaterial))
                    .clipShape(Circle())
                    .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
            }

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
                                resetToken += 1
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

    // MARK: - Debug tuning panel (temporary — camera framing / tile size)

    private var debugPanel: some View {
        VStack(spacing: 7) {
            debugSlider("cam X", $debug.camX, -14...14)
            debugSlider("cam Y", $debug.camY, -4...16)
            debugSlider("cam Z", $debug.camZ, 1...18)
            HStack {
                Text("fov").font(.system(size: 11)).frame(width: 52, alignment: .leading)
                Slider(value: $debug.fov, in: 15...70)
                Text(String(format: "%.0f", debug.fov))
                    .font(.system(size: 11, design: .monospaced)).frame(width: 52, alignment: .trailing)
            }
            Toggle("Show axes  (R=X · G=Y · B=Z · ● center)", isOn: $debug.showAxes).font(.system(size: 11))
            Text("cam(\(f(debug.camX)), \(f(debug.camY)), \(f(debug.camZ)))  fov \(Int(debug.fov))")
                .font(.system(size: 10, design: .monospaced))
                .foregroundColor(.secondary)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .padding(.horizontal, 12)
        .padding(.bottom, 8)
    }

    private func debugSlider(_ label: String, _ value: Binding<Float>, _ range: ClosedRange<Float>) -> some View {
        HStack {
            Text(label).font(.system(size: 11)).frame(width: 52, alignment: .leading)
            Slider(value: value, in: range)
            Text(f(value.wrappedValue))
                .font(.system(size: 11, design: .monospaced)).frame(width: 52, alignment: .trailing)
        }
    }

    private func f(_ v: Float) -> String { String(format: "%.2f", v) }
}

// Safe array subscript
extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
