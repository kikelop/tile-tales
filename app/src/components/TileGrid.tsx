"use client";

import Wordmark from "./Wordmark";
import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from "react";
import { getState, subscribe, getAllTags, type TileItem } from "@/lib/store";
import { useTileFileUrl } from "@/lib/useTileFileUrl";
import { haptic } from "@/lib/haptic";

const ONBOARDING_DISMISSED_KEY = "tile-tales-onboarding-dismissed";

type SortMode = "recent" | "az" | "favorites";
const SORT_STORAGE_KEY = "tile-tales-sort";

function loadSortPref(): SortMode {
  if (typeof window === "undefined") return "recent";
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (raw === "recent" || raw === "az" || raw === "favorites") return raw;
  } catch {}
  return "recent";
}

type GridSize = "L" | "M" | "S";
const GRID_SIZE_KEY = "tile-tales-grid-size";
const SIZE_TO_COLS: Record<GridSize, number> = { L: 2, M: 3, S: 5 };
const SIZE_LABEL: Record<GridSize, string> = { L: "Large", M: "Medium", S: "Small" };
function loadGridSize(): GridSize {
  if (typeof window === "undefined") return "M";
  try {
    const raw = localStorage.getItem(GRID_SIZE_KEY);
    if (raw === "L" || raw === "M" || raw === "S") return raw;
  } catch {}
  return "M";
}

function TileThumb({ tile, onClick }: { tile: TileItem; onClick: () => void }) {
  const url = useTileFileUrl(tile.file);
  return (
    <button
      onClick={onClick}
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
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
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
      ) : (
        <div style={{ width: "100%", height: "100%", background: "#ece8e1" }} />
      )}
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
}

function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

export default function TileGrid({
  onSelectTile,
  onTakePhoto,
  onChooseLibrary,
  onOpenWallpaper,
  onOpenMap,
  onOpenAlbums,
  onOpenProfile,
}: {
  onSelectTile: (index: number) => void;
  onTakePhoto: () => void;
  onChooseLibrary: () => void;
  onOpenWallpaper: () => void;
  onOpenMap: () => void;
  onOpenAlbums: () => void;
  onOpenProfile: () => void;
}) {
  const { tiles } = useStore();
  const [activeFilter, setActiveFilter] = useState("all");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [gridSize, setGridSizeState] = useState<GridSize>(() => loadGridSize());
  const [columns, setColumns] = useState(() => SIZE_TO_COLS[loadGridSize()]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [sortMode, setSortModeState] = useState<SortMode>(() => loadSortPref());
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1"; } catch { return false; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinchStart = useRef(0);
  const colsAtPinchStart = useRef(3);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const setSortMode = useCallback((mode: SortMode) => {
    setSortModeState(mode);
    try { localStorage.setItem(SORT_STORAGE_KEY, mode); } catch {}
  }, []);

  const setGridSize = useCallback((size: GridSize) => {
    setGridSizeState(size);
    setColumns(SIZE_TO_COLS[size]);
    try { localStorage.setItem(GRID_SIZE_KEY, size); } catch {}
  }, []);

  const filters = useMemo(() => {
    const tags = getAllTags();
    return [
      { id: "all", label: "All" },
      { id: "favorites", label: "♥ Favorites" },
      ...tags.map((t) => ({ id: `tag:${t}`, label: t.charAt(0).toUpperCase() + t.slice(1) })),
    ];
  }, [tiles]); // eslint-disable-line react-hooks/exhaustive-deps -- getAllTags() reads store tiles

  const visibleTiles = useMemo(() => {
    // 1. Apply filter
    let list: TileItem[];
    if (activeFilter === "all") list = tiles;
    else if (activeFilter === "favorites") list = tiles.filter((t) => t.favorite);
    else if (activeFilter.startsWith("tag:")) {
      const tag = activeFilter.slice(4);
      list = tiles.filter((t) => t.tags.includes(tag));
    } else {
      list = tiles;
    }
    // 2. Apply search
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      list = list.filter((t) => {
        if (t.name.toLowerCase().includes(q)) return true;
        return t.tags.some((tag) => tag.toLowerCase().includes(q));
      });
    }
    // 3. Apply sort
    if (sortMode === "az") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortMode === "favorites") {
      list = [...list].sort((a, b) => {
        if (a.favorite === b.favorite) return 0;
        return a.favorite ? -1 : 1;
      });
    }
    // "recent": tiles are appended via addTile, so the current array order is
    // already chronological (mocks first, then user captures). We just want
    // newest on top instead of bottom.
    else if (sortMode === "recent") {
      list = [...list].reverse();
    }
    return list;
  }, [tiles, activeFilter, searchQuery, sortMode]);

  // Scroll to top whenever the visible list changes due to sort/filter/search.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [sortMode, activeFilter, searchQuery]);

  // Focus the search input as soon as it appears.
  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

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

  const counterText =
    activeFilter === "all" && !searchQuery
      ? `${tiles.length} ${tiles.length === 1 ? "tile" : "tiles"}`
      : `${visibleTiles.length} of ${tiles.length}`;

  const sortLabel: Record<SortMode, string> = {
    recent: "Recent first",
    az: "A–Z",
    favorites: "Favorites first",
  };

  const showOnboarding = tiles.length === 0 && !onboardingDismissed;
  const dismissOnboarding = useCallback(() => {
    setOnboardingDismissed(true);
    try { localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1"); } catch {}
  }, []);

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
      {/* Header */}
      <div
        style={{
          padding: "max(16px, env(safe-area-inset-top, 16px)) 16px 12px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          minHeight: 56,
        }}
      >
        {searchOpen ? (
          <>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or tag"
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid #e0d8cc",
                background: "#faf8f5",
                fontSize: 16,
                outline: "none",
                color: "#1a1a1a",
                letterSpacing: "-0.01em",
              }}
            />
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery(""); haptic(6); }}
              style={{
                padding: "6px 12px",
                borderRadius: 16,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                color: "#1a1a1a",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <h1 style={{ margin: 0, color: "var(--tt-fg)" }}>
              <Wordmark height={20} style={{ display: "block" }} />
            </h1>
            <span style={{ flex: 1, fontSize: 13, color: "var(--tt-muted)", fontWeight: 500, letterSpacing: "-0.01em" }}>
              {counterText}
            </span>
            <button
              aria-label="Profile"
              onClick={() => { onOpenProfile(); haptic(6); }}
              style={{
                width: 36, height: 36, borderRadius: 18, border: "none",
                background: "var(--tt-chip-bg)", color: "var(--tt-fg)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                WebkitTapHighlightColor: "transparent", flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </button>
            <button
              aria-label="Search"
              onClick={() => { setSearchOpen(true); haptic(6); }}
              style={{
                width: 36, height: 36, borderRadius: 18, border: "none",
                background: "var(--tt-chip-bg)", color: "var(--tt-fg)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                WebkitTapHighlightColor: "transparent", flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </button>
            <button
              aria-label="View options"
              onClick={() => { setShowViewMenu((v) => !v); haptic(6); }}
              style={{
                width: 36, height: 36, borderRadius: 18, border: "none",
                background: showViewMenu ? "var(--tt-chip-bg-active)" : "var(--tt-chip-bg)",
                color: showViewMenu ? "var(--tt-chip-fg-active)" : "var(--tt-fg)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                WebkitTapHighlightColor: "transparent", flexShrink: 0,
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2" fill="var(--tt-chip-bg)" />
                <line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2" fill="var(--tt-chip-bg)" />
                <line x1="4" y1="18" x2="20" y2="18" /><circle cx="8" cy="18" r="2" fill="var(--tt-chip-bg)" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* View menu popover: filter + sort + grid size */}
      {showViewMenu && (
        <>
          <div
            onClick={() => setShowViewMenu(false)}
            style={{ position: "fixed", inset: 0, zIndex: 49 }}
          />
          <div
            style={{
              position: "fixed",
              top: "max(64px, env(safe-area-inset-top, 16px) + 56px)",
              right: 16,
              background: "var(--tt-popover-bg)",
              color: "var(--tt-fg)",
              borderRadius: 14,
              boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
              overflow: "hidden auto",
              maxHeight: "min(70vh, 520px)",
              zIndex: 50,
              minWidth: 230,
              paddingBottom: 8,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--tt-muted)", padding: "12px 16px 4px" }}>Filter</div>
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => { setActiveFilter(f.id); haptic(6); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "10px 16px", border: "none", background: "transparent",
                  cursor: "pointer", fontSize: 14, color: "var(--tt-fg)",
                  WebkitTapHighlightColor: "transparent", fontWeight: activeFilter === f.id ? 600 : 400,
                  textAlign: "left",
                }}
              >
                <span>{f.label}</span>
                {activeFilter === f.id && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>
            ))}

            <div style={{ borderTop: "1px solid var(--tt-popover-divider)", margin: "6px 0" }} />
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--tt-muted)", padding: "6px 16px 4px" }}>Sort</div>
            {(["recent", "az", "favorites"] as SortMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => { setSortMode(mode); haptic(6); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "10px 16px", border: "none", background: "transparent",
                  cursor: "pointer", fontSize: 14, color: "var(--tt-fg)",
                  WebkitTapHighlightColor: "transparent", fontWeight: sortMode === mode ? 600 : 400,
                  textAlign: "left",
                }}
              >
                <span>{sortLabel[mode]}</span>
                {sortMode === mode && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                )}
              </button>
            ))}

            <div style={{ borderTop: "1px solid var(--tt-popover-divider)", margin: "6px 0" }} />
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--tt-muted)", padding: "6px 16px 8px" }}>Grid size</div>
            <div style={{ display: "flex", gap: 8, padding: "0 16px 6px" }}>
              {(["L", "M", "S"] as GridSize[]).map((sz) => (
                <button
                  key={sz}
                  onClick={() => { setGridSize(sz); haptic(6); }}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer",
                    background: gridSize === sz ? "var(--tt-chip-bg-active)" : "var(--tt-chip-bg)",
                    color: gridSize === sz ? "var(--tt-chip-fg-active)" : "var(--tt-fg)",
                    fontSize: 13, fontWeight: 600, WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {SIZE_LABEL[sz]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

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
        {showOnboarding && (
          <div
            style={{
              margin: "12px 16px 8px",
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(26,26,26,0.04)",
              border: "1px solid rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: "var(--tt-accent)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div style={{ flex: 1, fontSize: 13, color: "#1a1a1a", lineHeight: 1.4 }}>
              <strong style={{ fontWeight: 600 }}>Start your collection.</strong>{" "}
              <span style={{ color: "#6a6356" }}>Tap + below to capture your first street tile.</span>
            </div>
            <button
              onClick={dismissOnboarding}
              aria-label="Dismiss"
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#8a8578",
                flexShrink: 0,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        {visibleTiles.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 32 }}>
            <p style={{ color: "#8a8578", fontSize: 15, textAlign: "center" }}>
              {searchQuery
                ? `No tiles match "${searchQuery}"`
                : "No tiles match this filter"}
            </p>
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
            {visibleTiles.map((tile) => {
              const originalIndex = tiles.findIndex((t) => t.id === tile.id);
              return (
                <TileThumb
                  key={tile.id}
                  tile={tile}
                  onClick={() => onSelectTile(originalIndex)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom nav bar */}
      <div
        style={{
          flexShrink: 0,
          background: "var(--tt-bottombar-bg)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid var(--tt-border)",
          padding: "10px 12px max(10px, env(safe-area-inset-bottom, 10px))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
        }}
      >
        <button
          onClick={onOpenAlbums}
          aria-label="Albums"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: "none",
            background: "var(--tt-chip-bg)",
            color: "var(--tt-fg)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h7l2 3h7a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
          </svg>
        </button>

        <button
          onClick={onOpenMap}
          aria-label="Map"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: "none",
            background: "var(--tt-chip-bg)",
            color: "var(--tt-fg)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </button>

        <button
          onClick={onOpenWallpaper}
          aria-label="Wallpaper"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: "none",
            background: "var(--tt-chip-bg)",
            color: "var(--tt-fg)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
        </button>

      </div>

      {/* Floating add button — above the nav bar */}
      <button
        onClick={() => setShowAddMenu((v) => !v)}
        aria-label="Add tile"
        style={{
          position: "fixed",
          bottom: "max(80px, calc(env(safe-area-inset-bottom, 10px) + 80px))",
          right: "max(16px, env(safe-area-inset-right, 16px))",
          width: 56,
          height: 56,
          borderRadius: 28,
          border: "none",
          background: "var(--tt-accent)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          WebkitTapHighlightColor: "transparent",
          zIndex: 48,
          transition: "transform 0.2s",
          transform: showAddMenu ? "rotate(45deg)" : "rotate(0deg)",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

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
              bottom: "max(146px, calc(env(safe-area-inset-bottom, 10px) + 146px))",
              right: "max(16px, env(safe-area-inset-right, 16px))",
              background: "var(--tt-popover-bg)",
              color: "var(--tt-fg)",
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
                padding: "14px 18px", border: "none", borderBottom: "1px solid var(--tt-popover-divider)",
                background: "transparent", cursor: "pointer", fontSize: 15, color: "var(--tt-fg)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
                cursor: "pointer", fontSize: 15, color: "var(--tt-fg)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
