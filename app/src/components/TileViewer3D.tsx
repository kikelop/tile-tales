"use client";

import { Canvas } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useState, useSyncExternalStore, useRef, useEffect } from "react";
import Scene from "./viewer/TileScene";
import SelectorThumb from "./viewer/SelectorThumb";
import FlipHint from "./viewer/FlipHint";
import TileEditSheet from "./viewer/TileEditSheet";
import { getState, subscribe, toggleFavorite } from "@/lib/store";
import { haptic } from "@/lib/haptic";
import { toast } from "@/lib/toast";
import { reverseGeocode } from "@/lib/geo";
import { isIdbRef, idbRefToId, getTileBlobUrl } from "@/lib/blob-storage";
import { useTileFileUrl } from "@/lib/useTileFileUrl";


export default function TileViewer3D({
  onReady,
  initialIndex = 0,
  onBack,
}: {
  onReady?: () => void;
  initialIndex?: number;
  onBack: () => void;
}) {
  const { tiles, albums } = useSyncExternalStore(subscribe, getState, getState);

  // Preload tile textures into Drei's cache, but only the ones we haven't
  // seen before — otherwise toggleFavorite / updateTile would re-trigger
  // every preload on every store change.
  const preloadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    tiles.forEach((t) => {
      if (preloadedRef.current.has(t.id)) return;
      preloadedRef.current.add(t.id);
      if (isIdbRef(t.file)) {
        void getTileBlobUrl(idbRefToId(t.file)).then((url) => {
          if (url) useTexture.preload(url);
        });
      } else {
        useTexture.preload(t.file);
      }
    });
  }, [tiles]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [editing, setEditing] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const [flipHintVisible, setFlipHintVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem("tile-tales-flip-hint-seen") === "1") return;
    } catch {}
    const t1 = setTimeout(() => setFlipHintVisible(true), 1800);
    const t2 = setTimeout(() => {
      setFlipHintVisible(false);
      try { localStorage.setItem("tile-tales-flip-hint-seen", "1"); } catch {}
    }, 1800 + 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Clamp activeIndex if tiles change
  const safeIndex = Math.min(activeIndex, Math.max(0, tiles.length - 1));
  useEffect(() => { setActiveIndex(safeIndex); }, [safeIndex]);

  // Keep the active thumbnail scrolled into view in the selector strip.
  useEffect(() => {
    const el = selectorRef.current?.children[safeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [safeIndex]);

  const activeTileFile = tiles[safeIndex]?.file;
  const activeTileUrl = useTileFileUrl(activeTileFile);
  const canvasBg = "#f5f2ed";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--tt-bg)",
        color: "var(--tt-fg)",
        touchAction: "none",
      }}
    >
      {/* Canvas */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {tiles.length > 0 && activeTileUrl ? (
          <Canvas
            camera={{ position: [0, 0.3, 6], fov: 35 }}
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.2,
            }}
            dpr={[1, 2]}
          >
            <color attach="background" args={[canvasBg]} />
            <Scene
              textureUrl={activeTileUrl}
              memory={tiles[safeIndex].memory}
              date={tiles[safeIndex].date}
              onReady={onReady}
            />
          </Canvas>
        ) : tiles.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <p style={{ color: "#8a8578", fontSize: 16 }}>No tiles yet</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <p style={{ color: "#8a8578", fontSize: 14 }}>Loading tile…</p>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={onBack}
          style={{
            position: "absolute",
            top: "max(16px, env(safe-area-inset-top, 16px))",
            left: "max(16px, env(safe-area-inset-left, 16px))",
            width: 44,
            height: 44,
            borderRadius: 22,
            border: "none",
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>

        {/* Title */}
        {tiles.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "max(16px, env(safe-area-inset-top, 16px))",
              left: 72,
              pointerEvents: "none",
            }}
          >
            <h1
              style={{
                fontSize: "clamp(20px, 5vw, 26px)",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: 0,
                lineHeight: "44px",
              }}
            >
              {tiles[safeIndex].name}
            </h1>
          </div>
        )}

        {/* Favorite + Share + Edit buttons */}
        {tiles.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "max(16px, env(safe-area-inset-top, 16px))",
              right: "max(16px, env(safe-area-inset-right, 16px))",
              display: "flex",
              gap: 8,
            }}
          >
            {/* Favorite button */}
            <button
              onClick={() => {
                const tile = tiles[safeIndex];
                if (!tile) return;
                toggleFavorite(tile.id);
                haptic(10);
                toast(tile.favorite ? "Removed from favorites" : "Added to favorites");
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                border: "none",
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(8px)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                WebkitTapHighlightColor: "transparent",
                fontSize: 20,
                lineHeight: 1,
                transition: "transform 0.2s",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24"
                fill={tiles[safeIndex].favorite ? "#e0245e" : "none"}
                stroke={tiles[safeIndex].favorite ? "#e0245e" : "#1a1a1a"}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>

            {/* Share button */}
            <button
              onClick={async () => {
                const tile = tiles[safeIndex];
                if (!tile) return;
                try {
                  // Resolve idb:* refs to a real URL before drawing.
                  const imgSrc = isIdbRef(tile.file)
                    ? await getTileBlobUrl(idbRefToId(tile.file))
                    : tile.file;
                  if (!imgSrc) {
                    toast("Couldn't load image");
                    return;
                  }
                  // Create a share card with tile image + name + location
                  const canvas = document.createElement("canvas");
                  canvas.width = 1080;
                  canvas.height = 1080;
                  const ctx = canvas.getContext("2d")!;

                  // Load tile image
                  const img = new Image();
                  img.crossOrigin = "anonymous";
                  await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = reject;
                    img.src = imgSrc;
                  });

                  // Fill background
                  ctx.fillStyle = "#f5f2ed";
                  ctx.fillRect(0, 0, 1080, 1080);

                  // Draw tile image centered with padding
                  const pad = 60;
                  const imgSize = 1080 - pad * 2;
                  ctx.save();
                  ctx.beginPath();
                  ctx.roundRect(pad, pad, imgSize, imgSize, 24);
                  ctx.clip();
                  ctx.drawImage(img, pad, pad, imgSize, imgSize);
                  ctx.restore();

                  // Overlay gradient at bottom for text
                  const grad = ctx.createLinearGradient(0, 780, 0, 1080);
                  grad.addColorStop(0, "rgba(0,0,0,0)");
                  grad.addColorStop(1, "rgba(0,0,0,0.6)");
                  ctx.fillStyle = grad;
                  ctx.beginPath();
                  ctx.roundRect(pad, pad, imgSize, imgSize, 24);
                  ctx.fill();

                  // Tile name
                  ctx.fillStyle = "#ffffff";
                  ctx.font = "bold 42px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
                  ctx.textAlign = "left";
                  ctx.textBaseline = "bottom";
                  ctx.fillText(tile.name, pad + 28, 1080 - pad - 24);

                  // Location or date subtitle. Try the reverse-geocoded label
                  // first; fall back to coords if the lookup never resolved.
                  let locationLabel: string | null = null;
                  if (tile.lat != null && tile.lng != null) {
                    locationLabel = await reverseGeocode(tile.lat, tile.lng);
                  }
                  const subtitle =
                    tile.date ||
                    locationLabel ||
                    (tile.lat != null && tile.lng != null
                      ? `${tile.lat.toFixed(2)}, ${tile.lng.toFixed(2)}`
                      : "");
                  if (subtitle) {
                    ctx.fillStyle = "rgba(255,255,255,0.75)";
                    ctx.font = "28px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
                    ctx.fillText(subtitle, pad + 28, 1080 - pad - 72);
                  }

                  // Watermark
                  ctx.fillStyle = "rgba(255,255,255,0.5)";
                  ctx.font = "22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
                  ctx.textAlign = "right";
                  ctx.fillText("Tile Tales", 1080 - pad - 20, pad + 40);

                  const blob = await new Promise<Blob>((resolve) =>
                    canvas.toBlob((b) => resolve(b!), "image/png")
                  );
                  const file = new File([blob], `${tile.name.replace(/\s+/g, "-").toLowerCase()}.png`, { type: "image/png" });

                  if (navigator.share && navigator.canShare?.({ files: [file] })) {
                    await navigator.share({
                      title: tile.name,
                      text: tile.memory || `Check out this tile: ${tile.name}`,
                      files: [file],
                    });
                    haptic(15);
                    toast("Shared");
                  } else {
                    // Desktop fallback: download
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = file.name;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast("Downloaded");
                  }
                } catch {
                  // User cancelled share or error — silently ignore
                }
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                border: "none",
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(8px)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>

            {/* Edit button */}
            <button
              onClick={() => setEditing(true)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                border: "none",
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(8px)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
          </div>
        )}

        {/* First-visit hint: flip to see memory */}
        {tiles.length > 0 && <FlipHint visible={flipHintVisible} />}
      </div>

      {/* Tile selector — horizontally scrollable */}
      <div
        ref={selectorRef}
        className="hide-scrollbar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "clamp(6px, 1.5vw, 10px)",
          padding: "10px 16px max(10px, env(safe-area-inset-bottom, 10px))",
          flexShrink: 0,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          touchAction: "pan-x",
        }}
      >
        {tiles.map((tile, i) => (
          <SelectorThumb
            key={tile.id}
            tile={tile}
            active={i === safeIndex}
            onClick={() => setActiveIndex(i)}
          />
        ))}
      </div>

      {editing && tiles[safeIndex] && (
        <TileEditSheet
          tile={tiles[safeIndex]}
          albums={albums}
          isLastTile={tiles.length <= 1}
          onClose={() => setEditing(false)}
          onDeleteLast={onBack}
        />
      )}

    </div>
  );
}
