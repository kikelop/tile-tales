"use client";

const DB_NAME = "tile-tales";
const DB_VERSION = 1;
const STORE = "tile-blobs";
export const IDB_PREFIX = "idb:";
export const STORAGE_FAILURE_EVENT = "tile-tales-storage-failure";

let dbPromise: Promise<IDBDatabase> | null = null;
let warnedStorage = false;

function notifyStorageFailure() {
  if (warnedStorage) return;
  warnedStorage = true;
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(STORAGE_FAILURE_EVENT));
  } catch {}
}

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    notifyStorageFailure();
    return Promise.reject(new Error("IndexedDB not available"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      notifyStorageFailure();
      reject(req.error);
    };
    req.onblocked = () => {
      notifyStorageFailure();
      reject(new Error("IndexedDB blocked"));
    };
  });
  return dbPromise;
}

export async function saveTileBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadTileBlob(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTileBlob(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // best-effort cleanup
  }
}

// In-memory cache of object URLs so we don't recreate one per render.
const urlCache = new Map<string, string>();
const pendingUrls = new Map<string, Promise<string | null>>();

export async function getTileBlobUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const pending = pendingUrls.get(id);
  if (pending) return pending;
  const promise = (async () => {
    try {
      const blob = await loadTileBlob(id);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urlCache.set(id, url);
      return url;
    } catch {
      return null;
    } finally {
      pendingUrls.delete(id);
    }
  })();
  pendingUrls.set(id, promise);
  return promise;
}

export function revokeTileBlobUrl(id: string): void {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

export function isIdbRef(file: string): boolean {
  return file.startsWith(IDB_PREFIX);
}

export function idbRefToId(file: string): string {
  return file.slice(IDB_PREFIX.length);
}

export function idToIdbRef(id: string): string {
  return `${IDB_PREFIX}${id}`;
}
