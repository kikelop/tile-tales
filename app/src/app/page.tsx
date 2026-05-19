"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import SplashScreen from "@/components/SplashScreen";
import TileGrid from "@/components/TileGrid";
import CropModal from "@/components/CropModal";
import ScanModal from "@/components/ScanModal";
import WallpaperGenerator from "@/components/WallpaperGenerator";
import ScreenTransition from "@/components/ScreenTransition";
import { addTile, generateTileId } from "@/lib/store";

const TileMap = dynamic(() => import("@/components/TileMap"), { ssr: false });
const TileViewer3D = dynamic(() => import("@/components/TileViewer3D"), { ssr: false });

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
  const [pendingScanImage, setPendingScanImage] = useState<string | null>(null);
  const [pendingCropImage, setPendingCropImage] = useState<string | null>(null);
  const pendingGeo = useRef<{ lat: number; lng: number } | null>(null);
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

  const handleCameraCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingScanImage(URL.createObjectURL(file));
    e.target.value = "";
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
    if (pendingScanImage) URL.revokeObjectURL(pendingScanImage);
    setPendingScanImage(null);
  }, [pendingScanImage, saveTile]);

  const handleScanCancel = useCallback(() => {
    if (pendingScanImage) URL.revokeObjectURL(pendingScanImage);
    setPendingScanImage(null);
  }, [pendingScanImage]);

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
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
        style={{ display: "none" }}
      />
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
                onTakePhoto={() => cameraInputRef.current?.click()}
                onChooseLibrary={() => galleryInputRef.current?.click()}
                onOpenWallpaper={() => setScreen({ type: "wallpaper" })}
                onOpenMap={() => setScreen({ type: "map" })}
              />
              {pendingScanImage && (
                <ScanModal
                  imageUrl={pendingScanImage}
                  onConfirm={handleScanConfirm}
                  onCancel={handleScanCancel}
                />
              )}
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
    </>
  );
}
