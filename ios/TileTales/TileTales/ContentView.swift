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
    @AppStorage("tt-tour-seen") private var tourSeen = false
    @State private var showOnboarding = false
    @State private var showTour = false
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
                    } else if !tourSeen {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { withAnimation { showTour = true } }
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
                if !tourSeen {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { withAnimation { showTour = true } }
                }
            }
            .environmentObject(auth)
            .environmentObject(sync)
        }
        .overlay {
            if showTour {
                TourOverlay { tourSeen = true; withAnimation { showTour = false } }
                    .transition(.opacity)
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
                // Next button's taps). Swipe horizontally or use the button.
                pageView(pages[safePage])
                    .id(safePage)
                    .transition(.opacity)
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 30).onEnded { v in
                            if v.translation.width < -40, page < pages.count - 1 { withAnimation { page += 1 } }
                            if v.translation.width > 40, page > 0 { withAnimation { page -= 1 } }
                        }
                    )

                Spacer()

                HStack(spacing: 8) {
                    ForEach(pages.indices, id: \.self) { i in
                        Circle()
                            .fill(i == safePage ? accent : Color.black.opacity(0.15))
                            .frame(width: 8, height: 8)
                    }
                }
                .padding(.bottom, 16)

                Button(safePage == pages.count - 1 ? "Get started" : "Next") {
                    if page < pages.count - 1 { withAnimation { page += 1 } } else { onDone() }
                }
                .font(.system(size: 17, weight: .semibold)).foregroundColor(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 16)
                .background(accent).clipShape(RoundedRectangle(cornerRadius: 14))
                .padding(.horizontal, 24).padding(.bottom, 24)
            }
        }
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

// MARK: - First-run guided tour (coachmarks over the real UI)

/// Dims the app and walks through its parts: the tile grid, the + button, the
/// section tabs. A white frame highlights each spot with a caption + Next/Skip.
/// Positions are derived from the screen geometry (no per-element frame capture),
/// which keeps it robust. Gated by @AppStorage "tt-tour-seen".
struct TourOverlay: View {
    let onDone: () -> Void
    @State private var step = 0

    private let accent = Color(red: 52/255, green: 70/255, blue: 188/255)

    private struct Spot { let rect: (CGSize, EdgeInsets) -> CGRect; let captionTop: Bool; let text: String }

    private let steps: [Spot] = [
        Spot(rect: { size, safe in
            CGRect(x: 16, y: safe.top + 64, width: size.width - 32, height: size.height * 0.42)
        }, captionTop: false, text: "Your tiles live here. Tap one to spin it in 3D and read its story."),
        Spot(rect: { size, safe in
            let d: CGFloat = 72
            return CGRect(x: size.width - 16 - d, y: size.height - safe.bottom - 96 - d, width: d, height: d)
        }, captionTop: true, text: "Tap + to add a tile you found — snap it, crop it, fix the light."),
        Spot(rect: { size, safe in
            CGRect(x: 12, y: size.height - safe.bottom - 78, width: size.width - 24, height: 64)
        }, captionTop: true, text: "Albums to group them, Map to see where you found them, Compose to make patterns."),
    ]

    var body: some View {
        GeometryReader { geo in
            let safe = geo.safeAreaInsets
            let spot = steps[step]
            let r = spot.rect(geo.size, safe)

            ZStack(alignment: .topLeading) {
                Color.black.opacity(0.6).ignoresSafeArea()
                    .onTapGesture { advance() }

                // Highlight frame around the current spot.
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.white, lineWidth: 3)
                    .frame(width: r.width, height: r.height)
                    .position(x: r.midX, y: r.midY)

                // Caption card, above or below the spot.
                captionCard(text: spot.text)
                    .frame(maxWidth: geo.size.width - 48)
                    .position(x: geo.size.width / 2,
                              y: spot.captionTop ? max(r.minY - 70, safe.top + 60) : r.maxY + 80)
            }
        }
        .ignoresSafeArea()
    }

    private func captionCard(text: String) -> some View {
        VStack(spacing: 14) {
            Text(text)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(Color(red: 26/255, green: 26/255, blue: 26/255))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            HStack {
                Button("Skip") { onDone() }
                    .font(.system(size: 14)).foregroundColor(.secondary)
                Spacer()
                Text("\(step + 1)/\(steps.count)").font(.system(size: 13)).foregroundColor(.secondary)
                Spacer()
                Button(step == steps.count - 1 ? "Done" : "Next") { advance() }
                    .font(.system(size: 15, weight: .semibold)).foregroundColor(accent)
            }
        }
        .padding(16)
        .background(Color(red: 245/255, green: 242/255, blue: 237/255))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.25), radius: 12, y: 4)
    }

    private func advance() {
        if step < steps.count - 1 { withAnimation { step += 1 } } else { onDone() }
    }
}
