"use client";

import { useState, useRef, useCallback, useEffect, useSyncExternalStore } from "react";
import { getState, subscribe, addWallpaper, type TileItem } from "@/lib/store";
import { isIdbRef, idbRefToId, getTileBlobUrl } from "@/lib/blob-storage";
import { useTileFileUrl } from "@/lib/useTileFileUrl";
import { haptic } from "@/lib/haptic";

interface DuotonePreset {
  id: string;
  label: string;
  dark: string;
  light: string;
}

const DUOTONE_PRESETS: DuotonePreset[] = [
  { id: "ocean", label: "Ocean", dark: "#1a4d6b", light: "#d5e7ed" },
  { id: "sunset", label: "Sunset", dark: "#7a2e44", light: "#f7d8a4" },
  { id: "forest", label: "Forest", dark: "#2d4a2e", light: "#d8e0c0" },
  { id: "vintage", label: "Vintage", dark: "#5c3a21", light: "#e8d8b8" },
  { id: "noir", label: "Noir", dark: "#1a1a1a", light: "#e0e0e0" },
];

function WallpaperTileThumb({
  tile,
  isSelected,
  selIndex,
  disabled,
  onClick,
}: {
  tile: TileItem;
  isSelected: boolean;
  selIndex: number;
  disabled: boolean;
  onClick: () => void;
}) {
  const url = useTileFileUrl(tile.file);
  return (
    <button
      onClick={onClick}
      style={{
        width: 64,
        height: 64,
        minWidth: 64,
        borderRadius: 10,
        overflow: "hidden",
        border: "none",
        padding: 0,
        cursor: disabled && !isSelected ? "not-allowed" : "pointer",
        outline: isSelected ? "2.5px solid #1a1a1a" : "2px solid transparent",
        outlineOffset: 2,
        opacity: disabled && !isSelected ? 0.35 : isSelected ? 1 : 0.65,
        transition: "all 0.2s",
        background: "#ece8e1",
        flexShrink: 0,
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
}

type PatternMode = "grid" | "mirror" | "brick" | "diamond" | "pinwheel";

const PATTERN_LABELS: Record<PatternMode, string> = {
  grid: "Grid",
  mirror: "Mirror",
  diamond: "Diamond",
  pinwheel: "Pinwheel",
  brick: "Brick",
};

function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  width: number,
  height: number,
  rawTileSize: number,
  mode: PatternMode
) {
  ctx.clearRect(0, 0, width, height);

  // Snap tile size so columns fit exactly — no tiles get cut off
  const cols = Math.max(1, Math.round(width / rawTileSize));
  const tileSize = width / cols;
  const rows = Math.ceil(height / tileSize) + 1;
  const n = images.length;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * tileSize;
      const y = row * tileSize;

      ctx.save();

      switch (mode) {
        case "mirror": {
          const imgIndex = (row + col) % n;
          const flipH = col % 2 === 1;
          const flipV = row % 2 === 1;
          ctx.translate(flipH ? x + tileSize : x, flipV ? y + tileSize : y);
          ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
          ctx.drawImage(images[imgIndex], 0, 0, tileSize, tileSize);
          break;
        }

        case "brick": {
          // Half-tile offset on odd rows, like a brick wall
          const offsetX = row % 2 === 1 ? tileSize / 2 : 0;
          const imgIndex = (row * cols + col) % n;
          ctx.drawImage(images[imgIndex], x + offsetX, y, tileSize, tileSize);
          // Fill left gap on odd rows
          if (row % 2 === 1 && col === cols - 1) {
            ctx.drawImage(images[(row * cols) % n], -tileSize / 2, y, tileSize, tileSize);
            ctx.drawImage(images[(row * cols + col + 1) % n], x + offsetX + tileSize, y, tileSize, tileSize);
          }
          break;
        }

        case "diamond":
          // Handled separately below (two-pass rendering)
          break;

        case "pinwheel": {
          // 2x2 block: each cell gets a different tile, rotated 0°/90°/180°/270°
          const quadRow = row % 2;
          const quadCol = col % 2;
          const quadIndex = quadRow * 2 + quadCol; // 0,1,2,3
          const blockRow = Math.floor(row / 2);
          const blockCol = Math.floor(col / 2);
          // Cycle through images per block position
          const imgIndex = (quadIndex + (blockRow + blockCol) * n) % n;
          const rotation = quadIndex * (Math.PI / 2);
          const cx = x + tileSize / 2;
          const cy = y + tileSize / 2;
          ctx.translate(cx, cy);
          ctx.rotate(rotation);
          ctx.drawImage(images[imgIndex], -tileSize / 2, -tileSize / 2, tileSize, tileSize);
          break;
        }


        default: {
          // grid
          const imgIndex = (row + col) % n;
          ctx.drawImage(images[imgIndex], x, y, tileSize, tileSize);
          break;
        }
      }

      ctx.restore();
    }
  }

  // Diamond: two-pass — fill gaps first, then main tiles on top
  if (mode === "diamond") {
    const s = tileSize / Math.SQRT2;

    // Pass 1: gap-filler diamonds at every cell corner intersection
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= cols; col++) {
        const gapIndex = (row + col + 1) % n;
        ctx.save();
        ctx.translate(col * tileSize, row * tileSize);
        ctx.rotate(Math.PI / 4);
        ctx.drawImage(images[gapIndex], -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }

    // Pass 2: main diamonds centered in each cell
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const imgIndex = (row + col) % n;
        ctx.save();
        ctx.translate(col * tileSize + tileSize / 2, row * tileSize + tileSize / 2);
        ctx.rotate(Math.PI / 4);
        ctx.drawImage(images[imgIndex], -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function applyDuotone(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  darkColor: string,
  lightColor: string
) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const dark = hexToRgb(darkColor);
  const light = hexToRgb(lightColor);

  for (let i = 0; i < data.length; i += 4) {
    // Luminance
    let lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
    // Push toward extremes — high contrast S-curve
    lum = lum < 0.5
      ? 2 * lum * lum
      : 1 - 2 * (1 - lum) * (1 - lum);
    // Apply again for even more punch
    lum = lum < 0.5
      ? 2 * lum * lum
      : 1 - 2 * (1 - lum) * (1 - lum);
    // Lerp between dark and light
    data[i]     = dark[0] + (light[0] - dark[0]) * lum;
    data[i + 1] = dark[1] + (light[1] - dark[1]) * lum;
    data[i + 2] = dark[2] + (light[2] - dark[2]) * lum;
  }

  ctx.putImageData(imageData, 0, 0);
}

function getExportSize(): { w: number; h: number } {
  if (typeof window === "undefined") return { w: 1080, h: 1920 };
  const isMobile = window.innerWidth < 768;
  return isMobile ? { w: 1080, h: 1920 } : { w: 2560, h: 1440 };
}

type View = "editor" | "preview" | "saved";

export default function WallpaperGenerator({ onBack }: { onBack: () => void }) {
  const { tiles, wallpapers } = useStore();
  const [view, setView] = useState<View>("editor");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<PatternMode>("grid");
  const [tileSize, setTileSize] = useState(120);
  const [duotone, setDuotone] = useState(false);
  const [duoDark, setDuoDark] = useState("#4a6fa5");
  const [duoLight, setDuoLight] = useState("#e8dcc8");
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [loadedImages, setLoadedImages] = useState<HTMLImageElement[]>([]);
  const [generatedDataUrl, setGeneratedDataUrl] = useState<string | null>(null);

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

    void Promise.all(
      selected.map(async (tile) => {
        const src = isIdbRef(tile.file)
          ? await getTileBlobUrl(idbRefToId(tile.file))
          : tile.file;
        return new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => resolve(img);
          if (src) img.src = src;
        });
      })
    ).then((imgs) => {
      if (!cancelled) setLoadedImages(imgs);
    });

    return () => { cancelled = true; };
  }, [selectedIds, tiles]);

  // Draw live preview in editor
  useEffect(() => {
    if (view !== "editor") return;
    const canvas = previewCanvasRef.current;
    if (!canvas || loadedImages.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth;
    const displayH = canvas.clientHeight;
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    ctx.scale(dpr, dpr);

    drawPattern(ctx, loadedImages, displayW, displayH, tileSize, mode);
    if (duotone) applyDuotone(ctx, displayW * dpr, displayH * dpr, duoDark, duoLight);
  }, [loadedImages, mode, tileSize, view, duotone, duoDark, duoLight]);

  const handleCreate = useCallback(() => {
    if (loadedImages.length === 0) return;

    const { w, h } = getExportSize();
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;

    // Scale tile size proportionally for export
    const scaleFactor = Math.max(w, h) / Math.max(window.innerWidth, window.innerHeight);
    drawPattern(ctx, loadedImages, w, h, tileSize * scaleFactor, mode);
    if (duotone) applyDuotone(ctx, w, h, duoDark, duoLight);

    const dataUrl = canvas.toDataURL("image/png");
    setGeneratedDataUrl(dataUrl);
    setView("preview");
  }, [loadedImages, mode, tileSize, duotone, duoDark, duoLight]);

  const handleSave = useCallback(() => {
    if (!generatedDataUrl) return;
    addWallpaper(generatedDataUrl);
    setView("saved");
  }, [generatedDataUrl]);

  const handleDownload = useCallback(() => {
    if (!generatedDataUrl) return;
    const a = document.createElement("a");
    a.href = generatedDataUrl;
    a.download = `tile-tales-wallpaper-${Date.now()}.png`;
    a.click();
  }, [generatedDataUrl]);

  const hasSelection = selectedIds.length > 0;

  // --- PREVIEW VIEW ---
  if (view === "preview" && generatedDataUrl) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Preview image */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={generatedDataUrl}
            alt="Wallpaper preview"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "16px 16px max(16px, env(safe-area-inset-bottom, 16px))",
            background: "rgba(0,0,0,0.8)",
          }}
        >
          <button
            onClick={() => setView("editor")}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Back
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 12,
              border: "none",
              background: "#fff",
              color: "#1a1a1a",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save
          </button>
          <button
            onClick={handleDownload}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 12,
              border: "none",
              background: "#fff",
              color: "#1a1a1a",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Download
          </button>
        </div>
      </div>
    );
  }

  // --- SAVED VIEW ---
  if (view === "saved") {
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
            onClick={() => setView("editor")}
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
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "#1a1a1a" }}>
            My Wallpapers
          </h1>
        </div>

        {/* Grid of saved wallpapers */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "0 0 max(16px, env(safe-area-inset-bottom, 16px))",
          }}
        >
          {wallpapers.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 32 }}>
              <p style={{ color: "#8a8578", fontSize: 15, textAlign: "center" }}>
                No wallpapers yet. Create one and hit Save!
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 8,
                padding: "0 16px",
              }}
            >
              {wallpapers.map((wp) => (
                <button
                  key={wp.id}
                  onClick={() => {
                    setGeneratedDataUrl(wp.dataUrl);
                    setView("preview");
                  }}
                  style={{
                    aspectRatio: "9/16",
                    border: "none",
                    padding: 0,
                    borderRadius: 12,
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "#ece8e1",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={wp.dataUrl}
                    alt="Saved wallpaper"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- EDITOR VIEW ---
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
            flex: 1,
          }}
        >
          Wallpaper
        </h1>

        {/* My Wallpapers link */}
        {wallpapers.length > 0 && (
          <button
            onClick={() => setView("saved")}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              border: "none",
              background: "rgba(0,0,0,0.06)",
              fontSize: 13,
              fontWeight: 500,
              color: "#1a1a1a",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Saved ({wallpapers.length})
          </button>
        )}
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

      {/* Controls: pattern chips (scrollable) + size slider */}
      {hasSelection && (
        <div style={{ flexShrink: 0, padding: "12px 0 0" }}>
          <div
            className="hide-scrollbar"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 16px",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
            }}
          >
            {(Object.keys(PATTERN_LABELS) as PatternMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "none",
                  background: mode === m ? "#1a1a1a" : "rgba(0,0,0,0.06)",
                  color: mode === m ? "#fff" : "#1a1a1a",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  WebkitTapHighlightColor: "transparent",
                  transition: "all 0.2s",
                }}
              >
                {PATTERN_LABELS[m]}
              </button>
            ))}

            <input
              type="range"
              min={60}
              max={240}
              value={tileSize}
              onChange={(e) => setTileSize(Number(e.target.value))}
              style={{ width: 70, accentColor: "#1a1a1a", flexShrink: 0 }}
            />

            {/* Duotone toggle */}
            <button
              onClick={() => setDuotone((v) => !v)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "none",
                background: duotone ? "#1a1a1a" : "rgba(0,0,0,0.06)",
                color: duotone ? "#fff" : "#1a1a1a",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.2s",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Duotone
            </button>

            {/* Color pickers (only when duotone active) */}
            {duotone && (
              <>
                <input
                  type="color"
                  value={duoDark}
                  onChange={(e) => setDuoDark(e.target.value)}
                  title="Dark color"
                  style={{ width: 28, height: 28, border: "none", borderRadius: 14, cursor: "pointer", flexShrink: 0, padding: 0 }}
                />
                <input
                  type="color"
                  value={duoLight}
                  onChange={(e) => setDuoLight(e.target.value)}
                  title="Light color"
                  style={{ width: 28, height: 28, border: "none", borderRadius: 14, cursor: "pointer", flexShrink: 0, padding: 0 }}
                />
              </>
            )}
          </div>

          {/* Duotone preset chips */}
          {duotone && (
            <div
              className="hide-scrollbar"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px 0",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
              }}
            >
              {DUOTONE_PRESETS.map((p) => {
                const active = duoDark.toLowerCase() === p.dark.toLowerCase() && duoLight.toLowerCase() === p.light.toLowerCase();
                return (
                  <button
                    key={p.id}
                    onClick={() => { setDuoDark(p.dark); setDuoLight(p.light); haptic(6); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px 6px 6px",
                      borderRadius: 18,
                      border: active ? "1.5px solid #1a1a1a" : "1.5px solid transparent",
                      background: "rgba(0,0,0,0.04)",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#1a1a1a",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      WebkitTapHighlightColor: "transparent",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        background: `linear-gradient(135deg, ${p.dark} 50%, ${p.light} 50%)`,
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                      }}
                    />
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create button */}
      {hasSelection && (
        <div style={{ padding: "10px 16px", flexShrink: 0 }}>
          <button
            onClick={handleCreate}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: 12,
              border: "none",
              background: "#1a1a1a",
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Create Wallpaper
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
        {tiles.map((tile) => (
          <WallpaperTileThumb
            key={tile.id}
            tile={tile}
            isSelected={selectedIds.includes(tile.id)}
            selIndex={selectedIds.indexOf(tile.id)}
            disabled={selectedIds.length >= 4}
            onClick={() => toggleTile(tile.id)}
          />
        ))}
      </div>
    </div>
  );
}
