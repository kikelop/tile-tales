import SwiftUI

struct TileEditSheet: View {
    @EnvironmentObject var store: TileStore
    @Environment(\.dismiss) private var dismiss
    let tile: TileItem

    @State private var name: String = ""
    @State private var memory: String = ""
    @State private var date: String = ""
    @State private var tagsText: String = ""
    @State private var showDeleteConfirm = false

    private let bgColor = Color(red: 245/255, green: 242/255, blue: 237/255)
    private let fgColor = Color(red: 26/255, green: 26/255, blue: 26/255)
    private let mutedColor = Color(red: 138/255, green: 133/255, blue: 120/255)

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 16) {
                    // Name
                    TextField("Tile name", text: $name)
                        .font(.system(size: 20, weight: .semibold))
                        .padding(12)
                        .background(Color(red: 250/255, green: 248/255, blue: 245/255))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color(red: 224/255, green: 216/255, blue: 204/255), lineWidth: 1)
                        )

                    // Memory
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Memory (appears on the back of the tile)")
                            .font(.system(size: 13))
                            .foregroundColor(mutedColor)

                        TextEditor(text: $memory)
                            .font(.custom("Snell Roundhand", size: 18))
                            .frame(minHeight: 120)
                            .padding(12)
                            .background(Color(red: 250/255, green: 248/255, blue: 245/255))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color(red: 224/255, green: 216/255, blue: 204/255), lineWidth: 1)
                            )
                    }

                    // Date
                    TextField("e.g. March 2026, Lisboa", text: $date)
                        .font(.custom("Snell Roundhand", size: 16))
                        .foregroundColor(mutedColor)
                        .padding(12)
                        .background(Color(red: 250/255, green: 248/255, blue: 245/255))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color(red: 224/255, green: 216/255, blue: 204/255), lineWidth: 1)
                        )

                    // Tags
                    TextField("Tags: geometric, floral, classic...", text: $tagsText)
                        .font(.system(size: 14))
                        .padding(12)
                        .background(Color(red: 250/255, green: 248/255, blue: 245/255))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color(red: 224/255, green: 216/255, blue: 204/255), lineWidth: 1)
                        )

                    // Location info
                    if let lat = tile.latitude, let lng = tile.longitude {
                        HStack {
                            Image(systemName: "mappin")
                                .foregroundColor(mutedColor)
                            Text(String(format: "%.4f, %.4f", lat, lng))
                                .font(.system(size: 13))
                                .foregroundColor(mutedColor)
                            Spacer()
                        }
                        .padding(.horizontal, 4)
                    }

                    // Save
                    HStack(spacing: 12) {
                        Button("Cancel") {
                            dismiss()
                        }
                        .font(.system(size: 15, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color(red: 224/255, green: 216/255, blue: 204/255), lineWidth: 1)
                        )
                        .cornerRadius(12)

                        Button("Save") {
                            let tags = tagsText.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces).lowercased() }.filter { !$0.isEmpty }
                            store.updateTile(id: tile.id, name: name, memory: memory, date: date, tags: tags)
                            dismiss()
                        }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(fgColor)
                        .cornerRadius(12)
                    }

                    // Delete
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        Text("Delete tile")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.red)
                    }
                    .padding(.top, 8)
                }
                .padding(24)
            }
            .background(Color.white)
            .navigationBarHidden(true)
        }
        .onAppear {
            name = tile.name
            memory = tile.memory
            date = tile.date
            tagsText = tile.tags.joined(separator: ", ")
        }
        .alert("Delete tile?", isPresented: $showDeleteConfirm) {
            Button("Delete", role: .destructive) {
                store.deleteTile(id: tile.id)
                dismiss()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This action cannot be undone.")
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
