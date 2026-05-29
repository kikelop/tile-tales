"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import AlbumsField from "./AlbumsField";
import { updateTile, deleteTile, type TileItem, type Album } from "@/lib/store";
import { haptic } from "@/lib/haptic";
import { toast } from "@/lib/toast";
import { requestGeolocation, searchPlaces, type GeoPoint, type PlaceResult } from "@/lib/geo";
import { deleteTileBlob, isIdbRef, idbRefToId, revokeTileBlobUrl } from "@/lib/blob-storage";
import { useReverseGeocode } from "@/lib/useReverseGeocode";

// Green drop-pin matching the location row accent.
const pickerIcon = L.divIcon({
  className: "",
  html: `<svg width="28" height="28" viewBox="0 0 24 24" fill="#5a8a3c" stroke="#fff" stroke-width="1.5" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#fff" stroke="#5a8a3c"/></svg>`,
  iconSize: [28, 28],
  iconAnchor: [14, 26],
});

// Captures taps on the mini-map to drop the location pin.
function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

/**
 * Bottom-sheet editor for a tile: name, memory, date, tags, location and albums.
 * Owns all of its own draft + place-search state, seeded from `tile` on mount,
 * so the parent only has to mount/unmount it.
 */
export default function TileEditSheet({
  tile,
  albums,
  isLastTile,
  onClose,
  onDeleteLast,
}: {
  tile: TileItem;
  albums: Album[];
  isLastTile: boolean;
  onClose: () => void;
  onDeleteLast: () => void;
}) {
  const [nameDraft, setNameDraft] = useState(tile.name);
  const [memoryDraft, setMemoryDraft] = useState(tile.memory);
  const [dateDraft, setDateDraft] = useState(tile.date);
  const [tagsDraft, setTagsDraft] = useState(tile.tags.join(", "));
  const [geoDraft, setGeoDraft] = useState<GeoPoint | null>(
    tile.lat != null && tile.lng != null ? { lat: tile.lat, lng: tile.lng } : null
  );
  const [fetchingGeo, setFetchingGeo] = useState(false);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [pickingOnMap, setPickingOnMap] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);

  const geoLabel = useReverseGeocode(geoDraft?.lat, geoDraft?.lng);

  useEffect(() => {
    if (!searchingPlace) return;
    const q = placeQuery.trim();
    if (q.length < 2) {
      setPlaceResults([]);
      setPlaceLoading(false);
      return;
    }
    const controller = new AbortController();
    setPlaceLoading(true);
    const timer = setTimeout(async () => {
      const results = await searchPlaces(q, controller.signal);
      if (!controller.signal.aborted) {
        setPlaceResults(results);
        setPlaceLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [placeQuery, searchingPlace]);

  const handleSave = () => {
    const tags = tagsDraft.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    updateTile(tile.id, {
      name: nameDraft,
      memory: memoryDraft,
      date: dateDraft,
      tags,
      lat: geoDraft?.lat,
      lng: geoDraft?.lng,
    });
    haptic(8);
    toast("Tile updated");
    onClose();
  };

  const handleDelete = () => {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${tile.name}"? This can't be undone.`)) return;
    if (isIdbRef(tile.file)) {
      const blobId = idbRefToId(tile.file);
      void deleteTileBlob(blobId);
      revokeTileBlobUrl(blobId);
    }
    deleteTile(tile.id);
    onClose();
    haptic([10, 40, 10]);
    toast("Tile deleted");
    if (isLastTile) onDeleteLast();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "14px 24px max(24px, env(safe-area-inset-bottom, 24px))",
          maxHeight: "88vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!editingLocation ? (
        <>
        {/* Close */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "rgba(0,0,0,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <input
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          placeholder="Tile name"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e0d8cc",
            background: "#faf8f5",
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            outline: "none",
            boxSizing: "border-box",
            color: "#1a1a1a",
            marginBottom: 12,
          }}
        />
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#8a8578" }}>
          Memory (appears on the back of the tile)
        </p>
        <textarea
          value={memoryDraft}
          onChange={(e) => setMemoryDraft(e.target.value)}
          placeholder="The day I found this tile..."
          style={{
            width: "100%",
            minHeight: 120,
            padding: 16,
            borderRadius: 12,
            border: "1px solid #e0d8cc",
            background: "#faf8f5",
            fontSize: 18,
            fontFamily: "var(--font-caveat), cursive",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
            color: "#1a1a1a",
          }}
        />
        <input
          type="text"
          value={dateDraft}
          onChange={(e) => setDateDraft(e.target.value)}
          placeholder="e.g. March 2026, Lisboa"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e0d8cc",
            background: "#faf8f5",
            fontSize: 16,
            fontFamily: "var(--font-caveat), cursive",
            outline: "none",
            boxSizing: "border-box",
            color: "#9a9288",
            marginTop: 8,
          }}
        />
        <input
          type="text"
          value={tagsDraft}
          onChange={(e) => setTagsDraft(e.target.value)}
          placeholder="Tags: geometric, floral, classic..."
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e0d8cc",
            background: "#faf8f5",
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
            color: "#1a1a1a",
            marginTop: 8,
          }}
        />

        {/* Location (compact — the pencil opens the location sub-view) */}
        <div style={{ marginTop: 14 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#8a8578" }}>Location</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: geoDraft ? "#f1f5ee" : "#faf8f5", border: `1px solid ${geoDraft ? "#cfe0c2" : "#e0d8cc"}` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={geoDraft ? "#5a8a3c" : "none"} stroke={geoDraft ? "#5a8a3c" : "#b8b0a3"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" fill="#fff" stroke={geoDraft ? "#5a8a3c" : "#b8b0a3"} />
            </svg>
            <span style={{ flex: 1, fontSize: 13, color: geoDraft ? "#1a1a1a" : "#9a9288", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {geoDraft ? (geoLabel || `${geoDraft.lat.toFixed(4)}, ${geoDraft.lng.toFixed(4)}`) : "No location"}
            </span>
            <button onClick={() => { setEditingLocation(true); haptic(6); }} aria-label="Edit location" style={{ width: 30, height: 30, borderRadius: 15, border: "none", background: "rgba(0,0,0,0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            </button>
          </div>
        </div>

        {/* Albums editor */}
        <AlbumsField tileId={tile.id} albums={albums} />

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid #e0d8cc", background: "transparent", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSave} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "#1a1a1a", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Save</button>
        </div>

        {/* Delete — separated, low-emphasis, confirms first */}
        <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid #f0ece6", textAlign: "center" }}>
          <button onClick={handleDelete} style={{ border: "none", background: "transparent", color: "#b9534e", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "4px 10px", WebkitTapHighlightColor: "transparent" }}>
            Delete tile
          </button>
        </div>
        </>
        ) : (
        <>
        {/* ---- Location sub-view ---- */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button onClick={() => { setSearchingPlace(false); setPickingOnMap(false); setEditingLocation(false); haptic(6); }} aria-label="Back" style={{ width: 32, height: 32, borderRadius: 16, border: "none", background: "rgba(0,0,0,0.06)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
          </button>
          <span style={{ fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Location</span>
        </div>

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 12,
              background: geoDraft ? "#f1f5ee" : "#faf8f5",
              border: `1px solid ${geoDraft ? "#cfe0c2" : "#e0d8cc"}`,
              transition: "background 0.25s ease, border-color 0.25s ease",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={geoDraft ? "#5a8a3c" : "none"} stroke={geoDraft ? "#5a8a3c" : "#b8b0a3"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke 0.25s ease, fill 0.25s ease", flexShrink: 0 }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" fill="#fff" stroke={geoDraft ? "#5a8a3c" : "#b8b0a3"} />
            </svg>
            <span
              style={{
                flex: 1,
                fontSize: 13,
                color: geoDraft ? "#1a1a1a" : "#9a9288",
                fontVariantNumeric: geoDraft && !geoLabel ? "tabular-nums" : "normal",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {geoDraft ? (
                geoLabel ? (
                  geoLabel
                ) : (
                  <>
                    {`${geoDraft.lat.toFixed(4)}, ${geoDraft.lng.toFixed(4)}`}
                    <span style={{ color: "#9a9288" }}> · naming…</span>
                  </>
                )
              ) : (
                "No location"
              )}
            </span>
            {geoDraft && (
              <button
                onClick={() => { setGeoDraft(null); haptic(6); }}
                style={{
                  padding: "4px 10px",
                  borderRadius: 14,
                  border: "none",
                  background: "transparent",
                  color: "#d44",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                Clear
              </button>
            )}
          </div>

          {!searchingPlace && !pickingOnMap && (
            <>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={async () => {
                  if (fetchingGeo) return;
                  setFetchingGeo(true);
                  haptic(6);
                  const geo = await requestGeolocation();
                  setFetchingGeo(false);
                  if (geo) {
                    setGeoDraft(geo);
                    toast("Location updated");
                  } else {
                    toast("Couldn't get location");
                  }
                }}
                disabled={fetchingGeo}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  borderRadius: 12,
                  border: "1px solid #e0d8cc",
                  background: "transparent",
                  fontSize: 13,
                  fontWeight: 600,
                  color: fetchingGeo ? "#9a9288" : "#1a1a1a",
                  cursor: fetchingGeo ? "default" : "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {fetchingGeo ? "Getting…" : "Use my location"}
              </button>
              <button
                onClick={() => { setSearchingPlace(true); haptic(6); }}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  borderRadius: 12,
                  border: "1px solid #e0d8cc",
                  background: "transparent",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1a1a1a",
                  cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                Search a place
              </button>
            </div>
            <button
              onClick={() => { setPickingOnMap(true); haptic(6); }}
              style={{
                width: "100%",
                marginTop: 8,
                padding: "10px 8px",
                borderRadius: 12,
                border: "1px solid #e0d8cc",
                background: "transparent",
                fontSize: 13,
                fontWeight: 600,
                color: "#1a1a1a",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Pin on map
            </button>
            </>
          )}
          {searchingPlace && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  autoFocus
                  type="text"
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  placeholder="e.g. Lisboa, Portugal"
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #e0d8cc",
                    background: "#faf8f5",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                    color: "#1a1a1a",
                  }}
                />
                <button
                  onClick={() => {
                    setSearchingPlace(false);
                    setPlaceQuery("");
                    setPlaceResults([]);
                  }}
                  style={{
                    padding: "0 14px",
                    borderRadius: 12,
                    border: "1px solid #e0d8cc",
                    background: "transparent",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1a1a1a",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  Cancel
                </button>
              </div>

              {placeQuery.trim().length >= 2 && (
                <div
                  style={{
                    marginTop: 8,
                    maxHeight: 200,
                    overflowY: "auto",
                    borderRadius: 12,
                    border: "1px solid #e0d8cc",
                    background: "#faf8f5",
                  }}
                >
                  {placeLoading && placeResults.length === 0 ? (
                    <p style={{ margin: 0, padding: "12px 14px", fontSize: 13, color: "#9a9288" }}>
                      Searching…
                    </p>
                  ) : placeResults.length === 0 ? (
                    <p style={{ margin: 0, padding: "12px 14px", fontSize: 13, color: "#9a9288" }}>
                      No results
                    </p>
                  ) : (
                    placeResults.map((r, i) => (
                      <button
                        key={`${r.lat}-${r.lng}-${i}`}
                        onClick={() => {
                          setGeoDraft({ lat: r.lat, lng: r.lng });
                          setSearchingPlace(false);
                          setPlaceQuery("");
                          setPlaceResults([]);
                          haptic(8);
                          toast("Location set");
                        }}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 14px",
                          border: "none",
                          borderTop: i === 0 ? "none" : "1px solid #ece6dc",
                          background: "transparent",
                          fontSize: 13,
                          color: "#1a1a1a",
                          cursor: "pointer",
                          WebkitTapHighlightColor: "transparent",
                        }}
                      >
                        {r.label}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          {pickingOnMap && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 200, borderRadius: 12, overflow: "hidden", border: "1px solid #e0d8cc" }}>
                <MapContainer
                  center={(geoDraft ? [geoDraft.lat, geoDraft.lng] : [40, -4]) as [number, number]}
                  zoom={geoDraft ? 13 : 4}
                  style={{ height: "100%", width: "100%" }}
                  zoomControl={false}
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                  <MapClickHandler onPick={(lat, lng) => { setGeoDraft({ lat, lng }); haptic(6); }} />
                  {geoDraft && <Marker position={[geoDraft.lat, geoDraft.lng]} icon={pickerIcon} />}
                </MapContainer>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <span style={{ flex: 1, fontSize: 12, color: "#9a9288" }}>Tap the map to drop the pin</span>
                <button
                  onClick={() => { setPickingOnMap(false); haptic(6); }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 12,
                    border: "1px solid #e0d8cc",
                    background: "transparent",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1a1a1a",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => { setSearchingPlace(false); setPickingOnMap(false); setEditingLocation(false); haptic(6); }}
          style={{ width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 12, border: "none", background: "#1a1a1a", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >
          Done
        </button>
        </>
        )}
      </div>
    </div>
  );
}
