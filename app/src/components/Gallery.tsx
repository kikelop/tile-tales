"use client";

import { useState } from "react";
import { mockTiles, type Tile } from "@/lib/mock-tiles";
import TileCard from "./TileCard";
import TileDetail from "./TileDetail";

export default function Gallery() {
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);

  return (
    <div style={{ perspective: "1200px" }}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mockTiles.map((tile, i) => (
          <TileCard
            key={tile.id}
            tile={tile}
            index={i}
            onSelect={setSelectedTile}
          />
        ))}
      </div>

      <TileDetail tile={selectedTile} onClose={() => setSelectedTile(null)} />
    </div>
  );
}
