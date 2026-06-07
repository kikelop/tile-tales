"use client";
// Local-first sync engine. The app is fully usable without an account; when a
// session exists this module reconciles the local store with Supabase:
//
//  - pull:  fetch all remote rows (incl. soft-deleted), last-write-wins per row
//  - push:  upload local rows newer than their remote counterpart, plus
//           tombstones as soft deletes; captured images go to private storage
//  - first login: everything local (samples included) simply counts as "newer
//    than missing" and gets pushed — that IS the initial migration
//
// Conflict model: LWW comparing local `updatedAt` (ms epoch) with remote
// `updated_at`. The server re-stamps updated_at on write, so "last push wins"
// across devices — acceptable for a single user in v1.

import { getSupabase } from "./supabase";
import { subscribeAuth } from "./auth";
import {
  getState,
  subscribe as subscribeStore,
  applyRemoteChanges,
  getTombstones,
  type TileItem,
  type Album,
} from "./store";
import {
  loadTileBlob,
  saveTileBlob,
  deleteTileBlob,
  isIdbRef,
  idbRefToId,
  idToIdbRef,
} from "./blob-storage";

const BUCKET = "tiles";
const STORAGE_REF_PREFIX = "storage:";

// ---------- status (consumed by the Account UI) ----------

export type SyncState = "off" | "syncing" | "idle" | "error";
export interface SyncStatus {
  state: SyncState;
  lastSyncAt: number | null;
  error?: string;
}

let status: SyncStatus = { state: "off", lastSyncAt: null };
const statusListeners = new Set<(s: SyncStatus) => void>();

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  statusListeners.forEach((l) => l(status));
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: (s: SyncStatus) => void): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => statusListeners.delete(listener);
}

// ---------- row mapping ----------

interface TileRow {
  user_id: string;
  id: string;
  name: string;
  image_ref: string;
  memory: string;
  date: string;
  tags: string[];
  favorite: boolean;
  lat: number | null;
  lng: number | null;
  updated_at: string;
  deleted_at: string | null;
}

interface AlbumRow {
  user_id: string;
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function storagePath(uid: string, tileId: string): string {
  return `${uid}/${tileId}.webp`;
}

function tileToRow(t: TileItem, uid: string): Omit<TileRow, "updated_at"> {
  return {
    user_id: uid,
    id: t.id,
    name: t.name,
    image_ref: isIdbRef(t.file) ? `${STORAGE_REF_PREFIX}${storagePath(uid, t.id)}` : t.file,
    memory: t.memory,
    date: t.date,
    tags: t.tags,
    favorite: t.favorite,
    lat: t.lat ?? null,
    lng: t.lng ?? null,
    deleted_at: null,
  };
}

function rowToTile(row: TileRow, file: string): TileItem {
  return {
    id: row.id,
    name: row.name,
    file,
    memory: row.memory,
    date: row.date,
    tags: row.tags || [],
    favorite: row.favorite,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    updatedAt: Date.parse(row.updated_at) || 0,
  };
}

// ---------- engine ----------

let started = false;
let syncing = false;
let rerunQueued = false;
let applyingRemote = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentUid: string | null = null;

/** Call once from a client component. Safe to call multiple times. */
export function startSync(): void {
  if (started) return;
  started = true;
  const supabase = getSupabase();
  if (!supabase) return; // sync not configured in this build

  subscribeAuth((session) => {
    const uid = session?.user?.id ?? null;
    if (uid === currentUid) return;
    currentUid = uid;
    if (uid) {
      setStatus({ state: "idle", error: undefined });
      void requestSync();
    } else {
      setStatus({ state: "off", error: undefined });
    }
  });

  // Push local edits, debounced. Remote applications are flagged off.
  subscribeStore(() => {
    if (!currentUid || applyingRemote) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => void requestSync(), 2000);
  });

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && currentUid) void requestSync();
    });
  }
}

/** Runs a full sync cycle; coalesces concurrent requests. */
export async function requestSync(): Promise<void> {
  if (!currentUid) return;
  if (syncing) {
    rerunQueued = true;
    return;
  }
  syncing = true;
  setStatus({ state: "syncing", error: undefined });
  try {
    await syncCycle(currentUid);
    setStatus({ state: "idle", lastSyncAt: Date.now(), error: undefined });
  } catch (e) {
    setStatus({ state: "error", error: e instanceof Error ? e.message : "Sync failed" });
  } finally {
    syncing = false;
    if (rerunQueued) {
      rerunQueued = false;
      void requestSync();
    }
  }
}

async function syncCycle(uid: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  // ----- pull everything (tiny data set: one user's collection) -----
  const [tilesRes, albumsRes, membersRes] = await Promise.all([
    supabase.from("tiles").select("*"),
    supabase.from("albums").select("*"),
    supabase.from("album_tiles").select("album_id, tile_id"),
  ]);
  if (tilesRes.error) throw tilesRes.error;
  if (albumsRes.error) throw albumsRes.error;
  if (membersRes.error) throw membersRes.error;

  const remoteTiles = new Map((tilesRes.data as TileRow[]).map((r) => [r.id, r]));
  const remoteAlbums = new Map((albumsRes.data as AlbumRow[]).map((r) => [r.id, r]));
  const remoteMembers = new Map<string, string[]>();
  for (const m of membersRes.data as { album_id: string; tile_id: string }[]) {
    const list = remoteMembers.get(m.album_id) || [];
    list.push(m.tile_id);
    remoteMembers.set(m.album_id, list);
  }

  const local = getState();
  const tombstones = getTombstones();

  // ----- reconcile tiles -----
  const upsertLocalTiles: TileItem[] = [];
  const deleteLocalTileIds: string[] = [];
  const pushTiles: TileItem[] = [];
  const pushDeleteTileIds: string[] = [];
  const localTileMap = new Map(local.tiles.map((t) => [t.id, t]));

  for (const [id, row] of remoteTiles) {
    const localTile = localTileMap.get(id);
    const remoteTs = Date.parse(row.updated_at) || 0;
    if (row.deleted_at) {
      if (localTile) {
        const localTs = localTile.updatedAt ?? 0;
        if (localTs > Date.parse(row.deleted_at)) {
          pushTiles.push(localTile); // re-created/edited after the remote delete
        } else {
          deleteLocalTileIds.push(id);
          if (isIdbRef(localTile.file)) void deleteTileBlob(idbRefToId(localTile.file));
        }
      }
      continue;
    }
    if (!localTile) {
      if (tombstones.tiles[id]) {
        pushDeleteTileIds.push(id); // deleted locally while offline
      } else {
        upsertLocalTiles.push(await materializeRemoteTile(row));
      }
      continue;
    }
    const localTs = localTile.updatedAt ?? 0;
    if (remoteTs > localTs) {
      upsertLocalTiles.push(await materializeRemoteTile(row));
    } else if (localTs > remoteTs) {
      pushTiles.push(localTile);
    }
  }
  // Local tiles the remote has never seen → initial upload
  for (const t of local.tiles) {
    if (!remoteTiles.has(t.id)) pushTiles.push(t);
  }
  // Local tombstones for rows that exist remotely (not yet soft-deleted)
  for (const id of Object.keys(tombstones.tiles)) {
    const row = remoteTiles.get(id);
    if (row && !row.deleted_at) pushDeleteTileIds.push(id);
  }

  // ----- reconcile albums (same shape, plus membership) -----
  const upsertLocalAlbums: Album[] = [];
  const deleteLocalAlbumIds: string[] = [];
  const pushAlbums: Album[] = [];
  const pushDeleteAlbumIds: string[] = [];
  const localAlbumMap = new Map(local.albums.map((a) => [a.id, a]));

  for (const [id, row] of remoteAlbums) {
    const localAlbum = localAlbumMap.get(id);
    const remoteTs = Date.parse(row.updated_at) || 0;
    if (row.deleted_at) {
      if (localAlbum) {
        const localTs = localAlbum.updatedAt ?? 0;
        if (localTs > Date.parse(row.deleted_at)) pushAlbums.push(localAlbum);
        else deleteLocalAlbumIds.push(id);
      }
      continue;
    }
    const remoteAlbumLocal: Album = {
      id: row.id,
      name: row.name,
      tileIds: remoteMembers.get(row.id) || [],
      createdAt: Date.parse(row.created_at) || 0,
      updatedAt: remoteTs,
    };
    if (!localAlbum) {
      if (tombstones.albums[id]) pushDeleteAlbumIds.push(id);
      else upsertLocalAlbums.push(remoteAlbumLocal);
      continue;
    }
    const localTs = localAlbum.updatedAt ?? 0;
    if (remoteTs > localTs) upsertLocalAlbums.push(remoteAlbumLocal);
    else if (localTs > remoteTs) pushAlbums.push(localAlbum);
  }
  for (const a of local.albums) {
    if (!remoteAlbums.has(a.id)) pushAlbums.push(a);
  }
  for (const id of Object.keys(tombstones.albums)) {
    const row = remoteAlbums.get(id);
    if (row && !row.deleted_at) pushDeleteAlbumIds.push(id);
  }

  // ----- apply remote → local (one batch, one notify) -----
  if (
    upsertLocalTiles.length ||
    upsertLocalAlbums.length ||
    deleteLocalTileIds.length ||
    deleteLocalAlbumIds.length
  ) {
    applyingRemote = true;
    try {
      applyRemoteChanges({
        upsertTiles: upsertLocalTiles,
        upsertAlbums: upsertLocalAlbums,
        deleteTileIds: deleteLocalTileIds,
        deleteAlbumIds: deleteLocalAlbumIds,
      });
    } finally {
      applyingRemote = false;
    }
  }

  // ----- push local → remote -----
  for (const t of pushTiles) {
    if (isIdbRef(t.file)) {
      const blob = await loadTileBlob(idbRefToId(t.file));
      if (blob) {
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath(uid, t.id), blob, { upsert: true, contentType: "image/webp" });
        if (error) throw error;
      }
    }
    const { error } = await supabase.from("tiles").upsert(tileToRow(t, uid));
    if (error) throw error;
  }

  if (pushDeleteTileIds.length) {
    const { error } = await supabase
      .from("tiles")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", pushDeleteTileIds);
    if (error) throw error;
    // Best-effort: free the storage objects of deleted captures
    void supabase.storage.from(BUCKET).remove(pushDeleteTileIds.map((id) => storagePath(uid, id)));
  }

  for (const a of pushAlbums) {
    const { error } = await supabase.from("albums").upsert({
      user_id: uid,
      id: a.id,
      name: a.name,
      created_at: new Date(a.createdAt || 0).toISOString(),
      deleted_at: null,
    });
    if (error) throw error;
    // Membership: replace wholesale (collections are small)
    const del = await supabase.from("album_tiles").delete().eq("album_id", a.id);
    if (del.error) throw del.error;
    if (a.tileIds.length) {
      const ins = await supabase.from("album_tiles").insert(
        a.tileIds.map((tileId) => ({ user_id: uid, album_id: a.id, tile_id: tileId }))
      );
      if (ins.error) throw ins.error;
    }
  }

  if (pushDeleteAlbumIds.length) {
    const { error } = await supabase
      .from("albums")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", pushDeleteAlbumIds);
    if (error) throw error;
  }

  // ----- tombstones are now propagated; clear them -----
  const clearTileTombstones = Object.keys(tombstones.tiles).filter(
    (id) => pushDeleteTileIds.includes(id) || !remoteTiles.has(id) || remoteTiles.get(id)?.deleted_at
  );
  const clearAlbumTombstones = Object.keys(tombstones.albums).filter(
    (id) => pushDeleteAlbumIds.includes(id) || !remoteAlbums.has(id) || remoteAlbums.get(id)?.deleted_at
  );
  if (clearTileTombstones.length || clearAlbumTombstones.length) {
    applyingRemote = true;
    try {
      applyRemoteChanges({
        clearTombstoneTileIds: clearTileTombstones,
        clearTombstoneAlbumIds: clearAlbumTombstones,
      });
    } finally {
      applyingRemote = false;
    }
  }
}

/** Builds the local TileItem for a remote row, downloading the image into
 * IndexedDB when it lives in storage. Falls back to the remote-ref string if
 * the download fails (the grid will show a placeholder; next sync retries). */
async function materializeRemoteTile(row: TileRow): Promise<TileItem> {
  if (!row.image_ref.startsWith(STORAGE_REF_PREFIX)) {
    return rowToTile(row, row.image_ref);
  }
  const path = row.image_ref.slice(STORAGE_REF_PREFIX.length);
  const supabase = getSupabase();
  try {
    const existing = await loadTileBlob(row.id);
    if (!existing && supabase) {
      const { data, error } = await supabase.storage.from(BUCKET).download(path);
      if (error || !data) throw error ?? new Error("empty download");
      await saveTileBlob(row.id, data);
    }
    return rowToTile(row, idToIdbRef(row.id));
  } catch {
    return rowToTile(row, idToIdbRef(row.id));
  }
}
