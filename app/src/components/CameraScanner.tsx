"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface CameraScannerProps {
  onConfirm: (warpedUrl: string) => void;
  onCancel: () => void;
}

type Point = { x: number; y: number };
type Quad = [Point, Point, Point, Point];

type Stage = "permission" | "live" | "captured" | "warping" | "error";

const CV_URL = "https://docs.opencv.org/4.10.0/opencv.js";
const CV_INIT_TIMEOUT_MS = 30000;
const OUT_SIZE = 1024;
const DETECT_INTERVAL_MS = 200; // ~5 fps detection in live mode
const PROCESS_MAX_DIM = 640;
const HANDLE_R = 14;
const MAGNIFIER_SIZE = 110;
const MAGNIFIER_ZOOM = 2;

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
    const started = Date.now();
    const poll = () => {
      if (settled) return;
      const cv = window.cv as CvLike | undefined;
      if (cv && typeof cv.Mat === "function") return finish(cv);
      if (Date.now() - started > CV_INIT_TIMEOUT_MS) {
        return finish(new Error("Scanner took too long to load"));
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
function detectQuadFromCanvas(cv: any, srcCanvas: HTMLCanvasElement, naturalW: number, naturalH: number): Quad | null {
  const scale = Math.min(1, PROCESS_MAX_DIM / Math.max(srcCanvas.width, srcCanvas.height));
  const sw = Math.round(srcCanvas.width * scale);
  const sh = Math.round(srcCanvas.height * scale);
  // Re-scale relative to natural dims
  const toNaturalX = naturalW / sw;
  const toNaturalY = naturalH / sh;

  const tmp = document.createElement("canvas");
  tmp.width = sw;
  tmp.height = sh;
  tmp.getContext("2d")!.drawImage(srcCanvas, 0, 0, sw, sh);

  const src = cv.imread(tmp);
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
            x: approx.data32S[j * 2] * toNaturalX,
            y: approx.data32S[j * 2 + 1] * toNaturalY,
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
function warpQuad(cv: any, srcCanvas: HTMLCanvasElement, quad: Quad): Promise<string> {
  return new Promise((resolve, reject) => {
    const src = cv.imread(srcCanvas);
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

export default function CameraScanner({ onConfirm, onCancel }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cvRef = useRef<any>(null);
  const capturedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectionLoopRef = useRef<number | null>(null);

  const [stage, setStage] = useState<Stage>("permission");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0 });
  const [bounds, setBounds] = useState<DisplayBounds>({ left: 0, top: 0, width: 0, height: 0, scale: 1 });
  const [liveQuad, setLiveQuad] = useState<Quad | null>(null);
  const [capturedQuad, setCapturedQuad] = useState<Quad | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [activeHandle, setActiveHandle] = useState<number | null>(null);
  const [pointerPos, setPointerPos] = useState<Point | null>(null);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const debugLog = useCallback((line: string) => {
    setDebugLines((prev) => [...prev.slice(-9), `${Date.now() % 100000}: ${line}`]);
  }, []);
  const [debugTick, setDebugTick] = useState(0);

  // Start camera + load OpenCV in parallel
  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        debugLog(`mediaDevices: ${typeof navigator !== "undefined" ? !!navigator.mediaDevices : "no nav"}`);
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          const isStandalone = typeof window !== "undefined" && (
            window.matchMedia?.("(display-mode: standalone)").matches ||
            (window.navigator as Navigator & { standalone?: boolean }).standalone === true
          );
          throw new Error(
            isStandalone
              ? "Camera API unavailable in installed app. Open the site in Safari instead."
              : "Camera API not supported in this browser."
          );
        }

        debugLog("calling getUserMedia...");
        const stream = await Promise.race([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1920 } },
            audio: false,
          }),
          new Promise<MediaStream>((_, reject) =>
            setTimeout(() => reject(new Error("Camera prompt timed out — check site permissions")), 12000)
          ),
        ]);
        debugLog(`stream got, tracks=${stream.getVideoTracks().length}`);

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error("Video element missing");
        debugLog(`video el found, rs=${video.readyState}`);
        video.setAttribute("playsinline", "true");
        video.muted = true;
        video.srcObject = stream;
        debugLog(`srcObject set, rs=${video.readyState}`);

        // Pass to live immediately and rely on the video element to start
        // rendering frames once metadata is ready. Don't gate the UI on
        // loadedmetadata — on some iOS PWA builds it never fires even
        // though the stream is live.
        setStage("live");
        video.play()
          .then(() => debugLog(`play() OK, rs=${video.readyState} vw=${video.videoWidth}`))
          .catch((err) => debugLog(`play() ERR: ${err?.message ?? err}`));

        video.addEventListener("loadedmetadata", () => {
          debugLog(`loadedmetadata vw=${video.videoWidth} vh=${video.videoHeight}`);
          setVideoSize({ w: video.videoWidth, h: video.videoHeight });
        }, { once: true });
        video.addEventListener("playing", () => {
          debugLog(`playing vw=${video.videoWidth} vh=${video.videoHeight}`);
          setVideoSize({ w: video.videoWidth, h: video.videoHeight });
        }, { once: true });
      } catch (e) {
        const err = e as Error;
        console.error("camera error:", err);
        debugLog(`ERROR: ${err.name || "?"} — ${err.message ?? err}`);
        if (!cancelled) {
          let msg = err.message || "Couldn't access camera.";
          if (err.name === "NotAllowedError") msg = "Camera permission denied. Enable it for this site in iOS Settings → Safari.";
          else if (err.name === "NotFoundError") msg = "No camera found on this device.";
          else if (err.name === "NotReadableError") msg = "Camera is being used by another app.";
          else if (err.name) msg = `${err.name}: ${err.message}`;
          setErrorMsg(msg);
          setStage("error");
        }
      }
    };

    // Kick off OpenCV load (best-effort; not required to show the live feed)
    loadOpenCv().then((cv) => {
      if (!cancelled) cvRef.current = cv;
    }).catch((e) => {
      console.warn("opencv preload failed (will retry on capture):", e);
    });

    startCamera();

    return () => {
      cancelled = true;
      if (detectionLoopRef.current !== null) clearTimeout(detectionLoopRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Poll video element state into debug panel
  useEffect(() => {
    const id = setInterval(() => setDebugTick((t) => t + 1), 800);
    return () => clearInterval(id);
  }, []);

  // Track display bounds
  useEffect(() => {
    const update = () => {
      if (!containerRef.current || !videoSize.w) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      setBounds(getDisplayBounds(cw, ch, videoSize.w, videoSize.h));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [videoSize]);

  // Real-time detection loop in live stage
  useEffect(() => {
    if (stage !== "live") return;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      const cv = cvRef.current;
      if (video && cv && video.videoWidth > 0) {
        const tmp = document.createElement("canvas");
        tmp.width = video.videoWidth;
        tmp.height = video.videoHeight;
        tmp.getContext("2d")!.drawImage(video, 0, 0);
        try {
          const q = detectQuadFromCanvas(cv, tmp, video.videoWidth, video.videoHeight);
          if (!stopped) setLiveQuad(q);
        } catch (e) {
          console.warn("detect error:", e);
        }
      }
      detectionLoopRef.current = window.setTimeout(tick, DETECT_INTERVAL_MS);
    };

    detectionLoopRef.current = window.setTimeout(tick, DETECT_INTERVAL_MS);
    return () => {
      stopped = true;
      if (detectionLoopRef.current !== null) clearTimeout(detectionLoopRef.current);
    };
  }, [stage]);

  const toDisplay = useCallback((p: Point): Point => ({
    x: bounds.left + p.x * bounds.scale,
    y: bounds.top + p.y * bounds.scale,
  }), [bounds]);

  const toNatural = useCallback((x: number, y: number, w: number, h: number): Point => ({
    x: Math.max(0, Math.min(w, (x - bounds.left) / bounds.scale)),
    y: Math.max(0, Math.min(h, (y - bounds.top) / bounds.scale)),
  }), [bounds]);

  const handleShutter = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    capturedCanvasRef.current = canvas;

    // Stop camera stream and live detection
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (detectionLoopRef.current !== null) {
      clearTimeout(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setCapturedUrl(url);
      setVideoSize({ w: canvas.width, h: canvas.height });

      // Use the last live quad if available; otherwise re-detect on the snapshot;
      // otherwise default to inner margin
      let initial = liveQuad;
      if (!initial && cvRef.current) {
        try {
          initial = detectQuadFromCanvas(cvRef.current, canvas, canvas.width, canvas.height);
        } catch (e) {
          console.warn(e);
        }
      }
      setCapturedQuad(initial ?? defaultQuad(canvas.width, canvas.height));
      setStage("captured");
    }, "image/jpeg", 0.92);
  }, [liveQuad]);

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
    const canvas = capturedCanvasRef.current;
    if (!canvas) return;
    setCapturedQuad((prev) => {
      if (!prev) return prev;
      const next = [...prev] as Quad;
      next[idx] = toNatural(cx, cy, canvas.width, canvas.height);
      return next;
    });
  }, [activeHandle, toNatural]);

  const onHandleUp = useCallback(() => {
    setActiveHandle(null);
    setPointerPos(null);
  }, []);

  const handleRetake = useCallback(async () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedQuad(null);
    capturedCanvasRef.current = null;
    setStage("permission");
    // Restart camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
        setVideoSize({ w: video.videoWidth, h: video.videoHeight });
        setStage("live");
      }
    } catch (e) {
      const err = e as Error;
      setErrorMsg("Couldn't access camera.");
      console.error(err);
      setStage("error");
    }
  }, [capturedUrl]);

  const handleConfirm = useCallback(async () => {
    if (!capturedQuad || !capturedCanvasRef.current) return;
    if (!cvRef.current) {
      try {
        cvRef.current = await loadOpenCv();
      } catch (e) {
        setErrorMsg((e as Error).message ?? "Scanner not available");
        setStage("error");
        return;
      }
    }
    setStage("warping");
    try {
      const url = await warpQuad(cvRef.current, capturedCanvasRef.current, capturedQuad);
      onConfirm(url);
    } catch (e) {
      console.error(e);
      setErrorMsg("Couldn't process the image.");
      setStage("error");
    }
  }, [capturedQuad, onConfirm]);

  const v = videoRef.current;
  const liveDebug = v ? `rs=${v.readyState} pa=${v.paused} vw=${v.videoWidth} vh=${v.videoHeight} cw=${v.clientWidth} ch=${v.clientHeight}` : "no video el";
  const trackDebug = streamRef.current
    ? `active=${streamRef.current.active} tracks=${streamRef.current.getVideoTracks().map(t => `${t.readyState}/${t.muted ? "muted" : "ok"}`).join(",")}`
    : "no stream";
  // debugTick keeps this re-rendering even when nothing else changes
  void debugTick;

  const displayQuadLive = stage === "live" && liveQuad ? (liveQuad.map(toDisplay) as Quad) : null;
  const displayQuadCaptured = stage === "captured" && capturedQuad ? (capturedQuad.map(toDisplay) as Quad) : null;
  const activeDisplayQuad = displayQuadLive ?? displayQuadCaptured;
  const polyPoints = activeDisplayQuad ? activeDisplayQuad.map((p) => `${p.x},${p.y}`).join(" ") : "";

  // Magnifier position
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
      {/* Debug panel — top-left, always visible */}
      <div style={{
        position: "absolute",
        top: "max(40px, env(safe-area-inset-top, 40px))",
        left: 8,
        right: 8,
        zIndex: 1000,
        background: "rgba(0,0,0,0.75)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: 10,
        padding: "6px 8px",
        borderRadius: 6,
        lineHeight: 1.3,
        pointerEvents: "none",
        maxHeight: "30vh",
        overflow: "hidden",
      }}>
        <div>stage={stage} videoSize={videoSize.w}x{videoSize.h}</div>
        <div>{liveDebug}</div>
        <div>{trackDebug}</div>
        <div>cv={cvRef.current ? "ready" : "loading"}</div>
        <div style={{ marginTop: 4, borderTop: "1px solid #050", paddingTop: 4 }}>
          {debugLines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>

      <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Live video (always mounted; iOS won't play a display:none video) */}
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: stage === "captured" ? "none" : "block",
            pointerEvents: "none",
            background: "#000",
          }}
        />

        {/* Captured frame */}
        {capturedUrl && stage === "captured" && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={capturedUrl}
            alt="Captured tile"
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        )}

        {/* Quad overlay */}
        {activeDisplayQuad && containerRef.current && (
          <svg
            width={containerRef.current.clientWidth}
            height={containerRef.current.clientHeight}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            {stage === "captured" && (
              <>
                <defs>
                  <mask id="cam-quad-mask">
                    <rect width="100%" height="100%" fill="white" />
                    <polygon points={polyPoints} fill="black" />
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#cam-quad-mask)" />
              </>
            )}
            <polygon
              points={polyPoints}
              fill={stage === "live" ? "rgba(80,200,120,0.12)" : "rgba(255,255,255,0.04)"}
              stroke={stage === "live" ? "#5fdd8b" : "#fff"}
              strokeWidth={2}
            />
          </svg>
        )}

        {/* Handles (only in captured stage) */}
        {displayQuadCaptured && displayQuadCaptured.map((p, idx) => (
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
        {activeHandle !== null && pointerPos && magnifierPos && capturedUrl && (
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
                backgroundImage: `url(${capturedUrl})`,
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

        {/* Permission / loading state */}
        {stage === "permission" && (
          <div style={overlayStyle}>
            <Spinner />
            <p style={{ color: "#fff", fontSize: 14, marginTop: 12 }}>Starting camera...</p>
          </div>
        )}

        {stage === "warping" && (
          <div style={overlayStyle}>
            <Spinner />
            <p style={{ color: "#fff", fontSize: 14, marginTop: 12 }}>Straightening...</p>
          </div>
        )}

        {stage === "error" && (
          <div style={overlayStyle}>
            <p style={{ color: "#fff", fontSize: 14, textAlign: "center", padding: "0 32px", maxWidth: 320 }}>
              {errorMsg ?? "Something went wrong."}
            </p>
            <button
              onClick={onCancel}
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
              Close
            </button>
          </div>
        )}

        {/* Hint banner in live mode */}
        {stage === "live" && (
          <div style={{
            position: "absolute",
            top: "max(16px, env(safe-area-inset-top, 16px))",
            left: 16,
            right: 16,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}>
            <div style={{
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontSize: 13,
              padding: "8px 14px",
              borderRadius: 999,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}>
              {liveQuad ? "Tile detected — tap shutter" : "Point at a tile"}
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{
        display: "flex",
        gap: 12,
        padding: "16px 24px max(20px, env(safe-area-inset-bottom, 20px))",
        background: "#000",
        alignItems: "center",
        justifyContent: stage === "live" ? "space-between" : "stretch",
      }}>
        {stage === "live" && (
          <>
            <button onClick={onCancel} style={textBtn}>Cancel</button>
            <button
              onClick={handleShutter}
              aria-label="Capture"
              style={{
                width: 68,
                height: 68,
                borderRadius: "50%",
                background: "#fff",
                border: "4px solid rgba(255,255,255,0.4)",
                outline: "none",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                boxShadow: "0 0 0 2px #fff",
              }}
            />
            <div style={{ width: 60 }} />
          </>
        )}

        {stage === "captured" && (
          <>
            <button onClick={handleRetake} style={btnSecondary}>Retake</button>
            <button onClick={handleConfirm} style={btnPrimary}>Use photo</button>
          </>
        )}

        {(stage === "permission" || stage === "warping" || stage === "error") && (
          <button onClick={onCancel} style={btnSecondary}>Cancel</button>
        )}
      </div>
    </div>
  );
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

const textBtn: React.CSSProperties = {
  background: "transparent",
  color: "#fff",
  border: "none",
  fontSize: 16,
  fontWeight: 600,
  padding: 0,
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

const btnPrimary: React.CSSProperties = {
  flex: 1,
  padding: "14px 0",
  border: "none",
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
  background: "#fff",
  color: "#000",
  WebkitTapHighlightColor: "transparent",
};

const btnSecondary: React.CSSProperties = {
  flex: 1,
  padding: "14px 0",
  border: "none",
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
  background: "#333",
  color: "#fff",
  WebkitTapHighlightColor: "transparent",
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
