"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";

export default function ScreenTransition({
  screenKey,
  children,
}: {
  screenKey: string;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const prevKey = useRef(screenKey);

  useEffect(() => {
    if (screenKey !== prevKey.current) {
      setVisible(false);
      const timeout = setTimeout(() => {
        prevKey.current = screenKey;
        setVisible(true);
      }, 30);
      return () => clearTimeout(timeout);
    } else {
      setVisible(true);
    }
  }, [screenKey]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 0.3s ease, transform 0.3s ease",
        position: "fixed",
        inset: 0,
      }}
    >
      {children}
    </div>
  );
}
