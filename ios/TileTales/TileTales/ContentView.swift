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
    /// TEMP (testing): always show onboarding + tour on every launch. Set false
    /// (or remove + restore the `!seen` checks) before release.
    private let alwaysShowIntro = true
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
                    if alwaysShowIntro || !onboardingSeen {
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
                if alwaysShowIntro || !tourSeen {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { withAnimation { showTour = true } }
                }
            }
            .environmentObject(auth)
            .environmentObject(sync)
        }
        .overlayPreferenceValue(TourAnchorKey.self) { anchors in
            if showTour {
                GeometryReader { geo in
                    let tabRect = CGRect(x: 10,
                                         y: geo.size.height - geo.safeAreaInsets.bottom - 62,
                                         width: geo.size.width - 20, height: 58)
                    // Grid fills the screen, so frame just its top rows (with inner
                    // margins) — a full-viewport frame would sit at the screen edges.
                    let gridRect = anchors[.grid].map { a -> CGRect in
                        let r = geo[a]
                        return CGRect(x: r.minX + 8, y: r.minY + 6,
                                      width: r.width - 16, height: min(r.height - 12, 300))
                    }
                    TourOverlay(
                        gridRect: gridRect,
                        addRect: anchors[.add].map { geo[$0].insetBy(dx: -8, dy: -8) },
                        tabRect: tabRect,
                        screenSize: geo.size,
                        safeTop: geo.safeAreaInsets.top
                    ) { tourSeen = true; withAnimation { showTour = false } }
                }
                .ignoresSafeArea()
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

// MARK: - Tour anchors (so coachmark frames hug the real elements)

enum TourSpot: Hashable { case grid, add }

struct TourAnchorKey: PreferenceKey {
    static var defaultValue: [TourSpot: Anchor<CGRect>] = [:]
    static func reduce(value: inout [TourSpot: Anchor<CGRect>], nextValue: () -> [TourSpot: Anchor<CGRect>]) {
        value.merge(nextValue()) { $1 }
    }
}

extension View {
    /// Reports this view's bounds so the guided tour can frame it exactly.
    func tourAnchor(_ spot: TourSpot) -> some View {
        anchorPreference(key: TourAnchorKey.self, value: .bounds) { [spot: $0] }
    }
}

// MARK: - First-run guided tour (coachmarks over the real UI)

/// Dims the app and walks through its parts: the tile grid, the + button, the
/// section tabs. A white frame highlights each spot with a caption + Next/Skip.
/// Positions are derived from the screen geometry (no per-element frame capture),
/// which keeps it robust. Gated by @AppStorage "tt-tour-seen".
struct TourOverlay: View {
    let gridRect: CGRect?
    let addRect: CGRect?
    let tabRect: CGRect
    let screenSize: CGSize
    let safeTop: CGFloat
    let onDone: () -> Void
    @State private var step = 0

    private let accent = Color(red: 52/255, green: 70/255, blue: 188/255)
    private let bg = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fg = Color(red: 26/255, green: 26/255, blue: 26/255)

    private struct Step { let rect: CGRect?; let captionTop: Bool; let text: String }

    private var steps: [Step] {
        [
            Step(rect: gridRect, captionTop: false,
                 text: "Your tiles live here. Tap one to spin it in 3D and read its story."),
            Step(rect: addRect, captionTop: true,
                 text: "Tap + to add a tile you found — snap it, crop it, fix the light."),
            Step(rect: tabRect, captionTop: true,
                 text: "Albums to group them, Map to see where you found them, Compose to make patterns."),
        ]
    }

    var body: some View {
        let s = steps[step]
        let r = s.rect  // rects already padded per-element by the caller

        ZStack {
            Color.black.opacity(0.55).ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture { advance() }

            if let r {
                RoundedRectangle(cornerRadius: 18)
                    .stroke(bg, lineWidth: 2.5)
                    .frame(width: r.width, height: r.height)
                    .position(x: r.midX, y: r.midY)
                    .shadow(color: accent.opacity(0.5), radius: 8)
            }

            captionCard(text: s.text)
                .frame(maxWidth: screenSize.width - 48)
                .position(x: screenSize.width / 2, y: captionY(for: r, top: s.captionTop))
        }
    }

    private func captionY(for r: CGRect?, top: Bool) -> CGFloat {
        guard let r else { return screenSize.height / 2 }
        return top ? max(r.minY - 78, safeTop + 70) : min(r.maxY + 84, screenSize.height - 120)
    }

    private func captionCard(text: String) -> some View {
        VStack(spacing: 14) {
            Text(text)
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(fg)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            HStack {
                Button("Skip") { onDone() }
                    .font(.system(size: 14)).foregroundColor(Color(red: 138/255, green: 133/255, blue: 120/255))
                Spacer()
                Text("\(step + 1)/\(steps.count)")
                    .font(.system(size: 13)).foregroundColor(Color(red: 138/255, green: 133/255, blue: 120/255))
                Spacer()
                Button(step == steps.count - 1 ? "Done" : "Next") { advance() }
                    .font(.system(size: 15, weight: .semibold)).foregroundColor(accent)
            }
        }
        .padding(18)
        .background(bg)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .shadow(color: .black.opacity(0.22), radius: 14, y: 6)
    }

    private func advance() {
        if step < steps.count - 1 { withAnimation { step += 1 } } else { onDone() }
    }
}
