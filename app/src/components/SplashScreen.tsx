"use client";
/* eslint-disable @next/next/no-img-element -- decorative splash tile, next/image adds nothing here */

import { useState, useEffect, useCallback } from "react";
import Wordmark from "./Wordmark";

export default function SplashScreen({ onFinished }: { onFinished: () => void }) {
  const [fading, setFading] = useState(false);

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
      {/* Single brand tile — white-on-indigo vector azulejo.
          Sizes from Figma 70-720: tile 27vw, gap ~32% of tile, wordmark 52vw. */}
      <img
        src="/tiles/flor-azul.svg"
        alt=""
        style={{
          width: "min(27vw, 150px)",
          height: "auto",
          opacity: 0,
          animation: "splashTileIn 0.9s ease 0.1s forwards",
        }}
      />

      {/* Brand wordmark */}
      <h1
        style={{
          margin: "min(8.6vw, 44px) 0 0",
          color: "#ffffff",
          opacity: 0,
          animation: "splashFadeIn 0.8s ease 0.4s forwards",
        }}
      >
        <Wordmark
          style={{ display: "block", width: "min(52vw, 268px)", height: "auto" }}
        />
      </h1>

      <style>{`
        @keyframes splashFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashTileIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
