import SwiftUI
import MapKit

/// Flat, neutral basemap using Carto "light_all" raster tiles (same look as the
/// web's Leaflet map) instead of Apple Maps' greens and blues. A MKTileOverlay
/// with `canReplaceMapContent = true` hides Apple's base map entirely. Tile pins
/// are custom annotation views showing the tile image in a white-ringed circle.
struct CartoMapView: UIViewRepresentable {
    var tiles: [TileItem]
    @Binding var selectedTileId: String?
    /// Bumped by the parent to recenter; the coordinator applies `region` when it changes.
    var recenterToken: Int
    var region: MKCoordinateRegion?
    var onSelect: (TileItem) -> Void

    private let accent = UIColor(red: 26/255, green: 26/255, blue: 26/255, alpha: 1)

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.pointOfInterestFilter = .excludingAll
        map.showsCompass = false

        // Carto light basemap (@2x for retina). Fixed subdomain 'a' — MKTileOverlay
        // doesn't expand {s}. canReplaceMapContent drops Apple's base entirely.
        let template = "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
        let overlay = MKTileOverlay(urlTemplate: template)
        overlay.canReplaceMapContent = true
        overlay.tileSize = CGSize(width: 512, height: 512)
        map.addOverlay(overlay, level: .aboveLabels)

        map.register(TilePinView.self, forAnnotationViewWithReuseIdentifier: "tilePin")

        // Tap on empty map (not a pin) dismisses the selected-tile card.
        let tap = UITapGestureRecognizer(target: context.coordinator,
                                         action: #selector(Coordinator.handleMapTap(_:)))
        tap.delegate = context.coordinator
        tap.cancelsTouchesInView = false
        map.addGestureRecognizer(tap)

        context.coordinator.syncAnnotations(on: map)
        if let region { map.setRegion(region, animated: false) }
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        context.coordinator.parent = self
        context.coordinator.syncAnnotations(on: map)

        if context.coordinator.lastRecenter != recenterToken, let region {
            context.coordinator.lastRecenter = recenterToken
            map.setRegion(region, animated: true)
        }
        // Keep the selected ring in sync if selection changed externally.
        context.coordinator.refreshSelection(on: map)
    }

    final class Coordinator: NSObject, MKMapViewDelegate, UIGestureRecognizerDelegate {
        var parent: CartoMapView
        var lastRecenter = 0

        init(_ parent: CartoMapView) { self.parent = parent }

        // Empty-map tap clears the selection (dismisses the card). Taps on a pin are
        // ignored here — MKMapView's own selection handling (didSelect) takes those.
        @objc func handleMapTap(_ g: UITapGestureRecognizer) {
            guard parent.selectedTileId != nil else { return }
            let map = g.view as! MKMapView
            let point = g.location(in: map)
            if let hit = map.hitTest(point, with: nil),
               hit is MKAnnotationView || hit.superview is MKAnnotationView { return }
            parent.selectedTileId = nil
            refreshSelection(on: map)
        }

        func gestureRecognizer(_ g: UIGestureRecognizer,
                               shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

        func syncAnnotations(on map: MKMapView) {
            let existing = map.annotations.compactMap { $0 as? TileAnnotation }
            let existingIds = Set(existing.map { $0.tileId })
            let wantedIds = Set(parent.tiles.map { $0.id })

            // Remove annotations whose tile is gone.
            for ann in existing where !wantedIds.contains(ann.tileId) {
                map.removeAnnotation(ann)
            }
            // Add annotations for new tiles.
            for tile in parent.tiles where !existingIds.contains(tile.id) {
                guard let coord = tile.coordinate else { continue }
                let ann = TileAnnotation(tileId: tile.id, title: tile.name, coordinate: coord,
                                         image: tile.image)
                map.addAnnotation(ann)
            }
        }

        func refreshSelection(on map: MKMapView) {
            for case let view as TilePinView in map.annotations.compactMap({ map.view(for: $0) }) {
                if let ann = view.annotation as? TileAnnotation {
                    view.setSelectedRing(ann.tileId == parent.selectedTileId)
                }
            }
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let tileOverlay = overlay as? MKTileOverlay {
                return MKTileOverlayRenderer(tileOverlay: tileOverlay)
            }
            return MKOverlayRenderer(overlay: overlay)
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard let tileAnn = annotation as? TileAnnotation else { return nil }
            let view = mapView.dequeueReusableAnnotationView(withIdentifier: "tilePin", for: annotation) as! TilePinView
            view.configure(image: tileAnn.image, name: tileAnn.title ?? "")
            view.setSelectedRing(tileAnn.tileId == parent.selectedTileId)
            return view
        }

        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            guard let ann = view.annotation as? TileAnnotation,
                  let tile = parent.tiles.first(where: { $0.id == ann.tileId }) else { return }
            // MKMapView keeps a selection highlight we don't want; clear it.
            mapView.deselectAnnotation(view.annotation, animated: false)
            parent.onSelect(tile)
            refreshSelection(on: mapView)
        }
    }
}

/// Map annotation backing a tile pin.
final class TileAnnotation: NSObject, MKAnnotation {
    let tileId: String
    let title: String?
    let coordinate: CLLocationCoordinate2D
    let image: UIImage?

    init(tileId: String, title: String, coordinate: CLLocationCoordinate2D, image: UIImage?) {
        self.tileId = tileId
        self.title = title
        self.coordinate = coordinate
        self.image = image
    }
}

/// Circular tile-image pin with a white (or ink, when selected) ring.
final class TilePinView: MKAnnotationView {
    private let imageView = UIImageView()
    private let ring = CALayer()
    private let size: CGFloat = 44

    override init(annotation: MKAnnotation?, reuseIdentifier: String?) {
        super.init(annotation: annotation, reuseIdentifier: reuseIdentifier)
        frame = CGRect(x: 0, y: 0, width: size, height: size)
        centerOffset = CGPoint(x: 0, y: -size / 2)

        imageView.frame = bounds
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.layer.cornerRadius = size / 2
        addSubview(imageView)

        layer.cornerRadius = size / 2
        layer.borderWidth = 3
        layer.borderColor = UIColor.white.cgColor
        layer.masksToBounds = true
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.25
        layer.shadowRadius = 4
        layer.shadowOffset = CGSize(width: 0, height: 2)
    }

    required init?(coder: NSCoder) { fatalError() }

    func configure(image: UIImage?, name: String) {
        imageView.image = image
        if image == nil {
            imageView.backgroundColor = UIColor(red: 0.4, green: 0.55, blue: 0.8, alpha: 1)
        }
    }

    func setSelectedRing(_ selected: Bool) {
        layer.borderColor = selected
            ? UIColor(red: 26/255, green: 26/255, blue: 26/255, alpha: 1).cgColor
            : UIColor.white.cgColor
    }
}
