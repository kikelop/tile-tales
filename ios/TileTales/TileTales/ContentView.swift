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
    @EnvironmentObject var auth: AuthService
    @AppStorage("tt-onboarding-seen") private var onboardingSeen = false
    @State private var showOnboarding = false
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
                    if !onboardingSeen {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { showOnboarding = true }
                    }
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
                    Tab("Compose", systemImage: "square.on.square", value: 3) {
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
        .fullScreenCover(isPresented: $showOnboarding) {
            OnboardingView(isLoggedIn: auth.session != nil) {
                onboardingSeen = true
                showOnboarding = false
            }
        }
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

// MARK: - First-run onboarding

/// Shown once after the splash (gated by @AppStorage "tt-onboarding-seen"). A few
/// paged cards explaining the app; the last card recommends signing in (only when
/// anonymous) so the user doesn't lose their collection.
struct OnboardingView: View {
    let isLoggedIn: Bool
    let onDone: () -> Void
    @State private var page = 0

    private let bg = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fg = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let muted = Color(red: 138/255, green: 133/255, blue: 120/255)
    private let accent = Color(red: 52/255, green: 70/255, blue: 188/255)

    private struct Page { let icon: String; let title: String; let body: String }

    private var pages: [Page] {
        var p = [
            Page(icon: "square.grid.2x2.fill", title: "Collect street tiles",
                 body: "Tile Tales is your collection of the beautiful tiles you spot out in the world."),
            Page(icon: "camera.fill", title: "Capture & fix",
                 body: "Tap + to photograph a tile, then crop it and fix the light right away."),
            Page(icon: "cube.fill", title: "See them in 3D",
                 body: "Tap any tile to spin it in 3D — and write the memory of where you found it on the back."),
        ]
        if !isLoggedIn {
            p.append(Page(icon: "icloud.fill", title: "Keep them safe",
                          body: "Sign in from your profile to back up your collection, so you never lose a tile."))
        }
        return p
    }

    var body: some View {
        ZStack {
            bg.ignoresSafeArea()
            VStack(spacing: 0) {
                HStack {
                    Spacer()
                    Button("Skip") { onDone() }
                        .font(.system(size: 15)).foregroundColor(muted)
                        .padding(.horizontal, 20).padding(.top, 16)
                }

                TabView(selection: $page) {
                    ForEach(pages.indices, id: \.self) { i in
                        VStack(spacing: 22) {
                            Image(systemName: pages[i].icon)
                                .font(.system(size: 60)).foregroundColor(accent)
                            Text(pages[i].title)
                                .font(.system(size: 26, weight: .bold)).foregroundColor(fg)
                            Text(pages[i].body)
                                .font(.system(size: 16)).foregroundColor(muted)
                                .multilineTextAlignment(.center)
                                .fixedSize(horizontal: false, vertical: true)
                                .padding(.horizontal, 36)
                        }
                        .tag(i)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))

                Button(page == pages.count - 1 ? "Get started" : "Next") {
                    if page < pages.count - 1 { withAnimation { page += 1 } } else { onDone() }
                }
                .font(.system(size: 17, weight: .semibold)).foregroundColor(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 16)
                .background(accent).clipShape(RoundedRectangle(cornerRadius: 14))
                .padding(.horizontal, 24).padding(.bottom, 24)
            }
        }
    }
}
