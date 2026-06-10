import SwiftUI

struct TileViewer3DView: View {
    @EnvironmentObject var store: TileStore
    let onClose: () -> Void
    @State var activeIndex: Int
    @State private var showEditSheet = false
    @State private var resetToken = 0
    @State private var showFlipHint = false
    @AppStorage("tt-flip-hint-seen") private var flipHintSeen = false

    // TEMP rotation/camera calibration (persisted so values survive relaunch
    // while tuning on device). Remove the panel once values are locked.
    @State private var showCalib = false
    @AppStorage("tt-cal-camX") private var camX = 0.0
    @AppStorage("tt-cal-camY") private var camY = 8.8
    @AppStorage("tt-cal-camZ") private var camZ = 3.3
    @AppStorage("tt-cal-fov") private var fov = 37.0
    @AppStorage("tt-cal-drag") private var dragSensitivity = 0.012
    @AppStorage("tt-cal-inertia") private var inertiaDecay = 0.95

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)

    init(initialIndex: Int, onClose: @escaping () -> Void) {
        _activeIndex = State(initialValue: initialIndex)
        self.onClose = onClose
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
                topBar

                // 3D Canvas
                ZStack(alignment: .top) {
                    if let tile = currentTile {
                        SceneKitTileView(
                            tileImage: tile.image,
                            memoryText: tile.memory,
                            dateText: tile.date,
                            tileName: tile.name,
                            resetToken: resetToken,
                            camX: Float(camX), camY: Float(camY), camZ: Float(camZ),
                            fov: Float(fov),
                            dragSensitivity: Float(dragSensitivity),
                            inertiaDecay: Float(inertiaDecay)
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
                }

                if showCalib { calibPanel.padding(.bottom, 8) }

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
                onClose()
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

                // TEMP calibration toggle — remove once values are locked.
                Button {
                    withAnimation { showCalib.toggle() }
                } label: {
                    Image(systemName: "slider.horizontal.3")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(showCalib ? .white : fgColor)
                        .frame(width: 44, height: 44)
                        .background(showCalib ? AnyShapeStyle(Color(red: 52/255, green: 70/255, blue: 188/255)) : AnyShapeStyle(.ultraThinMaterial))
                        .clipShape(Circle())
                        .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 12)
    }

    // MARK: - Calibration panel (TEMP)

    private var calibPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            calibRow("Cam X", $camX, -8, 8)
            calibRow("Cam Y", $camY, 0, 12)
            calibRow("Cam Z", $camZ, 0, 14)
            calibRow("FOV", $fov, 18, 70)
            calibRow("Drag", $dragSensitivity, 0.004, 0.03)
            calibRow("Inertia", $inertiaDecay, 0.8, 0.99)
            HStack {
                Button("Reset") {
                    camX = 0; camY = 8.8; camZ = 3.3; fov = 37
                    dragSensitivity = 0.012; inertiaDecay = 0.95
                }
                .font(.system(size: 13, weight: .semibold))
                Spacer()
                Text("X \(camX, specifier: "%.1f")  Y \(camY, specifier: "%.1f")  Z \(camZ, specifier: "%.1f")  fov \(fov, specifier: "%.0f")  drag \(dragSensitivity, specifier: "%.3f")  in \(inertiaDecay, specifier: "%.2f")")
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundColor(.secondary)
            }
        }
        .padding(14)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 16)
    }

    private func calibRow(_ label: String, _ value: Binding<Double>, _ lo: Double, _ hi: Double) -> some View {
        HStack(spacing: 10) {
            Text(label).font(.system(size: 12, weight: .medium)).frame(width: 54, alignment: .leading)
            Slider(value: value, in: lo...hi)
            Text("\(value.wrappedValue, specifier: abs(hi) < 1 ? "%.3f" : "%.1f")")
                .font(.system(size: 11, design: .monospaced)).frame(width: 44, alignment: .trailing)
        }
    }

    // MARK: - Thumbnails

    private var thumbnailSelector: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Array(store.tiles.enumerated()).reversed(), id: \.element.id) { index, tile in
                        Button {
                            // Just swap the tile on the top face — no entry/reset
                            // animation; the floating motion keeps going.
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
            .onAppear {
                // Highlight + scroll the entered tile into view.
                if let tile = store.tiles[safe: safeIndex] {
                    DispatchQueue.main.async {
                        proxy.scrollTo(tile.id, anchor: .center)
                    }
                }
            }
        }
        .background(bgColor.opacity(0.92).background(.ultraThinMaterial))
    }
}

// Safe array subscript
extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
