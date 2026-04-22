import SwiftUI
import PhotosUI

struct PhotoLibraryPicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.selectionLimit = 1
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

            guard let provider = results.first?.itemProvider,
                  provider.canLoadObject(ofClass: UIImage.self) else { return }

            provider.loadObject(ofClass: UIImage.self) { [weak self] image, _ in
                DispatchQueue.main.async {
                    if let uiImage = image as? UIImage {
                        self?.parent.image = self?.cropToSquare(uiImage)
                    }
                }
            }
        }

        private func cropToSquare(_ image: UIImage) -> UIImage {
            guard let cgImage = image.cgImage else { return image }
            let size = min(cgImage.width, cgImage.height)
            let x = (cgImage.width - size) / 2
            let y = (cgImage.height - size) / 2
            let rect = CGRect(x: x, y: y, width: size, height: size)
            guard let cropped = cgImage.cropping(to: rect) else { return image }
            return UIImage(cgImage: cropped, scale: image.scale, orientation: image.imageOrientation)
        }
    }
}
