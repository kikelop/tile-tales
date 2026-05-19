import { describe, it, expect } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useTileFileUrl } from "./useTileFileUrl";
import { saveTileBlob, idToIdbRef } from "./blob-storage";

describe("useTileFileUrl", () => {
  it("returns static URLs synchronously for mock tile paths", () => {
    const { result } = renderHook(() => useTileFileUrl("/tiles/foo.webp"));
    expect(result.current).toBe("/tiles/foo.webp");
  });

  it("resolves idb: refs asynchronously after the blob is fetched", async () => {
    const id = "use-hook-1";
    await act(async () => {
      await saveTileBlob(id, new Blob(["x"], { type: "text/plain" }));
    });
    const { result } = renderHook(() => useTileFileUrl(idToIdbRef(id)));
    expect(result.current).toBeNull();
    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });
    expect(result.current).toMatch(/^blob:/);
  });
});
