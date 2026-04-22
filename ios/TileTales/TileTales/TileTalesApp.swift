import SwiftUI

@main
struct TileTalesApp: App {
    @StateObject private var store = TileStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
        }
    }
}
