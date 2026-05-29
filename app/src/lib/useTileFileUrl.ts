"use client";

import { useState, useEffect } from "react";
import { getTileBlobUrl, isIdbRef, idbRefToId } from "./blob-storage";

/**
 * Resolves a tile.file string into a real URL.
 * - "/tiles/foo.webp" → returned as-is.
 * - "idb:<id>"        → async load from IndexedDB; returns null until ready or if missing.
 */
export function useTileFileUrl(file: string | undefined): string | null {
  const isIdb = !!file && isIdbRef(file);
  const [url, setUrl] = useState<string | null>(isIdb || !file ? null : file);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    if (!isIdbRef(file)) {
      setUrl(file);
      return;
    }
    let cancelled = false;
    setUrl(null);
    void getTileBlobUrl(idbRefToId(file)).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  return url;
}
