import SwiftUI

/// Interactive square crop with pinch-zoom, drag-pan and rotation. Walks a queue
/// of captured photos one at a time (multi-import), calling onConfirm per tile.
/// Mirrors the web CropModal: pill "N left" + Skip vs Cancel when batching.
struct CropView: View {
    let photos: [CapturedPhoto]
    /// Called for each confirmed crop, in order.
    let onConfirm: (CapturedPhoto, UIImage) -> Void
    /// Called when the queue is exhausted or the user cancels the whole batch.
    let onClose: () -> Void

    @State private var index = 0
    @State private var scale: CGFloat = 1
    @State private var baseScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var baseOffset: CGSize = .zero
    @State private var rotation: Angle = .zero
    @State private var baseRotation: Angle = .zero

    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let outputSize: CGFloat = 1024

    private var current: CapturedPhoto? { photos[safe: index] }
    private var remaining: Int { max(0, photos.count - index) }
    private var isBatch: Bool { photos.count > 1 }

    var body: some View {
        GeometryReader { geo in
            let side = min(geo.size.width - 32, geo.size.height - 220)

            ZStack {
                Color.black.ignoresSafeArea()

                VStack(spacing: 20) {
                    if isBatch {
                        Text("\(remaining) photo\(remaining == 1 ? "" : "s") left")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 14).padding(.vertical, 6)
                            .background(Color.white.opacity(0.18))
                            .clipShape(Capsule())
                    }

                    Spacer()

                    if let photo = current {
                        Image(uiImage: photo.image)
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: side, height: side)
                            .scaleEffect(scale)
                            .rotationEffect(rotation)
                            .offset(offset)
                            .frame(width: side, height: side)
                            .clipped()
                            .overlay(
                                Rectangle().stroke(Color.white.opacity(0.6), lineWidth: 1)
                            )
                            .contentShape(Rectangle())
                            .gesture(dragGesture.simultaneously(with: magnifyGesture).simultaneously(with: rotateGesture))
                    }

                    Spacer()

                    // Rotation fine controls
                    HStack(spacing: 24) {
                        rotateButton(systemName: "rotate.left", delta: -10)
                        Text("\(Int(rotation.degrees.truncatingRemainder(dividingBy: 360)))°")
                            .font(.system(size: 14, weight: .medium, design: .monospaced))
                            .foregroundColor(.white.opacity(0.8))
                            .frame(width: 60)
                        rotateButton(systemName: "rotate.right", delta: 10)
                    }

                    // Actions
                    HStack(spacing: 10) {
                        Button(isBatch ? "Skip" : "Cancel") {
                            if isBatch { advance() } else { onClose() }
                        }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.white.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                        Button("Use") {
                            if let photo = current {
                                let cropped = renderCrop(photo.image, side: side)
                                onConfirm(photo, cropped)
                            }
                            advance()
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
                .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Gestures

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                offset = CGSize(width: baseOffset.width + value.translation.width,
                                height: baseOffset.height + value.translation.height)
            }
            .onEnded { _ in baseOffset = offset }
    }

    private var magnifyGesture: some Gesture {
        MagnificationGesture()
            .onChanged { value in scale = max(0.5, min(4, baseScale * value)) }
            .onEnded { _ in baseScale = scale }
    }

    private var rotateGesture: some Gesture {
        RotationGesture()
            .onChanged { value in rotation = baseRotation + value }
            .onEnded { _ in baseRotation = rotation }
    }

    private func rotateButton(systemName: String, delta: Double) -> some View {
        Button {
            withAnimation(.easeOut(duration: 0.15)) {
                rotation = .degrees(rotation.degrees + delta)
                baseRotation = rotation
            }
        } label: {
            Image(systemName: systemName)
                .font(.system(size: 18))
                .foregroundColor(.white)
                .frame(width: 44, height: 44)
                .background(Color.white.opacity(0.18))
                .clipShape(Circle())
        }
    }

    // MARK: - Flow

    private func advance() {
        // Reset transform for the next photo.
        scale = 1; baseScale = 1
        offset = .zero; baseOffset = .zero
        rotation = .zero; baseRotation = .zero
        if index + 1 < photos.count {
            index += 1
        } else {
            onClose()
        }
    }

    // MARK: - Crop rendering

    /// Replays the on-screen transform (offset → rotate → scale, centered) into
    /// a square output, drawing the image aspect-filled the same way the preview
    /// frame does.
    private func renderCrop(_ image: UIImage, side: CGFloat) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: outputSize, height: outputSize))
        return renderer.image { ctx in
            let cg = ctx.cgContext
            let f = outputSize / side
            cg.translateBy(x: outputSize / 2, y: outputSize / 2)
            cg.translateBy(x: offset.width * f, y: offset.height * f)
            cg.rotate(by: CGFloat(rotation.radians))
            cg.scaleBy(x: scale, y: scale)

            let imgSize = image.size
            let fillScale = max(outputSize / imgSize.width, outputSize / imgSize.height)
            let drawW = imgSize.width * fillScale
            let drawH = imgSize.height * fillScale
            image.draw(in: CGRect(x: -drawW / 2, y: -drawH / 2, width: drawW, height: drawH))
        }
    }
}
