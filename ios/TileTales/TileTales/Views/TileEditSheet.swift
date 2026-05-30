import SwiftUI
import MapKit
import CoreLocation

struct TileEditSheet: View {
    @EnvironmentObject var store: TileStore
    @Environment(\.dismiss) private var dismiss
    let tile: TileItem

    @State private var name = ""
    @State private var memory = ""
    @State private var date = ""
    @State private var tagsText = ""
    @State private var showDeleteConfirm = false

    // Location drafts
    @State private var geoLat: Double?
    @State private var geoLng: Double?
    @State private var locationLabel: String?
    @State private var resolvingLabel = false
    @State private var locationMode: LocationMode = .none
    @State private var searchQuery = ""
    @State private var searchResults: [PlaceResult] = []
    @State private var searching = false
    @State private var mapCamera: MapCameraPosition = .automatic

    // Album create
    @State private var newAlbumName = ""

    @StateObject private var locationService = LocationService()

    private enum LocationMode { case none, search, pinMap }

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)
    private let fieldBg = Color(red: 250/255, green: 248/255, blue: 245/255)
    private let fieldBorder = Color(red: 224/255, green: 216/255, blue: 204/255)
    private let accentGreen = Color(red: 46/255, green: 125/255, blue: 90/255)

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    nameField
                    memoryField
                    dateField
                    tagsField
                    locationSection
                    albumsSection
                    actionButtons
                    deleteButton
                }
                .padding(24)
            }
            .background(Color.white)
            .navigationBarHidden(true)
        }
        .onAppear(perform: seed)
        .alert("Delete tile?", isPresented: $showDeleteConfirm) {
            Button("Delete", role: .destructive) {
                store.deleteTile(id: tile.id)
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This action cannot be undone.")
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Fields

    private var nameField: some View {
        TextField("Tile name", text: $name)
            .font(.system(size: 20, weight: .semibold))
            .padding(12)
            .background(fieldBg)
            .cornerRadius(12)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(fieldBorder, lineWidth: 1))
    }

    private var memoryField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Memory (appears on the back of the tile)")
                .font(.system(size: 13)).foregroundColor(mutedColor)
            TextEditor(text: $memory)
                .font(.custom("Snell Roundhand", size: 18))
                .frame(minHeight: 120)
                .padding(12)
                .background(fieldBg)
                .cornerRadius(12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(fieldBorder, lineWidth: 1))
        }
    }

    private var dateField: some View {
        TextField("e.g. March 2026, Lisboa", text: $date)
            .font(.custom("Snell Roundhand", size: 16))
            .foregroundColor(mutedColor)
            .padding(12)
            .background(fieldBg)
            .cornerRadius(12)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(fieldBorder, lineWidth: 1))
    }

    private var tagsField: some View {
        TextField("Tags: geometric, floral, classic...", text: $tagsText)
            .font(.system(size: 14))
            .autocorrectionDisabled()
            .padding(12)
            .background(fieldBg)
            .cornerRadius(12)
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(fieldBorder, lineWidth: 1))
    }

    // MARK: - Location

    private var hasLocation: Bool { geoLat != nil && geoLng != nil }

    private var locationSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Current location row
            HStack(spacing: 8) {
                Image(systemName: hasLocation ? "mappin.circle.fill" : "mappin.slash")
                    .foregroundColor(hasLocation ? accentGreen : mutedColor)
                if hasLocation {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(locationLabel ?? "\(coordString)")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(fgColor)
                        if resolvingLabel {
                            Text("\(coordString) · naming…")
                                .font(.system(size: 11)).foregroundColor(mutedColor)
                        }
                    }
                } else {
                    Text("No location")
                        .font(.system(size: 14)).foregroundColor(mutedColor)
                }
                Spacer()
                if hasLocation {
                    Button {
                        clearLocation()
                    } label: {
                        Image(systemName: "xmark.circle.fill").foregroundColor(mutedColor)
                    }
                }
            }
            .padding(12)
            .background(hasLocation ? accentGreen.opacity(0.08) : Color.black.opacity(0.03))
            .cornerRadius(12)
            .overlay(RoundedRectangle(cornerRadius: 12)
                .stroke(hasLocation ? accentGreen.opacity(0.4) : fieldBorder, lineWidth: 1))
            .animation(.easeOut(duration: 0.25), value: hasLocation)

            // Three ways to set it
            HStack(spacing: 8) {
                locationOption("Use my location", system: "location.fill") {
                    useMyLocation()
                }
                locationOption("Search", system: "magnifyingglass") {
                    locationMode = locationMode == .search ? .none : .search
                }
                locationOption("Pin on map", system: "map") {
                    locationMode = locationMode == .pinMap ? .none : .pinMap
                    if locationMode == .pinMap { centerMap() }
                }
            }

            if locationMode == .search { searchSubview }
            if locationMode == .pinMap { mapSubview }
        }
    }

    private func locationOption(_ title: String, system: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: system).font(.system(size: 15))
                Text(title).font(.system(size: 11, weight: .medium)).lineLimit(1)
            }
            .foregroundColor(fgColor)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(Color.black.opacity(0.05))
            .cornerRadius(10)
        }
    }

    private var searchSubview: some View {
        VStack(spacing: 8) {
            HStack {
                TextField("Search a place", text: $searchQuery)
                    .font(.system(size: 14))
                    .autocorrectionDisabled()
                    .onSubmit { runSearch() }
                Button("Go") { runSearch() }
                    .font(.system(size: 13, weight: .semibold))
            }
            .padding(10)
            .background(fieldBg)
            .cornerRadius(10)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(fieldBorder, lineWidth: 1))

            if searching {
                ProgressView().frame(maxWidth: .infinity)
            }
            ForEach(searchResults) { result in
                Button {
                    selectPlace(result)
                } label: {
                    HStack {
                        Image(systemName: "mappin").foregroundColor(mutedColor)
                        Text(result.label).font(.system(size: 13)).foregroundColor(fgColor)
                        Spacer()
                    }
                    .padding(.vertical, 8).padding(.horizontal, 4)
                }
            }
        }
    }

    private var mapSubview: some View {
        MapReader { proxy in
            Map(position: $mapCamera) {
                if let lat = geoLat, let lng = geoLng {
                    Marker("", coordinate: CLLocationCoordinate2D(latitude: lat, longitude: lng))
                        .tint(accentGreen)
                }
            }
            .frame(height: 220)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .onTapGesture { screenPoint in
                if let coord = proxy.convert(screenPoint, from: .local) {
                    setLocation(lat: coord.latitude, lng: coord.longitude)
                }
            }
            .overlay(alignment: .bottom) {
                Text("Tap the map to drop a pin")
                    .font(.system(size: 11)).foregroundColor(.white)
                    .padding(.horizontal, 10).padding(.vertical, 5)
                    .background(fgColor.opacity(0.7))
                    .clipShape(Capsule())
                    .padding(.bottom, 8)
            }
        }
    }

    private var coordString: String {
        guard let lat = geoLat, let lng = geoLng else { return "" }
        return String(format: "%.4f, %.4f", lat, lng)
    }

    // MARK: - Albums

    private var albumsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Albums")
                .font(.system(size: 13)).foregroundColor(mutedColor)

            ForEach(store.albums) { album in
                Button {
                    store.toggleTileInAlbum(albumId: album.id, tileId: tile.id)
                } label: {
                    HStack {
                        Image(systemName: album.tileIds.contains(tile.id) ? "checkmark.circle.fill" : "circle")
                            .foregroundColor(album.tileIds.contains(tile.id) ? accentGreen : mutedColor)
                        Text(album.name).font(.system(size: 14)).foregroundColor(fgColor)
                        Spacer()
                        Text("\(album.tileIds.count)").font(.system(size: 12)).foregroundColor(mutedColor)
                    }
                    .padding(.vertical, 8).padding(.horizontal, 10)
                    .background(Color.black.opacity(0.03))
                    .cornerRadius(10)
                }
            }

            HStack {
                TextField("New album…", text: $newAlbumName)
                    .font(.system(size: 14))
                Button("Add") {
                    let trimmed = newAlbumName.trimmingCharacters(in: .whitespaces)
                    guard !trimmed.isEmpty else { return }
                    let album = store.addAlbum(name: trimmed)
                    store.toggleTileInAlbum(albumId: album.id, tileId: tile.id)
                    newAlbumName = ""
                }
                .font(.system(size: 13, weight: .semibold))
                .disabled(newAlbumName.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(10)
            .background(fieldBg)
            .cornerRadius(10)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(fieldBorder, lineWidth: 1))
        }
    }

    // MARK: - Actions

    private var actionButtons: some View {
        HStack(spacing: 12) {
            Button("Cancel") { dismiss() }
                .font(.system(size: 15, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(fieldBorder, lineWidth: 1))
                .cornerRadius(12)

            Button("Save") { save() }
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(fgColor)
                .cornerRadius(12)
        }
    }

    private var deleteButton: some View {
        Button(role: .destructive) {
            showDeleteConfirm = true
        } label: {
            Text("Delete tile")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.red)
        }
        .padding(.top, 8)
    }

    // MARK: - Logic

    private func seed() {
        name = tile.name
        memory = tile.memory
        date = tile.date
        tagsText = tile.tags.joined(separator: ", ")
        geoLat = tile.latitude
        geoLng = tile.longitude
        if hasLocation { resolveLabel() }
    }

    private func save() {
        let tags = tagsText.split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
            .filter { !$0.isEmpty }
        store.updateTile(id: tile.id, name: name, memory: memory, date: date,
                         tags: tags, latitude: geoLat, longitude: geoLng)
        dismiss()
    }

    private func setLocation(lat: Double, lng: Double) {
        geoLat = lat
        geoLng = lng
        locationLabel = nil
        resolveLabel()
    }

    private func clearLocation() {
        geoLat = nil
        geoLng = nil
        locationLabel = nil
    }

    private func useMyLocation() {
        Task {
            if let location = await locationService.getCurrentLocation() {
                setLocation(lat: location.coordinate.latitude, lng: location.coordinate.longitude)
                centerMap()
            }
        }
    }

    private func runSearch() {
        let query = searchQuery
        guard query.trimmingCharacters(in: .whitespaces).count >= 2 else { return }
        searching = true
        Task {
            let results = await GeocodingService.shared.searchPlaces(query: query)
            searchResults = results
            searching = false
        }
    }

    private func selectPlace(_ result: PlaceResult) {
        setLocation(lat: result.latitude, lng: result.longitude)
        locationLabel = result.label
        locationMode = .none
        searchResults = []
        centerMap()
    }

    private func resolveLabel() {
        guard let lat = geoLat, let lng = geoLng else { return }
        if let cached = GeocodingService.shared.cachedLabel(lat: lat, lng: lng) {
            locationLabel = cached
            return
        }
        resolvingLabel = true
        Task {
            locationLabel = await GeocodingService.shared.reverseGeocode(lat: lat, lng: lng)
            resolvingLabel = false
        }
    }

    private func centerMap() {
        guard let lat = geoLat, let lng = geoLng else { return }
        mapCamera = .region(MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: lat, longitude: lng),
            span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
        ))
    }
}
