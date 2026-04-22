import SwiftUI

struct SplashView: View {
    let onFinished: () -> Void

    @State private var opacity: Double = 0
    @State private var titleOffset: CGFloat = 10
    @State private var step = 0

    // Duotone colors matching web app
    private let duoDark = Color(red: 74/255, green: 111/255, blue: 165/255)
    private let duoLight = Color(red: 232/255, green: 220/255, blue: 200/255)
    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)

    // Sample colors for the tile grid animation
    private let tileColors: [[Color]] = [
        [.blue.opacity(0.3), .indigo.opacity(0.4), .teal.opacity(0.3), .cyan.opacity(0.4)],
        [.purple.opacity(0.3), .blue.opacity(0.4), .indigo.opacity(0.3), .teal.opacity(0.4)],
        [.teal.opacity(0.4), .cyan.opacity(0.3), .blue.opacity(0.4), .purple.opacity(0.3)],
        [.indigo.opacity(0.4), .teal.opacity(0.3), .purple.opacity(0.4), .blue.opacity(0.3)],
    ]

    var body: some View {
        ZStack {
            bgColor.ignoresSafeArea()

            VStack(spacing: 32) {
                // 2x2 animated tile grid
                LazyVGrid(columns: [GridItem(.fixed(70), spacing: 0), GridItem(.fixed(70), spacing: 0)], spacing: 0) {
                    ForEach(0..<4, id: \.self) { index in
                        RoundedRectangle(cornerRadius: 0)
                            .fill(
                                LinearGradient(
                                    colors: [duoDark, tileColors[step % tileColors.count][index]],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 70, height: 70)
                            .opacity(opacity)
                            .animation(
                                .easeOut(duration: 0.4).delay(Double(index) * 0.1),
                                value: step
                            )
                    }
                }

                // App name
                VStack(spacing: 6) {
                    Text("Tile Tales")
                        .font(.system(size: 28, weight: .semibold))
                        .tracking(-0.5)
                        .foregroundColor(Color(red: 26/255, green: 26/255, blue: 26/255))

                    Text("Your street tile collection")
                        .font(.system(size: 13))
                        .foregroundColor(Color(red: 138/255, green: 133/255, blue: 120/255))
                }
                .opacity(opacity)
                .offset(y: titleOffset)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) {
                opacity = 1
                titleOffset = 0
            }

            // Cycle tile colors
            Timer.scheduledTimer(withTimeInterval: 0.8, repeats: true) { timer in
                withAnimation(.easeInOut(duration: 0.4)) {
                    step += 1
                }
            }

            // Auto-dismiss after 2.5s
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                onFinished()
            }
        }
    }
}
