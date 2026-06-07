import SwiftUI
import CoreText

@main
struct TileTalesApp: App {
    @StateObject private var store = TileStore()
    @StateObject private var auth = AuthService()
    @StateObject private var sync = SyncEngine()

    init() {
        // Register the bundled Caveat handwriting font app-wide (Info.plist is
        // generated, so we can't declare UIAppFonts — register at runtime).
        if let url = Bundle.main.url(forResource: "Caveat", withExtension: "ttf") {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .environmentObject(auth)
                .environmentObject(sync)
                .task {
                    auth.start()
                    sync.start(store: store, auth: auth)
                }
        }
    }
}
