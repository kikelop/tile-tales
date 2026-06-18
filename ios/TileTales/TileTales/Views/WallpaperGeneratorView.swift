import SwiftUI
import CoreImage
import CoreImage.CIFilterBuiltins

enum WallpaperPattern: String, CaseIterable {
    case grid = "Grid"
    case mirror = "Mirror"
    case diamond = "Diamond"
    case pinwheel = "Pinwheel"
    case accent = "Accent"   // field tile + accent tile; needs ≥2 tiles

    /// Patterns that only make sense with more than one tile.
    var needsMultipleTiles: Bool { self == .accent }
}

/// Duotone presets mirroring the web (Ocean / Sunset / Forest / Vintage / Noir).
struct DuotonePreset: Identifiable {
    let id = UUID()
    let name: String
    let dark: Color
    let light: Color
}

/// Identifiable wrapper so the result sheet drives off `.sheet(item:)` — avoids the
/// `.sheet(isPresented:) { if let … }` race that showed a blank sheet.
struct GeneratedWallpaper: Identifiable {
    let id = UUID()
    let image: UIImage
}

/// Drives the push into edit mode. A fresh id per entry resets composition.
struct ComposeSession: Identifiable, Hashable {
    let id = UUID()
    let initialTileId: String
}

// MARK: - Root (initial state, lives inside the Compose tab with the tab bar)

struct WallpaperGeneratorView: View {
    @EnvironmentObject var store: TileStore
    @Environment(\.dismiss) private var dismiss
    var isRoot: Bool = false

    @State private var session: ComposeSession?
    @State private var showSaved = false

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)
    private let maxTiles = 6

    var body: some View {
        VStack(spacing: 0) {
            header
            placeholderPreview
            tileSelector
        }
        .background(bgColor.ignoresSafeArea())
        // Tapping a tile pushes an immersive edit mode (slides in, not a modal); the
        // tab bar hides while it's on screen. A fresh ComposeSession resets composition.
        .navigationDestination(item: $session) { s in
            ComposeEditView(initialTileId: s.initialTileId)
                .environmentObject(store)
                // Modern hide (not .navigationBarHidden, which leaves a ghost bar that
                // swallows taps on the custom back button in the top area).
                .toolbar(.hidden, for: .navigationBar, .tabBar)
        }
        .sheet(isPresented: $showSaved) {
            SavedWallpapersView()
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            if !isRoot {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(fgColor)
                        .frame(width: 40, height: 40)
                        .background(Color.black.opacity(0.06))
                        .clipShape(Circle())
                }
            }
            Text("Compose").font(.system(size: 22, weight: .bold)).tracking(-0.3)
            Spacer()
            if !store.wallpapers.isEmpty {
                Button { showSaved = true } label: {
                    Text("Saved (\(store.wallpapers.count))")
                        .font(.system(size: 13, weight: .medium))
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(Color.black.opacity(0.06))
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 12)
    }

    private var placeholderPreview: some View {
        VStack {
            Spacer()
            Text("Tap a tile below to start composing")
                .foregroundColor(mutedColor).font(.system(size: 15))
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 236/255, green: 232/255, blue: 225/255))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, 16)
    }

    // Root selector: tapping any tile enters edit mode pre-seeded with that tile.
    private var tileSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(store.tiles) { tile in
                    Button { session = ComposeSession(initialTileId: tile.id) } label: {
                        Group {
                            if let image = tile.image {
                                Image(uiImage: image).resizable().aspectRatio(contentMode: .fill)
                            } else {
                                Color.gray.opacity(0.2)
                            }
                        }
                        .frame(width: 64, height: 64)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 8)
        }
    }
}

// MARK: - Edit mode (immersive full-screen, no tab bar — styled like the 3D viewer)

struct ComposeEditView: View {
    @EnvironmentObject var store: TileStore
    @Environment(\.dismiss) private var dismiss
    let initialTileId: String

    @State private var selectedTileIds: [String]
    @State private var pattern: WallpaperPattern = .grid
    @State private var columns: Int = 4           // whole tiles across the width
    @State private var duotone = false
    @State private var duoDark = Color(red: 74/255, green: 111/255, blue: 165/255)   // Lisboa #4a6fa5
    @State private var duoLight = Color(red: 241/255, green: 234/255, blue: 217/255) // Lisboa #f1ead9
    @State private var portrait = true
    @State private var generated: GeneratedWallpaper?
    @State private var previewImage: UIImage?

    private let minColumns = 2
    private let maxColumns = 8

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)
    private let maxTiles = 6

    // Tile-city presets picked by Kike from the duotone-lab palette sheets
    // (personal/tile-tales/duotone-lab/palettes.py): deep saturated dark + light
    // warm white, all in the spirit of the old "Classic" (now Lisboa, the default).
    private let presets: [DuotonePreset] = [
        DuotonePreset(name: "Lisboa", dark: Color(red: 74/255, green: 111/255, blue: 165/255), light: Color(red: 241/255, green: 234/255, blue: 217/255)),   // #4a6fa5 / #f1ead9
        DuotonePreset(name: "Delft", dark: Color(red: 43/255, green: 58/255, blue: 103/255), light: Color(red: 247/255, green: 243/255, blue: 233/255)),     // #2b3a67 / #f7f3e9
        DuotonePreset(name: "Porto", dark: Color(red: 30/255, green: 107/255, blue: 115/255), light: Color(red: 249/255, green: 241/255, blue: 227/255)),    // #1e6b73 / #f9f1e3
        DuotonePreset(name: "Sevilla", dark: Color(red: 156/255, green: 74/255, blue: 47/255), light: Color(red: 248/255, green: 239/255, blue: 223/255)),   // #9c4a2f / #f8efdf
        DuotonePreset(name: "Talavera", dark: Color(red: 63/255, green: 82/255, blue: 119/255), light: Color(red: 249/255, green: 231/255, blue: 196/255)),  // #3f5277 / #f9e7c4
        DuotonePreset(name: "Nápoles", dark: Color(red: 125/255, green: 90/255, blue: 36/255), light: Color(red: 247/255, green: 240/255, blue: 222/255)),   // #7d5a24 / #f7f0de
    ]

    init(initialTileId: String) {
        self.initialTileId = initialTileId
        _selectedTileIds = State(initialValue: [initialTileId])
    }

    var body: some View {
        ZStack {
            bgColor.ignoresSafeArea()

            // Order: preview → tile list → options → "Preview" button at the bottom.
            // (To flip tiles/options, swap `tileSelector` and `controls` below.)
            VStack(spacing: 0) {
                topBar
                roundedCardPreview
                tileSelector
                controls
                previewButton
            }
        }
        .fullScreenCover(item: $generated) { w in
            FinalPreviewView(image: w.image, onBack: { generated = nil })
                .environmentObject(store)
        }
        .task(id: previewKey) {
            // Debounce so dragging the size slider doesn't re-render every frame.
            try? await Task.sleep(nanoseconds: 80_000_000)
            if Task.isCancelled { return }
            previewImage = selectedTileIds.isEmpty ? nil : renderWallpaper(size: previewSize)
        }
    }

    // MARK: Top bar (mirrors the 3D viewer)

    private var topBar: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(fgColor)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
                    .contentShape(Circle()) // make the whole circle tappable (Material bg isn't hit-testable on its own)
                    .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
            }
            .buttonStyle(.plain)
            Text("Compose").font(.system(size: 20, weight: .semibold)).tracking(-0.3)
            Spacer()
        }
        .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 12)
    }

    // MARK: Preview (rounded card, matches the placeholder framing)

    private var roundedCardPreview: some View {
        Color(red: 236/255, green: 232/255, blue: 225/255)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay {
                if let img = previewImage {
                    Image(uiImage: img).resizable().scaledToFill()
                } else {
                    ProgressView()
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .padding(.horizontal, 16)
            // Purely visual; the scaledToFill image overflows its frame and would
            // otherwise steal taps from the top bar above it.
            .allowsHitTesting(false)
    }

    // MARK: Tile selector (add/remove up to maxTiles)

    private var tileSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(store.tiles) { tile in
                    Button { toggleTile(tile.id) } label: {
                        ZStack(alignment: .topTrailing) {
                            Group {
                                if let image = tile.image {
                                    Image(uiImage: image).resizable().aspectRatio(contentMode: .fill)
                                } else {
                                    Color.gray.opacity(0.2)
                                }
                            }
                            .frame(width: 64, height: 64)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10)
                                .stroke(selectedTileIds.contains(tile.id) ? fgColor : Color.clear, lineWidth: 2.5))
                            .opacity(opacity(for: tile.id))

                            if let position = selectedTileIds.firstIndex(of: tile.id) {
                                Text("\(position + 1)")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(.white)
                                    .frame(width: 20, height: 20)
                                    .background(fgColor)
                                    .clipShape(Circle())
                                    .offset(x: 4, y: -4)
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 14)
        }
    }

    // MARK: Controls

    private var controls: some View {
        VStack(spacing: 16) {
            // Pattern + Color as two dropdown menus
            HStack(spacing: 10) {
                Menu {
                    ForEach(WallpaperPattern.allCases, id: \.self) { p in
                        // Multi-tile-only patterns (Accent) hidden until ≥2 tiles.
                        if !p.needsMultipleTiles || selectedTileIds.count >= 2 {
                            Button {
                                pattern = p
                            } label: {
                                if pattern == p { Label(p.rawValue, systemImage: "checkmark") }
                                else { Text(p.rawValue) }
                            }
                        }
                    }
                } label: {
                    dropdownLabel(title: "Pattern", value: pattern.rawValue)
                }

                Menu {
                    Button { duotone = false } label: {
                        if !duotone { Label("None", systemImage: "checkmark") } else { Text("None") }
                    }
                    ForEach(presets) { preset in
                        Button {
                            duotone = true
                            duoDark = preset.dark
                            duoLight = preset.light
                        } label: {
                            if isPreset(preset) { Label(preset.name, systemImage: "checkmark") }
                            else { Text(preset.name) }
                        }
                    }
                } label: {
                    dropdownLabel(title: "Color", value: duotone ? currentPresetName : "None")
                }
            }
            .padding(.horizontal, 16)

            // Size: discrete steps, each adds/removes a whole tile across the width.
            HStack(spacing: 12) {
                Button { columns = min(maxColumns, columns + 1) } label: {
                    Image(systemName: "minus.magnifyingglass").foregroundColor(mutedColor)
                }
                Slider(
                    value: Binding(
                        get: { Double(columns) },
                        set: { columns = Int($0.rounded()) }
                    ),
                    in: Double(minColumns)...Double(maxColumns),
                    step: 1
                ).tint(fgColor)
                Button { columns = max(minColumns, columns - 1) } label: {
                    Image(systemName: "plus.magnifyingglass").foregroundColor(mutedColor)
                }

                Button {
                    portrait.toggle()
                } label: {
                    Image(systemName: portrait ? "rectangle.portrait" : "rectangle")
                        .font(.system(size: 16))
                        .foregroundColor(fgColor)
                        .frame(width: 40, height: 40)
                        .background(Color.black.opacity(0.06))
                        .clipShape(Circle())
                }
            }
            .padding(.horizontal, 16)
        }
        .padding(.bottom, 14)
    }

    // Larger column count = smaller tiles = "zoom out" (minus icon); hence minus
    // increments columns and plus decrements, matching the magnifier semantics.

    private var previewButton: some View {
        Button { generateWallpaper() } label: {
            Text("Preview")
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(fgColor)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .padding(.horizontal, 16).padding(.bottom, 8)
    }

    private func dropdownLabel(title: String, value: String) -> some View {
        HStack(spacing: 6) {
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.system(size: 11)).foregroundColor(mutedColor)
                Text(value).font(.system(size: 15, weight: .medium)).foregroundColor(fgColor)
            }
            Spacer()
            Image(systemName: "chevron.up.chevron.down")
                .font(.system(size: 12, weight: .medium)).foregroundColor(mutedColor)
        }
        .padding(.horizontal, 14).padding(.vertical, 9)
        .background(Color.black.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var currentPresetName: String {
        presets.first { isPreset($0) }?.name ?? "Lisboa"
    }

    private func isPreset(_ preset: DuotonePreset) -> Bool {
        duotone && UIColor(duoDark) == UIColor(preset.dark) && UIColor(duoLight) == UIColor(preset.light)
    }

    private func opacity(for id: String) -> Double {
        if selectedTileIds.contains(id) { return 1 }
        return selectedTileIds.count >= maxTiles ? 0.35 : 0.65
    }

    private func toggleTile(_ id: String) {
        if let idx = selectedTileIds.firstIndex(of: id) {
            if selectedTileIds.count > 1 { selectedTileIds.remove(at: idx) } // keep at least one
        } else if selectedTileIds.count < maxTiles {
            selectedTileIds.append(id)
        }
        // A multi-tile-only pattern can't survive dropping back to one tile.
        if pattern.needsMultipleTiles && selectedTileIds.count < 2 { pattern = .grid }
    }

    // MARK: - Generation

    // Preview render target — same aspect as the export, smaller pixels.
    private var previewSize: CGSize {
        let w: CGFloat = 480
        let ratio: CGFloat = 1920 / 1080
        return portrait ? CGSize(width: w, height: w * ratio) : CGSize(width: w * ratio, height: w)
    }

    // Recompute the preview whenever any of these change.
    private var previewKey: String {
        let colorKey = duotone ? "\(UIColor(duoDark).hashValue):\(UIColor(duoLight).hashValue)" : "none"
        return "\(selectedTileIds.joined(separator: ","))|\(pattern.rawValue)|\(columns)|\(colorKey)|\(portrait)"
    }

    /// Composites the selected tiles into a wallpaper at the given pixel size.
    /// `ts = width / columns` puts exactly `columns` whole tiles across the width, so
    /// every size step adds/removes one full tile (identical density in preview and
    /// export, since both derive `ts` from their own width).
    private func renderWallpaper(size: CGSize) -> UIImage? {
        let tiles = selectedTileIds.compactMap { id in store.tiles.first { $0.id == id }?.image }
        guard !tiles.isEmpty else { return nil }

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1 // size is already in pixels
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let composed = renderer.image { ctx in
            let cg = ctx.cgContext
            let ts = size.width / CGFloat(columns) // exact whole tiles across the width

            // Diamond = the whole grid rotated 45° (tiles stay whole, laid on a
            // diagonal lattice). Rotate the context and draw an oversized grid so
            // the rotated lattice still covers the corners.
            let isDiamond = pattern == .diamond
            if isDiamond {
                cg.translateBy(x: size.width / 2, y: size.height / 2)
                cg.rotate(by: .pi / 4)
                cg.translateBy(x: -size.width / 2, y: -size.height / 2)
            }
            let extra = isDiamond ? columns : 0
            let cols = columns + 1
            let rows = Int(ceil(size.height / ts)) + 1

            for row in -extra ..< rows + extra {
                for col in -extra ..< cols + extra {
                    drawCell(cg: cg, row: row, col: col, ts: ts, tiles: tiles)
                }
            }
        }
        // Duotone the fully composed wallpaper (matches the web, which applies it
        // to the final canvas — not per tile before scaling).
        return duotone ? duotoneFiltered(composed) : composed
    }

    private func generateWallpaper() {
        let size = portrait ? CGSize(width: 1080, height: 1920) : CGSize(width: 1920, height: 1080)
        guard let image = renderWallpaper(size: size) else { return }
        generated = GeneratedWallpaper(image: image)
    }

    private func drawCell(cg: CGContext, row: Int, col: Int, ts: CGFloat, tiles: [UIImage]) {
        let n = tiles.count
        // Safe modulo (row/col can be negative for the diamond's oversized grid).
        func tileAt(_ i: Int) -> UIImage { tiles[((i % n) + n) % n] }
        switch pattern {
        case .grid:
            let tile = tileAt(row + col)
            tile.draw(in: CGRect(x: CGFloat(col) * ts, y: CGFloat(row) * ts, width: ts, height: ts))

        case .mirror:
            let tile = tileAt(row + col)
            let flipH = col % 2 == 1
            let flipV = row % 2 == 1
            drawTransformed(cg: cg, image: tile,
                            origin: CGPoint(x: CGFloat(col) * ts, y: CGFloat(row) * ts),
                            ts: ts, rotation: 0, flipH: flipH, flipV: flipV)

        case .diamond:
            // Whole tile like grid; the 45° rotation is applied to the whole context
            // in renderWallpaper, so the lattice (not each tile) is diagonal.
            let tile = tileAt(row + col)
            tile.draw(in: CGRect(x: CGFloat(col) * ts, y: CGFloat(row) * ts, width: ts, height: ts))

        case .pinwheel:
            // 2x2 block, each quadrant rotated 90°.
            let tile = tiles[((row / 2) + (col / 2)) % n]
            let quadrant = (row % 2) * 2 + (col % 2)
            let rotation = CGFloat(quadrant) * (.pi / 2)
            drawTransformed(cg: cg, image: tile,
                            origin: CGPoint(x: CGFloat(col) * ts, y: CGFloat(row) * ts),
                            ts: ts, rotation: rotation, flipH: false, flipV: false)

        case .accent:
            // First tile is the field; second is an accent placed at the centre of
            // each 3×3 block. Falls back to the field if only one tile is selected.
            let isAccent = (((row % 3) + 3) % 3 == 1) && (((col % 3) + 3) % 3 == 1)
            let tile = (isAccent && n > 1) ? tiles[1] : tiles[0]
            tile.draw(in: CGRect(x: CGFloat(col) * ts, y: CGFloat(row) * ts, width: ts, height: ts))
        }
    }

    private func drawTransformed(cg: CGContext, image: UIImage, origin: CGPoint, ts: CGFloat,
                                 rotation: CGFloat, flipH: Bool, flipV: Bool) {
        cg.saveGState()
        cg.translateBy(x: origin.x + ts / 2, y: origin.y + ts / 2)
        if rotation != 0 { cg.rotate(by: rotation) }
        cg.scaleBy(x: flipH ? -1 : 1, y: flipV ? -1 : 1)
        image.draw(in: CGRect(x: -ts / 2, y: -ts / 2, width: ts, height: ts))
        cg.restoreGState()
    }

    // Duotone gradient map, variant B from the duotone-lab contact sheets
    // (personal/tile-tales/duotone-lab): per-pixel luminance → autocontrast
    // stretch (2% cutoff per side, so light tiles like terrazzo don't wash out
    // to a single tone) → S-curve x2.5 → interpolate dark→light. Picked by Kike
    // over the web's plain S-curve x2, which washes out low-contrast tiles.
    private func duotoneFiltered(_ image: UIImage) -> UIImage {
        guard let cgImage = image.cgImage else { return image }
        let width = cgImage.width
        let height = cgImage.height
        guard width > 0, height > 0 else { return image }

        var dr: CGFloat = 0, dg: CGFloat = 0, db: CGFloat = 0, da: CGFloat = 0
        UIColor(duoDark).getRed(&dr, green: &dg, blue: &db, alpha: &da)
        var lr: CGFloat = 0, lg: CGFloat = 0, lb: CGFloat = 0, la: CGFloat = 0
        UIColor(duoLight).getRed(&lr, green: &lg, blue: &lb, alpha: &la)
        let darkR = Float(dr * 255), darkG = Float(dg * 255), darkB = Float(db * 255)
        let lightR = Float(lr * 255), lightG = Float(lg * 255), lightB = Float(lb * 255)

        let bytesPerRow = width * 4
        var buffer = [UInt8](repeating: 0, count: bytesPerRow * height)
        // Explicit sRGB (not DeviceRGB) + big-endian RGBA, so the bytes we read
        // are gamma-encoded sRGB exactly like the web canvas getImageData — no
        // implicit color-matching that would compress the contrast.
        let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
        guard let ctx = CGContext(
            data: &buffer, width: width, height: height, bitsPerComponent: 8,
            bytesPerRow: bytesPerRow, space: colorSpace,
            bitmapInfo: bitmapInfo
        ) else { return image }
        ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

        // Pass 1: 8-bit luminance per pixel + histogram (mirrors PIL "L" + autocontrast).
        var lumBytes = [UInt8](repeating: 0, count: width * height)
        var histogram = [Int](repeating: 0, count: 256)
        var p = 0
        for i in stride(from: 0, to: buffer.count, by: 4) {
            let l = (Float(buffer[i]) * 0.299 + Float(buffer[i + 1]) * 0.587 + Float(buffer[i + 2]) * 0.114)
            let lb = UInt8(max(0, min(255, l.rounded())))
            lumBytes[p] = lb
            histogram[Int(lb)] += 1
            p += 1
        }

        // Autocontrast bounds: drop 2% of pixels from each end, stretch the rest.
        let cutoff = (width * height) * 2 / 100
        var lo = 0, hi = 255
        var acc = 0
        while lo < 255 { acc += histogram[lo]; if acc > cutoff { break }; lo += 1 }
        acc = 0
        while hi > lo { acc += histogram[hi]; if acc > cutoff { break }; hi -= 1 }
        let range = Float(max(hi - lo, 1))

        // LUT: stretch → S-curve x2 → half blend toward a third pass (x2.5).
        func sCurve(_ x: Float) -> Float {
            x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x)
        }
        var lut = [Float](repeating: 0, count: 256)
        for v in 0..<256 {
            var x = max(0, min(1, (Float(v) - Float(lo)) / range))
            x = sCurve(x)
            x = sCurve(x)
            x = x * 0.5 + sCurve(x) * 0.5
            lut[v] = x
        }

        p = 0
        for i in stride(from: 0, to: buffer.count, by: 4) {
            let lum = lut[Int(lumBytes[p])]
            p += 1
            buffer[i]     = UInt8(max(0, min(255, darkR + (lightR - darkR) * lum)))
            buffer[i + 1] = UInt8(max(0, min(255, darkG + (lightG - darkG) * lum)))
            buffer[i + 2] = UInt8(max(0, min(255, darkB + (lightB - darkB) * lum)))
        }

        guard let outCg = ctx.makeImage() else { return image }
        return UIImage(cgImage: outCg, scale: image.scale, orientation: image.imageOrientation)
    }
}

// MARK: - Final preview (full-screen black, image complete, solid bottom bar)

struct FinalPreviewView: View {
    @EnvironmentObject var store: TileStore
    let image: UIImage
    let onBack: () -> Void

    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // Image pinned to the top with the action bar flush against its bottom edge
            // (no black gap between them); any leftover black collects below the bar.
            VStack(spacing: 0) {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)

                HStack(spacing: 10) {
                    Button("Back") { onBack() }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(Color.white.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    Button("Save") {
                        store.addWallpaper(image: image)
                        onBack()
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(fgColor)
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    Button("Download") {
                        UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(fgColor)
                    .frame(maxWidth: .infinity).padding(.vertical, 14)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(.ultraThinMaterial)

                Spacer(minLength: 0)
            }
        }
    }
}
