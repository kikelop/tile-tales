import SwiftUI

struct AlbumsView: View {
    @EnvironmentObject var store: TileStore
    @Binding var navigationPath: NavigationPath
    @State private var newAlbumName = ""
    @State private var showCreate = false

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        ZStack {
            bgColor.ignoresSafeArea()

            VStack(spacing: 0) {
                header

                if store.albums.isEmpty {
                    VStack(spacing: 8) {
                        Spacer()
                        Image(systemName: "rectangle.stack")
                            .font(.system(size: 40)).foregroundColor(mutedColor.opacity(0.5))
                        Text("No albums yet")
                            .font(.system(size: 16, weight: .medium)).foregroundColor(fgColor)
                        Text("Group tiles into albums from a tile's edit screen, or create one here.")
                            .font(.system(size: 13)).foregroundColor(mutedColor)
                            .multilineTextAlignment(.center).padding(.horizontal, 40)
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    ScrollView {
                        LazyVGrid(columns: columns, spacing: 12) {
                            ForEach(store.albums) { album in
                                Button {
                                    navigationPath.append(AppScreen.albumDetail(id: album.id))
                                } label: {
                                    albumCard(album)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(16)
                    }
                }
            }
        }
        .alert("New album", isPresented: $showCreate) {
            TextField("Album name", text: $newAlbumName)
            Button("Create") {
                let trimmed = newAlbumName.trimmingCharacters(in: .whitespaces)
                if !trimmed.isEmpty { store.addAlbum(name: trimmed) }
                newAlbumName = ""
            }
            Button("Cancel", role: .cancel) { newAlbumName = "" }
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Button { navigationPath.removeLast() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(fgColor)
                    .frame(width: 40, height: 40)
                    .background(Color.black.opacity(0.06))
                    .clipShape(Circle())
            }
            Text("Albums").font(.system(size: 22, weight: .bold)).tracking(-0.3)
            Spacer()
            Button { showCreate = true } label: {
                Image(systemName: "plus")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(.white)
                    .frame(width: 40, height: 40)
                    .background(fgColor)
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 12)
    }

    private func albumCard(_ album: Album) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack {
                if let cover = store.tiles(in: album).first?.image {
                    Image(uiImage: cover)
                        .resizable().aspectRatio(1, contentMode: .fill)
                } else {
                    Rectangle().fill(Color.black.opacity(0.06))
                        .aspectRatio(1, contentMode: .fill)
                        .overlay(Image(systemName: "square.stack").font(.system(size: 28)).foregroundColor(mutedColor.opacity(0.5)))
                }
            }
            .frame(maxWidth: .infinity)
            .clipShape(RoundedRectangle(cornerRadius: 14))

            Text(album.name).font(.system(size: 15, weight: .semibold)).foregroundColor(fgColor).lineLimit(1)
            Text("\(album.tileIds.count) tile\(album.tileIds.count == 1 ? "" : "s")")
                .font(.system(size: 12)).foregroundColor(mutedColor)
        }
    }
}

struct AlbumDetailView: View {
    @EnvironmentObject var store: TileStore
    let albumId: String
    @Binding var navigationPath: NavigationPath
    @State private var showRename = false
    @State private var renameText = ""
    @State private var showDeleteConfirm = false

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)
    private let columns = [GridItem(.flexible(), spacing: 2), GridItem(.flexible(), spacing: 2), GridItem(.flexible(), spacing: 2)]

    private var album: Album? { store.albums.first { $0.id == albumId } }

    var body: some View {
        ZStack {
            bgColor.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                if let album, !album.tileIds.isEmpty {
                    ScrollView {
                        LazyVGrid(columns: columns, spacing: 2) {
                            ForEach(store.tiles(in: album)) { tile in
                                TileGridCell(tile: tile) {
                                    if let index = store.tiles.firstIndex(where: { $0.id == tile.id }) {
                                        navigationPath.append(AppScreen.viewer(initialIndex: index))
                                    }
                                }
                            }
                        }
                    }
                } else {
                    VStack {
                        Spacer()
                        Text("No tiles in this album yet")
                            .font(.system(size: 15)).foregroundColor(mutedColor)
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .alert("Rename album", isPresented: $showRename) {
            TextField("Album name", text: $renameText)
            Button("Save") { store.renameAlbum(id: albumId, name: renameText) }
            Button("Cancel", role: .cancel) {}
        }
        .alert("Delete album?", isPresented: $showDeleteConfirm) {
            Button("Delete", role: .destructive) {
                store.deleteAlbum(id: albumId)
                navigationPath.removeLast()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("The tiles stay in your collection; only the album is removed.")
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Button { navigationPath.removeLast() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(fgColor)
                    .frame(width: 40, height: 40)
                    .background(Color.black.opacity(0.06))
                    .clipShape(Circle())
            }
            Text(album?.name ?? "Album").font(.system(size: 22, weight: .bold)).tracking(-0.3).lineLimit(1)
            Spacer()
            Menu {
                Button { renameText = album?.name ?? ""; showRename = true } label: { Label("Rename", systemImage: "pencil") }
                Button(role: .destructive) { showDeleteConfirm = true } label: { Label("Delete album", systemImage: "trash") }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(fgColor)
                    .frame(width: 40, height: 40)
                    .background(Color.black.opacity(0.06))
                    .clipShape(Circle())
            }
        }
        .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 12)
    }
}
