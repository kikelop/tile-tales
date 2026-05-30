import UIKit
import ImageIO
import CoreLocation

enum CaptureSource {
    case camera
    case library
}

/// One photo waiting to be cropped into a tile. Mirrors the web capture queue:
/// library photos carry their EXIF coordinate (no fallback to current location),
/// camera photos resolve GPS at save time.
struct CapturedPhoto: Identifiable, Equatable {
    let id = UUID()
    let image: UIImage
    let source: CaptureSource
    let coordinate: CLLocationCoordinate2D?

    static func == (lhs: CapturedPhoto, rhs: CapturedPhoto) -> Bool {
        lhs.id == rhs.id
    }
}

enum ExifReader {
    /// Pulls the GPS coordinate out of raw image data, if present. Used for
    /// library picks so a photo taken in Lisboa doesn't get stamped with the
    /// user's current location (the bug the web app fixed).
    static func coordinate(from data: Data) -> CLLocationCoordinate2D? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let props = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              let gps = props[kCGImagePropertyGPSDictionary] as? [CFString: Any],
              let lat = gps[kCGImagePropertyGPSLatitude] as? Double,
              let latRef = gps[kCGImagePropertyGPSLatitudeRef] as? String,
              let lng = gps[kCGImagePropertyGPSLongitude] as? Double,
              let lngRef = gps[kCGImagePropertyGPSLongitudeRef] as? String else {
            return nil
        }
        let latitude = latRef == "S" ? -lat : lat
        let longitude = lngRef == "W" ? -lng : lng
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}
