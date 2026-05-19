"use client";

import { useSyncExternalStore, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getState, subscribe, type TileItem } from "@/lib/store";
import { useTileFileUrl } from "@/lib/useTileFileUrl";
import { useReverseGeocode } from "@/lib/useReverseGeocode";

function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

function tileIconWithUrl(url: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 44px;
      height: 44px;
      border-radius: 22px;
      overflow: hidden;
      border: 3px solid #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    "><img src="${url}" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24],
  });
}

function TileMarker({
  tile,
  originalIndex,
  onSelectTile,
}: {
  tile: TileItem;
  originalIndex: number;
  onSelectTile: (index: number) => void;
}) {
  const url = useTileFileUrl(tile.file);
  const label = useReverseGeocode(tile.lat, tile.lng);
  if (!url) return null;
  return (
    <Marker position={[tile.lat!, tile.lng!]} icon={tileIconWithUrl(url)}>
      <Popup>
        <div
          style={{ textAlign: "center", cursor: "pointer" }}
          onClick={() => onSelectTile(originalIndex)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={tile.name}
            style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, display: "block", margin: "0 auto 8px" }}
          />
          <strong>{tile.name}</strong>
          {label && (
            <div style={{ fontSize: 11, color: "#8a8578", marginTop: 4 }}>{label}</div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

export default function TileMap({
  onBack,
  onSelectTile,
}: {
  onBack: () => void;
  onSelectTile: (index: number) => void;
}) {
  const { tiles } = useStore();

  const geoTiles = useMemo(
    () => tiles.filter((t) => t.lat != null && t.lng != null),
    [tiles]
  );

  // Center on average of all geolocated tiles, or default to Europe
  const center = useMemo<[number, number]>(() => {
    if (geoTiles.length === 0) return [40, -3];
    const lat = geoTiles.reduce((s, t) => s + t.lat!, 0) / geoTiles.length;
    const lng = geoTiles.reduce((s, t) => s + t.lng!, 0) / geoTiles.length;
    return [lat, lng];
  }, [geoTiles]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--tt-bg)",
        color: "var(--tt-fg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          padding: "max(16px, env(safe-area-inset-top, 16px)) 16px 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(245, 242, 237, 0.85)",
          backdropFilter: "blur(12px)",
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
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "#1a1a1a" }}>
          Map
        </h1>
        <span style={{ fontSize: 13, color: "#8a8578" }}>
          {geoTiles.length} / {tiles.length} located
        </span>
      </div>

      {/* Map */}
      <MapContainer
        center={center}
        zoom={5}
        style={{ flex: 1, width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {geoTiles.map((tile) => {
          const originalIndex = tiles.findIndex((t) => t.id === tile.id);
          return (
            <TileMarker
              key={tile.id}
              tile={tile}
              originalIndex={originalIndex}
              onSelectTile={onSelectTile}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
