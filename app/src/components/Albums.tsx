"use client";

import { useState, useSyncExternalStore, useMemo } from "react";
import {
  getState,
  subscribe,
  addAlbum,
  deleteAlbum,
  renameAlbum,
  type Album,
  type TileItem,
} from "@/lib/store";
import { useTileFileUrl } from "@/lib/useTileFileUrl";
import { haptic } from "@/lib/haptic";
import { toast } from "@/lib/toast";

function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

function AlbumCover({ tile }: { tile: TileItem | undefined }) {
  const url = useTileFileUrl(tile?.file);
  if (!tile) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "1",
          background: "var(--tt-tile-placeholder)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--tt-muted)",
          fontSize: 12,
        }}
      >
        Empty
      </div>
    );
  }
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={tile.name}
      style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
    />
  ) : (
    <div style={{ width: "100%", aspectRatio: "1", background: "var(--tt-tile-placeholder)" }} />
  );
}

export default function Albums({
  onBack,
  onOpenAlbum,
}: {
  onBack: () => void;
  onOpenAlbum: (id: string) => void;
}) {
  const { albums, tiles } = useStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const tileById = useMemo(() => {
    const m = new Map<string, TileItem>();
    tiles.forEach((t) => m.set(t.id, t));
    return m;
  }, [tiles]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const album = addAlbum(name);
    setCreating(false);
    setNewName("");
    haptic(8);
    toast(`Album "${album.name}" created`);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--tt-bg)",
        color: "var(--tt-fg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "max(16px, env(safe-area-inset-top, 16px)) 16px 12px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            border: "none",
            background: "var(--tt-chip-bg)",
            color: "var(--tt-fg)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(22px, 5vw, 28px)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--tt-fg)",
            flex: 1,
          }}
        >
          Albums
        </h1>
        <button
          onClick={() => { setCreating(true); haptic(6); }}
          style={{
            padding: "8px 14px",
            borderRadius: 18,
            border: "none",
            background: "var(--tt-chip-bg-active)",
            color: "var(--tt-chip-fg-active)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          + New
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "8px 16px 24px" }}>
        {albums.length === 0 && !creating ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--tt-muted)", fontSize: 14 }}>
            No albums yet. Tap + New to group your tiles by trip, city, or style.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 12,
            }}
          >
            {albums.map((a) => {
              const cover = a.tileIds.length > 0 ? tileById.get(a.tileIds[0]) : undefined;
              return (
                <button
                  key={a.id}
                  onClick={() => { onOpenAlbum(a.id); haptic(6); }}
                  style={{
                    border: "1px solid var(--tt-border)",
                    background: "transparent",
                    borderRadius: 14,
                    overflow: "hidden",
                    padding: 0,
                    cursor: "pointer",
                    textAlign: "left",
                    WebkitTapHighlightColor: "transparent",
                    color: "var(--tt-fg)",
                  }}
                >
                  <AlbumCover tile={cover} />
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: "var(--tt-muted)" }}>
                      {a.tileIds.length} {a.tileIds.length === 1 ? "tile" : "tiles"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {creating && (
        <div
          onClick={() => setCreating(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--tt-popover-bg)",
              color: "var(--tt-fg)",
              borderRadius: "20px 20px 0 0",
              padding: "24px 24px max(24px, env(safe-area-inset-bottom, 24px))",
              width: "100%",
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--tt-muted)" }}>Album name</p>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              placeholder="Lisboa Trip"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--tt-input-border)",
                background: "var(--tt-input-bg)",
                fontSize: 16,
                outline: "none",
                boxSizing: "border-box",
                color: "var(--tt-fg)",
              }}
            />
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button
                onClick={() => { setCreating(false); setNewName(""); }}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: "1px solid var(--tt-input-border)",
                  background: "transparent",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  color: "var(--tt-fg)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: "none",
                  background: newName.trim() ? "var(--tt-chip-bg-active)" : "var(--tt-chip-bg)",
                  color: newName.trim() ? "var(--tt-chip-fg-active)" : "var(--tt-muted)",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: newName.trim() ? "pointer" : "default",
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AlbumDetail({
  albumId,
  onBack,
  onSelectTile,
}: {
  albumId: string;
  onBack: () => void;
  onSelectTile: (index: number) => void;
}) {
  const { albums, tiles } = useStore();
  const album: Album | undefined = albums.find((a) => a.id === albumId);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(album?.name ?? "");

  const albumTiles = useMemo(() => {
    if (!album) return [] as TileItem[];
    const map = new Map(tiles.map((t) => [t.id, t]));
    return album.tileIds.map((tid) => map.get(tid)).filter(Boolean) as TileItem[];
  }, [album, tiles]);

  if (!album) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "var(--tt-bg)", color: "var(--tt-fg)", padding: 32 }}>
        <p>Album not found.</p>
        <button onClick={onBack}>Back</button>
      </div>
    );
  }

  const handleRename = () => {
    const name = draftName.trim();
    if (name && name !== album.name) {
      renameAlbum(album.id, name);
      toast("Album renamed");
    }
    setRenaming(false);
  };

  const handleDelete = () => {
    if (typeof window !== "undefined" && !window.confirm(`Delete album "${album.name}"? Tiles will stay in your collection.`)) {
      return;
    }
    deleteAlbum(album.id);
    haptic([10, 40, 10]);
    toast("Album deleted");
    onBack();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--tt-bg)",
        color: "var(--tt-fg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "max(16px, env(safe-area-inset-top, 16px)) 16px 12px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            border: "none",
            background: "var(--tt-chip-bg)",
            color: "var(--tt-fg)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        {renaming ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid var(--tt-border)",
              background: "var(--tt-chip-bg)",
              color: "var(--tt-fg)",
              fontSize: 20,
              fontWeight: 600,
              outline: "none",
            }}
          />
        ) : (
          <h1
            onClick={() => { setRenaming(true); setDraftName(album.name); }}
            style={{
              margin: 0,
              fontSize: "clamp(22px, 5vw, 28px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--tt-fg)",
              flex: 1,
              cursor: "text",
            }}
          >
            {album.name}
          </h1>
        )}
        <button
          onClick={handleDelete}
          aria-label="Delete album"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            border: "none",
            background: "var(--tt-chip-bg)",
            color: "#d44",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1.5 13a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>

      <p style={{ margin: "0 16px 8px", fontSize: 12, color: "var(--tt-muted)" }}>
        {albumTiles.length} {albumTiles.length === 1 ? "tile" : "tiles"}
      </p>

      <div style={{ flex: 1, overflow: "auto" }}>
        {albumTiles.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--tt-muted)", fontSize: 14 }}>
            No tiles in this album yet. Open a tile and use Albums in the edit sheet to add it here.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            {albumTiles.map((tile, index) => {
              const globalIndex = tiles.findIndex((t) => t.id === tile.id);
              return (
                <Thumb
                  key={tile.id}
                  tile={tile}
                  onClick={() => onSelectTile(globalIndex)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Thumb({ tile, onClick }: { tile: TileItem; onClick: () => void }) {
  const url = useTileFileUrl(tile.file);
  return (
    <button
      onClick={onClick}
      style={{
        aspectRatio: "1",
        border: "none",
        padding: 0,
        cursor: "pointer",
        background: "var(--tt-tile-placeholder)",
        overflow: "hidden",
        display: "block",
        position: "relative",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={tile.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}
    </button>
  );
}
