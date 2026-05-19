"use client";

import { type TileItem } from "@/lib/store";
import { useTileFileUrl } from "@/lib/useTileFileUrl";

export default function SelectorThumb({
  tile,
  active,
  onClick,
}: {
  tile: TileItem;
  active: boolean;
  onClick: () => void;
}) {
  const url = useTileFileUrl(tile.file);
  return (
    <button
      onClick={onClick}
      style={{
        width: "clamp(52px, 12vw, 72px)",
        height: "clamp(52px, 12vw, 72px)",
        borderRadius: "clamp(8px, 2vw, 12px)",
        overflow: "hidden",
        border: "none",
        padding: 0,
        cursor: "pointer",
        outline: active ? "2px solid #1a1a1a" : "2px solid transparent",
        outlineOffset: 2,
        opacity: active ? 1 : 0.6,
        transition: "all 0.2s",
        background: "#ece8e1",
        flexShrink: 0,
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
