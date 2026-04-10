"use client";

import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { ContactShadows, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useState, Suspense, useRef, useCallback, useEffect, useMemo } from "react";
import CropModal from "./CropModal";

interface TileItem {
  name: string;
  file: string;
  memory: string;
  date: string;
}

const DEFAULT_TILES: TileItem[] = [
  { name: "Terrazzo Star", file: "/tiles/terrazzo-star.png", memory: "", date: "" },
  { name: "Zellige Rose", file: "/tiles/zellige-rose.png", memory: "", date: "" },
  { name: "Geometric Orange", file: "/tiles/geometric-orange.png", memory: "", date: "" },
  { name: "Floral Green", file: "/tiles/floral-green.png", memory: "", date: "" },
];

function useTextTexture(text: string, date: string) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const render = (bgImg?: HTMLImageElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d")!;

      // Background — ceramic texture or fallback color
      if (bgImg) {
        // Draw centered/cropped to fill square
        const s = Math.min(bgImg.width, bgImg.height);
        const sx = (bgImg.width - s) / 2;
        const sy = (bgImg.height - s) / 2;
        ctx.drawImage(bgImg, sx, sy, s, s, 0, 0, 1024, 1024);
      } else {
        ctx.fillStyle = "#d4cdc2";
        ctx.fillRect(0, 0, 1024, 1024);
      }

      if (text.trim()) {
        ctx.fillStyle = "#5a5248";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const maxWidth = 700;
        const fontFamily = 'Caveat, "Segoe Script", "Bradley Hand", cursive';

        // Find optimal font size: start large, shrink until single line fits or hit minimum
        const maxFontSize = 110;
        const minFontSize = 64;
        let fontSize = maxFontSize;

        // Try to fit in one line first, then wrap
        for (let fs = maxFontSize; fs >= minFontSize; fs -= 2) {
          ctx.font = `${fs}px ${fontFamily}`;
          if (ctx.measureText(text).width <= maxWidth) {
            fontSize = fs;
            break;
          }
          fontSize = fs;
        }

        ctx.font = `${fontSize}px ${fontFamily}`;
        const lineHeight = fontSize * 1.3;

        // Word wrap at final font size
        const words = text.split(" ");
        const lines: string[] = [];
        let currentLine = "";

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        const startY = 512 - ((lines.length - 1) * lineHeight) / 2;
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], 512, startY + i * lineHeight);
        }
      }

      // Date in bottom-right corner
      if (date.trim()) {
        ctx.fillStyle = "#8a8278";
        ctx.font = '34px Caveat, "Segoe Script", "Bradley Hand", cursive';
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(date, 920, 940);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      setTexture((prev) => { if (prev) prev.dispose(); return tex; });
    };

    // Load ceramic background image, then render
    const bgImg = new Image();
    bgImg.onload = () => {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => render(bgImg));
      } else {
        render(bgImg);
      }
    };
    bgImg.onerror = () => {
      // Fallback without background image
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => render());
      } else {
        render();
      }
    };
    bgImg.src = "/tiles/default/square.png";
  }, [text, date]);

  return texture;
}

function TileMesh({ textureUrl, memory, date }: { textureUrl: string; memory: string; date: string }) {
  const tileTexture = useTexture(textureUrl);
  tileTexture.colorSpace = THREE.SRGBColorSpace;
  const [s1, s2, s3, s4, sq] = useTexture([
    "/tiles/default/side1.png",
    "/tiles/default/side2.png",
    "/tiles/default/side3.png",
    "/tiles/default/side4.png",
    "/tiles/default/square.png",
  ]);
  [s1, s2, s3, s4, sq].forEach(t => { t.colorSpace = THREE.SRGBColorSpace; });
  const backTexture = useTextTexture(memory, date);

  // Rounded rectangle extruded — used only for the rounded edge shape (color solid)
  const bodyGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const w = 2.4, h = 2.4, r = 0.06;
    const hw = w / 2, hh = h / 2;
    shape.moveTo(-hw + r, -hh);
    shape.lineTo(hw - r, -hh);
    shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
    shape.lineTo(hw, hh - r);
    shape.quadraticCurveTo(hw, hh, hw - r, hh);
    shape.lineTo(-hw + r, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
    shape.lineTo(-hw, -hh + r);
    shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
    geo.translate(0, 0, -0.08);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const t = 0.081; // half-thickness + tiny offset
  const s = 2.34;  // face size (inset from 2.4 so edges peek)
  const W = 2.4;   // full width
  const H = 0.16;  // thickness

  return (
    <group>
      {/* Rounded body shell */}
      <mesh geometry={bodyGeo} castShadow>
        <meshBasicMaterial color="#e2ddd6" />
      </mesh>

      {/* Top face — tile texture */}
      <mesh position={[0, t, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[s, s]} />
        <meshBasicMaterial map={tileTexture} />
      </mesh>

      {/* Bottom face — memory text on ceramic bg */}
      <mesh position={[0, -t, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[s, s]} />
        {backTexture ? (
          <meshBasicMaterial map={backTexture} />
        ) : (
          <meshBasicMaterial map={sq} />
        )}
      </mesh>

      {/* 4 sides — individual textures, each plane sized to real proportions */}
      {/* Front (+Z) */}
      <mesh position={[0, 0, W / 2 + 0.001]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={s1} />
      </mesh>
      {/* Back (-Z) */}
      <mesh position={[0, 0, -W / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={s2} />
      </mesh>
      {/* Right (+X) */}
      <mesh position={[W / 2 + 0.001, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={s3} />
      </mesh>
      {/* Left (-X) */}
      <mesh position={[-W / 2 - 0.001, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={s4} />
      </mesh>
    </group>
  );
}

function RotatableTile({
  textureUrl,
  memory,
  date,
  initialRotation,
}: {
  textureUrl: string;
  memory: string;
  date: string;
  initialRotation: [number, number, number];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const isDragging = useRef(false);
  const touchCount = useRef(0);
  const prevPointer = useRef({ x: 0, y: 0 });
  const quaternion = useRef(new THREE.Quaternion());
  const autoRotateSpeed = useRef(0.08);
  const velocity = useRef({ x: 0, y: 0 });
  const { gl, camera } = useThree();

  useEffect(() => {
    const euler = new THREE.Euler(initialRotation[0], initialRotation[1], initialRotation[2]);
    quaternion.current.setFromEuler(euler);
  }, []); // only on mount

  const onPointerDown = useCallback((e: PointerEvent) => {
    isDragging.current = true;
    autoRotateSpeed.current = 0;
    prevPointer.current = { x: e.clientX, y: e.clientY };
    gl.domElement.setPointerCapture(e.pointerId);
  }, [gl]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging.current || touchCount.current > 1) return;

    const dx = (e.clientX - prevPointer.current.x) * 0.01;
    const dy = (e.clientY - prevPointer.current.y) * 0.01;
    prevPointer.current = { x: e.clientX, y: e.clientY };

    velocity.current = { x: dx, y: dy };

    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy);

    quaternion.current.premultiply(qx).premultiply(qy);
  }, []);

  const onPointerUp = useCallback((e: PointerEvent) => {
    isDragging.current = false;
    autoRotateSpeed.current = 0.08;
    gl.domElement.releasePointerCapture(e.pointerId);
  }, [gl]);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const z = camera.position.z + e.deltaY * 0.005;
    camera.position.z = Math.max(2, Math.min(12, z));
  }, [camera]);

  // Track touch count to disable rotation during pinch
  const pinchStart = useRef(0);
  const onTouchStart = useCallback((e: TouchEvent) => {
    touchCount.current = e.touches.length;
    if (e.touches.length === 2) {
      isDragging.current = false; // stop rotation immediately
      velocity.current = { x: 0, y: 0 };
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStart.current = Math.hypot(dx, dy);
    }
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = (pinchStart.current - dist) * 0.015;
      pinchStart.current = dist;
      const z = camera.position.z + delta;
      camera.position.z = Math.max(3, Math.min(12, z));
    }
  }, [camera]);

  const onTouchEnd = useCallback((e: TouchEvent) => {
    touchCount.current = e.touches.length;
    if (e.touches.length === 0) {
      autoRotateSpeed.current = 0.08;
    }
  }, []);

  useEffect(() => {
    const dom = gl.domElement;
    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("touchstart", onTouchStart, { passive: true });
    dom.addEventListener("touchmove", onTouchMove, { passive: false });
    dom.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("touchstart", onTouchStart);
      dom.removeEventListener("touchmove", onTouchMove);
      dom.removeEventListener("touchend", onTouchEnd);
    };
  }, [gl, onPointerDown, onPointerMove, onPointerUp, onWheel, onTouchStart, onTouchMove, onTouchEnd]);

  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    if (!isDragging.current) {
      if (Math.abs(velocity.current.x) > 0.0001 || Math.abs(velocity.current.y) > 0.0001) {
        const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), velocity.current.x);
        const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), velocity.current.y);
        quaternion.current.premultiply(qx).premultiply(qy);
        velocity.current.x *= 0.95;
        velocity.current.y *= 0.95;
      }

      const autoQ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        autoRotateSpeed.current * delta
      );
      const wobbleX = Math.sin(t * 0.4) * 0.0008;
      const wobbleY = Math.cos(t * 0.3) * 0.0006;
      const qx2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), wobbleX);
      const qy2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), wobbleY);

      quaternion.current.premultiply(autoQ).premultiply(qx2).premultiply(qy2);
    }

    if (groupRef.current) {
      groupRef.current.quaternion.copy(quaternion.current);
      groupRef.current.position.y = Math.sin(t * 0.8) * 0.06;
    }
  });

  return (
    <group ref={groupRef}>
      <TileMesh textureUrl={textureUrl} memory={memory} date={date} />
    </group>
  );
}

function AdaptiveCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    // Portrait/mobile: pull camera back; landscape/desktop: closer
    camera.position.z = aspect < 1 ? 11 : 6;
    // Shift camera up slightly on mobile so tile appears more centered visually
    camera.position.y = aspect < 1 ? 0.6 : 0.3;
  }, [camera, size]);
  return null;
}

function Scene({ textureUrl, memory, date }: { textureUrl: string; memory: string; date: string }) {
  return (
    <>
      <AdaptiveCamera />
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 6, 10]} intensity={1.5} />
      <directionalLight position={[-4, 3, 5]} intensity={0.5} />
      <directionalLight position={[0, -6, 8]} intensity={1.0} />

      <Suspense fallback={null}>
        <RotatableTile
          textureUrl={textureUrl}
          memory={memory}
          date={date}
          initialRotation={[1.57, 0.78, -0.01]}
        />
        <ContactShadows
          position={[0, -3, 0]}
          opacity={0.12}
          scale={10}
          blur={5}
          far={8}
        />
      </Suspense>
    </>
  );
}

export default function TileViewer3D() {
  const [tiles, setTiles] = useState<TileItem[]>(DEFAULT_TILES);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [editingMemory, setEditingMemory] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImage(URL.createObjectURL(file));
    e.target.value = "";
  }, []);

  const handleCropConfirm = useCallback((croppedUrl: string) => {
    const name = `Tile #${tiles.length + 1}`;
    const newTiles = [...tiles, { name, file: croppedUrl, memory: "", date: "" }];
    setTiles(newTiles);
    setActiveIndex(newTiles.length - 1);
    if (pendingImage) URL.revokeObjectURL(pendingImage);
    setPendingImage(null);
  }, [tiles, pendingImage]);

  const handleCropCancel = useCallback(() => {
    if (pendingImage) URL.revokeObjectURL(pendingImage);
    setPendingImage(null);
  }, [pendingImage]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "#f5f2ed",
        touchAction: "none",
      }}
    >
      {/* Hidden file input for camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        style={{ display: "none" }}
      />

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <Canvas
          camera={{ position: [0, 0.3, 6], fov: 35 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2,
          }}
          dpr={[1, 2]}
        >
          <color attach="background" args={["#f5f2ed"]} />
          <Scene textureUrl={tiles[activeIndex].file} memory={tiles[activeIndex].memory} date={tiles[activeIndex].date} />
        </Canvas>

        {/* Title */}
        <div
          style={{
            position: "absolute",
            top: "max(16px, env(safe-area-inset-top, 16px))",
            left: "max(16px, env(safe-area-inset-left, 16px))",
            pointerEvents: "none",
            padding: "0 8px",
          }}
        >
          <h1
            style={{
              fontSize: "clamp(22px, 5vw, 30px)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {tiles[activeIndex].name}
          </h1>
          <p style={{ fontSize: "clamp(12px, 3vw, 14px)", color: "#8a8578", marginTop: 4 }}>
            Drag to rotate — Pinch to zoom
          </p>
        </div>

        {/* Memory edit button */}
        <button
          onClick={() => {
            setMemoryDraft(tiles[activeIndex].memory);
            setDateDraft(tiles[activeIndex].date);
            setEditingMemory(true);
          }}
          style={{
            position: "absolute",
            top: "max(16px, env(safe-area-inset-top, 16px))",
            right: "max(16px, env(safe-area-inset-right, 16px))",
            width: 44,
            height: 44,
            borderRadius: 22,
            border: "none",
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>
      </div>

      {/* Tile selector + capture button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "clamp(8px, 2vw, 12px)",
          padding: "12px 16px max(12px, env(safe-area-inset-bottom, 12px))",
          flexShrink: 0,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Capture button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: "clamp(52px, 12vw, 72px)",
            height: "clamp(52px, 12vw, 72px)",
            borderRadius: "clamp(8px, 2vw, 12px)",
            overflow: "hidden",
            border: "2px dashed #b5ad9e",
            padding: 0,
            cursor: "pointer",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8a8578" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>

        {/* Tile thumbnails */}
        {tiles.map((tile, i) => (
          <button
            key={tile.file}
            onClick={() => setActiveIndex(i)}
            style={{
              width: "clamp(52px, 12vw, 72px)",
              height: "clamp(52px, 12vw, 72px)",
              borderRadius: "clamp(8px, 2vw, 12px)",
              overflow: "hidden",
              border: "none",
              padding: 0,
              cursor: "pointer",
              outline: i === activeIndex ? "2px solid #1a1a1a" : "2px solid transparent",
              outlineOffset: 2,
              opacity: i === activeIndex ? 1 : 0.6,
              transition: "all 0.2s",
              background: "transparent",
              flexShrink: 0,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tile.file}
              alt={tile.name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </button>
        ))}
      </div>

      {/* Memory edit modal */}
      {editingMemory && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setEditingMemory(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              padding: "24px 24px max(24px, env(safe-area-inset-bottom, 24px))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600 }}>
              Write a memory
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#8a8578" }}>
              This text will appear on the back of the tile
            </p>
            <textarea
              autoFocus
              value={memoryDraft}
              onChange={(e) => setMemoryDraft(e.target.value)}
              placeholder="The day I found this tile..."
              style={{
                width: "100%",
                minHeight: 120,
                padding: 16,
                borderRadius: 12,
                border: "1px solid #e0d8cc",
                background: "#faf8f5",
                fontSize: 18,
                fontFamily: "var(--font-caveat), cursive",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
                color: "#1a1a1a",
              }}
            />
            <input
              type="text"
              value={dateDraft}
              onChange={(e) => setDateDraft(e.target.value)}
              placeholder="e.g. March 2026, Lisboa"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #e0d8cc",
                background: "#faf8f5",
                fontSize: 16,
                fontFamily: "var(--font-caveat), cursive",
                outline: "none",
                boxSizing: "border-box",
                color: "#9a9288",
                marginTop: 8,
              }}
            />
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button
                onClick={() => setEditingMemory(false)}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: "1px solid #e0d8cc",
                  background: "transparent",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const updated = [...tiles];
                  updated[activeIndex] = { ...updated[activeIndex], memory: memoryDraft, date: dateDraft };
                  setTiles(updated);
                  setEditingMemory(false);
                }}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  borderRadius: 12,
                  border: "none",
                  background: "#1a1a1a",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crop modal */}
      {pendingImage && (
        <CropModal
          imageUrl={pendingImage}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
