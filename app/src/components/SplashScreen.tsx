"use client";
/* eslint-disable @next/next/no-img-element -- decorative animated splash tiles, next/image adds nothing here */

import { useState, useEffect, useCallback } from "react";
import Wordmark from "./Wordmark";

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
        background: "var(--tt-accent)",
        transition: "opacity 0.6s ease",
        opacity: fading ? 0 : 1,
      }}
    >
      {/* 2x2 tile grid, white frame lines like a real azulejo panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 3,
          padding: 3,
          background: "#ffffff",
          width: 146,
          height: 146,
        }}
      >
        {SEQUENCES.map((seq, i) => (
          <TileSlot key={i} images={seq.map((idx) => TILE_IMAGES[idx])} step={step} delay={i * 0.1} />
        ))}
      </div>

      {/* Brand wordmark */}
      <h1
        style={{
          margin: "36px 0 0",
          color: "#ffffff",
          opacity: 0,
          animation: "splashFadeIn 0.8s ease 0.3s forwards",
        }}
      >
        <Wordmark height={31} style={{ display: "block" }} />
      </h1>
      <p
        style={{
          marginTop: 8,
          fontSize: 13,
          color: "rgba(255, 255, 255, 0.65)",
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

// Splash brand blue — white-on-blue duotone, like a painted azulejo
const SPLASH_BLUE = "#0049B4";

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

  // Grayscale + screen blend over the blue base: darks become blue,
  // lights stay white — white-on-blue duotone.
  const imgStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "grayscale(1) contrast(2.2) brightness(1.1)",
    mixBlendMode: "screen",
  };

  return (
    <div
      style={{
        borderRadius: 0,
        overflow: "hidden",
        position: "relative",
        perspective: 200,
        opacity: 0,
        animation: `splashFadeIn 0.5s ease ${delay + 0.1}s forwards`,
        background: SPLASH_BLUE,
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
