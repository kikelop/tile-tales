"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { addTile, updateTile, generateTileId, getState } from "./store";
import { readGeoForCapture, type GeoPoint } from "./geo";
import { saveTileBlob, idToIdbRef } from "./blob-storage";
import { toast } from "./toast";

interface UseCaptureTileOptions {
  /** Build the tile's display name from the current count. */
  getTileName?: (count: number) => string;
  /** Called with the new tile id after addTile. */
  afterAdd?: (id: string) => void;
}

/** One image waiting to go through the crop modal, with its geo read already
 * in flight (EXIF for gallery, GPS for camera) so it resolves while the user
 * crops. */
interface QueueItem {
  url: string;
  geo: Promise<GeoPoint | null> | null;
}

/**
 * Shared capture flow used by both the grid (page.tsx) and the viewer
 * (TileViewer3D.tsx). Owns a QUEUE of pending images so a multi-select gallery
 * import walks the crop modal one tile at a time. Per item it owns: the blob
 * URL for the crop preview, the geolocation promise running in parallel with
 * the crop, IDB persistence of the cropped blob, and the resulting addTile +
 * lat/lng patch when geo resolves.
 */
export function useCaptureTile(opts: UseCaptureTileOptions = {}) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { getTileName, afterAdd } = opts;

  const pendingImage = queue[0]?.url ?? null;
  const queueCount = queue.length;

  const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const source = (e.currentTarget.dataset.source as "camera" | "gallery") || "camera";
    const items: QueueItem[] = files.map((file) => ({
      url: URL.createObjectURL(file),
      geo: readGeoForCapture(file, source),
    }));
    setQueue((prev) => [...prev, ...items]);
    e.target.value = "";
  }, []);

  // Revoke the head's preview URL and drop it from the queue.
  const dropHead = useCallback(() => {
    setQueue((prev) => {
      if (prev[0]) URL.revokeObjectURL(prev[0].url);
      return prev.slice(1);
    });
  }, []);

  const handleCropConfirm = useCallback(
    async (blob: Blob) => {
      const item = queueRef.current[0];
      const geoPromise = item?.geo ?? null;
      const remaining = queueRef.current.length - 1;

      const id = generateTileId();
      let saved = false;
      try {
        await saveTileBlob(id, blob);
        saved = true;
      } catch {
        toast("Couldn't save image");
      }
      dropHead();
      if (!saved) return;

      const count = getState().tiles.length;
      const name = getTileName ? getTileName(count) : "New tile";
      addTile({
        id,
        name,
        file: idToIdbRef(id),
        memory: "",
        date: "",
        tags: [],
        favorite: false,
      });
      if (geoPromise) {
        void geoPromise.then((geo) => {
          if (geo) updateTile(id, { lat: geo.lat, lng: geo.lng });
        });
      }
      afterAdd?.(id);
      toast(remaining > 0 ? `Tile saved · ${remaining} left` : "Tile saved");
    },
    [getTileName, afterAdd, dropHead]
  );

  // Cancel skips the current image and advances to the next in the queue.
  const handleCropCancel = useCallback(() => {
    dropHead();
  }, [dropHead]);

  return {
    pendingImage,
    queueCount,
    cameraInputRef,
    galleryInputRef,
    handleCapture,
    handleCropConfirm,
    handleCropCancel,
  };
}
