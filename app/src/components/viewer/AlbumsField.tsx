"use client";

import { useState } from "react";
import { type Album, addAlbum, toggleTileInAlbum } from "@/lib/store";
import { haptic } from "@/lib/haptic";
import { toast } from "@/lib/toast";

export default function AlbumsField({
  tileId,
  albums,
}: {
  tileId: string | undefined;
  albums: Album[];
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  if (!tileId) return null;

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const album = addAlbum(name);
    toggleTileInAlbum(album.id, tileId);
    setCreating(false);
    setNewName("");
    haptic(8);
    toast(`Added to "${album.name}"`);
  };

  return (
    <div style={{ marginTop: 14 }}>
      <p style={{ margin: "0 0 8px", fontSize: 13, color: "#8a8578" }}>Albums</p>
      <div
        className="hide-scrollbar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          paddingBottom: 2,
        }}
      >
        {albums.map((a) => {
          const isIn = a.tileIds.includes(tileId);
          return (
            <button
              key={a.id}
              onClick={() => { toggleTileInAlbum(a.id, tileId); haptic(6); }}
              style={{
                padding: "6px 12px",
                borderRadius: 18,
                border: isIn ? "1.5px solid #1a1a1a" : "1.5px solid #e0d8cc",
                background: isIn ? "#1a1a1a" : "transparent",
                color: isIn ? "#fff" : "#1a1a1a",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                WebkitTapHighlightColor: "transparent",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {a.name}
            </button>
          );
        })}
        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            style={{
              padding: "6px 12px",
              borderRadius: 18,
              border: "1.5px dashed #c4b8a4",
              background: "transparent",
              color: "#8a8578",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            + New album
          </button>
        ) : (
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") { setCreating(false); setNewName(""); }
              }}
              placeholder="Album name"
              style={{
                padding: "6px 10px",
                borderRadius: 14,
                border: "1px solid #e0d8cc",
                background: "#faf8f5",
                fontSize: 12,
                outline: "none",
                width: 120,
              }}
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              style={{
                padding: "6px 10px",
                borderRadius: 14,
                border: "none",
                background: newName.trim() ? "#1a1a1a" : "#bbb6ad",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                cursor: newName.trim() ? "pointer" : "default",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Add
            </button>
            <button
              onClick={() => { setCreating(false); setNewName(""); }}
              style={{
                padding: "6px 8px",
                borderRadius: 14,
                border: "none",
                background: "transparent",
                color: "#8a8578",
                fontSize: 11,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
