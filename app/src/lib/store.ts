export interface TileItem {
  id: string;
  name: string;
  file: string;
  memory: string;
  date: string;
  tags: string[];
  favorite: boolean;
  lat?: number;
  lng?: number;
  /** ms epoch of the last local mutation — drives last-write-wins sync. */
  updatedAt?: number;
}

export interface SavedWallpaper {
  id: string;
  dataUrl: string;
  createdAt: number;
}

export interface Album {
  id: string;
  name: string;
  tileIds: string[];
  createdAt: number;
  /** ms epoch of the last local mutation — drives last-write-wins sync. */
  updatedAt?: number;
}

/** Tombstones for deletions, so sync can propagate them to other devices. */
export interface Tombstones {
  tiles: Record<string, number>; // id -> deletedAt (ms epoch)
  albums: Record<string, number>;
}

// Order matters: TileGrid's default "recent" sort REVERSES this array, so the
// last entry here renders first in the grid and is the hero tile the 3D viewer
// opens on. Strongest, most symmetric tile (Star Compass) is kept last on purpose.
// "Floral Multicolor" was removed — its source asset carried a stock watermark.
const DEFAULT_TILES: TileItem[] = [
  { id: "t7", name: "Pink Marble", file: "/tiles/pink-marble.webp", memory: "", date: "", tags: ["marble"], favorite: false },
  { id: "t4", name: "Floral Green", file: "/tiles/floral-green.webp", memory: "", date: "", tags: ["floral"], favorite: false, lat: 41.1579, lng: -8.6291 },
  { id: "t12", name: "Fleur de Lis", file: "/tiles/fleur-de-lis-rust.webp", memory: "", date: "", tags: ["classic"], favorite: false, lat: 43.2630, lng: -2.9350 },
  { id: "t1", name: "Terrazzo Star", file: "/tiles/terrazzo-star.webp", memory: "", date: "", tags: ["geometric"], favorite: false, lat: 38.7223, lng: -9.1393 },
  { id: "t8", name: "Yellow Zellige", file: "/tiles/yellow-zellige.webp", memory: "", date: "", tags: ["artisan"], favorite: true, lat: 33.9716, lng: -6.8498 },
  { id: "t13", name: "Black Baroque", file: "/tiles/black-baroque.webp", memory: "", date: "", tags: ["classic"], favorite: false, lat: 41.3874, lng: 2.1686 },
  { id: "t3", name: "Geometric Orange", file: "/tiles/geometric-orange.webp", memory: "", date: "", tags: ["geometric"], favorite: false, lat: 37.3891, lng: -5.9845 },
  { id: "t6", name: "Green Baroque", file: "/tiles/green-baroque.webp", memory: "", date: "", tags: ["classic", "geometric"], favorite: false, lat: 41.3874, lng: 2.1686 },
  { id: "t14", name: "Ochre Scrollwork", file: "/tiles/ochre-scrollwork.webp", memory: "", date: "", tags: ["classic", "floral"], favorite: false, lat: 40.4168, lng: -3.7038 },
  { id: "t9", name: "Star Blue Gold", file: "/tiles/star-blue-gold.webp", memory: "", date: "", tags: ["geometric"], favorite: true, lat: 37.3891, lng: -5.9845 },
  { id: "t2", name: "Zellige Rose", file: "/tiles/zellige-rose.webp", memory: "", date: "", tags: ["floral", "artisan"], favorite: true, lat: 34.0331, lng: -5.0003 },
  { id: "t11", name: "Blue Floral Delft", file: "/tiles/blue-floral-delft.webp", memory: "", date: "", tags: ["floral", "classic"], favorite: true, lat: 52.0116, lng: 4.3571 },
  { id: "t10", name: "Star Compass", file: "/tiles/star-compass.webp", memory: "", date: "", tags: ["geometric"], favorite: true, lat: 38.7223, lng: -9.1393 },
];

const STORAGE_KEY = "tile-tales-state";

type Listener = () => void;
const listeners = new Set<Listener>();

// Load from localStorage or use defaults
function loadState(): {
  tiles: TileItem[];
  wallpapers: SavedWallpaper[];
  albums: Album[];
  deleted: Tombstones;
  purgedCount: number;
} {
  const empty = { tiles: DEFAULT_TILES, wallpapers: [], albums: [], deleted: { tiles: {}, albums: {} }, purgedCount: 0 };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const rawTiles = (parsed.tiles || []) as TileItem[];
      // Migration: drop tiles with dead blob URLs (pre-IDB captures that
      // can't be recovered), ensure fields exist, normalize legacy paths.
      const tiles = rawTiles
        .filter((t) => typeof t?.file === "string" && !t.file.startsWith("blob:"))
        .map((t) => ({
          ...t,
          tags: t.tags || [],
          favorite: t.favorite ?? false,
          file: t.file.replace(/\.png$/, ".webp"),
        }));
      const purgedCount = rawTiles.length - tiles.length;
      const validIds = new Set(tiles.map((t) => t.id));
      const albums = ((parsed.albums || []) as Album[]).map((a) => ({
        ...a,
        tileIds: (a.tileIds || []).filter((tid) => validIds.has(tid)),
      }));
      return {
        tiles,
        wallpapers: parsed.wallpapers || [],
        albums,
        deleted: {
          tiles: parsed.deleted?.tiles || {},
          albums: parsed.deleted?.albums || {},
        },
        purgedCount,
      };
    }
  } catch {}
  return empty;
}

function saveState() {
  if (typeof window === "undefined") return;
  try {
    // Don't persist wallpaper dataUrls if too large (>5MB total)
    const wpToSave = state.wallpapers.slice(0, 10);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tiles: state.tiles, wallpapers: wpToSave, albums: state.albums, deleted: state.deleted })
    );
  } catch {}
}

const initialLoad = loadState();
let state: { tiles: TileItem[]; wallpapers: SavedWallpaper[]; albums: Album[]; deleted: Tombstones } = {
  tiles: initialLoad.tiles,
  wallpapers: initialLoad.wallpapers,
  albums: initialLoad.albums,
  deleted: initialLoad.deleted,
};
const initialPurgedCount = initialLoad.purgedCount;

export function getState() {
  return state;
}

export function getInitialPurgedCount(): number {
  return initialPurgedCount;
}

function notify() {
  listeners.forEach((l) => l());
  saveState();
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateTile(id: string, updates: Partial<Omit<TileItem, "id">>) {
  state = {
    ...state,
    tiles: state.tiles.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t)),
  };
  notify();
}

export function deleteTile(id: string) {
  const now = Date.now();
  state = {
    ...state,
    tiles: state.tiles.filter((t) => t.id !== id),
    albums: state.albums.map((a) =>
      a.tileIds.includes(id)
        ? { ...a, tileIds: a.tileIds.filter((tid) => tid !== id), updatedAt: now }
        : a
    ),
    deleted: { ...state.deleted, tiles: { ...state.deleted.tiles, [id]: now } },
  };
  notify();
}

export function toggleFavorite(id: string) {
  state = {
    ...state,
    tiles: state.tiles.map((t) =>
      t.id === id ? { ...t, favorite: !t.favorite, updatedAt: Date.now() } : t
    ),
  };
  notify();
}

export function getAllTags(): string[] {
  const tagSet = new Set<string>();
  state.tiles.forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)));
  return Array.from(tagSet).sort();
}

export function addTile(tile: TileItem) {
  state = { ...state, tiles: [...state.tiles, { ...tile, updatedAt: tile.updatedAt ?? Date.now() }] };
  notify();
}

/** Merges imported tiles and albums into the current state, skipping any whose
 * id already exists (so restoring a backup is idempotent). Blobs for captured
 * tiles must already be written to IDB by the caller. */
export function importData(incoming: { tiles: TileItem[]; albums: Album[] }): {
  addedTiles: number;
  addedAlbums: number;
} {
  const tileIds = new Set(state.tiles.map((t) => t.id));
  const newTiles = (incoming.tiles || []).filter((t) => t?.id && !tileIds.has(t.id));
  const albumIds = new Set(state.albums.map((a) => a.id));
  const newAlbums = (incoming.albums || []).filter((a) => a?.id && !albumIds.has(a.id));
  state = {
    ...state,
    tiles: [...state.tiles, ...newTiles],
    albums: [...state.albums, ...newAlbums],
  };
  notify();
  return { addedTiles: newTiles.length, addedAlbums: newAlbums.length };
}

export function addWallpaper(dataUrl: string): SavedWallpaper {
  const wp: SavedWallpaper = { id: `wp-${Date.now()}`, dataUrl, createdAt: Date.now() };
  state = { ...state, wallpapers: [wp, ...state.wallpapers] };
  notify();
  return wp;
}

export function generateTileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `t-${crypto.randomUUID()}`;
  }
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- Albums ---

function generateAlbumId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `a-${crypto.randomUUID()}`;
  }
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addAlbum(name: string): Album {
  const now = Date.now();
  const album: Album = {
    id: generateAlbumId(),
    name: name.trim() || "Untitled album",
    tileIds: [],
    createdAt: now,
    updatedAt: now,
  };
  state = { ...state, albums: [album, ...state.albums] };
  notify();
  return album;
}

export function renameAlbum(id: string, name: string) {
  state = {
    ...state,
    albums: state.albums.map((a) =>
      a.id === id ? { ...a, name: name.trim() || a.name, updatedAt: Date.now() } : a
    ),
  };
  notify();
}

export function deleteAlbum(id: string) {
  state = {
    ...state,
    albums: state.albums.filter((a) => a.id !== id),
    deleted: { ...state.deleted, albums: { ...state.deleted.albums, [id]: Date.now() } },
  };
  notify();
}

/** Adds the tile to the album if missing; removes it if already present. */
export function toggleTileInAlbum(albumId: string, tileId: string) {
  state = {
    ...state,
    albums: state.albums.map((a) => {
      if (a.id !== albumId) return a;
      const has = a.tileIds.includes(tileId);
      return {
        ...a,
        tileIds: has ? a.tileIds.filter((t) => t !== tileId) : [...a.tileIds, tileId],
        updatedAt: Date.now(),
      };
    }),
  };
  notify();
}

export function getAlbumsForTile(tileId: string): Album[] {
  return state.albums.filter((a) => a.tileIds.includes(tileId));
}

// --- Sync support ---

export function getTombstones(): Tombstones {
  return state.deleted;
}

/** Applies a batch of remote changes in one state update + one notify.
 * Upserted items keep the remote updatedAt (no local re-stamping) so they
 * aren't considered dirty by the next push cycle. Local deletions performed
 * here do NOT create tombstones (the remote is already the source). */
export function applyRemoteChanges(changes: {
  upsertTiles?: TileItem[];
  upsertAlbums?: Album[];
  deleteTileIds?: string[];
  deleteAlbumIds?: string[];
  clearTombstoneTileIds?: string[];
  clearTombstoneAlbumIds?: string[];
}) {
  const deleteTiles = new Set(changes.deleteTileIds || []);
  const deleteAlbums = new Set(changes.deleteAlbumIds || []);
  const upsertTileMap = new Map((changes.upsertTiles || []).map((t) => [t.id, t]));
  const upsertAlbumMap = new Map((changes.upsertAlbums || []).map((a) => [a.id, a]));

  // Updates keep their array position (order is semantic: grid's "recent"
  // sort reverses the array); only genuinely new items are appended.
  const existingTileIds = new Set(state.tiles.map((t) => t.id));
  const tiles = [
    ...state.tiles
      .filter((t) => !deleteTiles.has(t.id))
      .map((t) => upsertTileMap.get(t.id) ?? t),
    ...[...upsertTileMap.values()].filter((t) => !existingTileIds.has(t.id)),
  ];
  const validIds = new Set(tiles.map((t) => t.id));
  const existingAlbumIds = new Set(state.albums.map((a) => a.id));
  const albums = [
    ...state.albums
      .filter((a) => !deleteAlbums.has(a.id))
      .map((a) => upsertAlbumMap.get(a.id) ?? a),
    ...[...upsertAlbumMap.values()].filter((a) => !existingAlbumIds.has(a.id)),
  ].map((a) => ({ ...a, tileIds: a.tileIds.filter((tid) => validIds.has(tid)) }));

  const deletedTiles = { ...state.deleted.tiles };
  (changes.clearTombstoneTileIds || []).forEach((id) => delete deletedTiles[id]);
  const deletedAlbums = { ...state.deleted.albums };
  (changes.clearTombstoneAlbumIds || []).forEach((id) => delete deletedAlbums[id]);

  state = { ...state, tiles, albums, deleted: { tiles: deletedTiles, albums: deletedAlbums } };
  notify();
}
