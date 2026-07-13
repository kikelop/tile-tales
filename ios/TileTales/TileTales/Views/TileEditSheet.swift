import SwiftUI
import MapKit
import CoreLocation

struct TileEditSheet: View {
    @EnvironmentObject var store: TileStore
    @Environment(\.dismiss) private var dismiss
    let tile: TileItem

    @State private var name = ""
    @State private var memory = ""
    @State private var dateValue = Date()
    @State private var hasDate = false
    @State private var tagsText = ""

    /// English, fixed format so the date on the tile back reads consistently
    /// regardless of device locale (the app's UI copy is English).
    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        f.dateFormat = "MMM d, yyyy"
        return f
    }()
    @State private var showDeleteConfirm = false
    @State private var showPhotoEditor = false

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

    private let bgColor = Brand.bg
    private let fgColor = Brand.fg
    private let mutedColor = Brand.muted
    private let fieldBg = Brand.bg
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
                    if tile.isCaptured { editPhotoButton }
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
        .fullScreenCover(isPresented: $showPhotoEditor) {
            let base = (tile.hasOriginal ? store.originalImage(for: tile.id) : nil) ?? tile.image ?? UIImage()
            PhotoEditView(
                baseImage: base,
                initialEdit: tile.photoEdit ?? .identity,
                hasOriginalOnDisk: tile.hasOriginal,
                onDone: { edit, rendered in
                    // Promote a legacy tile (no original on disk) to non-destructive.
                    if !tile.hasOriginal { store.writeOriginal(base, for: tile.id) }
                    store.updatePhotoEdit(id: tile.id, edit: edit, renderedImage: rendered)
                    showPhotoEditor = false
                },
                onCancel: { showPhotoEditor = false }
            )
        }
    }

    private var editPhotoButton: some View {
        Button { showPhotoEditor = true } label: {
            HStack(spacing: 8) {
                Image(systemName: "slider.horizontal.below.rectangle")
                Text("Edit photo")
            }
            .font(.system(size: 15, weight: .medium))
            .foregroundColor(fgColor)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(fieldBg)
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(fieldBorder, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    // MARK: - Fields

    private var tagsField: some View {
        VStack(alignment: .leading, spacing: 8) {
            fieldLabel("Tags")
            TextField("geometric, floral (comma-separated)", text: $tagsText)
                .font(.system(size: 15))
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .padding(12)
                .background(fieldBg)
                .cornerRadius(12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(fieldBorder, lineWidth: 1))
        }
    }

    private func fieldLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13)).foregroundColor(mutedColor)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var nameField: some View {
        VStack(alignment: .leading, spacing: 8) {
            fieldLabel("Title")
            TextField("Tile name", text: $name)
                .font(.system(size: 20, weight: .semibold))
                .padding(12)
                .background(fieldBg)
                .cornerRadius(12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(fieldBorder, lineWidth: 1))
        }
    }

    private var memoryField: some View {
        VStack(alignment: .leading, spacing: 8) {
            fieldLabel("Memory (appears on the back of the tile)")
            TextEditor(text: $memory)
                .font(.custom("Caveat", size: 22))
                .scrollContentBackground(.hidden)
                .frame(minHeight: 120)
                .padding(12)
                .background(fieldBg)
                .cornerRadius(12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(fieldBorder, lineWidth: 1))
        }
    }

    private var dateField: some View {
        VStack(alignment: .leading, spacing: 8) {
            fieldLabel("Date")
            if hasDate {
                HStack {
                    DatePicker("", selection: $dateValue, displayedComponents: .date)
                        .labelsHidden()
                        .datePickerStyle(.compact)
                    Spacer()
                    Button { hasDate = false } label: {
                        Image(systemName: "xmark.circle.fill").foregroundColor(mutedColor)
                    }
                }
                .padding(12)
                .background(fieldBg)
                .cornerRadius(12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(fieldBorder, lineWidth: 1))
            } else {
                Button { hasDate = true } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "calendar")
                        Text("Add a date")
                        Spacer()
                    }
                    .font(.system(size: 15))
                    .foregroundColor(mutedColor)
                    .padding(12)
                    .background(fieldBg)
                    .cornerRadius(12)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(fieldBorder, lineWidth: 1))
                }
            }
        }
    }

    // MARK: - Location

    private var hasLocation: Bool { geoLat != nil && geoLng != nil }

    private var locationSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            fieldLabel("Place")
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

            HStack(spacing: 8) {
                TextField("New album…", text: $newAlbumName)
                    .font(.system(size: 14))
                    .submitLabel(.done)
                    .onSubmit { createAlbum() }
                Button { createAlbum() } label: {
                    Text("Create")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 16).padding(.vertical, 8)
                        .background(newAlbumIsEmpty ? mutedColor.opacity(0.4) : accentGreen)
                        .clipShape(Capsule())
                }
                .disabled(newAlbumIsEmpty)
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
        if let parsed = Self.dateFormatter.date(from: tile.date) {
            dateValue = parsed
            hasDate = true
        } else {
            hasDate = false
        }
        tagsText = tile.tags.joined(separator: ", ")
        geoLat = tile.latitude
        geoLng = tile.longitude
        if hasLocation { resolveLabel() }
    }

    private func save() {
        let tags = tagsText.split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespaces).lowercased() }
            .filter { !$0.isEmpty }
        let dateString = hasDate ? Self.dateFormatter.string(from: dateValue) : ""
        store.updateTile(id: tile.id, name: name, memory: memory, date: dateString,
                         tags: tags, latitude: geoLat, longitude: geoLng)
        dismiss()
    }

    private var newAlbumIsEmpty: Bool {
        newAlbumName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private func createAlbum() {
        let trimmed = newAlbumName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        let album = store.addAlbum(name: trimmed)
        store.toggleTileInAlbum(albumId: album.id, tileId: tile.id)
        newAlbumName = ""
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
