import SwiftUI

enum AppScreen: Hashable {
    case grid
    case viewer(initialIndex: Int)
    case map
    case wallpaper
    case albums
    case albumDetail(id: String)
    case profile
}

struct ContentView: View {
    @EnvironmentObject var store: TileStore
    @State private var showSplash = true
    @State private var selection = 0
    @State private var homePath = NavigationPath()
    @State private var albumsPath = NavigationPath()
    @State private var mapPath = NavigationPath()
    @State private var wallpaperPath = NavigationPath()

    var body: some View {
        ZStack {
            if showSplash {
                SplashView {
                    withAnimation(.easeOut(duration: 0.5)) { showSplash = false }
                }
                .transition(.opacity)
            } else {
                TabView(selection: $selection) {
                    Tab("Home", systemImage: "square.grid.2x2", value: 0) {
                        NavigationStack(path: $homePath) {
                            TileGridView(navigationPath: $homePath)
                                .navigationBarHidden(true)
                                .navigationDestination(for: AppScreen.self) { destination($0, $homePath) }
                        }
                    }
                    Tab("Albums", systemImage: "rectangle.stack", value: 1) {
                        NavigationStack(path: $albumsPath) {
                            AlbumsView(navigationPath: $albumsPath, isRoot: true)
                                .navigationBarHidden(true)
                                .navigationDestination(for: AppScreen.self) { destination($0, $albumsPath) }
                        }
                    }
                    Tab("Map", systemImage: "mappin.circle", value: 2) {
                        NavigationStack(path: $mapPath) {
                            TileMapView(navigationPath: $mapPath, isRoot: true)
                                .navigationBarHidden(true)
                                .navigationDestination(for: AppScreen.self) { destination($0, $mapPath) }
                        }
                    }
                    Tab("Wallpaper", systemImage: "square.on.square", value: 3) {
                        NavigationStack(path: $wallpaperPath) {
                            WallpaperGeneratorView(isRoot: true)
                                .navigationBarHidden(true)
                                .navigationDestination(for: AppScreen.self) { destination($0, $wallpaperPath) }
                        }
                    }
                }
                .transition(.opacity)
            }
        }
        .animation(.easeOut(duration: 0.5), value: showSplash)
    }

    @ViewBuilder
    private func destination(_ screen: AppScreen, _ path: Binding<NavigationPath>) -> some View {
        switch screen {
        case .viewer(let index):
            TileViewer3DView(initialIndex: index, navigationPath: path)
                .navigationBarHidden(true)
                .toolbar(.hidden, for: .tabBar)
        case .profile:
            ProfileView(navigationPath: path)
                .navigationBarHidden(true)
                .toolbar(.hidden, for: .tabBar)
        case .albumDetail(let id):
            AlbumDetailView(albumId: id, navigationPath: path)
                .navigationBarHidden(true)
                .toolbar(.hidden, for: .tabBar)
        case .map:
            TileMapView(navigationPath: path)
                .navigationBarHidden(true)
        case .wallpaper:
            WallpaperGeneratorView()
                .navigationBarHidden(true)
        case .albums:
            AlbumsView(navigationPath: path)
                .navigationBarHidden(true)
        case .grid:
            TileGridView(navigationPath: path)
        }
    }
}
