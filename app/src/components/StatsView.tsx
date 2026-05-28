"use client";

import { useMemo, useState, useEffect, useSyncExternalStore } from "react";
import { getState, subscribe } from "@/lib/store";
import { isIdbRef } from "@/lib/blob-storage";
import { getCachedReverse, reverseGeocode } from "@/lib/geo";

function useStore() {
  return useSyncExternalStore(subscribe, getState, getState);
}

function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/** Resolves a "City, Country" label for every located tile, seeding from the
 * reverse-geocode cache and filling the rest sequentially (Nominatim is rate
 * limited to ~1 req/s) so the breakdown fills in live without a burst. */
function usePlaceLabels(coords: { lat: number; lng: number }[]) {
  const [labels, setLabels] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    if (typeof window !== "undefined") {
      for (const c of coords) {
        const cached = getCachedReverse(c.lat, c.lng);
        if (cached) seed[coordKey(c.lat, c.lng)] = cached;
      }
    }
    return seed;
  });

  const pending = useMemo(() => {
    const seen = new Set<string>();
    const out: { lat: number; lng: number; key: string }[] = [];
    for (const c of coords) {
      const key = coordKey(c.lat, c.lng);
      if (seen.has(key) || getCachedReverse(c.lat, c.lng)) continue;
      seen.add(key);
      out.push({ lat: c.lat, lng: c.lng, key });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.length]);

  useEffect(() => {
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      for (const c of pending) {
        if (cancelled) return;
        const label = await reverseGeocode(c.lat, c.lng);
        if (cancelled) return;
        if (label) setLabels((prev) => ({ ...prev, [c.key]: label }));
      }
    })();
    return () => { cancelled = true; };
  }, [pending]);

  return labels;
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: "16px 14px",
        borderRadius: 16,
        background: "var(--tt-chip-bg)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 12, color: "var(--tt-muted)", fontWeight: 500, letterSpacing: "-0.01em" }}>
        {label}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "8px 0 0",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        color: "var(--tt-muted)",
      }}
    >
      {children}
    </h2>
  );
}

export default function StatsView({ onBack }: { onBack: () => void }) {
  const { tiles, albums } = useStore();

  const stats = useMemo(() => {
    const total = tiles.length;
    const captured = tiles.filter((t) => isIdbRef(t.file)).length;
    const favorites = tiles.filter((t) => t.favorite).length;
    const located = tiles.filter((t) => typeof t.lat === "number" && typeof t.lng === "number");

    const tagCounts = new Map<string, number>();
    for (const t of tiles) for (const tag of t.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    const topTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]);

    const dated = tiles.map((t) => t.date).filter((d): d is string => Boolean(d && d.trim()));

    return { total, captured, favorites, located, topTags, dated };
  }, [tiles]);

  const coords = useMemo(
    () => stats.located.map((t) => ({ lat: t.lat as number, lng: t.lng as number })),
    [stats.located]
  );
  const placeLabels = usePlaceLabels(coords);

  // Group located tiles by resolved label, and count distinct countries.
  const { places, countryCount, resolvedCount } = useMemo(() => {
    const byPlace = new Map<string, number>();
    const countries = new Set<string>();
    let resolved = 0;
    for (const c of coords) {
      const label = placeLabels[coordKey(c.lat, c.lng)];
      if (!label) continue;
      resolved++;
      byPlace.set(label, (byPlace.get(label) ?? 0) + 1);
      const country = label.split(",").pop()?.trim();
      if (country) countries.add(country);
    }
    return {
      places: Array.from(byPlace.entries()).sort((a, b) => b[1] - a[1]),
      countryCount: countries.size,
      resolvedCount: resolved,
    };
  }, [coords, placeLabels]);

  const maxTag = stats.topTags[0]?.[1] ?? 1;
  const stillResolving = coords.length > 0 && resolvedCount < coords.length;

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
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
          Stats
        </h1>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "4px 16px max(24px, env(safe-area-inset-bottom, 24px))",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Hero */}
        <div style={{ padding: "8px 2px 4px" }}>
          <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1 }}>
            {stats.total}
          </div>
          <div style={{ fontSize: 14, color: "var(--tt-muted)", fontWeight: 500, marginTop: 4 }}>
            {stats.total === 1 ? "tile in your collection" : "tiles in your collection"}
            {stats.captured > 0 && ` · ${stats.captured} captured by you`}
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 10 }}>
          <StatCard value={stats.favorites} label={stats.favorites === 1 ? "Favorite" : "Favorites"} />
          <StatCard value={stats.located.length} label="Located" />
          <StatCard value={countryCount} label={countryCount === 1 ? "Country" : "Countries"} />
          <StatCard value={albums.length} label={albums.length === 1 ? "Album" : "Albums"} />
        </div>

        {/* Top tags */}
        {stats.topTags.length > 0 && (
          <>
            <SectionTitle>Top tags</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {stats.topTags.map(([tag, count]) => (
                <div key={tag} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, width: 90, flexShrink: 0, letterSpacing: "-0.01em" }}>
                    {tag.charAt(0).toUpperCase() + tag.slice(1)}
                  </span>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--tt-chip-bg)", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.max(6, (count / maxTag) * 100)}%`,
                        height: "100%",
                        borderRadius: 4,
                        background: "var(--tt-chip-bg-active)",
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 13, color: "var(--tt-muted)", width: 24, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Places */}
        {coords.length > 0 && (
          <>
            <SectionTitle>
              Places{stillResolving ? " · loading…" : ""}
            </SectionTitle>
            {places.length === 0 && stillResolving ? (
              <p style={{ fontSize: 13, color: "var(--tt-muted)", margin: 0 }}>
                Resolving locations…
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {places.map(([place, count]) => (
                  <div
                    key={place}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 2px",
                      borderBottom: "1px solid var(--tt-border)",
                    }}
                  >
                    <span style={{ fontSize: 14, letterSpacing: "-0.01em" }}>{place}</span>
                    <span style={{ fontSize: 13, color: "var(--tt-muted)", fontVariantNumeric: "tabular-nums" }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {stats.total === 0 && (
          <p style={{ fontSize: 14, color: "var(--tt-muted)", textAlign: "center", marginTop: 32 }}>
            Capture your first tile to see stats.
          </p>
        )}
      </div>
    </div>
  );
}
