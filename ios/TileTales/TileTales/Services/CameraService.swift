import SwiftUI
import UIKit

struct CameraPicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraDevice = .rear
        picker.delegate = context.coordinator
        picker.allowsEditing = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker

        init(_ parent: CameraPicker) {
            self.parent = parent
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.image = cropToSquare(image)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
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
