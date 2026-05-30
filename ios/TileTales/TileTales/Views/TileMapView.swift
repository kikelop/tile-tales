import SwiftUI
import MapKit
import CoreLocation

struct TileMapView: View {
    @EnvironmentObject var store: TileStore
    @Binding var navigationPath: NavigationPath
    @State private var cameraPosition: MapCameraPosition = .automatic
    @State private var selectedTileId: String?
    @State private var activeTag: String?
    @State private var selectedLabel: String?
    @StateObject private var locationService = LocationService()
    @StateObject private var geocoder = GeocodingService.shared

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)

    private var visibleTiles: [TileItem] {
        guard let tag = activeTag else { return store.geolocatedTiles }
        return store.geolocatedTiles.filter { $0.tags.contains(tag) }
    }

    var body: some View {
        ZStack(alignment: .top) {
            // Map
            Map(position: $cameraPosition, selection: $selectedTileId) {
                ForEach(visibleTiles) { tile in
                    if let coordinate = tile.coordinate {
                        Annotation(tile.name, coordinate: coordinate, anchor: .bottom) {
                            VStack(spacing: 0) {
                                tilePin(tile: tile)
                                    .onTapGesture { selectTile(tile) }
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

            headerBar

            // My-location button
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Button {
                        goToMyLocation()
                    } label: {
                        Image(systemName: "location.fill")
                            .font(.system(size: 17))
                            .foregroundColor(fgColor)
                            .frame(width: 48, height: 48)
                            .background(.ultraThinMaterial)
                            .clipShape(Circle())
                            .shadow(color: .black.opacity(0.15), radius: 6, y: 2)
                    }
                    .padding(.trailing, 16)
                    .padding(.bottom, selectedTileId == nil ? 80 : 200)
                }
            }

            // Tag filter chips
            if !store.geolocatedTags.isEmpty {
                VStack {
                    Spacer()
                    tagFilterBar
                        .padding(.bottom, selectedTileId == nil ? 16 : 0)
                }
            }

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
        .onAppear(perform: centerOnTiles)
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
                .font(.system(size: 22, weight: .bold)).tracking(-0.3)

            Text("\(visibleTiles.count) / \(store.tiles.count) located")
                .font(.system(size: 13)).foregroundColor(mutedColor)

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 12)
        .background(bgColor.opacity(0.85).background(.ultraThinMaterial))
    }

    // MARK: - Tag filter

    private var tagFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                chip(title: "All", active: activeTag == nil) { activeTag = nil }
                ForEach(store.geolocatedTags, id: \.self) { tag in
                    chip(title: tag.capitalized, active: activeTag == tag) {
                        activeTag = (activeTag == tag) ? nil : tag
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func chip(title: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .padding(.horizontal, 14).padding(.vertical, 7)
                .background(active ? fgColor : Color.white.opacity(0.9))
                .foregroundColor(active ? .white : fgColor)
                .clipShape(Capsule())
                .shadow(color: .black.opacity(0.1), radius: 3, y: 1)
        }
    }

    // MARK: - Pin

    private func tilePin(tile: TileItem) -> some View {
        Group {
            if let image = tile.image {
                Image(uiImage: image).resizable().aspectRatio(contentMode: .fill)
            } else {
                LinearGradient(colors: [.blue.opacity(0.4), .white.opacity(0.6)],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                    .overlay(Text(tile.name.prefix(1)).font(.system(size: 16, weight: .bold)).foregroundColor(.white))
            }
        }
        .frame(width: 44, height: 44)
        .clipShape(Circle())
        .overlay(Circle().stroke(selectedTileId == tile.id ? fgColor : .white, lineWidth: 3))
        .shadow(color: .black.opacity(0.25), radius: 4, y: 2)
    }

    // MARK: - Selected card

    private func tileCard(tile: TileItem) -> some View {
        HStack(spacing: 16) {
            Group {
                if let image = tile.image {
                    Image(uiImage: image).resizable().aspectRatio(contentMode: .fill)
                } else {
                    Color.gray.opacity(0.2)
                }
            }
            .frame(width: 80, height: 80)
            .clipShape(RoundedRectangle(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 4) {
                Text(tile.name).font(.system(size: 18, weight: .semibold))
                if let label = selectedLabel {
                    Text(label).font(.system(size: 13)).foregroundColor(mutedColor)
                } else if !tile.date.isEmpty {
                    Text(tile.date).font(.system(size: 13)).foregroundColor(mutedColor)
                }
                if !tile.tags.isEmpty {
                    Text(tile.tags.joined(separator: " · ")).font(.system(size: 12)).foregroundColor(mutedColor)
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
        .background(RoundedRectangle(cornerRadius: 20).fill(.ultraThickMaterial)
            .shadow(color: .black.opacity(0.15), radius: 16, y: -4))
        .padding(.horizontal, 16)
        .padding(.bottom, 16)
    }

    // MARK: - Logic

    private func selectTile(_ tile: TileItem) {
        selectedTileId = tile.id
        selectedLabel = nil
        if let lat = tile.latitude, let lng = tile.longitude {
            if let cached = geocoder.cachedLabel(lat: lat, lng: lng) {
                selectedLabel = cached
            } else {
                Task { selectedLabel = await geocoder.reverseGeocode(lat: lat, lng: lng) }
            }
        }
    }

    private func centerOnTiles() {
        let geoTiles = store.geolocatedTiles
        guard !geoTiles.isEmpty else { return }
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

    private func goToMyLocation() {
        Task {
            if let location = await locationService.getCurrentLocation() {
                withAnimation {
                    cameraPosition = .region(MKCoordinateRegion(
                        center: location.coordinate,
                        span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
                    ))
                }
            }
        }
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
