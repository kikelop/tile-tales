"use client";

import { useEffect, useState } from "react";
import { subscribeToast } from "@/lib/toast";

export default function Toaster() {
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;
    let clearTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const unsub = subscribeToast((msg) => {
      if (hideTimeout) clearTimeout(hideTimeout);
      if (clearTimeoutId) clearTimeout(clearTimeoutId);
      setMessage(msg);
      setVisible(true);
      hideTimeout = setTimeout(() => {
        setVisible(false);
        clearTimeoutId = setTimeout(() => setMessage(null), 220);
      }, 2000);
    });

    return () => {
      unsub();
      if (hideTimeout) clearTimeout(hideTimeout);
      if (clearTimeoutId) clearTimeout(clearTimeoutId);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(96px, calc(env(safe-area-inset-bottom, 12px) + 96px))",
        transform: `translate(-50%, ${visible ? 0 : 8}px)`,
        opacity: visible ? 1 : 0,
        background: "rgba(26,26,26,0.92)",
        color: "#fff",
        padding: "10px 18px",
        borderRadius: 22,
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: "-0.01em",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        zIndex: 200,
        pointerEvents: "none",
        transition: "opacity 0.22s ease, transform 0.22s ease",
        maxWidth: "calc(100vw - 32px)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {message}
    </div>
  );
}
