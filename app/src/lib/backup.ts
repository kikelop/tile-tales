"use client";

import { getState, importData, type TileItem, type Album } from "./store";
import { isIdbRef, idbRefToId, loadTileBlob, saveTileBlob } from "./blob-storage";

const BACKUP_VERSION = 1;

interface BackupManifest {
  version: number;
  exportedAt: string;
  tiles: TileItem[];
  albums: Album[];
}

/**
 * Bundles the whole collection into a ZIP: a `collection.json` manifest with
 * tile + album metadata, plus the raw binary of every user-captured tile under
 * `blobs/<id>` (sample tiles ship with the app, so they're referenced by path
 * and not bundled). jszip is dynamic-imported so it only loads when the user
 * actually exports — same pattern as exifr.
 */
export async function exportCollection(): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const { tiles, albums } = getState();

  const manifest: BackupManifest = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tiles,
    albums,
  };
  zip.file("collection.json", JSON.stringify(manifest, null, 2));

  const blobs = zip.folder("blobs")!;
  for (const t of tiles) {
    if (!isIdbRef(t.file)) continue;
    const blob = await loadTileBlob(idbRefToId(t.file));
    if (blob) blobs.file(idbRefToId(t.file), blob);
  }

  return zip.generateAsync({ type: "blob" });
}

/**
 * Restores a ZIP produced by exportCollection. Writes each captured tile's
 * blob back into IndexedDB, then merges metadata into the store by id (tiles
 * and albums already present are skipped, so re-importing is idempotent). A
 * captured tile whose blob is missing from the ZIP is dropped — it would only
 * render as a broken image.
 */
export async function importCollection(file: File): Promise<{ addedTiles: number; addedAlbums: number }> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(file);

  const manifestFile = zip.file("collection.json");
  if (!manifestFile) throw new Error("Not a Tile Tales backup");
  const manifest = JSON.parse(await manifestFile.async("string")) as Partial<BackupManifest>;

  const tiles = (manifest.tiles ?? []) as TileItem[];
  const albums = (manifest.albums ?? []) as Album[];

  const restorable: TileItem[] = [];
  for (const t of tiles) {
    if (!isIdbRef(t.file)) {
      restorable.push(t);
      continue;
    }
    const id = idbRefToId(t.file);
    const entry = zip.file(`blobs/${id}`);
    if (!entry) continue; // blob missing → would render broken, skip
    await saveTileBlob(id, await entry.async("blob"));
    restorable.push(t);
  }

  return importData({ tiles: restorable, albums });
}
