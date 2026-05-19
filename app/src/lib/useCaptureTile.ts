"use client";

import { useState, useRef, useCallback } from "react";
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

/**
 * Shared capture flow used by both the grid (page.tsx) and the viewer
 * (TileViewer3D.tsx). Owns: pending blob URL for the crop preview, the
 * geolocation promise that runs in parallel with the user's crop, IDB
 * persistence of the cropped blob, and the resulting addTile + lat/lng
 * patch when geo resolves.
 */
export function useCaptureTile(opts: UseCaptureTileOptions = {}) {
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const pendingGeo = useRef<Promise<GeoPoint | null> | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { getTileName, afterAdd } = opts;

  const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const source = (e.currentTarget.dataset.source as "camera" | "gallery") || "camera";
    setPendingImage(URL.createObjectURL(file));
    e.target.value = "";
    pendingGeo.current = readGeoForCapture(file, source);
  }, []);

  const handleCropConfirm = useCallback(
    async (blob: Blob) => {
      const id = generateTileId();
      let saved = false;
      try {
        await saveTileBlob(id, blob);
        saved = true;
      } catch {
        toast("Couldn't save image");
      }
      // Revoke the crop preview URL whether or not the save succeeded.
      setPendingImage((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
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
      const geoPromise = pendingGeo.current;
      pendingGeo.current = null;
      if (geoPromise) {
        geoPromise.then((geo) => {
          if (geo) updateTile(id, { lat: geo.lat, lng: geo.lng });
        });
      }
      afterAdd?.(id);
      toast("Tile saved");
    },
    [getTileName, afterAdd]
  );

  const handleCropCancel = useCallback(() => {
    setPendingImage((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  return {
    pendingImage,
    cameraInputRef,
    galleryInputRef,
    handleCapture,
    handleCropConfirm,
    handleCropCancel,
  };
}
