"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import SplashScreen from "@/components/SplashScreen";
import TileGrid from "@/components/TileGrid";
import CropModal from "@/components/CropModal";
import WallpaperGenerator from "@/components/WallpaperGenerator";
import ScreenTransition from "@/components/ScreenTransition";
import { addTile, generateTileId } from "@/lib/store";

const TileMap = dynamic(() => import("@/components/TileMap"), { ssr: false });
const TileViewer3D = dynamic(() => import("@/components/TileViewer3D"), { ssr: false });
const CameraScanner = dynamic(() => import("@/components/CameraScanner"), { ssr: false });

const MIN_SPLASH_MS = 2500;

type Screen =
  | { type: "splash" }
  | { type: "grid" }
  | { type: "viewer"; initialIndex: number }
  | { type: "wallpaper" }
  | { type: "map" };

function requestGeolocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ type: "splash" });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingCropImage, setPendingCropImage] = useState<string | null>(null);
  const pendingGeo = useRef<{ lat: number; lng: number } | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Splash timer
  useEffect(() => {
    if (screen.type !== "splash") return;
    const timeout = setTimeout(() => {
      const fadeOut = (window as unknown as Record<string, (() => void) | undefined>).__splashFadeOut;
      if (fadeOut) fadeOut();
    }, MIN_SPLASH_MS);
    return () => clearTimeout(timeout);
  }, [screen.type]);

  const handleTakePhoto = useCallback(() => {
    setCameraOpen(true);
    requestGeolocation().then((geo) => { pendingGeo.current = geo; });
  }, []);

  const handleGalleryCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingCropImage(URL.createObjectURL(file));
    e.target.value = "";
    requestGeolocation().then((geo) => { pendingGeo.current = geo; });
  }, []);

  const saveTile = useCallback((url: string) => {
    const id = generateTileId();
    const geo = pendingGeo.current;
    addTile({
      id, name: "New tile", file: url, memory: "", date: "", tags: [], favorite: false,
      ...(geo ? { lat: geo.lat, lng: geo.lng } : {}),
    });
    pendingGeo.current = null;
  }, []);

  const handleScanConfirm = useCallback((warpedUrl: string) => {
    saveTile(warpedUrl);
    setCameraOpen(false);
  }, [saveTile]);

  const handleScanCancel = useCallback(() => {
    setCameraOpen(false);
  }, []);

  const handleCropConfirm = useCallback((croppedUrl: string) => {
    saveTile(croppedUrl);
    if (pendingCropImage) URL.revokeObjectURL(pendingCropImage);
    setPendingCropImage(null);
  }, [pendingCropImage, saveTile]);

  const handleCropCancel = useCallback(() => {
    if (pendingCropImage) URL.revokeObjectURL(pendingCropImage);
    setPendingCropImage(null);
  }, [pendingCropImage]);

  return (
    <>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleGalleryCapture}
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
                onTakePhoto={handleTakePhoto}
                onChooseLibrary={() => galleryInputRef.current?.click()}
                onOpenWallpaper={() => setScreen({ type: "wallpaper" })}
                onOpenMap={() => setScreen({ type: "map" })}
              />
              {pendingCropImage && (
                <CropModal
                  imageUrl={pendingCropImage}
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

      {cameraOpen && (
        <CameraScanner onConfirm={handleScanConfirm} onCancel={handleScanCancel} />
      )}
    </>
  );
}
