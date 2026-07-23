import UIKit
import SwiftUI

struct ShareService {
    static func createShareCard(for tile: TileItem) -> UIImage? {
        let size = CGSize(width: 1080, height: 1080)
        let renderer = UIGraphicsImageRenderer(size: size)

        return renderer.image { ctx in
            let context = ctx.cgContext

            // Background — matches Brand.bg (#FDFCFB)
            UIColor(red: 253/255, green: 252/255, blue: 251/255, alpha: 1).setFill()
            context.fill(CGRect(origin: .zero, size: size))

            // Tile image
            let pad: CGFloat = 60
            let imgSize = size.width - pad * 2
            let imgRect = CGRect(x: pad, y: pad, width: imgSize, height: imgSize)

            if let tileImage = tile.image {
                let path = UIBezierPath(roundedRect: imgRect, cornerRadius: 24)
                context.saveGState()
                path.addClip()
                tileImage.draw(in: imgRect)
                context.restoreGState()

                // Gradient overlay at bottom
                let gradientRect = CGRect(x: pad, y: 780, width: imgSize, height: size.height - 780 - pad)
                let colors = [UIColor.clear.cgColor, UIColor.black.withAlphaComponent(0.6).cgColor]
                if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors as CFArray, locations: [0, 1]) {
                    let gradPath = UIBezierPath(roundedRect: CGRect(x: pad, y: pad, width: imgSize, height: imgSize), cornerRadius: 24)
                    context.saveGState()
                    gradPath.addClip()
                    context.drawLinearGradient(gradient,
                                              start: CGPoint(x: size.width / 2, y: gradientRect.minY),
                                              end: CGPoint(x: size.width / 2, y: size.height - pad),
                                              options: [])
                    context.restoreGState()
                }
            }

            // Tile name
            let nameAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 42, weight: .bold),
                .foregroundColor: UIColor.white,
            ]
            let nameString = tile.name as NSString
            nameString.draw(at: CGPoint(x: pad + 28, y: size.height - pad - 72), withAttributes: nameAttrs)

            // Subtitle (date or coordinates)
            var subtitle = tile.date
            if subtitle.isEmpty, let lat = tile.latitude, let lng = tile.longitude {
                subtitle = String(format: "%.2f, %.2f", lat, lng)
            }
            if !subtitle.isEmpty {
                let subAttrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 28),
                    .foregroundColor: UIColor.white.withAlphaComponent(0.75),
                ]
                (subtitle as NSString).draw(at: CGPoint(x: pad + 28, y: size.height - pad - 110), withAttributes: subAttrs)
            }

            // Watermark
            let wmAttrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 22),
                .foregroundColor: UIColor.white.withAlphaComponent(0.5),
            ]
            let wmString = "Tile Tales" as NSString
            let wmSize = wmString.size(withAttributes: wmAttrs)
            wmString.draw(at: CGPoint(x: size.width - pad - wmSize.width - 20, y: pad + 16), withAttributes: wmAttrs)
        }
    }

    static func share(tile: TileItem, from view: UIView? = nil) {
        guard let image = createShareCard(for: tile) else { return }

        let text = tile.memory.isEmpty ? "Check out this tile: \(tile.name)" : tile.memory
        let activityVC = UIActivityViewController(activityItems: [image, text], applicationActivities: nil)

        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            if let popover = activityVC.popoverPresentationController {
                popover.sourceView = rootVC.view
                popover.sourceRect = CGRect(x: rootVC.view.bounds.midX, y: rootVC.view.bounds.midY, width: 0, height: 0)
            }
            rootVC.present(activityVC, animated: true)
        }
    }
}
