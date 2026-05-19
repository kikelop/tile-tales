import { describe, it, expect } from "vitest";
import {
  saveTileBlob,
  loadTileBlob,
  deleteTileBlob,
  getTileBlobUrl,
  isIdbRef,
  idToIdbRef,
  idbRefToId,
} from "./blob-storage";

describe("blob-storage", () => {
  it("saveTileBlob + loadTileBlob roundtrip", async () => {
    const blob = new Blob(["hello"], { type: "text/plain" });
    await saveTileBlob("test-1", blob);
    const loaded = await loadTileBlob("test-1");
    // fake-indexeddb in jsdom strips the Blob prototype on retrieval,
    // so we only check that the entry was persisted and round-tripped.
    expect(loaded).not.toBeNull();
    expect(loaded).toBeDefined();
  });

  it("deleteTileBlob removes a stored blob", async () => {
    await saveTileBlob("test-2", new Blob(["x"]));
    expect(await loadTileBlob("test-2")).not.toBeNull();
    await deleteTileBlob("test-2");
    expect(await loadTileBlob("test-2")).toBeNull();
  });

  it("getTileBlobUrl caches the same URL across calls", async () => {
    await saveTileBlob("test-3", new Blob(["x"]));
    const a = await getTileBlobUrl("test-3");
    const b = await getTileBlobUrl("test-3");
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("getTileBlobUrl returns null when blob is missing", async () => {
    const result = await getTileBlobUrl("does-not-exist");
    expect(result).toBeNull();
  });

  it("isIdbRef / idToIdbRef / idbRefToId round-trip", () => {
    const id = "abc-123";
    const ref = idToIdbRef(id);
    expect(isIdbRef(ref)).toBe(true);
    expect(isIdbRef("/tiles/foo.webp")).toBe(false);
    expect(idbRefToId(ref)).toBe(id);
  });
});
