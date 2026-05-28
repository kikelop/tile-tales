import { describe, it, expect, beforeEach, vi } from "vitest";
import JSZip from "jszip";

describe("backup", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("exportCollection produces a ZIP with a parseable manifest", async () => {
    const { exportCollection } = await import("./backup");
    const { getState } = await import("./store");

    const blob = await exportCollection();
    const zip = await JSZip.loadAsync(blob);
    const manifestFile = zip.file("collection.json");
    expect(manifestFile).not.toBeNull();

    const manifest = JSON.parse(await manifestFile!.async("string"));
    expect(manifest.version).toBe(1);
    expect(Array.isArray(manifest.tiles)).toBe(true);
    expect(manifest.tiles.length).toBe(getState().tiles.length);
  });

  it("importCollection merges sample tiles from a hand-built backup", async () => {
    const { importCollection } = await import("./backup");
    const { getState } = await import("./store");
    const before = getState().tiles.length;

    const zip = new JSZip();
    zip.file(
      "collection.json",
      JSON.stringify({
        version: 1,
        exportedAt: "2026-05-28T00:00:00.000Z",
        tiles: [
          { id: "bk-1", name: "Restored", file: "/tiles/restored.webp", memory: "", date: "", tags: ["geometric"], favorite: false },
        ],
        albums: [{ id: "bk-alb", name: "Backup album", tileIds: ["bk-1"], createdAt: 1 }],
      })
    );
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const file = new File([zipBlob], "backup.zip", { type: "application/zip" });

    const res = await importCollection(file);
    expect(res).toEqual({ addedTiles: 1, addedAlbums: 1 });
    expect(getState().tiles.length).toBe(before + 1);
    expect(getState().tiles.some((t) => t.id === "bk-1")).toBe(true);
  });

  it("importCollection drops captured tiles whose blob is missing from the ZIP", async () => {
    const { importCollection } = await import("./backup");
    const { getState } = await import("./store");
    const before = getState().tiles.length;

    const zip = new JSZip();
    zip.file(
      "collection.json",
      JSON.stringify({
        version: 1,
        exportedAt: "2026-05-28T00:00:00.000Z",
        tiles: [
          // idb ref but no blobs/<id> entry → unrenderable, must be skipped
          { id: "ghost", name: "Ghost", file: "idb:ghost", memory: "", date: "", tags: [], favorite: false },
        ],
        albums: [],
      })
    );
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const file = new File([zipBlob], "backup.zip", { type: "application/zip" });

    const res = await importCollection(file);
    expect(res.addedTiles).toBe(0);
    expect(getState().tiles.length).toBe(before);
  });

  it("importCollection rejects a ZIP without a manifest", async () => {
    const { importCollection } = await import("./backup");
    const zip = new JSZip();
    zip.file("random.txt", "not a backup");
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const file = new File([zipBlob], "x.zip", { type: "application/zip" });

    await expect(importCollection(file)).rejects.toThrow();
  });
});
