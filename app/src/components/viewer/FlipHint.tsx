"use client";

export default function FlipHint({ visible }: { visible: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 24,
        transform: `translate(-50%, ${visible ? 0 : 8}px)`,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease, transform 0.3s ease",
        background: "rgba(26,26,26,0.85)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 500,
        padding: "8px 14px",
        borderRadius: 18,
        display: "flex",
        alignItems: "center",
        gap: 8,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        pointerEvents: "none",
        zIndex: 10,
        whiteSpace: "nowrap",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <polyline points="21 4 21 10 15 10" />
      </svg>
      Drag to flip and see the memory
    </div>
  );
}
