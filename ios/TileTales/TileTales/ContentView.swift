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
    @EnvironmentObject var sync: SyncEngine
    @AppStorage("tt-onboarding-seen") private var onboardingSeen = false
    /// TEMP (testing): always show onboarding on every launch. Set false (or
    /// remove + restore the `!onboardingSeen` check) before release.
    private let alwaysShowIntro = true
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
                    if alwaysShowIntro || !onboardingSeen {
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
            OnboardingView {
                onboardingSeen = true
                showOnboarding = false
            }
            .environmentObject(auth)
            .environmentObject(sync)
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
    let onDone: () -> Void
    @EnvironmentObject var auth: AuthService
    @State private var page = 0
    @State private var showLogin = false

    private var isLoggedIn: Bool { auth.session != nil }

    private let bg = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fg = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let muted = Color(red: 138/255, green: 133/255, blue: 120/255)
    private let accent = Color(red: 52/255, green: 70/255, blue: 188/255)

    private struct Page { let icon: String; let title: String; let body: String; let isLogin: Bool }

    private var pages: [Page] {
        var p = [
            Page(icon: "square.grid.2x2.fill", title: "Collect street tiles",
                 body: "Tile Tales is your collection of the beautiful tiles you spot out in the world.", isLogin: false),
            Page(icon: "camera.fill", title: "Capture & fix",
                 body: "Tap + to photograph a tile, then crop it and fix the light right away.", isLogin: false),
            Page(icon: "cube.fill", title: "See them in 3D",
                 body: "Tap any tile to spin it in 3D — and write the memory of where you found it on the back.", isLogin: false),
        ]
        if !isLoggedIn {
            p.append(Page(icon: "icloud.fill", title: "Keep them safe",
                          body: "Sign in to back up your collection so you never lose a tile. You can always do this later.", isLogin: true))
        }
        return p
    }

    var body: some View {
        let safePage = min(page, pages.count - 1)
        ZStack {
            bg.ignoresSafeArea()
            VStack(spacing: 0) {
                HStack {
                    Spacer()
                    Button("Skip") { onDone() }
                        .font(.system(size: 15)).foregroundColor(muted)
                        .padding(.horizontal, 20).padding(.top, 16)
                }

                Spacer()

                // Manual paging (not TabView .page — its scroll view swallowed the
                // Next button's taps).
                pageView(pages[safePage])
                    .id(safePage)
                    .transition(.opacity)
                    .frame(maxWidth: .infinity)

                Spacer()

                HStack(spacing: 8) {
                    ForEach(pages.indices, id: \.self) { i in
                        Circle()
                            .fill(i == safePage ? accent : Color.black.opacity(0.15))
                            .frame(width: 8, height: 8)
                    }
                }
                .padding(.bottom, 16)

                Button {
                    if page < pages.count - 1 { withAnimation { page += 1 } } else { onDone() }
                } label: {
                    Text(safePage == pages.count - 1 ? "Get started" : "Next")
                        .font(.system(size: 17, weight: .semibold)).foregroundColor(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 16)
                        .background(accent).clipShape(RoundedRectangle(cornerRadius: 14))
                        .contentShape(Rectangle()) // whole pill is tappable, not just the text
                }
                .padding(.horizontal, 24).padding(.bottom, 24)
            }
        }
        // Swipe anywhere on the screen to change page.
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 30).onEnded { v in
                if v.translation.width < -40, page < pages.count - 1 { withAnimation { page += 1 } }
                if v.translation.width > 40, page > 0 { withAnimation { page -= 1 } }
            }
        )
        // Login as a dismissable modal — never blocks finishing onboarding.
        .sheet(isPresented: $showLogin) { LoginSheet() }
    }

    private func pageView(_ p: Page) -> some View {
        VStack(spacing: 22) {
            Image(systemName: p.icon)
                .font(.system(size: 60)).foregroundColor(accent)
            Text(p.title)
                .font(.system(size: 26, weight: .bold)).foregroundColor(fg)
            Text(p.body)
                .font(.system(size: 16)).foregroundColor(muted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 36)
            if p.isLogin {
                Button { showLogin = true } label: {
                    Text("Sign in")
                        .font(.system(size: 16, weight: .semibold)).foregroundColor(accent)
                        .padding(.horizontal, 28).padding(.vertical, 12)
                        .overlay(Capsule().stroke(accent, lineWidth: 1.5))
                }
                .padding(.top, 4)
            }
        }
    }
}

/// The account/login form (AccountSectionView) presented as a dismissable sheet,
/// e.g. from onboarding. Optional — you can close it and continue without signing in.
struct LoginSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var auth: AuthService
    private let bg = Color(red: 245/255, green: 242/255, blue: 237/255)

    var body: some View {
        NavigationStack {
            ZStack {
                bg.ignoresSafeArea()
                ScrollView { AccountSectionView().padding(16) }
            }
            .navigationTitle("Sign in")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            // Auto-close once signed in.
            .onChange(of: auth.session != nil) { _, loggedIn in
                if loggedIn { dismiss() }
            }
        }
    }
}

