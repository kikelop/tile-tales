"use client";

import { useEffect, useState } from "react";
import { subscribeToast, toast } from "@/lib/toast";
import { STORAGE_FAILURE_EVENT } from "@/lib/blob-storage";
import { getInitialPurgedCount } from "@/lib/store";

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

    // Storage failure (private mode, blocked IDB): warn once per session.
    const onStorageFailure = () => {
      toast("Storage unavailable — captures won't persist");
    };
    window.addEventListener(STORAGE_FAILURE_EVENT, onStorageFailure);

    // Migration toast: if loadState filtered out broken tiles, let the
    // user know instead of silently shrinking the grid.
    const purged = getInitialPurgedCount();
    let migrationTimeout: ReturnType<typeof setTimeout> | null = null;
    if (purged > 0) {
      migrationTimeout = setTimeout(() => {
        toast(`Cleaned up ${purged} broken tile${purged > 1 ? "s" : ""}`);
      }, 800);
    }

    return () => {
      unsub();
      window.removeEventListener(STORAGE_FAILURE_EVENT, onStorageFailure);
      if (hideTimeout) clearTimeout(hideTimeout);
      if (clearTimeoutId) clearTimeout(clearTimeoutId);
      if (migrationTimeout) clearTimeout(migrationTimeout);
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
