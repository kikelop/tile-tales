import SwiftUI
import UniformTypeIdentifiers

/// Native backup format. Unlike the web (which zips a manifest + separate blob
/// files), TileItem already carries its image inline as Data, so a single JSON
/// round-trips everything. Samples (asset-backed, no imageData) restore fine too
/// since importData merges by id.
struct BackupManifest: Codable {
    var version = 1
    var exportedAt = Date()
    var tiles: [TileItem]
    var albums: [Album]
}

enum BackupService {
    static func makeBackupFile(tiles: [TileItem], albums: [Album]) throws -> URL {
        let manifest = BackupManifest(tiles: tiles, albums: albums)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted]
        let data = try encoder.encode(manifest)

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let name = "tile-tales-backup-\(formatter.string(from: Date())).json"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        try data.write(to: url)
        return url
    }

    static func decode(_ data: Data) -> BackupManifest? {
        try? JSONDecoder().decode(BackupManifest.self, from: data)
    }
}

/// UIActivityViewController wrapper for sharing the backup file.
struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

/// Document picker for importing a backup JSON.
struct BackupDocumentPicker: UIViewControllerRepresentable {
    let onPick: (Data) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.json])
        picker.allowsMultipleSelection = false
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let parent: BackupDocumentPicker
        init(_ parent: BackupDocumentPicker) { self.parent = parent }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard let url = urls.first else { return }
            let needsStop = url.startAccessingSecurityScopedResource()
            defer { if needsStop { url.stopAccessingSecurityScopedResource() } }
            if let data = try? Data(contentsOf: url) {
                parent.onPick(data)
            }
        }
    }
}
