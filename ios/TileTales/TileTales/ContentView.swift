import SwiftUI

enum AppScreen: Hashable {
    case grid
    case viewer(initialIndex: Int)
    case map
    case wallpaper
    case albums
    case albumDetail(id: String)
    case stats
}

struct ContentView: View {
    @EnvironmentObject var store: TileStore
    @State private var showSplash = true
    @State private var navigationPath = NavigationPath()

    var body: some View {
        ZStack {
            if showSplash {
                SplashView {
                    withAnimation(.easeOut(duration: 0.5)) {
                        showSplash = false
                    }
                }
                .transition(.opacity)
            } else {
                NavigationStack(path: $navigationPath) {
                    TileGridView(navigationPath: $navigationPath)
                        .navigationDestination(for: AppScreen.self) { screen in
                            switch screen {
                            case .viewer(let index):
                                TileViewer3DView(initialIndex: index, navigationPath: $navigationPath)
                                    .navigationBarHidden(true)
                            case .map:
                                TileMapView(navigationPath: $navigationPath)
                                    .navigationBarHidden(true)
                            case .wallpaper:
                                WallpaperGeneratorView()
                                    .navigationBarHidden(true)
                            case .albums:
                                AlbumsView(navigationPath: $navigationPath)
                                    .navigationBarHidden(true)
                            case .albumDetail(let id):
                                AlbumDetailView(albumId: id, navigationPath: $navigationPath)
                                    .navigationBarHidden(true)
                            case .stats:
                                StatsView(navigationPath: $navigationPath)
                                    .navigationBarHidden(true)
                            case .grid:
                                TileGridView(navigationPath: $navigationPath)
                            }
                        }
                }
                .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.5), value: showSplash)
    }
}
