export interface TileItem {
  id: string;
  name: string;
  file: string;
  memory: string;
  date: string;
}

const DEFAULT_TILES: TileItem[] = [
  { id: "t1", name: "Terrazzo Star", file: "/tiles/terrazzo-star.png", memory: "", date: "" },
  { id: "t2", name: "Zellige Rose", file: "/tiles/zellige-rose.png", memory: "", date: "" },
  { id: "t3", name: "Geometric Orange", file: "/tiles/geometric-orange.png", memory: "", date: "" },
  { id: "t4", name: "Floral Green", file: "/tiles/floral-green.png", memory: "", date: "" },
  { id: "t5", name: "Floral Multicolor", file: "/tiles/floral-multicolor.png", memory: "", date: "" },
  { id: "t6", name: "Green Baroque", file: "/tiles/green-baroque.png", memory: "", date: "" },
  { id: "t7", name: "Pink Marble", file: "/tiles/pink-marble.png", memory: "", date: "" },
  { id: "t8", name: "Yellow Zellige", file: "/tiles/yellow-zellige.png", memory: "", date: "" },
  { id: "t9", name: "Star Blue Gold", file: "/tiles/star-blue-gold.png", memory: "", date: "" },
  { id: "t10", name: "Star Compass", file: "/tiles/star-compass.png", memory: "", date: "" },
  { id: "t11", name: "Blue Floral Delft", file: "/tiles/blue-floral-delft.png", memory: "", date: "" },
  { id: "t12", name: "Fleur de Lis", file: "/tiles/fleur-de-lis-rust.png", memory: "", date: "" },
  { id: "t13", name: "Black Baroque", file: "/tiles/black-baroque.png", memory: "", date: "" },
  { id: "t14", name: "Ochre Scrollwork", file: "/tiles/ochre-scrollwork.png", memory: "", date: "" },
];

type Listener = () => void;
const listeners = new Set<Listener>();

let state = {
  tiles: DEFAULT_TILES,
};

export function getState() {
  return state;
}

function notify() {
  listeners.forEach((l) => l());
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

export function addTile(tile: TileItem) {
  state = { ...state, tiles: [...state.tiles, tile] };
  notify();
}

let nextId = 15;
export function generateTileId() {
  return `t${nextId++}`;
}
