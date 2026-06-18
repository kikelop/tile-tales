import UIKit
import CoreImage
import CoreImage.CIFilterBuiltins

// MARK: - Photo render pipeline (crop transform + colour adjustments)

/// Pure render used by both the live editor preview and the saved 1024² image.
/// Crop uses the exact same math as CropView's renderCrop (byte-for-byte parity
/// with existing tiles); colour uses Core Image.
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
