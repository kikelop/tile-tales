import Foundation
import CoreLocation
import UIKit
import CoreImage
import CoreImage.CIFilterBuiltins

/// Non-destructive photo edit for a captured tile: the crop transform + colour
/// adjustments, applied to the on-disk original to re-render `imageData`. All
/// neutral defaults = identity (no-op). Offsets are normalized (screen offset /
/// preview side) so the crop is independent of device screen size.
struct PhotoEdit: Codable, Equatable {
    var scale: CGFloat = 1            // 0.5...4 (matches CropView's magnify clamp)
    var offsetX: CGFloat = 0          // normalized: screen offset.width / side
    var offsetY: CGFloat = 0          // normalized: screen offset.height / side
    var rotationRadians: Double = 0

    var brightness: Double = 0        // CIColorControls inputBrightness  -1...1
    var contrast: Double = 1          // CIColorControls inputContrast     0...2
    var saturation: Double = 1        // CIColorControls inputSaturation   0...2
    var exposure: Double = 0          // CIExposureAdjust inputEV         -2...2
    var warmth: Double = 0            // CITemperatureAndTint target shift -1...1

    static let identity = PhotoEdit()

    var isColorIdentity: Bool {
        brightness == 0 && contrast == 1 && saturation == 1 && exposure == 0 && warmth == 0
    }
}

struct TileItem: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    /// Inline image data for tiles the user captured. Persisted in UserDefaults.
    var imageData: Data?
    /// Bundled asset name for the curated sample tiles. Keeps sample images out
    /// of UserDefaults (mirrors the web app's `/tiles/*.webp` path references vs
    /// `idb:` captured blobs). Exactly one of imageData / assetName is set.
    var assetName: String?
    var memory: String
    var date: String
    var tags: [String]
    var favorite: Bool
    var latitude: Double?
    var longitude: Double?
    var createdAt: Date
    /// Last local mutation — drives last-write-wins sync. Optional so state
    /// persisted before sync existed still decodes.
    var updatedAt: Date?
    /// Non-destructive edit state (crop + colour). Local-only: the explicit
    /// SyncEngine row mapping ignores it, so it never goes to Supabase.
    var photoEdit: PhotoEdit?
    /// True once the uncropped original JPEG has been written to Documents/originals/.
    var hasOriginal: Bool = false

    /// True for tiles the user captured (have inline image data), false for the
    /// bundled samples. Used by Stats' "captured by you" count.
    var isCaptured: Bool { imageData != nil }

    var coordinate: CLLocationCoordinate2D? {
        guard let lat = latitude, let lng = longitude else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    var image: UIImage? {
        if let data = imageData {
            return UIImage(data: data)
        }
        if let assetName {
            return UIImage(named: assetName)
        }
        return nil
    }

    static func create(name: String, image: UIImage, location: CLLocation? = nil) -> TileItem {
        TileItem(
            id: "t-\(UUID().uuidString)",
            name: name,
            imageData: image.jpegData(compressionQuality: 0.85),
            assetName: nil,
            memory: "",
            date: "",
            tags: [],
            favorite: false,
            latitude: location?.coordinate.latitude,
            longitude: location?.coordinate.longitude,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}

struct Album: Identifiable, Codable, Equatable {
    let id: String
    var name: String
    var tileIds: [String]
    var createdAt: Date
    /// Last local mutation — drives last-write-wins sync.
    var updatedAt: Date?
}

struct SavedWallpaper: Identifiable, Codable {
    let id: String
    var imageData: Data?
    var createdAt: Date

    var image: UIImage? {
        guard let data = imageData else { return nil }
        return UIImage(data: data)
    }
}

// MARK: - Curated sample tiles

extension TileItem {
    /// One sample, asset-backed. Coordinates and favorites mirror the web app's
    /// curated DEFAULT_TILES (app/src/lib/store.ts).
    private static func sample(_ id: String, _ name: String, _ asset: String,
                               tags: [String], favorite: Bool = false,
                               lat: Double? = nil, lng: Double? = nil) -> TileItem {
        TileItem(id: id, name: name, imageData: nil, assetName: asset, memory: "",
                 date: "", tags: tags, favorite: favorite,
                 latitude: lat, longitude: lng, createdAt: Date())
    }

    /// Curated samples. The default "recent" sort reverses this list, so the LAST
    /// entry (Star Compass) is the hero the grid shows first / the 3D viewer opens
    /// on. Ordered so the boldest tiles lead the grid and the subtler ones trail;
    /// dropped "Pink Marble" (a flat marble, not a patterned street tile).
    static let samples: [TileItem] = [
        sample("t1", "Terrazzo Star", "terrazzo-star", tags: ["geometric"], lat: 38.7223, lng: -9.1393),
        sample("t12", "Fleur de Lis", "fleur-de-lis-rust", tags: ["classic"], lat: 43.2630, lng: -2.9350),
        sample("t14", "Ochre Scrollwork", "ochre-scrollwork", tags: ["classic", "floral"], lat: 40.4168, lng: -3.7038),
        sample("t4", "Floral Green", "floral-green", tags: ["floral"], lat: 41.1579, lng: -8.6291),
        sample("t8", "Yellow Zellige", "yellow-zellige", tags: ["artisan"], favorite: true, lat: 33.9716, lng: -6.8498),
        sample("t6", "Green Baroque", "green-baroque", tags: ["classic", "geometric"], lat: 41.3874, lng: 2.1686),
        sample("t3", "Geometric Orange", "geometric-orange", tags: ["geometric"], lat: 37.3891, lng: -5.9845),
        sample("t2", "Zellige Rose", "zellige-rose", tags: ["floral", "artisan"], favorite: true, lat: 34.0331, lng: -5.0003),
        sample("t11", "Blue Floral Delft", "blue-floral-delft", tags: ["floral", "classic"], favorite: true, lat: 52.0116, lng: 4.3571),
        sample("t13", "Black Baroque", "black-baroque", tags: ["classic"], lat: 41.3874, lng: 2.1686),
        sample("t9", "Star Blue Gold", "star-blue-gold", tags: ["geometric"], favorite: true, lat: 37.3891, lng: -5.9845),
        sample("t10", "Star Compass", "star-compass", tags: ["geometric"], favorite: true, lat: 38.7223, lng: -9.1393),
    ]
}

// MARK: - Photo render pipeline (crop transform + colour adjustments)

/// Pure render used by both the live editor preview and the saved 1024² image.
/// Crop uses the exact same math as CropView's renderCrop (byte-for-byte parity
/// with existing tiles); colour uses Core Image. Lives here (not a new file) so
/// it doesn't need a manual pbxproj entry.
enum PhotoRenderer {
    static let outputSize: CGFloat = 1024

    // Shared CIContext — expensive to build; the wallpaper duotone uses a manual
    // pixel loop, so this is the app's first one.
    private static let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    /// Crop only: replays offset → rotate → scale (centered), aspect-filling the
    /// source like the on-screen preview. De-normalizes the stored offset by `side`.
    static func crop(_ image: UIImage, edit: PhotoEdit, side: CGFloat) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1 // exact 1024px pixels (not device-scaled), so applyColor's extent matches
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: outputSize, height: outputSize), format: format)
        return renderer.image { ctx in
            let cg = ctx.cgContext
            let f = outputSize / side
            cg.translateBy(x: outputSize / 2, y: outputSize / 2)
            cg.translateBy(x: edit.offsetX * side * f, y: edit.offsetY * side * f)
            cg.rotate(by: CGFloat(edit.rotationRadians))
            cg.scaleBy(x: edit.scale, y: edit.scale)
            let imgSize = image.size
            let fillScale = max(outputSize / imgSize.width, outputSize / imgSize.height)
            let drawW = imgSize.width * fillScale
            let drawH = imgSize.height * fillScale
            image.draw(in: CGRect(x: -drawW / 2, y: -drawH / 2, width: drawW, height: drawH))
        }
    }

    /// Colour only: CIColorControls → CIExposureAdjust → CITemperatureAndTint.
    static func applyColor(_ image: UIImage, edit: PhotoEdit) -> UIImage {
        guard let input = CIImage(image: image) else { return image }
        var out = input

        let controls = CIFilter.colorControls()
        controls.inputImage = out
        controls.brightness = Float(edit.brightness)
        controls.contrast = Float(edit.contrast)
        controls.saturation = Float(edit.saturation)
        out = controls.outputImage ?? out

        if edit.exposure != 0 {
            let exposure = CIFilter.exposureAdjust()
            exposure.inputImage = out
            exposure.ev = Float(edit.exposure)
            out = exposure.outputImage ?? out
        }

        if edit.warmth != 0 {
            // Shift the target neutral warmer (positive) / cooler (negative).
            let temp = CIFilter.temperatureAndTint()
            temp.inputImage = out
            temp.neutral = CIVector(x: 6500, y: 0)
            temp.targetNeutral = CIVector(x: 6500 + edit.warmth * 1500, y: 0)
            out = temp.outputImage ?? out
        }

        // Use the image's real extent (not a hardcoded 1024) so device-scaled inputs
        // aren't cropped to a corner — that bug made adjustments "zoom" the tile.
        guard let cg = ciContext.createCGImage(out, from: input.extent) else { return image }
        return UIImage(cgImage: cg, scale: image.scale, orientation: image.imageOrientation)
    }

    /// Full pipeline: crop the original, then apply colour (skipped if identity).
    static func render(original: UIImage, edit: PhotoEdit, side: CGFloat = outputSize) -> UIImage {
        let cropped = crop(original, edit: edit, side: side)
        return edit.isColorIdentity ? cropped : applyColor(cropped, edit: edit)
    }

    /// A lightweight copy for the interactive editor preview — gesturing a full-res
    /// (12MP) photo per frame stutters and locks up. The final save still uses the
    /// full-res original; the normalized crop transform yields the same framing.
    static func downscaled(_ image: UIImage, maxDimension: CGFloat = 1400) -> UIImage {
        let w = image.size.width, h = image.size.height
        let longest = max(w, h)
        guard longest > maxDimension else { return image }
        let f = maxDimension / longest
        let newSize = CGSize(width: w * f, height: h * f)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: newSize, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}
