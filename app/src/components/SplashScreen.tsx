"use client";

import { useState, useEffect, useCallback } from "react";

const TILE_IMAGES = [
  "/tiles/terrazzo-star.png",
  "/tiles/zellige-rose.png",
  "/tiles/geometric-orange.png",
  "/tiles/floral-green.png",
];

// Each slot cycles through images in a different order
const SEQUENCES = [
  [0, 2, 1, 3],
  [1, 3, 0, 2],
  [2, 0, 3, 1],
  [3, 1, 2, 0],
];

export default function SplashScreen({ onFinished }: { onFinished: () => void }) {
  const [step, setStep] = useState(0);
  const [fading, setFading] = useState(false);

  // Cycle tile images fast
  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % TILE_IMAGES.length);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const fadeOut = useCallback(() => {
    setFading(true);
    setTimeout(onFinished, 600);
  }, [onFinished]);

  // Expose fadeOut via a data attribute so parent can trigger it
  useEffect(() => {
    (window as unknown as Record<string, () => void>).__splashFadeOut = fadeOut;
    return () => {
      delete (window as unknown as Record<string, () => void>).__splashFadeOut;
    };
  }, [fadeOut]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f2ed",
        transition: "opacity 0.6s ease",
        opacity: fading ? 0 : 1,
      }}
    >
      {/* 2x2 tile grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 0,
          width: 140,
          height: 140,
        }}
      >
        {SEQUENCES.map((seq, i) => (
          <TileSlot key={i} images={seq.map((idx) => TILE_IMAGES[idx])} step={step} delay={i * 0.1} />
        ))}
      </div>

      {/* App name */}
      <h1
        style={{
          marginTop: 32,
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          color: "#1a1a1a",
          opacity: 0,
          animation: "splashFadeIn 0.8s ease 0.3s forwards",
        }}
      >
        Tile Tales
      </h1>
      <p
        style={{
          marginTop: 6,
          fontSize: 13,
          color: "#8a8578",
          opacity: 0,
          animation: "splashFadeIn 0.8s ease 0.6s forwards",
        }}
      >
        Your street tile collection
      </p>

      <style>{`
        @keyframes splashFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function TileSlot({
  images,
  step,
  delay,
}: {
  images: string[];
  step: number;
  delay: number;
}) {
  const current = images[step % images.length];
  const prev = images[(step - 1 + images.length) % images.length];

  return (
    <div
      style={{
        width: 70,
        height: 70,
        borderRadius: 0,
        overflow: "hidden",
        position: "relative",
        perspective: 200,
        opacity: 0,
        animation: `splashFadeIn 0.5s ease ${delay + 0.1}s forwards`,
      }}
    >
      {/* Previous image fading out */}
      {step > 0 && (
        <img
          key={`prev-${step}`}
          src={prev}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            animation: `tileOut 0.4s ease forwards`,
            animationDelay: `${delay}s`,
          }}
        />
      )}
      {/* Current image fading in */}
      <img
        key={`curr-${step}`}
        src={current}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          animation: step === 0 ? "none" : `tileIn 0.4s ease forwards`,
          animationDelay: `${delay}s`,
          opacity: step === 0 ? 1 : 0,
          transform: "rotateY(0deg)",
        }}
      />

      <style>{`
        @keyframes tileIn {
          0% { opacity: 0; transform: rotateY(12deg) scale(0.95); }
          100% { opacity: 1; transform: rotateY(0deg) scale(1); }
        }
        @keyframes tileOut {
          0% { opacity: 1; transform: rotateY(0deg) scale(1); }
          100% { opacity: 0; transform: rotateY(-12deg) scale(0.95); }
        }
      `}</style>
    </div>
  );
}
