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
}

export interface SavedWallpaper {
  id: string;
  dataUrl: string;
  createdAt: number;
}

const DEFAULT_TILES: TileItem[] = [
  { id: "t1", name: "Terrazzo Star", file: "/tiles/terrazzo-star.webp", memory: "", date: "", tags: ["geometric"], favorite: false, lat: 38.7223, lng: -9.1393 },
  { id: "t2", name: "Zellige Rose", file: "/tiles/zellige-rose.webp", memory: "", date: "", tags: ["floral", "artisan"], favorite: true, lat: 34.0331, lng: -5.0003 },
  { id: "t3", name: "Geometric Orange", file: "/tiles/geometric-orange.webp", memory: "", date: "", tags: ["geometric"], favorite: false, lat: 37.3891, lng: -5.9845 },
  { id: "t4", name: "Floral Green", file: "/tiles/floral-green.webp", memory: "", date: "", tags: ["floral"], favorite: true, lat: 41.1579, lng: -8.6291 },
  { id: "t5", name: "Floral Multicolor", file: "/tiles/floral-multicolor.webp", memory: "", date: "", tags: ["floral"], favorite: false, lat: 37.1773, lng: -3.5986 },
  { id: "t6", name: "Green Baroque", file: "/tiles/green-baroque.webp", memory: "", date: "", tags: ["classic", "geometric"], favorite: false, lat: 41.3874, lng: 2.1686 },
  { id: "t7", name: "Pink Marble", file: "/tiles/pink-marble.webp", memory: "", date: "", tags: ["marble"], favorite: false },
  { id: "t8", name: "Yellow Zellige", file: "/tiles/yellow-zellige.webp", memory: "", date: "", tags: ["artisan"], favorite: true, lat: 33.9716, lng: -6.8498 },
  { id: "t9", name: "Star Blue Gold", file: "/tiles/star-blue-gold.webp", memory: "", date: "", tags: ["geometric"], favorite: false, lat: 37.3891, lng: -5.9845 },
  { id: "t10", name: "Star Compass", file: "/tiles/star-compass.webp", memory: "", date: "", tags: ["geometric"], favorite: true, lat: 38.7223, lng: -9.1393 },
  { id: "t11", name: "Blue Floral Delft", file: "/tiles/blue-floral-delft.webp", memory: "", date: "", tags: ["floral", "classic"], favorite: true, lat: 52.0116, lng: 4.3571 },
  { id: "t12", name: "Fleur de Lis", file: "/tiles/fleur-de-lis-rust.webp", memory: "", date: "", tags: ["classic"], favorite: false, lat: 43.2630, lng: -2.9350 },
  { id: "t13", name: "Black Baroque", file: "/tiles/black-baroque.webp", memory: "", date: "", tags: ["classic"], favorite: false, lat: 41.3874, lng: 2.1686 },
  { id: "t14", name: "Ochre Scrollwork", file: "/tiles/ochre-scrollwork.webp", memory: "", date: "", tags: ["classic", "floral"], favorite: false, lat: 40.4168, lng: -3.7038 },
];

const STORAGE_KEY = "tile-tales-state";

type Listener = () => void;
const listeners = new Set<Listener>();

// Load from localStorage or use defaults
function loadState(): { tiles: TileItem[]; wallpapers: SavedWallpaper[] } {
  if (typeof window === "undefined") return { tiles: DEFAULT_TILES, wallpapers: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migration: drop tiles with dead blob URLs (pre-IDB captures that
      // can't be recovered), ensure fields exist, normalize legacy paths.
      const tiles = (parsed.tiles || [])
        .filter((t: TileItem) => typeof t?.file === "string" && !t.file.startsWith("blob:"))
        .map((t: TileItem) => ({
          ...t,
          tags: t.tags || [],
          favorite: t.favorite ?? false,
          file: t.file.replace(/\.png$/, ".webp"),
        }));
      return { tiles, wallpapers: parsed.wallpapers || [] };
    }
  } catch {}
  return { tiles: DEFAULT_TILES, wallpapers: [] };
}

function saveState() {
  if (typeof window === "undefined") return;
  try {
    // Don't persist wallpaper dataUrls if too large (>5MB total)
    const wpToSave = state.wallpapers.slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tiles: state.tiles, wallpapers: wpToSave }));
  } catch {}
}

let state = loadState();

export function getState() {
  return state;
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
    tiles: state.tiles.map((t) => (t.id === id ? { ...t, ...updates } : t)),
  };
  notify();
}

export function deleteTile(id: string) {
  state = {
    ...state,
    tiles: state.tiles.filter((t) => t.id !== id),
  };
  notify();
}

export function toggleFavorite(id: string) {
  state = {
    ...state,
    tiles: state.tiles.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)),
  };
  notify();
}

export function getAllTags(): string[] {
  const tagSet = new Set<string>();
  state.tiles.forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)));
  return Array.from(tagSet).sort();
}

export function addTile(tile: TileItem) {
  state = { ...state, tiles: [...state.tiles, tile] };
  notify();
}

export function addWallpaper(dataUrl: string): SavedWallpaper {
  const wp: SavedWallpaper = { id: `wp-${Date.now()}`, dataUrl, createdAt: Date.now() };
  state = { ...state, wallpapers: [wp, ...state.wallpapers] };
  notify();
  return wp;
}

let nextId = state.tiles.length + 1;
export function generateTileId() {
  return `t${nextId++}`;
}
