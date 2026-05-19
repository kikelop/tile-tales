"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface ScanModalProps {
  imageUrl: string;
  onConfirm: (warpedUrl: string) => void;
  onCancel: () => void;
}

type Point = { x: number; y: number };
type Quad = [Point, Point, Point, Point]; // tl, tr, br, bl in natural image coords

const CV_URL = "https://docs.opencv.org/4.10.0/opencv.js";
const CV_INIT_TIMEOUT_MS = 30000;
const OUT_SIZE = 1024;
const PROCESS_MAX_DIM = 800;
const HANDLE_R = 14;
const MAGNIFIER_SIZE = 110;
const MAGNIFIER_ZOOM = 2;

type Status = "loading" | "detecting" | "adjusting" | "warping" | "error";

declare global {
  interface Window {
    cv?: unknown;
    __tileTalesCvLoader?: Promise<unknown>;
  }
}

type CvLike = {
  Mat: new () => unknown;
  onRuntimeInitialized?: () => void;
} & Record<string, unknown>;

function loadOpenCv(): Promise<CvLike> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  const existing = window.cv as CvLike | undefined;
  if (existing && typeof existing.Mat === "function") return Promise.resolve(existing);
  if (window.__tileTalesCvLoader) return window.__tileTalesCvLoader as Promise<CvLike>;

  window.__tileTalesCvLoader = new Promise<CvLike>((resolve, reject) => {
    let settled = false;
    const finish = (result: CvLike | Error) => {
      if (settled) return;
      settled = true;
      if (result instanceof Error) reject(result);
      else resolve(result);
    };

    // Poll for cv readiness — onRuntimeInitialized callback is unreliable
    // (may have already fired before we get a chance to attach a handler,
    // especially with HTTP caching or service worker hits).
    const started = Date.now();
    const poll = () => {
      if (settled) return;
      const cv = window.cv as CvLike | undefined;
      if (cv && typeof cv.Mat === "function") {
        finish(cv);
        return;
      }
      if (Date.now() - started > CV_INIT_TIMEOUT_MS) {
        finish(new Error("Scanner took too long to load"));
        return;
      }
      setTimeout(poll, 100);
    };

    const tag = document.querySelector(`script[data-cv-loader="1"]`) as HTMLScriptElement | null;
    if (tag) {
      tag.addEventListener("error", () => finish(new Error("opencv script failed")), { once: true });
      poll();
      return;
    }
    const script = document.createElement("script");
    script.src = CV_URL;
    script.async = true;
    script.dataset.cvLoader = "1";
    script.onload = () => { script.dataset.loaded = "1"; poll(); };
    script.onerror = () => finish(new Error("opencv script failed to download"));
    document.head.appendChild(script);
    // Start polling immediately in case onload misses (some iOS PWA quirks)
    poll();
  });
  return window.__tileTalesCvLoader as Promise<CvLike>;
}

function orderQuad(pts: Point[]): Quad {
  const sum = pts.map((p) => p.x + p.y);
  const diff = pts.map((p) => p.x - p.y);
  const tl = pts[sum.indexOf(Math.min(...sum))];
  const br = pts[sum.indexOf(Math.max(...sum))];
  const tr = pts[diff.indexOf(Math.max(...diff))];
  const bl = pts[diff.indexOf(Math.min(...diff))];
  return [tl, tr, br, bl];
}

function defaultQuad(w: number, h: number): Quad {
  const m = 0.1;
  return [
    { x: w * m, y: h * m },
    { x: w * (1 - m), y: h * m },
    { x: w * (1 - m), y: h * (1 - m) },
    { x: w * m, y: h * (1 - m) },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectQuad(cv: any, img: HTMLImageElement): Quad | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const scale = Math.min(1, PROCESS_MAX_DIM / Math.max(w, h));
  const sw = Math.round(w * scale);
  const sh = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext("2d")!.drawImage(img, 0, 0, sw, sh);

  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
  const edges = new cv.Mat();
  cv.Canny(gray, edges, 50, 150);
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  cv.dilate(edges, edges, kernel);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  let bestQuad: Quad | null = null;
  let bestArea = 0;
  const minArea = sw * sh * 0.05;

  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i);
    const peri = cv.arcLength(c, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(c, approx, 0.02 * peri, true);
    if (approx.rows === 4) {
      const area = cv.contourArea(approx);
      if (area > minArea && area > bestArea) {
        const pts: Point[] = [];
        for (let j = 0; j < 4; j++) {
          pts.push({
            x: approx.data32S[j * 2] / scale,
            y: approx.data32S[j * 2 + 1] / scale,
          });
        }
        bestQuad = orderQuad(pts);
        bestArea = area;
      }
    }
    approx.delete();
    c.delete();
  }

  src.delete();
  gray.delete();
  edges.delete();
  kernel.delete();
  contours.delete();
  hierarchy.delete();

  return bestQuad;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function warpQuad(cv: any, img: HTMLImageElement, quad: Quad): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);

    const src = cv.imread(canvas);
    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
      quad[0].x, quad[0].y,
      quad[1].x, quad[1].y,
      quad[2].x, quad[2].y,
      quad[3].x, quad[3].y,
    ]);
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      OUT_SIZE, 0,
      OUT_SIZE, OUT_SIZE,
      0, OUT_SIZE,
    ]);
    const M = cv.getPerspectiveTransform(srcPts, dstPts);
    const dst = new cv.Mat();
    cv.warpPerspective(src, dst, M, new cv.Size(OUT_SIZE, OUT_SIZE));

    const outCanvas = document.createElement("canvas");
    outCanvas.width = OUT_SIZE;
    outCanvas.height = OUT_SIZE;
    cv.imshow(outCanvas, dst);

    src.delete();
    dst.delete();
    M.delete();
    srcPts.delete();
    dstPts.delete();

    outCanvas.toBlob((blob) => {
      if (blob) resolve(URL.createObjectURL(blob));
      else reject(new Error("blob failed"));
    }, "image/jpeg", 0.92);
  });
}

type DisplayBounds = { left: number; top: number; width: number; height: number; scale: number };

function getDisplayBounds(cw: number, ch: number, iw: number, ih: number): DisplayBounds {
  const s = Math.min(cw / iw, ch / ih);
  const dw = iw * s;
  const dh = ih * s;
  return { left: (cw - dw) / 2, top: (ch - dh) / 2, width: dw, height: dh, scale: s };
}

export default function ScanModal({ imageUrl, onConfirm, onCancel }: ScanModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });
  const [bounds, setBounds] = useState<DisplayBounds>({ left: 0, top: 0, width: 0, height: 0, scale: 1 });
  const [quad, setQuad] = useState<Quad | null>(null);
  const [activeHandle, setActiveHandle] = useState<number | null>(null);
  const [pointerPos, setPointerPos] = useState<Point | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cvRef = useRef<any>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      loadOpenCv().then((cv) => {
        if (cancelled) return;
        cvRef.current = cv;
        setStatus("detecting");
        // Defer to next frame to let UI paint the spinner state
        requestAnimationFrame(() => {
          if (cancelled) return;
          try {
            const detected = detectQuad(cv, img) ?? defaultQuad(img.naturalWidth, img.naturalHeight);
            setQuad(detected);
            setStatus("adjusting");
          } catch (e) {
            console.error(e);
            setQuad(defaultQuad(img.naturalWidth, img.naturalHeight));
            setStatus("adjusting");
          }
        });
      }).catch((e: Error) => {
        console.error("opencv load error:", e);
        // Reset loader so the retry button gets a fresh attempt
        if (typeof window !== "undefined") {
          window.__tileTalesCvLoader = undefined;
          document.querySelectorAll('script[data-cv-loader="1"]').forEach((s) => s.remove());
        }
        setErrorMsg(e?.message ? `${e.message}. Check your connection and retry.` : "Scanner failed to load.");
        setStatus("error");
      });
    };
    img.onerror = () => { if (!cancelled) { setErrorMsg("Image failed to load."); setStatus("error"); } };
    img.src = imageUrl;
    return () => { cancelled = true; };
  }, [imageUrl, retryToken]);

  const handleRetry = useCallback(() => {
    setErrorMsg(null);
    setStatus("loading");
    setRetryToken((t) => t + 1);
  }, []);

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      setBounds(getDisplayBounds(cw, ch, imgSize.w, imgSize.h));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [imgSize]);

  const toDisplay = useCallback((p: Point): Point => ({
    x: bounds.left + p.x * bounds.scale,
    y: bounds.top + p.y * bounds.scale,
  }), [bounds]);

  const toNatural = useCallback((x: number, y: number): Point => ({
    x: Math.max(0, Math.min(imgSize.w, (x - bounds.left) / bounds.scale)),
    y: Math.max(0, Math.min(imgSize.h, (y - bounds.top) / bounds.scale)),
  }), [bounds, imgSize]);

  const onHandleDown = useCallback((idx: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setActiveHandle(idx);
    const rect = containerRef.current!.getBoundingClientRect();
    setPointerPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const onHandleMove = useCallback((idx: number) => (e: React.PointerEvent) => {
    if (activeHandle !== idx) return;
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setPointerPos({ x: cx, y: cy });
    setQuad((prev) => {
      if (!prev) return prev;
      const next = [...prev] as Quad;
      next[idx] = toNatural(cx, cy);
      return next;
    });
  }, [activeHandle, toNatural]);

  const onHandleUp = useCallback(() => {
    setActiveHandle(null);
    setPointerPos(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!quad || !imgRef.current || !cvRef.current) return;
    setStatus("warping");
    try {
      const url = await warpQuad(cvRef.current, imgRef.current, quad);
      onConfirm(url);
    } catch (e) {
      console.error(e);
      setErrorMsg("Couldn't process the image.");
      setStatus("error");
    }
  }, [quad, onConfirm]);

  const handleReset = useCallback(() => {
    if (!cvRef.current || !imgRef.current) return;
    setStatus("detecting");
    requestAnimationFrame(() => {
      try {
        const detected = detectQuad(cvRef.current, imgRef.current!)
          ?? defaultQuad(imgSize.w, imgSize.h);
        setQuad(detected);
      } catch {
        setQuad(defaultQuad(imgSize.w, imgSize.h));
      }
      setStatus("adjusting");
    });
  }, [imgSize]);

  // Magnifier: position in opposite corner from the dragged handle
  const magnifierPos = (() => {
    if (!pointerPos || activeHandle === null) return null;
    const cw = containerRef.current?.clientWidth ?? 0;
    const margin = 16;
    const top = pointerPos.y > MAGNIFIER_SIZE + margin * 2;
    const left = pointerPos.x > cw / 2;
    return {
      top: top ? margin : undefined,
      bottom: top ? undefined : margin,
      left: left ? margin : undefined,
      right: left ? undefined : margin,
    };
  })();

  const displayQuad = quad ? (quad.map(toDisplay) as Quad) : null;
  const polyPoints = displayQuad ? displayQuad.map((p) => `${p.x},${p.y}`).join(" ") : "";

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
      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Scan preview"
          draggable={false}
          style={{
            position: "absolute",
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            pointerEvents: "none",
            userSelect: "none",
          }}
        />

        {/* Dim mask outside the quad */}
        {displayQuad && containerRef.current && (
          <svg
            width={containerRef.current.clientWidth}
            height={containerRef.current.clientHeight}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <defs>
              <mask id="quad-mask">
                <rect width="100%" height="100%" fill="white" />
                <polygon points={polyPoints} fill="black" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#quad-mask)" />
            <polygon
              points={polyPoints}
              fill="rgba(255,255,255,0.04)"
              stroke="#fff"
              strokeWidth={2}
            />
          </svg>
        )}

        {/* Handles */}
        {displayQuad && displayQuad.map((p, idx) => (
          <div
            key={idx}
            onPointerDown={onHandleDown(idx)}
            onPointerMove={onHandleMove(idx)}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            style={{
              position: "absolute",
              left: p.x - HANDLE_R * 1.6,
              top: p.y - HANDLE_R * 1.6,
              width: HANDLE_R * 3.2,
              height: HANDLE_R * 3.2,
              borderRadius: "50%",
              touchAction: "none",
              cursor: "grab",
              WebkitTapHighlightColor: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{
              width: HANDLE_R * 2,
              height: HANDLE_R * 2,
              borderRadius: "50%",
              background: activeHandle === idx ? "#fff" : "rgba(255,255,255,0.95)",
              border: "2px solid #000",
              boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
            }} />
          </div>
        ))}

        {/* Magnifier */}
        {activeHandle !== null && pointerPos && magnifierPos && imgRef.current && (
          <div
            style={{
              position: "absolute",
              ...magnifierPos,
              width: MAGNIFIER_SIZE,
              height: MAGNIFIER_SIZE,
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid #fff",
              boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
              pointerEvents: "none",
              background: "#000",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: bounds.width * MAGNIFIER_ZOOM,
                height: bounds.height * MAGNIFIER_ZOOM,
                left: MAGNIFIER_SIZE / 2 - (pointerPos.x - bounds.left) * MAGNIFIER_ZOOM,
                top: MAGNIFIER_SIZE / 2 - (pointerPos.y - bounds.top) * MAGNIFIER_ZOOM,
                backgroundImage: `url(${imageUrl})`,
                backgroundSize: "100% 100%",
              }}
            />
            <div style={{
              position: "absolute",
              left: MAGNIFIER_SIZE / 2 - 1,
              top: MAGNIFIER_SIZE / 2 - 8,
              width: 2,
              height: 16,
              background: "rgba(255,255,255,0.8)",
            }} />
            <div style={{
              position: "absolute",
              left: MAGNIFIER_SIZE / 2 - 8,
              top: MAGNIFIER_SIZE / 2 - 1,
              width: 16,
              height: 2,
              background: "rgba(255,255,255,0.8)",
            }} />
          </div>
        )}

        {/* Status overlays */}
        {(status === "loading" || status === "detecting" || status === "warping") && (
          <div style={overlayStyle}>
            <Spinner />
            <p style={{ color: "#fff", fontSize: 14, marginTop: 12 }}>
              {status === "loading" && "Loading scanner..."}
              {status === "detecting" && "Detecting tile..."}
              {status === "warping" && "Straightening..."}
            </p>
          </div>
        )}

        {status === "error" && (
          <div style={overlayStyle}>
            <p style={{ color: "#fff", fontSize: 14, textAlign: "center", padding: "0 32px", maxWidth: 320 }}>
              {errorMsg ?? "Something went wrong."}
            </p>
            <button
              onClick={handleRetry}
              style={{
                marginTop: 20,
                padding: "12px 24px",
                border: "1px solid #fff",
                borderRadius: 12,
                background: "transparent",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        display: "flex",
        gap: 12,
        padding: "12px 24px max(16px, env(safe-area-inset-bottom, 16px))",
        background: "#000",
        alignItems: "center",
      }}>
        <button onClick={onCancel} style={btnStyle("#333", "#fff")}>Cancel</button>
        <button
          onClick={handleReset}
          disabled={status !== "adjusting"}
          style={{
            ...btnStyle("transparent", "#fff"),
            flex: "0 0 auto",
            padding: "14px 16px",
            border: "1px solid #444",
            opacity: status === "adjusting" ? 1 : 0.4,
          }}
          aria-label="Reset corners"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <button
          onClick={handleConfirm}
          disabled={status !== "adjusting"}
          style={{ ...btnStyle("#fff", "#000"), opacity: status === "adjusting" ? 1 : 0.4 }}
        >
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

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

function Spinner() {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        border: "2px solid rgba(255,255,255,0.2)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "tt-spin 0.8s linear infinite",
      }}
    >
      <style>{`@keyframes tt-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
