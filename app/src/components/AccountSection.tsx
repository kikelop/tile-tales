"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSyncAvailable, getSupabase } from "@/lib/supabase";
import { subscribeAuth, signInWithEmail, signOut } from "@/lib/auth";
import { subscribeSyncStatus, requestSync, type SyncStatus } from "@/lib/sync";
import { haptic } from "@/lib/haptic";
import { toast } from "@/lib/toast";

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--tt-input-border)",
  background: "var(--tt-input-bg)",
  fontSize: 14,
  color: "var(--tt-fg)",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid var(--tt-input-border)",
  background: "transparent",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--tt-fg)",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

function syncLabel(s: SyncStatus): string {
  if (s.state === "syncing") return "Syncing…";
  if (s.state === "error") return `Sync issue: ${s.error ?? "unknown"}`;
  if (s.lastSyncAt) {
    const mins = Math.round((Date.now() - s.lastSyncAt) / 60000);
    return mins < 1 ? "Synced just now" : `Synced ${mins} min ago`;
  }
  return "Waiting for first sync";
}

/** Account block for the Stats screen: magic-link sign in, sync status,
 * sign out and in-app account deletion (App Store guideline 5.1.1v). */
export default function AccountSection() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "off", lastSyncAt: null });
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => subscribeAuth(setSession), []);
  useEffect(() => subscribeSyncStatus(setSyncStatus), []);

  if (!isSyncAvailable()) return null;

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed || sending) return;
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      toast("That doesn't look like an email");
      return;
    }
    setSending(true);
    haptic(6);
    const error = await signInWithEmail(trimmed);
    setSending(false);
    if (error) {
      toast("Couldn't send the link — try again");
    } else {
      setLinkSent(true);
    }
  };

  const handleSignOut = async () => {
    haptic(6);
    await signOut();
    setLinkSent(false);
    setEmail("");
    toast("Signed out — your tiles stay on this device");
  };

  const handleDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    haptic(10);
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error("unavailable");
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      await signOut();
      setConfirmDelete(false);
      toast("Account deleted — your tiles stay on this device");
    } catch {
      toast("Couldn't delete the account — try again");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <h2
        style={{
          margin: "8px 0 0",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          color: "var(--tt-muted)",
        }}
      >
        Account & sync
      </h2>

      {!session ? (
        linkSent ? (
          <p style={{ fontSize: 13, color: "var(--tt-muted)", margin: "0 2px", lineHeight: 1.5 }}>
            Check your inbox — we sent a sign-in link to <strong style={{ color: "var(--tt-fg)" }}>{email.trim()}</strong>.
            Open it on this device to finish.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSend(); }}
                style={inputStyle}
              />
              <button
                onClick={() => void handleSend()}
                disabled={sending || !email.trim()}
                style={{
                  ...buttonStyle,
                  background: "var(--tt-accent)",
                  border: "1px solid var(--tt-accent)",
                  color: "#fff",
                  opacity: sending || !email.trim() ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                {sending ? "Sending…" : "Sign in"}
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--tt-muted)", margin: "0 2px 4px", lineHeight: 1.4 }}>
              No password — we email you a sign-in link. Your tiles back up automatically and follow you to any device.
            </p>
          </>
        )
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "12px 14px",
              borderRadius: 12,
              background: "var(--tt-chip-bg)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session.user.email}
              </div>
              <div style={{ fontSize: 12, color: syncStatus.state === "error" ? "#b3402a" : "var(--tt-muted)", marginTop: 2 }}>
                {syncLabel(syncStatus)}
              </div>
            </div>
            <button
              onClick={() => void requestSync()}
              disabled={syncStatus.state === "syncing"}
              aria-label="Sync now"
              style={{ ...buttonStyle, padding: "8px 12px", fontSize: 13, flexShrink: 0 }}
            >
              {syncStatus.state === "syncing" ? "…" : "Sync now"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => void handleSignOut()} style={{ ...buttonStyle, flex: 1 }}>
              Sign out
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ ...buttonStyle, flex: 1, color: "#b3402a", borderColor: "rgba(179, 64, 42, 0.35)" }}
            >
              Delete account
            </button>
          </div>

          {confirmDelete && (
            <div
              style={{
                padding: "14px",
                borderRadius: 12,
                border: "1px solid rgba(179, 64, 42, 0.35)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                This deletes your account and everything backed up to it. Tiles on this device are kept. This can&apos;t be undone.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ ...buttonStyle, flex: 1 }}>
                  Cancel
                </button>
                <button
                  onClick={() => void handleDeleteAccount()}
                  disabled={deleting}
                  style={{
                    ...buttonStyle,
                    flex: 1,
                    background: "#b3402a",
                    border: "1px solid #b3402a",
                    color: "#fff",
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? "Deleting…" : "Delete forever"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
