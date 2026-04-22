import SwiftUI

enum WallpaperPattern: String, CaseIterable {
    case grid = "Grid"
    case mirror = "Mirror"
    case diamond = "Diamond"
    case pinwheel = "Pinwheel"
    case brick = "Brick"
}

struct WallpaperGeneratorView: View {
    @EnvironmentObject var store: TileStore
    @Environment(\.dismiss) private var dismiss

    @State private var selectedIds: Set<String> = []
    @State private var pattern: WallpaperPattern = .grid
    @State private var tileSize: CGFloat = 120
    @State private var duotone = false
    @State private var duoDark = Color(red: 74/255, green: 111/255, blue: 165/255)
    @State private var duoLight = Color(red: 232/255, green: 220/255, blue: 200/255)
    @State private var generatedImage: UIImage?
    @State private var showPreview = false
    @State private var showSaved = false

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)

    var body: some View {
        ZStack {
            bgColor.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                HStack(spacing: 12) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundColor(fgColor)
                            .frame(width: 40, height: 40)
                            .background(Color.black.opacity(0.06))
                            .clipShape(Circle())
                    }

                    Text("Wallpaper")
                        .font(.system(size: 22, weight: .bold))
                        .tracking(-0.3)

                    Spacer()

                    if !store.wallpapers.isEmpty {
                        Button {
                            showSaved = true
                        } label: {
                            Text("Saved (\(store.wallpapers.count))")
                                .font(.system(size: 13, weight: .medium))
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.black.opacity(0.06))
                                .clipShape(Capsule())
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 12)

                // Preview area
                if selectedIds.isEmpty {
                    VStack {
                        Spacer()
                        Text("Select up to 4 tiles below")
                            .foregroundColor(mutedColor)
                            .font(.system(size: 15))
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                    .background(Color(red: 236/255, green: 232/255, blue: 225/255))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .padding(.horizontal, 16)
                } else {
                    // Pattern preview placeholder
                    VStack {
                        Spacer()
                        Image(systemName: "square.grid.2x2.fill")
                            .font(.system(size: 48))
                            .foregroundColor(mutedColor.opacity(0.5))
                        Text("\(pattern.rawValue) pattern")
                            .font(.system(size: 15))
                            .foregroundColor(mutedColor)
                        Text("\(selectedIds.count) tiles selected")
                            .font(.system(size: 13))
                            .foregroundColor(mutedColor.opacity(0.7))
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                    .background(Color(red: 236/255, green: 232/255, blue: 225/255))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .padding(.horizontal, 16)
                }

                // Controls
                if !selectedIds.isEmpty {
                    // Pattern chips
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(WallpaperPattern.allCases, id: \.self) { p in
                                Button {
                                    pattern = p
                                } label: {
                                    Text(p.rawValue)
                                        .font(.system(size: 13, weight: .medium))
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 6)
                                        .background(pattern == p ? fgColor : Color.black.opacity(0.06))
                                        .foregroundColor(pattern == p ? .white : fgColor)
                                        .clipShape(Capsule())
                                }
                            }

                            // Size slider
                            Slider(value: $tileSize, in: 60...240)
                                .frame(width: 70)
                                .tint(fgColor)

                            // Duotone toggle
                            Button {
                                duotone.toggle()
                            } label: {
                                Text("Duotone")
                                    .font(.system(size: 13, weight: .medium))
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 6)
                                    .background(duotone ? fgColor : Color.black.opacity(0.06))
                                    .foregroundColor(duotone ? .white : fgColor)
                                    .clipShape(Capsule())
                            }

                            if duotone {
                                ColorPicker("", selection: $duoDark)
                                    .labelsHidden()
                                    .frame(width: 28, height: 28)
                                ColorPicker("", selection: $duoLight)
                                    .labelsHidden()
                                    .frame(width: 28, height: 28)
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                    .padding(.vertical, 12)

                    // Create button
                    Button {
                        generateWallpaper()
                    } label: {
                        Text("Create Wallpaper")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(fgColor)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 10)
                }

                // Tile selector
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(store.tiles) { tile in
                            Button {
                                toggleTile(tile.id)
                            } label: {
                                ZStack(alignment: .topTrailing) {
                                    Group {
                                        if let image = tile.image {
                                            Image(uiImage: image)
                                                .resizable()
                                                .aspectRatio(contentMode: .fill)
                                        } else {
                                            Color.gray.opacity(0.2)
                                        }
                                    }
                                    .frame(width: 64, height: 64)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10)
                                            .stroke(selectedIds.contains(tile.id) ? fgColor : Color.clear, lineWidth: 2.5)
                                    )
                                    .opacity(selectedIds.count >= 4 && !selectedIds.contains(tile.id) ? 0.35 : selectedIds.contains(tile.id) ? 1 : 0.65)

                                    if let index = Array(selectedIds).firstIndex(of: tile.id) {
                                        Text("\(index + 1)")
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
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                }
            }
        }
        .sheet(isPresented: $showPreview) {
            if let image = generatedImage {
                wallpaperPreview(image: image)
            }
        }
    }

    // MARK: - Actions

    private func toggleTile(_ id: String) {
        if selectedIds.contains(id) {
            selectedIds.remove(id)
        } else if selectedIds.count < 4 {
            selectedIds.insert(id)
        }
    }

    private func generateWallpaper() {
        // Create a simple tiled pattern
        let size = CGSize(width: 1080, height: 1920)
        let renderer = UIGraphicsImageRenderer(size: size)

        let selectedTiles = selectedIds.compactMap { id in store.tiles.first { $0.id == id } }
        guard !selectedTiles.isEmpty else { return }

        let image = renderer.image { ctx in
            let context = ctx.cgContext
            let ts = tileSize * 2 // Scale for export
            let cols = Int(ceil(size.width / ts))
            let rows = Int(ceil(size.height / ts))

            for row in 0..<rows {
                for col in 0..<cols {
                    let index = (row + col) % selectedTiles.count
                    let tile = selectedTiles[index]
                    let rect = CGRect(x: CGFloat(col) * ts, y: CGFloat(row) * ts, width: ts, height: ts)

                    if let tileImage = tile.image {
                        tileImage.draw(in: rect)
                    } else {
                        UIColor(red: 200/255, green: 195/255, blue: 185/255, alpha: 1).setFill()
                        context.fill(rect)
                    }
                }
            }
        }

        generatedImage = image
        showPreview = true
    }

    // MARK: - Preview

    private func wallpaperPreview(image: UIImage) -> some View {
        ZStack {
            Color.black.ignoresSafeArea()

            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fit)

            VStack {
                Spacer()

                HStack(spacing: 10) {
                    Button("Back") {
                        showPreview = false
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.white.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    Button("Save") {
                        store.addWallpaper(image: image)
                        showPreview = false
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(fgColor)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                    Button("Download") {
                        UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(fgColor)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }
        }
    }
}
