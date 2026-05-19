"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface CropModalProps {
  imageUrl: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

const CROP_SIZE = 1024;

export default function CropModal({ imageUrl, onConfirm, onCancel }: CropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgNatural, setImgNatural] = useState({ w: 1, h: 1 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0); // degrees, continuous
  const [minScale, setMinScale] = useState(0.1);
  const [maxScale, setMaxScale] = useState(5);
  const minScaleRef = useRef(0.1);
  const maxScaleRef = useRef(5);
  useEffect(() => { minScaleRef.current = minScale; maxScaleRef.current = maxScale; }, [minScale, maxScale]);

  // Refs for gesture state (avoids stale closures in native listeners)
  const stateRef = useRef({ offset: { x: 0, y: 0 }, scale: 1 });
  useEffect(() => { stateRef.current = { offset, scale }; }, [offset, scale]);

  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const gestureType = useRef<"none" | "drag" | "pinch">("none");
  const pinchStartDist = useRef(0);
  const pinchStartScale = useRef(1);
  const pinchStartOffset = useRef({ x: 0, y: 0 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setImgLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Calculate initial scale
  useEffect(() => {
    if (!imgLoaded || !containerRef.current) return;
    const container = containerRef.current;
    const cropPx = Math.min(container.clientWidth, container.clientHeight) * 0.8;
    const minDim = Math.min(imgNatural.w, imgNatural.h);
    const initialScale = cropPx / minDim;
    const min = initialScale * 0.3;
    const max = initialScale * 4;
    setMinScale(min);
    setMaxScale(max);
    setScale(initialScale);
    setOffset({
      x: (container.clientWidth - imgNatural.w * initialScale) / 2,
      y: (container.clientHeight - imgNatural.h * initialScale) / 2,
    });
  }, [imgLoaded, imgNatural]);

  // Native touch events for pinch + drag (no glitch)
  useEffect(() => {
    const dom = containerRef.current;
    if (!dom) return;

    const getCropCenter = () => ({
      x: dom.clientWidth / 2,
      y: dom.clientHeight / 2,
    });

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        gestureType.current = "pinch";
        dragging.current = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist.current = Math.hypot(dx, dy);
        pinchStartScale.current = stateRef.current.scale;
        pinchStartOffset.current = { ...stateRef.current.offset };
      } else if (e.touches.length === 1 && gestureType.current !== "pinch") {
        gestureType.current = "drag";
        dragging.current = true;
        dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        offsetStart.current = { ...stateRef.current.offset };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (gestureType.current === "pinch" && e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const newScale = Math.max(minScaleRef.current, Math.min(maxScaleRef.current,
          pinchStartScale.current * (dist / pinchStartDist.current)
        ));
        const center = getCropCenter();
        setOffset({
          x: center.x - (center.x - pinchStartOffset.current.x) * (newScale / pinchStartScale.current),
          y: center.y - (center.y - pinchStartOffset.current.y) * (newScale / pinchStartScale.current),
        });
        setScale(newScale);
      } else if (gestureType.current === "drag" && e.touches.length === 1) {
        setOffset({
          x: offsetStart.current.x + (e.touches[0].clientX - dragStart.current.x),
          y: offsetStart.current.y + (e.touches[0].clientY - dragStart.current.y),
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        gestureType.current = "none";
        dragging.current = false;
      } else if (e.touches.length === 1 && gestureType.current === "pinch") {
        gestureType.current = "drag";
        dragging.current = true;
        dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        offsetStart.current = { ...stateRef.current.offset };
      }
    };

    dom.addEventListener("touchstart", onTouchStart, { passive: false });
    dom.addEventListener("touchmove", onTouchMove, { passive: false });
    dom.addEventListener("touchend", onTouchEnd);
    return () => {
      dom.removeEventListener("touchstart", onTouchStart);
      dom.removeEventListener("touchmove", onTouchMove);
      dom.removeEventListener("touchend", onTouchEnd);
    };
  }, [imgLoaded]);

  // Mouse drag (desktop only)
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
  }, [offset]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setOffset({
      x: offsetStart.current.x + (e.clientX - dragStart.current.x),
      y: offsetStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Wheel zoom (desktop)
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const factor = e.deltaY > 0 ? 0.95 : 1.05;
    const newScale = Math.max(minScale, Math.min(maxScale, scale * factor));
    setOffset((prev) => ({
      x: cx - (cx - prev.x) * (newScale / scale),
      y: cy - (cy - prev.y) * (newScale / scale),
    }));
    setScale(newScale);
  }, [scale, minScale, maxScale]);

  // Zoom slider handler
  const handleZoomSlider = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newScale = parseFloat(e.target.value);
    const container = containerRef.current;
    if (!container) { setScale(newScale); return; }
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    setOffset((prev) => ({
      x: cx - (cx - prev.x) * (newScale / scale),
      y: cy - (cy - prev.y) * (newScale / scale),
    }));
    setScale(newScale);
  }, [scale]);

  // Crop and export
  const handleConfirm = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const cropPx = Math.min(container.clientWidth, container.clientHeight) * 0.8;
    const cropLeft = (container.clientWidth - cropPx) / 2;
    const cropTop = (container.clientHeight - cropPx) / 2;

    const displayW = imgNatural.w * scale;
    const displayH = imgNatural.h * scale;
    const imgCenterX = offset.x + displayW / 2;
    const imgCenterY = offset.y + displayH / 2;

    // Render to a temp canvas matching the container
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = container.clientWidth;
    tempCanvas.height = container.clientHeight;
    const tctx = tempCanvas.getContext("2d")!;

    tctx.translate(imgCenterX, imgCenterY);
    tctx.rotate((rotation * Math.PI) / 180);
    tctx.translate(-imgCenterX, -imgCenterY);
    tctx.drawImage(imgRef.current, offset.x, offset.y, displayW, displayH);

    // Extract crop square
    const canvas = document.createElement("canvas");
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(tempCanvas, cropLeft, cropTop, cropPx, cropPx, 0, 0, CROP_SIZE, CROP_SIZE);

    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob);
    }, "image/jpeg", 0.92);
  }, [offset, scale, rotation, imgNatural, onConfirm]);

  if (!imgLoaded) {
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "#000", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <p style={{ color: "#888" }}>Loading...</p>
      </div>
    );
  }

  const displayW = imgNatural.w * scale;
  const displayH = imgNatural.h * scale;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        touchAction: "none",
      }}
    >
      {/* Crop area */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: "relative", overflow: "hidden", cursor: "grab" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Crop preview"
          draggable={false}
          style={{
            position: "absolute",
            left: offset.x,
            top: offset.y,
            width: displayW,
            height: displayH,
            transformOrigin: `${displayW / 2}px ${displayH / 2}px`,
            transform: `rotate(${rotation}deg)`,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        <CropOverlay containerRef={containerRef} />
      </div>

      {/* Controls */}
      <div style={{ background: "#000", padding: "8px 24px 0" }}>
        {/* Rotation slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          <input
            type="range"
            min={-10}
            max={10}
            step={0.05}
            value={rotation}
            onChange={(e) => setRotation(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: "#fff" }}
          />
          <span style={{ color: "#888", fontSize: 12, fontFamily: "monospace", width: 45, textAlign: "right" }}>
            {rotation.toFixed(1)}°
          </span>
        </div>
      </div>

      {/* Buttons */}
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "8px 24px max(16px, env(safe-area-inset-bottom, 16px))",
          background: "#000",
        }}
      >
        <button onClick={onCancel} style={btnStyle("#333", "#fff")}>
          Cancel
        </button>
        <button onClick={handleConfirm} style={btnStyle("#fff", "#000")}>
          Use photo
        </button>
      </div>
    </div>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    flex: 1,
    padding: "14px 0",
    border: "none",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    background: bg,
    color,
    WebkitTapHighlightColor: "transparent",
  };
}

function CropOverlay({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [dims, setDims] = useState({ w: 0, h: 0, crop: 0 });

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      setDims({ w, h, crop: Math.min(w, h) * 0.8 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [containerRef]);

  const { w, h, crop } = dims;
  const left = (w - crop) / 2;
  const top = (h - crop) / 2;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: top, background: "rgba(0,0,0,0.55)" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: h - top - crop, background: "rgba(0,0,0,0.55)" }} />
      <div style={{ position: "absolute", top, left: 0, width: left, height: crop, background: "rgba(0,0,0,0.55)" }} />
      <div style={{ position: "absolute", top, right: 0, width: w - left - crop, height: crop, background: "rgba(0,0,0,0.55)" }} />
      <div style={{
        position: "absolute", top, left, width: crop, height: crop,
        border: "2px solid rgba(255,255,255,0.6)", borderRadius: 4, boxSizing: "border-box",
      }} />
    </div>
  );
}
