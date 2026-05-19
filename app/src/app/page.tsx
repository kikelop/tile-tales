"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import SplashScreen from "@/components/SplashScreen";
import TileGrid from "@/components/TileGrid";
import CropModal from "@/components/CropModal";
import WallpaperGenerator from "@/components/WallpaperGenerator";
import ScreenTransition from "@/components/ScreenTransition";
import { useCaptureTile } from "@/lib/useCaptureTile";

const TileMap = dynamic(() => import("@/components/TileMap"), { ssr: false });
const TileViewer3D = dynamic(() => import("@/components/TileViewer3D"), { ssr: false });
const Albums = dynamic(() => import("@/components/Albums"), { ssr: false });
const AlbumDetail = dynamic(() => import("@/components/Albums").then((m) => ({ default: m.AlbumDetail })), { ssr: false });

const MIN_SPLASH_MS = 2500;

type Screen =
  | { type: "splash" }
  | { type: "grid" }
  | { type: "viewer"; initialIndex: number }
  | { type: "wallpaper" }
  | { type: "map" }
  | { type: "albums" }
  | { type: "album"; id: string };

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ type: "splash" });
  const {
    pendingImage,
    cameraInputRef,
    galleryInputRef,
    handleCapture,
    handleCropConfirm,
    handleCropCancel,
  } = useCaptureTile();

  useEffect(() => {
    if (screen.type !== "splash") return;
    const timeout = setTimeout(() => {
      const fadeOut = (window as unknown as Record<string, (() => void) | undefined>).__splashFadeOut;
      if (fadeOut) fadeOut();
    }, MIN_SPLASH_MS);
    return () => clearTimeout(timeout);
  }, [screen.type]);

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
                onOpenAlbums={() => setScreen({ type: "albums" })}
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

          {screen.type === "albums" && (
            <Albums
              onBack={() => setScreen({ type: "grid" })}
              onOpenAlbum={(id) => setScreen({ type: "album", id })}
            />
          )}

          {screen.type === "album" && (
            <AlbumDetail
              albumId={screen.id}
              onBack={() => setScreen({ type: "albums" })}
              onSelectTile={(index) => setScreen({ type: "viewer", initialIndex: index })}
            />
          )}
        </ScreenTransition>
      )}
    </>
  );
}
