"use client";

import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from "react";
import { getState, subscribe, getAllTags, toggleFavorite } from "@/lib/store";

function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

export default function TileGrid({
  onSelectTile,
  onTakePhoto,
  onChooseLibrary,
  onOpenWallpaper,
  onOpenMap,
}: {
  onSelectTile: (index: number) => void;
  onTakePhoto: () => void;
  onChooseLibrary: () => void;
  onOpenWallpaper: () => void;
  onOpenMap: () => void;
}) {
  const { tiles } = useStore();
  const [activeFilter, setActiveFilter] = useState("all");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [columns, setColumns] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768 ? 5 : 3);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinchStart = useRef(0);
  const colsAtPinchStart = useRef(3);

  // Build filter list dynamically: All + Favorites + all tags from tiles
  const filters = useMemo(() => {
    const tags = getAllTags();
    return [
      { id: "all", label: "All" },
      { id: "favorites", label: "♥ Favorites" },
      ...tags.map((t) => ({ id: `tag:${t}`, label: t.charAt(0).toUpperCase() + t.slice(1) })),
    ];
  }, [tiles]);

  // Filter tiles
  const filteredTiles = useMemo(() => {
    if (activeFilter === "all") return tiles;
    if (activeFilter === "favorites") return tiles.filter((t) => t.favorite);
    if (activeFilter.startsWith("tag:")) {
      const tag = activeFilter.slice(4);
      return tiles.filter((t) => t.tags.includes(tag));
    }
    return tiles;
  }, [tiles, activeFilter]);

  // Scroll to bottom on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // Pinch-to-zoom
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStart.current = Math.hypot(dx, dy);
      colsAtPinchStart.current = columns;
    }
  }, [columns]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.hypot(dx, dy);
    const ratio = dist / pinchStart.current;
    let newCols = Math.round(colsAtPinchStart.current / ratio);
    newCols = Math.max(1, Math.min(6, newCols));
    if (newCols !== columns) setColumns(newCols);
  }, [columns]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#f5f2ed",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "max(16px, env(safe-area-inset-top, 16px)) 16px 12px",
          flexShrink: 0,
          display: "flex",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(24px, 6vw, 32px)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "#1a1a1a",
          }}
        >
          Tile Tales
        </h1>
        <span
          style={{
            fontSize: 13,
            color: "#8a8578",
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}
        >
          {activeFilter === "all"
            ? `${tiles.length} ${tiles.length === 1 ? "tile" : "tiles"}`
            : `${filteredTiles.length} of ${tiles.length}`}
        </span>
      </div>

      {/* Mosaic grid */}
      <div
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        style={{
          flex: 1,
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y pinch-zoom",
        }}
      >
        {filteredTiles.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 32 }}>
            <p style={{ color: "#8a8578", fontSize: 15 }}>No tiles match this filter</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: 2,
              transition: "grid-template-columns 0.2s ease",
            }}
          >
            {filteredTiles.map((tile) => {
              // Find original index in full tiles array for navigation
              const originalIndex = tiles.findIndex((t) => t.id === tile.id);
              return (
                <button
                  key={tile.id}
                  onClick={() => onSelectTile(originalIndex)}
                  style={{
                    aspectRatio: "1",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    background: "#ece8e1",
                    overflow: "hidden",
                    display: "block",
                    position: "relative",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tile.file}
                    alt={tile.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                      transition: "transform 0.2s",
                    }}
                    onPointerEnter={(e) => {
                      (e.target as HTMLImageElement).style.transform = "scale(1.05)";
                    }}
                    onPointerLeave={(e) => {
                      (e.target as HTMLImageElement).style.transform = "scale(1)";
                    }}
                  />
                  {/* Favorite indicator */}
                  {tile.favorite && (
                    <div
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        fontSize: 22,
                        lineHeight: 1,
                        color: "#fff",
                        textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                      }}
                    >
                      ♥
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom bar: filters + wallpaper + add */}
      <div
        style={{
          flexShrink: 0,
          background: "rgba(245, 242, 237, 0.92)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          padding: "10px 12px max(10px, env(safe-area-inset-bottom, 10px))",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* Filter chips */}
        <div
          className="hide-scrollbar"
          style={{
            flex: 1,
            display: "flex",
            gap: 6,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            paddingLeft: 4,
          }}
        >
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "none",
                background: activeFilter === f.id ? "#1a1a1a" : "rgba(0,0,0,0.06)",
                color: activeFilter === f.id ? "#fff" : "#1a1a1a",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.2s",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Map button */}
        <button
          onClick={onOpenMap}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: "none",
            background: "rgba(0,0,0,0.06)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </button>

        {/* Wallpaper button */}
        <button
          onClick={onOpenWallpaper}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: "none",
            background: "rgba(0,0,0,0.06)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
        </button>

        {/* Add button */}
        <button
          onClick={() => setShowAddMenu((v) => !v)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: "none",
            background: "#1a1a1a",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            WebkitTapHighlightColor: "transparent",
            transition: "transform 0.2s",
            transform: showAddMenu ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Add menu popover */}
      {showAddMenu && (
        <>
          <div
            onClick={() => setShowAddMenu(false)}
            style={{ position: "fixed", inset: 0, zIndex: 49 }}
          />
          <div
            style={{
              position: "fixed",
              bottom: "max(70px, calc(env(safe-area-inset-bottom, 10px) + 70px))",
              right: "max(12px, env(safe-area-inset-right, 12px))",
              background: "#fff",
              borderRadius: 14,
              boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
              overflow: "hidden",
              zIndex: 50,
              minWidth: 180,
            }}
          >
            <button
              onClick={() => { setShowAddMenu(false); onTakePhoto(); }}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                padding: "14px 18px", border: "none", borderBottom: "1px solid #f0ece6",
                background: "transparent", cursor: "pointer", fontSize: 15, color: "#1a1a1a",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Take photo
            </button>
            <button
              onClick={() => { setShowAddMenu(false); onChooseLibrary(); }}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                padding: "14px 18px", border: "none", background: "transparent",
                cursor: "pointer", fontSize: 15, color: "#1a1a1a",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              Choose from library
            </button>
          </div>
        </>
      )}
    </div>
  );
}
