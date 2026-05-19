import { describe, it, expect, beforeEach } from "vitest";

const STORAGE_KEY = "tile-tales-state";

function seedStore(tiles: unknown[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ tiles, wallpapers: [] })
  );
}

describe("store.loadState migration", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset the module so loadState() runs fresh against this localStorage.
    return import("vitest").then(({ vi }) => vi.resetModules());
  });

  it("filters out tiles whose file is a dead blob: URL and reports purgedCount", async () => {
    seedStore([
      { id: "t1", name: "Good A", file: "/tiles/a.webp", memory: "", date: "", tags: [], favorite: false },
      { id: "t2", name: "Broken", file: "blob:https://example/abc-123", memory: "", date: "", tags: [], favorite: false },
      { id: "t3", name: "Good B", file: "idb:tile-3", memory: "", date: "", tags: [], favorite: false },
    ]);

    const store = await import("./store");
    const tiles = store.getState().tiles;
    expect(tiles.map((t) => t.id)).toEqual(["t1", "t3"]);
    expect(store.getInitialPurgedCount()).toBe(1);
  });

  it("generateTileId produces unique ids", async () => {
    const store = await import("./store");
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(store.generateTileId());
    expect(ids.size).toBe(100);
  });
});
