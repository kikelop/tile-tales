import SwiftUI

/// Walks a queue of captured photos one at a time (multi-import), presenting the
/// full PhotoEditView (Crop + Adjust) for each. So a brand-new tile gets the same
/// crop AND light adjustments as re-editing an existing one. Mirrors the web
/// CropModal's "N left" + Skip/Use batch chrome via PhotoEditView's batch params.
struct CropView: View {
    let photos: [CapturedPhoto]
    /// Called for each confirmed crop, in order: the source photo, the rendered
    /// 1024² image (crop + colour), and the edit (so it can be re-applied later).
    let onConfirm: (CapturedPhoto, UIImage, PhotoEdit) -> Void
    /// Called when the queue is exhausted or the user cancels the whole batch.
    let onClose: () -> Void

    @State private var index = 0

    private var current: CapturedPhoto? { photos[safe: index] }
    private var remaining: Int { max(0, photos.count - index) }
    private var isBatch: Bool { photos.count > 1 }

    var body: some View {
        if let photo = current {
            PhotoEditView(
                baseImage: photo.image,
                initialEdit: .identity,
                hasOriginalOnDisk: true, // the original IS this photo; no "not stored" hint
                batchLabel: isBatch ? "\(remaining) photo\(remaining == 1 ? "" : "s") left" : nil,
                doneLabel: "Use",
                cancelLabel: isBatch ? "Skip" : "Cancel",
                onDone: { edit, rendered in
                    onConfirm(photo, rendered, edit)
                    advance()
                },
                onCancel: {
                    if isBatch { advance() } else { onClose() }
                }
            )
            .id(index) // fresh editor state per photo
        } else {
            Color.black.ignoresSafeArea()
        }
    }

    private func advance() {
        if index + 1 < photos.count {
            index += 1
        } else {
            onClose()
        }
    }
}

