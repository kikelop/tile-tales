"use client";

import { useThree, useFrame } from "@react-three/fiber";
import { ContactShadows, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { haptic } from "@/lib/haptic";

function useTextTexture(text: string, date: string) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const render = (bgImg?: HTMLImageElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext("2d")!;

      if (bgImg) {
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
        const maxFontSize = 110;
        const minFontSize = 64;
        let fontSize = maxFontSize;

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

    const bgImg = new Image();
    bgImg.onload = () => {
      if (document.fonts) {
        void document.fonts.ready.then(() => render(bgImg));
      } else {
        render(bgImg);
      }
    };
    bgImg.onerror = () => {
      if (document.fonts) {
        void document.fonts.ready.then(() => render());
      } else {
        render();
      }
    };
    bgImg.src = "/tiles/default/square.webp";
  }, [text, date]);

  return texture;
}

function TileMesh({ textureUrl, memory, date }: { textureUrl: string; memory: string; date: string }) {
  const tileTexture = useTexture(textureUrl);
  tileTexture.colorSpace = THREE.SRGBColorSpace;
  const [s1, s2, s3, s4, sq] = useTexture([
    "/tiles/default/side1.webp",
    "/tiles/default/side2.webp",
    "/tiles/default/side3.webp",
    "/tiles/default/side4.webp",
    "/tiles/default/square.webp",
  ]);
  [s1, s2, s3, s4, sq].forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; });
  const backTexture = useTextTexture(memory, date);

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

  const t = 0.081;
  const s = 2.34;
  const W = 2.4;
  const H = 0.16;

  return (
    <group>
      <mesh geometry={bodyGeo} castShadow>
        <meshBasicMaterial color="#e2ddd6" />
      </mesh>
      <mesh position={[0, t, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[s, s]} />
        <meshBasicMaterial map={tileTexture} />
      </mesh>
      <mesh position={[0, -t, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[s, s]} />
        {backTexture ? (
          <meshBasicMaterial map={backTexture} />
        ) : (
          <meshBasicMaterial map={sq} />
        )}
      </mesh>
      <mesh position={[0, 0, W / 2 + 0.001]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={s1} />
      </mesh>
      <mesh position={[0, 0, -W / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={s2} />
      </mesh>
      <mesh position={[W / 2 + 0.001, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={s3} />
      </mesh>
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
  onSwipeLeft,
  onSwipeRight,
}: {
  textureUrl: string;
  memory: string;
  date: string;
  initialRotation: [number, number, number];
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const isDragging = useRef(false);
  const touchCount = useRef(0);
  const prevPointer = useRef({ x: 0, y: 0 });
  const quaternion = useRef(new THREE.Quaternion());
  const autoRotateSpeed = useRef(0.08);
  const velocity = useRef({ x: 0, y: 0 });
  const initialQuaternion = useRef(new THREE.Quaternion());
  const slerpFrom = useRef(new THREE.Quaternion());
  const slerpProgress = useRef(1);
  const lastTapTime = useRef(0);
  const lastTapPos = useRef({ x: 0, y: 0 });
  const startPointer = useRef({ x: 0, y: 0 });
  const totalDelta = useRef({ x: 0, y: 0 });
  const intent = useRef<"rotate" | "swipe" | null>(null);
  const autoRotatePaused = useRef(false);
  const swipeLeftRef = useRef(onSwipeLeft);
  const swipeRightRef = useRef(onSwipeRight);
  useEffect(() => { swipeLeftRef.current = onSwipeLeft; }, [onSwipeLeft]);
  useEffect(() => { swipeRightRef.current = onSwipeRight; }, [onSwipeRight]);
  const { gl, camera } = useThree();

  useEffect(() => {
    const euler = new THREE.Euler(initialRotation[0], initialRotation[1], initialRotation[2]);
    quaternion.current.setFromEuler(euler);
    initialQuaternion.current.setFromEuler(euler);
  }, []); // only on mount  // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerDown = useCallback((e: PointerEvent) => {
    const now = Date.now();
    const dxLastTap = e.clientX - lastTapPos.current.x;
    const dyLastTap = e.clientY - lastTapPos.current.y;
    const distLastTap = Math.hypot(dxLastTap, dyLastTap);
    if (now - lastTapTime.current < 300 && distLastTap < 40) {
      slerpFrom.current.copy(quaternion.current);
      slerpProgress.current = 0;
      velocity.current = { x: 0, y: 0 };
      isDragging.current = false;
      autoRotateSpeed.current = 0;
      lastTapTime.current = 0;
      intent.current = null;
      haptic(8);
      gl.domElement.setPointerCapture(e.pointerId);
      return;
    }
    lastTapTime.current = now;
    lastTapPos.current = { x: e.clientX, y: e.clientY };
    startPointer.current = { x: e.clientX, y: e.clientY };
    totalDelta.current = { x: 0, y: 0 };
    intent.current = null;
    isDragging.current = true;
    autoRotateSpeed.current = 0;
    prevPointer.current = { x: e.clientX, y: e.clientY };
    gl.domElement.setPointerCapture(e.pointerId);
  }, [gl]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (touchCount.current > 1) return;

    const totalDx = e.clientX - startPointer.current.x;
    const totalDy = e.clientY - startPointer.current.y;
    totalDelta.current = { x: totalDx, y: totalDy };

    if (intent.current === null) {
      if (Math.hypot(totalDx, totalDy) < 8) return;
      if (Math.abs(totalDx) > Math.abs(totalDy) * 1.5) {
        intent.current = "swipe";
        isDragging.current = false;
        velocity.current = { x: 0, y: 0 };
        return;
      }
      intent.current = "rotate";
      prevPointer.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (intent.current === "swipe") return;
    if (!isDragging.current) return;

    const dx = (e.clientX - prevPointer.current.x) * 0.01;
    const dy = (e.clientY - prevPointer.current.y) * 0.01;
    prevPointer.current = { x: e.clientX, y: e.clientY };

    velocity.current = { x: dx, y: dy };

    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy);

    quaternion.current.premultiply(qx).premultiply(qy);
  }, []);

  const onPointerUp = useCallback((e: PointerEvent) => {
    if (intent.current === "swipe") {
      const swept = totalDelta.current.x;
      if (Math.abs(swept) > 60) {
        if (swept < 0) swipeLeftRef.current?.();
        else swipeRightRef.current?.();
        haptic(8);
      }
    } else if (intent.current === null) {
      const totalDist = Math.hypot(totalDelta.current.x, totalDelta.current.y);
      if (totalDist < 5) {
        autoRotatePaused.current = !autoRotatePaused.current;
        haptic(6);
      }
    }
    intent.current = null;
    isDragging.current = false;
    autoRotateSpeed.current = autoRotatePaused.current ? 0 : 0.08;
    try { gl.domElement.releasePointerCapture(e.pointerId); } catch {}
  }, [gl]);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const z = camera.position.z + e.deltaY * 0.005;
    camera.position.z = Math.max(2, Math.min(12, z));
  }, [camera]);

  const pinchStart = useRef(0);
  const onTouchStart = useCallback((e: TouchEvent) => {
    touchCount.current = e.touches.length;
    if (e.touches.length === 2) {
      isDragging.current = false;
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
      autoRotateSpeed.current = autoRotatePaused.current ? 0 : 0.08;
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

    const entryDur = 2.0;
    const ep = Math.min(t / entryDur, 1);
    const dropEase = 1 - Math.pow(1 - ep, 3);

    const scaleDur = 0.5;
    const sp = Math.min(t / scaleDur, 1);
    const scaleEase = 1 - Math.pow(1 - sp, 2);

    const scale = scaleEase;
    const dropY = (1 - dropEase) * 8;

    const zSpeed = t < 3.0 ? 0.08 + 4.0 * Math.pow(1 - t / 3.0, 2) : 0.08;

    const flipDur = 1.8;
    const fp = Math.min(t / flipDur, 1);
    const flipEase = 1 - Math.pow(1 - fp, 3);
    const yAngle = flipEase * Math.PI * 2;

    if (slerpProgress.current < 1) {
      slerpProgress.current = Math.min(1, slerpProgress.current + delta / 0.4);
      const slerpEase = 1 - Math.pow(1 - slerpProgress.current, 3);
      quaternion.current.copy(slerpFrom.current).slerp(initialQuaternion.current, slerpEase);
      if (slerpProgress.current >= 1) autoRotateSpeed.current = autoRotatePaused.current ? 0 : 0.08;
    } else if (!isDragging.current) {
      if (Math.abs(velocity.current.x) > 0.0001 || Math.abs(velocity.current.y) > 0.0001) {
        const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), velocity.current.x);
        const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), velocity.current.y);
        quaternion.current.premultiply(qx).premultiply(qy);
        velocity.current.x *= 0.95;
        velocity.current.y *= 0.95;
      }

      const autoQ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1), zSpeed * delta
      );
      const wobbleX = Math.sin(t * 0.4) * 0.0008;
      const wobbleY = Math.cos(t * 0.3) * 0.0006;
      const qx2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), wobbleX);
      const qy2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), wobbleY);

      quaternion.current.premultiply(autoQ).premultiply(qx2).premultiply(qy2);
    }

    const floatY = Math.sin(t * 0.8) * 0.06;

    if (groupRef.current) {
      if (fp < 1) {
        const flipQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yAngle);
        const final_q = flipQ.clone().multiply(quaternion.current);
        groupRef.current.quaternion.copy(final_q);
      } else {
        groupRef.current.quaternion.copy(quaternion.current);
      }
      groupRef.current.position.set(0, dropY + floatY, 0);
      groupRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group ref={groupRef}>
      <TileMesh textureUrl={textureUrl} memory={memory} date={date} />
    </group>
  );
}

function AdaptiveCamera({ onReady }: { onReady?: () => void }) {
  const { camera, size } = useThree();
  const readyFired = useRef(false);
  useEffect(() => {
    const aspect = size.width / size.height;
    camera.position.z = aspect < 1 ? 11 : 6;
    camera.position.y = aspect < 1 ? 0.6 : 0.3;
    if (!readyFired.current && onReady) {
      readyFired.current = true;
      onReady();
    }
  }, [camera, size, onReady]);
  return null;
}

export default function Scene({
  textureUrl,
  memory,
  date,
  onReady,
  onSwipeLeft,
  onSwipeRight,
}: {
  textureUrl: string;
  memory: string;
  date: string;
  onReady?: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}) {
  return (
    <>
      <AdaptiveCamera onReady={onReady} />
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
          onSwipeLeft={onSwipeLeft}
          onSwipeRight={onSwipeRight}
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
