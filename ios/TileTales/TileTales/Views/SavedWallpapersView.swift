import SwiftUI

/// Gallery of saved wallpapers, opened from the "Saved (N)" pill in the
/// wallpaper generator. Tap to preview full-screen; share or delete from there.
struct SavedWallpapersView: View {
    @EnvironmentObject var store: TileStore
    @Environment(\.dismiss) private var dismiss

    @State private var preview: SavedWallpaper?

    private let bgColor = Brand.bg
    private let fgColor = Brand.fg
    private let mutedColor = Brand.muted

    private let columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]

    var body: some View {
        NavigationStack {
            ZStack {
                bgColor.ignoresSafeArea()

                if store.wallpapers.isEmpty {
                    VStack(spacing: 6) {
                        Text("No saved wallpapers yet")
                            .font(.system(size: 16, weight: .semibold)).foregroundColor(fgColor)
                        Text("Create one and tap Save to keep it here.")
                            .font(.system(size: 13)).foregroundColor(mutedColor)
                    }
                } else {
                    ScrollView {
                        LazyVGrid(columns: columns, spacing: 10) {
                            ForEach(store.wallpapers) { wp in
                                if let img = wp.image {
                                    Image(uiImage: img)
                                        .resizable()
                                        .aspectRatio(9.0 / 16.0, contentMode: .fill)
                                        .frame(maxWidth: .infinity)
                                        .clipShape(RoundedRectangle(cornerRadius: 14))
                                        .onTapGesture { preview = wp }
                                }
                            }
                        }
                        .padding(16)
                    }
                }
            }
            .navigationTitle("Saved")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .fullScreenCover(item: $preview) { wp in
                SavedWallpaperPreview(wallpaper: wp)
            }
        }
    }
}

/// Full-screen preview of a single saved wallpaper with share + delete.
private struct SavedWallpaperPreview: View {
    @EnvironmentObject var store: TileStore
    @Environment(\.dismiss) private var dismiss
    let wallpaper: SavedWallpaper

    @State private var showShare = false
    @State private var showDeleteConfirm = false

    private let fgColor = Brand.fg

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let img = wallpaper.image {
                Image(uiImage: img).resizable().aspectRatio(contentMode: .fit)
            }

            VStack {
                Spacer()
                HStack(spacing: 10) {
                    Button("Close") { dismiss() }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(Color.white.opacity(0.2))
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    Button("Share") { showShare = true }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(fgColor)
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(Color.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    Button {
                        showDeleteConfirm = true
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 52).padding(.vertical, 14)
                            .background(Color.white.opacity(0.2))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
        }
        .sheet(isPresented: $showShare) {
            if let img = wallpaper.image { ActivityView(items: [img]) }
        }
        .alert("Delete wallpaper?", isPresented: $showDeleteConfirm) {
            Button("Delete", role: .destructive) {
                store.removeWallpaper(id: wallpaper.id)
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        }
    }
}
