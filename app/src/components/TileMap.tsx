"use client";

import { useSyncExternalStore, useMemo, useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getState, subscribe, getAllTags, type TileItem } from "@/lib/store";
import { useTileFileUrl } from "@/lib/useTileFileUrl";
import { useReverseGeocode } from "@/lib/useReverseGeocode";
import { requestGeolocation } from "@/lib/geo";
import { haptic } from "@/lib/haptic";
import { toast } from "@/lib/toast";
import { getActiveTheme, type Theme } from "@/lib/theme";

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
  const [activeTag, setActiveTag] = useState<string>("all");
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  // Track the active theme so we can swap the basemap and tint the chrome.
  const [theme, setThemeState] = useState<Theme>(() => getActiveTheme());
  useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => {
      setThemeState((document.documentElement.getAttribute("data-theme") as Theme) || "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  const isDark = theme === "dark";

  const geoTiles = useMemo(
    () => tiles.filter((t) => t.lat != null && t.lng != null),
    [tiles]
  );

  const tagFilters = useMemo(() => {
    const tagsOnMap = new Set<string>();
    geoTiles.forEach((t) => t.tags.forEach((tag) => tagsOnMap.add(tag)));
    return getAllTags().filter((t) => tagsOnMap.has(t));
  }, [geoTiles]);

  const visibleTiles = useMemo(() => {
    if (activeTag === "all") return geoTiles;
    return geoTiles.filter((t) => t.tags.includes(activeTag));
  }, [geoTiles, activeTag]);

  // Center on average of all geolocated tiles, or default to Europe
  const center = useMemo<[number, number]>(() => {
    if (geoTiles.length === 0) return [40, -3];
    const lat = geoTiles.reduce((s, t) => s + t.lat!, 0) / geoTiles.length;
    const lng = geoTiles.reduce((s, t) => s + t.lng!, 0) / geoTiles.length;
    return [lat, lng];
  }, [geoTiles]);

  const handleLocate = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    haptic(6);
    const pos = await requestGeolocation();
    setLocating(false);
    if (!pos) {
      toast("Couldn't get your location");
      return;
    }
    mapRef.current?.flyTo([pos.lat, pos.lng], 13, { duration: 1.2 });
  }, [locating]);

  const headerBg = isDark ? "rgba(20,20,20,0.85)" : "rgba(245,242,237,0.85)";
  const fg = isDark ? "#f0ece4" : "#1a1a1a";
  const muted = isDark ? "#888378" : "#8a8578";
  const chipBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

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
          background: headerBg,
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
            background: chipBg,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
            flexShrink: 0,
            color: fg,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: fg }}>
          Map
        </h1>
        <span style={{ fontSize: 13, color: muted }}>
          {visibleTiles.length} / {tiles.length} located
        </span>
      </div>

      {/* Map */}
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={5}
        style={{ flex: 1, width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          key={isDark ? "dark" : "light"}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url={
            isDark
              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          }
        />
        {visibleTiles.map((tile) => {
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

      {/* My location button */}
      <button
        onClick={() => void handleLocate()}
        aria-label="Center on my location"
        style={{
          position: "absolute",
          right: "max(16px, env(safe-area-inset-right, 16px))",
          bottom: tagFilters.length > 0
            ? "calc(max(16px, env(safe-area-inset-bottom, 16px)) + 60px)"
            : "max(20px, env(safe-area-inset-bottom, 20px))",
          zIndex: 1000,
          width: 48,
          height: 48,
          borderRadius: 24,
          border: "none",
          background: isDark ? "#f0ece4" : "#fff",
          color: isDark ? "#1a1a1a" : "#1a1a1a",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
          WebkitTapHighlightColor: "transparent",
          transition: "transform 0.2s",
        }}
      >
        {locating ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2a10 10 0 0 1 10 10" opacity="0.9">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
            </path>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3" />
            <path d="M12 19v3" />
            <path d="M2 12h3" />
            <path d="M19 12h3" />
          </svg>
        )}
      </button>

      {/* Tag filter bar */}
      {tagFilters.length > 0 && (
        <div
          className="hide-scrollbar"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            display: "flex",
            gap: 6,
            overflowX: "auto",
            padding: "10px 12px max(10px, env(safe-area-inset-bottom, 10px))",
            background: headerBg,
            backdropFilter: "blur(12px)",
            scrollbarWidth: "none",
          }}
        >
          {[{ id: "all", label: "All" }, ...tagFilters.map((t) => ({ id: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))].map((f) => (
            <button
              key={f.id}
              onClick={() => { setActiveTag(f.id); haptic(6); }}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "none",
                background: activeTag === f.id ? (isDark ? "#f0ece4" : "#1a1a1a") : chipBg,
                color: activeTag === f.id ? (isDark ? "#1a1a1a" : "#fff") : fg,
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
      )}
    </div>
  );
}
