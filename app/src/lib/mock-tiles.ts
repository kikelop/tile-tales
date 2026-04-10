export interface Tile {
  id: string;
  title: string;
  location: string;
  date: string;
  image: string;
  color: string;
  tags: string[];
}

export const mockTiles: Tile[] = [
  {
    id: "1",
    title: "Azulejo Pombalino",
    location: "Lisboa, Portugal",
    date: "2026-02-14",
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=600&fit=crop",
    color: "#2563eb",
    tags: ["azul", "geometrico", "historico"],
  },
  {
    id: "2",
    title: "Mosaico Nazari",
    location: "Granada, Espana",
    date: "2026-01-20",
    image: "https://images.unsplash.com/photo-1590674899484-13da0f971093?w=600&h=600&fit=crop",
    color: "#059669",
    tags: ["verde", "arabesco", "alhambra"],
  },
  {
    id: "3",
    title: "Ceramica Sevillana",
    location: "Sevilla, Espana",
    date: "2026-03-01",
    image: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&h=600&fit=crop",
    color: "#d97706",
    tags: ["amarillo", "floral", "triana"],
  },
  {
    id: "4",
    title: "Azulejo Art Nouveau",
    location: "Porto, Portugal",
    date: "2025-12-10",
    image: "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=600&h=600&fit=crop",
    color: "#7c3aed",
    tags: ["morado", "art nouveau", "floral"],
  },
  {
    id: "5",
    title: "Mosaico Hidraulico",
    location: "Barcelona, Espana",
    date: "2026-02-28",
    image: "https://images.unsplash.com/photo-1604076913837-52ab5f7c1ae4?w=600&h=600&fit=crop",
    color: "#dc2626",
    tags: ["rojo", "geometrico", "modernista"],
  },
  {
    id: "6",
    title: "Zellige Marroqui",
    location: "Fez, Marruecos",
    date: "2025-11-15",
    image: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=600&h=600&fit=crop",
    color: "#0891b2",
    tags: ["turquesa", "zellige", "artesanal"],
  },
  {
    id: "7",
    title: "Iznik Otomano",
    location: "Estambul, Turquia",
    date: "2026-03-15",
    image: "https://images.unsplash.com/photo-1570939274717-7eda259b50ed?w=600&h=600&fit=crop",
    color: "#1d4ed8",
    tags: ["azul", "floral", "iznik"],
  },
  {
    id: "8",
    title: "Talavera Poblana",
    location: "Puebla, Mexico",
    date: "2026-01-05",
    image: "https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=600&h=600&fit=crop",
    color: "#2563eb",
    tags: ["azul", "blanco", "colonial"],
  },
];
