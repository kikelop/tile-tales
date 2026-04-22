import SwiftUI
import MapKit

struct TileMapView: View {
    @EnvironmentObject var store: TileStore
    @Binding var navigationPath: NavigationPath
    @State private var cameraPosition: MapCameraPosition = .automatic
    @State private var selectedTileId: String?

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)

    var body: some View {
        ZStack(alignment: .top) {
            // Map
            Map(position: $cameraPosition, selection: $selectedTileId) {
                ForEach(store.geolocatedTiles) { tile in
                    if let coordinate = tile.coordinate {
                        Annotation(tile.name, coordinate: coordinate, anchor: .bottom) {
                            VStack(spacing: 0) {
                                tilePin(tile: tile)
                                    .onTapGesture {
                                        selectedTileId = tile.id
                                    }

                                // Arrow
                                Triangle()
                                    .fill(selectedTileId == tile.id ? fgColor : .white)
                                    .frame(width: 12, height: 6)
                                    .rotationEffect(.degrees(180))
                            }
                        }
                    }
                }
            }
            .mapStyle(.standard(pointsOfInterest: .excludingAll))
            .ignoresSafeArea()

            // Header
            headerBar

            // Bottom card for selected tile
            if let tileId = selectedTileId,
               let tile = store.tiles.first(where: { $0.id == tileId }) {
                VStack {
                    Spacer()
                    tileCard(tile: tile)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                .animation(.spring(response: 0.3), value: selectedTileId)
            }
        }
        .onAppear {
            // Center on all geolocated tiles
            let geoTiles = store.geolocatedTiles
            if !geoTiles.isEmpty {
                let lats = geoTiles.compactMap { $0.latitude }
                let lngs = geoTiles.compactMap { $0.longitude }
                let center = CLLocationCoordinate2D(
                    latitude: lats.reduce(0, +) / Double(lats.count),
                    longitude: lngs.reduce(0, +) / Double(lngs.count)
                )
                cameraPosition = .region(MKCoordinateRegion(
                    center: center,
                    span: MKCoordinateSpan(latitudeDelta: 15, longitudeDelta: 15)
                ))
            }
        }
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack(spacing: 12) {
            Button {
                navigationPath.removeLast()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(fgColor)
                    .frame(width: 40, height: 40)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
            }

            Text("Map")
                .font(.system(size: 22, weight: .bold))
                .tracking(-0.3)

            Text("\(store.geolocatedTiles.count) / \(store.tiles.count) located")
                .font(.system(size: 13))
                .foregroundColor(mutedColor)

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 12)
        .background(bgColor.opacity(0.85).background(.ultraThinMaterial))
    }

    // MARK: - Tile Pin

    private func tilePin(tile: TileItem) -> some View {
        Group {
            if let image = tile.image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                LinearGradient(
                    colors: [.blue.opacity(0.4), .white.opacity(0.6)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .overlay(
                    Text(tile.name.prefix(1))
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                )
            }
        }
        .frame(width: 44, height: 44)
        .clipShape(Circle())
        .overlay(
            Circle()
                .stroke(selectedTileId == tile.id ? fgColor : .white, lineWidth: 3)
        )
        .shadow(color: .black.opacity(0.25), radius: 4, y: 2)
    }

    // MARK: - Selected Tile Card

    private func tileCard(tile: TileItem) -> some View {
        HStack(spacing: 16) {
            // Thumbnail
            Group {
                if let image = tile.image {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } else {
                    Color.gray.opacity(0.2)
                }
            }
            .frame(width: 80, height: 80)
            .clipShape(RoundedRectangle(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 4) {
                Text(tile.name)
                    .font(.system(size: 18, weight: .semibold))

                if !tile.date.isEmpty {
                    Text(tile.date)
                        .font(.system(size: 13))
                        .foregroundColor(mutedColor)
                }

                if !tile.tags.isEmpty {
                    Text(tile.tags.joined(separator: " · "))
                        .font(.system(size: 12))
                        .foregroundColor(mutedColor)
                }
            }

            Spacer()

            Button {
                if let index = store.tiles.firstIndex(where: { $0.id == tile.id }) {
                    navigationPath.append(AppScreen.viewer(initialIndex: index))
                }
            } label: {
                Image(systemName: "cube")
                    .font(.system(size: 20))
                    .foregroundColor(fgColor)
                    .frame(width: 44, height: 44)
                    .background(Color.black.opacity(0.06))
                    .clipShape(Circle())
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(.ultraThickMaterial)
                .shadow(color: .black.opacity(0.15), radius: 16, y: -4)
        )
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
    }
}

// Triangle shape for pin arrow
struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}
