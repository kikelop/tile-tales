import SwiftUI
import PhotosUI

/// Multi-select library picker. Loads each pick's data representation so EXIF
/// GPS can be read, then hands back a queue of CapturedPhoto for the crop flow.
struct PhotoLibraryPicker: UIViewControllerRepresentable {
    @Binding var photos: [CapturedPhoto]
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.selectionLimit = 0 // 0 = unlimited (multi-import)
        config.filter = .images
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let parent: PhotoLibraryPicker

        init(_ parent: PhotoLibraryPicker) {
            self.parent = parent
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            parent.dismiss()
            guard !results.isEmpty else { return }

            // Preserve the order the user picked in; loads run concurrently.
            let group = DispatchGroup()
            var collected = [Int: CapturedPhoto]()
            let lock = NSLock()

            for (index, result) in results.enumerated() {
                let provider = result.itemProvider
                guard provider.canLoadObject(ofClass: UIImage.self) else { continue }
                group.enter()
                provider.loadDataRepresentation(forTypeIdentifier: "public.image") { data, _ in
                    defer { group.leave() }
                    guard let data, let image = UIImage(data: data) else { return }
                    let coordinate = ExifReader.coordinate(from: data)
                    let photo = CapturedPhoto(image: image, source: .library, coordinate: coordinate)
                    lock.lock(); collected[index] = photo; lock.unlock()
                }
            }

            group.notify(queue: .main) {
                let ordered = collected.keys.sorted().compactMap { collected[$0] }
                self.parent.photos = ordered
            }
        }
    }
}
