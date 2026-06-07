"use client";

import { useState, useRef, useSyncExternalStore } from "react";
import { getState, subscribe } from "@/lib/store";
import { exportCollection, importCollection } from "@/lib/backup";
import { haptic } from "@/lib/haptic";
import { toast } from "@/lib/toast";
import { SectionTitle } from "./StatsPanel";

/** Manual ZIP backup (export/import) — lives in the Profile's Account tab. */
export default function BackupSection() {
  const { tiles } = useSyncExternalStore(subscribe, getState, getState);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const total = tiles.length;

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    haptic(6);
    try {
      const blob = await exportCollection();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tile-tales-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast("Backup exported");
    } catch {
      toast("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    haptic(6);
    try {
      const { addedTiles, addedAlbums } = await importCollection(file);
      if (addedTiles === 0 && addedAlbums === 0) {
        toast("Nothing new to import");
      } else {
        const parts = [
          addedTiles > 0 ? `${addedTiles} ${addedTiles === 1 ? "tile" : "tiles"}` : null,
          addedAlbums > 0 ? `${addedAlbums} ${addedAlbums === 1 ? "album" : "albums"}` : null,
        ].filter(Boolean);
        toast(`Imported ${parts.join(" · ")}`);
      }
    } catch {
      toast("Couldn't read that backup");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <SectionTitle>Backup</SectionTitle>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => void handleExport()}
          disabled={exporting || total === 0}
          style={{
            flex: 1,
            padding: "12px 8px",
            borderRadius: 12,
            border: "1px solid var(--tt-input-border)",
            background: "transparent",
            fontSize: 14,
            fontWeight: 600,
            color: exporting || total === 0 ? "var(--tt-muted)" : "var(--tt-fg)",
            cursor: exporting || total === 0 ? "default" : "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {exporting ? "Exporting…" : "Export collection"}
        </button>
        <button
          onClick={() => importInputRef.current?.click()}
          disabled={importing}
          style={{
            flex: 1,
            padding: "12px 8px",
            borderRadius: 12,
            border: "1px solid var(--tt-input-border)",
            background: "transparent",
            fontSize: 14,
            fontWeight: 600,
            color: importing ? "var(--tt-muted)" : "var(--tt-fg)",
            cursor: importing ? "default" : "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {importing ? "Importing…" : "Import backup"}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--tt-muted)", margin: "0 2px 4px", lineHeight: 1.4 }}>
        Export downloads a ZIP with your captured tiles and albums. Import merges a backup back in — existing tiles are skipped.
      </p>
      <input
        ref={importInputRef}
        type="file"
        accept=".zip,application/zip"
        onChange={(e) => void handleImportFile(e)}
        style={{ display: "none" }}
      />
    </>
  );
}
