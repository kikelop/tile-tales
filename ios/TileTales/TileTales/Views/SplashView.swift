import SwiftUI

struct SplashView: View {
    let onFinished: () -> Void

    @State private var appear = false

    // Brand cream — backs the screen so any edge that the pattern doesn't
    // cover blends instead of showing black.
    private let bgColor = Brand.bg

    var body: some View {
        ZStack {
            bgColor.ignoresSafeArea()

            // Single baked splash image: scaledToFill keeps it centered and covers
            // any screen size; the artwork (pattern + logo) is one piece.
            Image("SplashImage")
                .resizable()
                .scaledToFill()
                .ignoresSafeArea()
                .opacity(appear ? 1 : 0)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.6)) { appear = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { onFinished() }
        }
    }
}
