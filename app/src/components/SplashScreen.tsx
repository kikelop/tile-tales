"use client";
/* eslint-disable @next/next/no-img-element -- decorative animated splash tiles, next/image adds nothing here */

import { useState, useEffect, useCallback } from "react";

const TILE_IMAGES = [
  "/tiles/terrazzo-star.webp",
  "/tiles/zellige-rose.webp",
  "/tiles/geometric-orange.webp",
  "/tiles/floral-green.webp",
  "/tiles/floral-multicolor.webp",
  "/tiles/green-baroque.webp",
  "/tiles/pink-marble.webp",
  "/tiles/yellow-zellige.webp",
  "/tiles/star-blue-gold.webp",
  "/tiles/star-compass.webp",
  "/tiles/blue-floral-delft.webp",
  "/tiles/fleur-de-lis-rust.webp",
  "/tiles/black-baroque.webp",
  "/tiles/ochre-scrollwork.webp",
];

// Each slot cycles through images in a different staggered order
const SEQUENCES = [
  [0, 4, 8, 12, 2, 6, 10, 1, 5, 9, 13, 3, 7, 11],
  [3, 7, 11, 1, 5, 9, 13, 0, 4, 8, 12, 2, 6, 10],
  [6, 10, 0, 4, 8, 12, 2, 7, 11, 1, 5, 9, 13, 3],
  [9, 13, 3, 7, 11, 1, 5, 10, 0, 4, 8, 12, 2, 6],
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

const DUO_DARK = "#4a6fa5";

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

  const imgStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "grayscale(1) contrast(1.8)",
  };

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
        background: DUO_DARK,
      }}
    >
      {/* Previous image fading out */}
      {step > 0 && (
        <img
          key={`prev-${step}`}
          src={prev}
          alt=""
          style={{
            ...imgStyle,
            mixBlendMode: "luminosity",
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
          ...imgStyle,
          mixBlendMode: "luminosity",
          animation: step === 0 ? "none" : `tileIn 0.4s ease forwards`,
          animationDelay: `${delay}s`,
          opacity: step === 0 ? 1 : 0,
          transform: "rotateY(0deg)",
        }}
      />
      {/* Duotone color overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${DUO_DARK}, ${DUO_DARK})`,
          mixBlendMode: "color",
          pointerEvents: "none",
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
