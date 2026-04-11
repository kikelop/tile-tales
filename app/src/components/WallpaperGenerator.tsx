"use client";

import { useState, useRef, useCallback, useEffect, useSyncExternalStore } from "react";
import { getState, subscribe, type TileItem } from "@/lib/store";

type PatternMode = "grid" | "mirror" | "diagonal";

const PATTERN_LABELS: Record<PatternMode, string> = {
  grid: "Grid",
  mirror: "Mirror",
  diagonal: "Diagonal",
};

function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  width: number,
  height: number,
  tileSize: number,
  mode: PatternMode
) {
  ctx.clearRect(0, 0, width, height);

  const cols = Math.ceil(width / tileSize);
  const rows = Math.ceil(height / tileSize);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const imgIndex = (row + col) % images.length;
      const img = images[imgIndex];
      const x = col * tileSize;
      const y = row * tileSize;

      ctx.save();

      if (mode === "mirror") {
        const flipH = col % 2 === 1;
        const flipV = row % 2 === 1;
        ctx.translate(
          flipH ? x + tileSize : x,
          flipV ? y + tileSize : y
        );
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
        ctx.drawImage(img, 0, 0, tileSize, tileSize);
      } else if (mode === "diagonal") {
        // Offset every other row by half a tile
        const offsetX = row % 2 === 1 ? tileSize / 2 : 0;
        ctx.drawImage(img, x + offsetX, y, tileSize, tileSize);
        // Fill gap on left edge for odd rows
        if (row % 2 === 1 && col === 0) {
          const gapImg = images[(row + cols - 1) % images.length];
          ctx.drawImage(gapImg, -tileSize / 2, y, tileSize, tileSize);
        }
      } else {
        // grid
        ctx.drawImage(img, x, y, tileSize, tileSize);
      }

      ctx.restore();
    }
  }
}

export default function WallpaperGenerator({ onBack }: { onBack: () => void }) {
  const { tiles } = useStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<PatternMode>("grid");
  const [tileSize, setTileSize] = useState(120);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedImages, setLoadedImages] = useState<HTMLImageElement[]>([]);

  const toggleTile = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }, []);

  // Load selected tile images
  useEffect(() => {
    if (selectedIds.length === 0) {
      setLoadedImages([]);
      return;
    }

    const selected = selectedIds
      .map((id) => tiles.find((t) => t.id === id))
      .filter(Boolean) as TileItem[];

    let cancelled = false;
    const loaded: HTMLImageElement[] = [];

    Promise.all(
      selected.map(
        (tile) =>
          new Promise<HTMLImageElement>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img);
            img.src = tile.file;
          })
      )
    ).then((imgs) => {
      if (!cancelled) setLoadedImages(imgs);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedIds, tiles]);

  // Draw preview
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || loadedImages.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Preview at screen-appropriate size
    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    ctx.scale(dpr, dpr);

    drawPattern(ctx, loadedImages, displayW, displayH, tileSize, mode);
  }, [loadedImages, mode, tileSize]);

  const handleExport = useCallback(
    (w: number, h: number, label: string) => {
      if (loadedImages.length === 0) return;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;

      drawPattern(ctx, loadedImages, w, h, tileSize * 2, mode);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tile-tales-wallpaper-${label}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    },
    [loadedImages, mode, tileSize]
  );

  const hasSelection = selectedIds.length > 0;

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
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
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
            WebkitTapHighlightColor: "transparent",
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#1a1a1a",
          }}
        >
          Wallpaper
        </h1>
      </div>

      {/* Preview area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          margin: "0 16px",
          borderRadius: 16,
          overflow: "hidden",
          background: hasSelection ? "transparent" : "#ece8e1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {hasSelection ? (
          <canvas
            ref={previewCanvasRef}
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        ) : (
          <p style={{ color: "#8a8578", fontSize: 15 }}>
            Select up to 4 tiles below
          </p>
        )}
      </div>

      {/* Controls: pattern mode + tile size */}
      {hasSelection && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "12px 16px 0",
            flexShrink: 0,
          }}
        >
          {(Object.keys(PATTERN_LABELS) as PatternMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                border: "none",
                background: mode === m ? "#1a1a1a" : "rgba(0,0,0,0.06)",
                color: mode === m ? "#fff" : "#1a1a1a",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                transition: "all 0.2s",
              }}
            >
              {PATTERN_LABELS[m]}
            </button>
          ))}

          {/* Size slider */}
          <input
            type="range"
            min={60}
            max={240}
            value={tileSize}
            onChange={(e) => setTileSize(Number(e.target.value))}
            style={{ width: 80, accentColor: "#1a1a1a" }}
          />
        </div>
      )}

      {/* Export buttons */}
      {hasSelection && (
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 16px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => handleExport(1080, 1920, "mobile")}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: "none",
              background: "#1a1a1a",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Mobile (1080×1920)
          </button>
          <button
            onClick={() => handleExport(2560, 1440, "desktop")}
            style={{
              flex: 1,
              padding: "12px 0",
              borderRadius: 12,
              border: "1px solid #d0c9be",
              background: "transparent",
              color: "#1a1a1a",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Desktop (2560×1440)
          </button>
        </div>
      )}

      {/* Tile selector */}
      <div
        className="hide-scrollbar"
        style={{
          display: "flex",
          gap: 8,
          padding: "8px 16px max(12px, env(safe-area-inset-bottom, 12px))",
          flexShrink: 0,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {tiles.map((tile) => {
          const isSelected = selectedIds.includes(tile.id);
          const selIndex = selectedIds.indexOf(tile.id);

          return (
            <button
              key={tile.id}
              onClick={() => toggleTile(tile.id)}
              style={{
                width: 64,
                height: 64,
                minWidth: 64,
                borderRadius: 10,
                overflow: "hidden",
                border: "none",
                padding: 0,
                cursor: selectedIds.length >= 4 && !isSelected ? "not-allowed" : "pointer",
                outline: isSelected ? "2.5px solid #1a1a1a" : "2px solid transparent",
                outlineOffset: 2,
                opacity: selectedIds.length >= 4 && !isSelected ? 0.35 : isSelected ? 1 : 0.65,
                transition: "all 0.2s",
                background: "#ece8e1",
                flexShrink: 0,
                position: "relative",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tile.file}
                alt={tile.name}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              {isSelected && (
                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    background: "#1a1a1a",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selIndex + 1}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
