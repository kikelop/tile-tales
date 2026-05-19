"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import SplashScreen from "@/components/SplashScreen";
import TileGrid from "@/components/TileGrid";
import CropModal from "@/components/CropModal";
import WallpaperGenerator from "@/components/WallpaperGenerator";
import ScreenTransition from "@/components/ScreenTransition";
import { addTile, updateTile, generateTileId } from "@/lib/store";
import { toast } from "@/lib/toast";
import { readGeoForCapture, type GeoPoint } from "@/lib/geo";

const TileMap = dynamic(() => import("@/components/TileMap"), { ssr: false });
const TileViewer3D = dynamic(() => import("@/components/TileViewer3D"), { ssr: false });

const MIN_SPLASH_MS = 2500;

type Screen =
  | { type: "splash" }
  | { type: "grid" }
  | { type: "viewer"; initialIndex: number }
  | { type: "wallpaper" }
  | { type: "map" };

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ type: "splash" });
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const pendingGeo = useRef<Promise<GeoPoint | null> | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (screen.type !== "splash") return;
    const timeout = setTimeout(() => {
      const fadeOut = (window as unknown as Record<string, (() => void) | undefined>).__splashFadeOut;
      if (fadeOut) fadeOut();
    }, MIN_SPLASH_MS);
    return () => clearTimeout(timeout);
  }, [screen.type]);

  const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const source = (e.currentTarget.dataset.source as "camera" | "gallery") || "camera";
    setPendingImage(URL.createObjectURL(file));
    e.target.value = "";
    pendingGeo.current = readGeoForCapture(file, source);
  }, []);

  const handleCropConfirm = useCallback((croppedUrl: string) => {
    const id = generateTileId();
    addTile({
      id, name: "New tile", file: croppedUrl, memory: "", date: "", tags: [], favorite: false,
    });
    const geoPromise = pendingGeo.current;
    pendingGeo.current = null;
    if (geoPromise) {
      geoPromise.then((geo) => {
        if (geo) updateTile(id, { lat: geo.lat, lng: geo.lng });
      });
    }
    if (pendingImage) URL.revokeObjectURL(pendingImage);
    setPendingImage(null);
    toast("Tile saved");
  }, [pendingImage]);

  const handleCropCancel = useCallback(() => {
    if (pendingImage) URL.revokeObjectURL(pendingImage);
    setPendingImage(null);
  }, [pendingImage]);

  return (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        data-source="camera"
        onChange={handleCapture}
        style={{ display: "none" }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        data-source="gallery"
        onChange={handleCapture}
        style={{ display: "none" }}
      />

      {screen.type === "splash" && (
        <SplashScreen onFinished={() => setScreen({ type: "grid" })} />
      )}

      {screen.type !== "splash" && (
        <ScreenTransition screenKey={screen.type}>
          {screen.type === "grid" && (
            <>
              <TileGrid
                onSelectTile={(index) => setScreen({ type: "viewer", initialIndex: index })}
                onTakePhoto={() => cameraInputRef.current?.click()}
                onChooseLibrary={() => galleryInputRef.current?.click()}
                onOpenWallpaper={() => setScreen({ type: "wallpaper" })}
                onOpenMap={() => setScreen({ type: "map" })}
              />
              {pendingImage && (
                <CropModal
                  imageUrl={pendingImage}
                  onConfirm={handleCropConfirm}
                  onCancel={handleCropCancel}
                />
              )}
            </>
          )}

          {screen.type === "wallpaper" && (
            <WallpaperGenerator onBack={() => setScreen({ type: "grid" })} />
          )}

          {screen.type === "map" && (
            <TileMap
              onBack={() => setScreen({ type: "grid" })}
              onSelectTile={(index) => setScreen({ type: "viewer", initialIndex: index })}
            />
          )}

          {screen.type === "viewer" && (
            <TileViewer3D
              initialIndex={screen.initialIndex}
              onBack={() => setScreen({ type: "grid" })}
            />
          )}
        </ScreenTransition>
      )}
    </>
  );
}
