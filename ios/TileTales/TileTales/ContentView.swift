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

/// The 3D viewer is presented as a full-screen cover (immersive, no tab bar, no
/// reflow "pop") from any tab. Child views set `route` instead of pushing.
struct ViewerRoute: Identifiable, Equatable {
    let id = UUID()
    let index: Int
}

@MainActor
final class ViewerPresenter: ObservableObject {
    @Published var route: ViewerRoute?
    func open(_ index: Int) { route = ViewerRoute(index: index) }
}

struct ContentView: View {
    @EnvironmentObject var store: TileStore
    @State private var showSplash = true
    @State private var selection = 0
    @State private var homePath = NavigationPath()
    @State private var albumsPath = NavigationPath()
    @State private var mapPath = NavigationPath()
    @State private var wallpaperPath = NavigationPath()
    @StateObject private var viewerPresenter = ViewerPresenter()

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
                .tint(Color(red: 52/255, green: 70/255, blue: 188/255)) // #3446BC brand indigo
                .transition(.opacity)
                .environmentObject(viewerPresenter)
                .fullScreenCover(item: $viewerPresenter.route) { route in
                    TileViewer3DView(initialIndex: route.index) {
                        viewerPresenter.route = nil
                    }
                    .environmentObject(store)
                    .environmentObject(viewerPresenter)
                }
            }
        }
        .animation(.easeOut(duration: 0.5), value: showSplash)
    }

    @ViewBuilder
    private func destination(_ screen: AppScreen, _ path: Binding<NavigationPath>) -> some View {
        switch screen {
        case .viewer:
            EmptyView() // viewer is presented as a full-screen cover, not pushed
        case .profile:
            ProfileView(navigationPath: path)
                .navigationBarHidden(true)
        case .albumDetail(let id):
            AlbumDetailView(albumId: id, navigationPath: path)
                .navigationBarHidden(true)
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
