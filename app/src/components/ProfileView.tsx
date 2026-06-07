"use client";

import { useState } from "react";
import { haptic } from "@/lib/haptic";
import AccountSection from "./AccountSection";
import BackupSection from "./BackupSection";
import StatsPanel from "./StatsPanel";

export type ProfileTab = "account" | "stats";

/** Profile screen: account & sync front and center (the reason this screen
 * exists — tiles must survive switching phones), with collection stats kept
 * as a secondary tab. */
export default function ProfileView({
  onBack,
  initialTab = "account",
}: {
  onBack: () => void;
  initialTab?: ProfileTab;
}) {
  const [tab, setTab] = useState<ProfileTab>(initialTab);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--tt-bg)",
        color: "var(--tt-fg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "max(16px, env(safe-area-inset-top, 16px)) 16px 12px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            border: "none",
            background: "var(--tt-chip-bg)",
            color: "var(--tt-fg)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            WebkitTapHighlightColor: "transparent",
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
          Profile
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 16px 4px", flexShrink: 0 }}>
        <div
          style={{
            display: "flex",
            background: "var(--tt-chip-bg)",
            borderRadius: 12,
            padding: 3,
            gap: 3,
          }}
        >
          {(["account", "stats"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); haptic(4); }}
              style={{
                flex: 1,
                padding: "9px 8px",
                borderRadius: 9,
                border: "none",
                background: tab === t ? "var(--tt-bg)" : "transparent",
                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                fontSize: 14,
                fontWeight: 600,
                color: tab === t ? "var(--tt-fg)" : "var(--tt-muted)",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                transition: "background 0.2s ease, color 0.2s ease",
              }}
            >
              {t === "account" ? "Account" : "Stats"}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "8px 16px max(24px, env(safe-area-inset-bottom, 24px))",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {tab === "account" ? (
          <>
            <AccountSection />
            <BackupSection />
          </>
        ) : (
          <StatsPanel />
        )}
      </div>
    </div>
  );
}
