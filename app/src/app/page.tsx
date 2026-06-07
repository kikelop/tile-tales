"use client";

import { useState, useEffect, useRef } from "react";
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
const ProfileView = dynamic(() => import("@/components/ProfileView"), { ssr: false });

const MIN_SPLASH_MS = 2500;

type Screen =
  | { type: "splash" }
  | { type: "grid" }
  | { type: "viewer"; initialIndex: number }
  | { type: "wallpaper" }
  | { type: "map" }
  | { type: "albums" }
  | { type: "album"; id: string }
  | { type: "profile"; tab?: "account" | "stats" };

// --- Hash-based deep linking ---------------------------------------------
// The app is a single client page; we mirror the active screen into the URL
// hash so a tile/album link can be shared and the browser back button works.

function screenToHash(s: Screen): string {
  switch (s.type) {
    case "viewer": return `#/tile/${s.initialIndex}`;
    case "wallpaper": return "#/wallpaper";
    case "map": return "#/map";
    case "albums": return "#/albums";
    case "album": return `#/album/${s.id}`;
    case "profile": return s.tab === "stats" ? "#/profile/stats" : "#/profile";
    case "grid":
    default: return "#/";
  }
}

function hashToScreen(hash: string): Screen {
  const h = hash.replace(/^#\/?/, "");
  const parts = h.split("/");
  switch (parts[0]) {
    case "tile": {
      const i = parseInt(parts[1], 10);
      return Number.isFinite(i) ? { type: "viewer", initialIndex: i } : { type: "grid" };
    }
    case "wallpaper": return { type: "wallpaper" };
    case "map": return { type: "map" };
    case "albums": return { type: "albums" };
    case "album": return parts[1] ? { type: "album", id: parts[1] } : { type: "albums" };
    case "profile": return { type: "profile", tab: parts[1] === "stats" ? "stats" : "account" };
    case "stats": return { type: "profile", tab: "stats" }; // legacy links
    default: return { type: "grid" };
  }
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>({ type: "splash" });
  const {
    pendingImage,
    queueCount,
    cameraInputRef,
    galleryInputRef,
    handleCapture,
    handleCropConfirm,
    handleCropCancel,
  } = useCaptureTile();

  // True when the next screen change came from a popstate (back/forward), so
  // the sync effect doesn't push a duplicate history entry.
  const skipPush = useRef(false);
  // First real navigation replaces history instead of pushing, so the back
  // button from the home grid exits cleanly rather than looping on "#/".
  const initialNav = useRef(true);

  useEffect(() => {
    if (screen.type !== "splash") return;
    const timeout = setTimeout(() => {
      const fadeOut = (window as unknown as Record<string, (() => void) | undefined>).__splashFadeOut;
      if (fadeOut) fadeOut();
    }, MIN_SPLASH_MS);
    return () => clearTimeout(timeout);
  }, [screen.type]);

  // Browser back/forward → drive the screen from the hash.
  useEffect(() => {
    const onPop = () => {
      skipPush.current = true;
      setScreen(hashToScreen(window.location.hash));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Screen change → mirror into the URL hash.
  useEffect(() => {
    if (screen.type === "splash") return;
    if (skipPush.current) { skipPush.current = false; return; }
    const hash = screenToHash(screen);
    if (initialNav.current) {
      initialNav.current = false;
      window.history.replaceState(null, "", hash);
    } else if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
  }, [screen]);

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
        multiple
        data-source="gallery"
        onChange={handleCapture}
        style={{ display: "none" }}
      />

      {screen.type === "splash" && (
        <SplashScreen onFinished={() => setScreen(hashToScreen(window.location.hash))} />
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
                onOpenProfile={() => setScreen({ type: "profile" })}
              />
              {pendingImage && (
                <CropModal
                  imageUrl={pendingImage}
                  queueCount={queueCount}
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

          {screen.type === "profile" && (
            <ProfileView initialTab={screen.tab} onBack={() => setScreen({ type: "grid" })} />
          )}
        </ScreenTransition>
      )}
    </>
  );
}
