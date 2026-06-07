"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSyncAvailable, getSupabase } from "@/lib/supabase";
import {
  subscribeAuth,
  isRecoveryPending,
  signIn,
  signUp,
  requestPasswordReset,
  updatePassword,
  signOut,
} from "@/lib/auth";
import { subscribeSyncStatus, requestSync, type SyncStatus } from "@/lib/sync";
import { haptic } from "@/lib/haptic";
import { toast } from "@/lib/toast";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
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

const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "var(--tt-accent)",
  border: "1px solid var(--tt-accent)",
  color: "#fff",
};

const linkButtonStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  padding: 0,
  fontSize: 13,
  fontWeight: 600,
  color: "var(--tt-accent)",
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

type Mode = "signin" | "signup" | "forgot";

/** Account block for the Stats screen: email+password auth, sync status,
 * sign out and in-app account deletion (App Store guideline 5.1.1v). */
export default function AccountSection() {
  const [session, setSession] = useState<Session | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "off", lastSyncAt: null });
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(
    () =>
      subscribeAuth((s) => {
        setSession(s);
        setRecovery(isRecoveryPending());
      }),
    []
  );
  useEffect(() => subscribeSyncStatus(setSyncStatus), []);

  if (!isSyncAvailable()) return null;

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  const handleSubmit = async () => {
    if (busy) return;
    setFormError(null);
    if (!validEmail) {
      setFormError("That doesn't look like an email");
      return;
    }
    if (mode !== "forgot" && password.length < 8) {
      setFormError("Password needs at least 8 characters");
      return;
    }
    setBusy(true);
    haptic(6);
    let error: string | null = null;
    if (mode === "signin") error = await signIn(email.trim(), password);
    else if (mode === "signup") error = await signUp(email.trim(), password);
    else {
      error = await requestPasswordReset(email.trim());
      if (!error) setResetSent(true);
    }
    setBusy(false);
    if (error) setFormError(error);
    else if (mode !== "forgot") {
      setPassword("");
      toast(mode === "signup" ? "Account created — backing up your tiles" : "Signed in");
    }
  };

  const handleSetNewPassword = async () => {
    if (busy) return;
    setFormError(null);
    if (newPassword.length < 8) {
      setFormError("Password needs at least 8 characters");
      return;
    }
    setBusy(true);
    const error = await updatePassword(newPassword);
    setBusy(false);
    if (error) setFormError(error);
    else {
      setNewPassword("");
      setRecovery(false);
      toast("Password updated");
    }
  };

  const handleSignOut = async () => {
    haptic(6);
    await signOut();
    setMode("signin");
    setEmail("");
    setPassword("");
    setFormError(null);
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

  const switchMode = (next: Mode) => {
    setMode(next);
    setFormError(null);
    setResetSent(false);
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
        <>
          {mode === "forgot" && resetSent ? (
            <p style={{ fontSize: 13, color: "var(--tt-muted)", margin: "0 2px", lineHeight: 1.5 }}>
              If <strong style={{ color: "var(--tt-fg)" }}>{email.trim()}</strong> has an account,
              a reset link is on its way. Open it on this device to set a new password.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
              {mode !== "forgot" && (
                <input
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder="Password (8+ characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
                  style={inputStyle}
                />
              )}
              {formError && (
                <p style={{ fontSize: 13, color: "#b3402a", margin: "0 2px" }}>{formError}</p>
              )}
              <button
                onClick={() => void handleSubmit()}
                disabled={busy || !email.trim()}
                style={{ ...primaryButtonStyle, opacity: busy || !email.trim() ? 0.5 : 1 }}
              >
                {busy
                  ? "…"
                  : mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : "Send reset link"}
              </button>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", padding: "0 2px 4px" }}>
            {mode === "signin" ? (
              <>
                <button onClick={() => switchMode("signup")} style={linkButtonStyle}>
                  Create account
                </button>
                <button onClick={() => switchMode("forgot")} style={{ ...linkButtonStyle, color: "var(--tt-muted)" }}>
                  Forgot password?
                </button>
              </>
            ) : (
              <button onClick={() => switchMode("signin")} style={linkButtonStyle}>
                ← Back to sign in
              </button>
            )}
          </div>
          {mode === "signup" && (
            <p style={{ fontSize: 12, color: "var(--tt-muted)", margin: "0 2px 4px", lineHeight: 1.4 }}>
              Your tiles back up automatically and follow you to any device.
            </p>
          )}
        </>
      ) : recovery ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 13, color: "var(--tt-muted)", margin: "0 2px", lineHeight: 1.5 }}>
            Set a new password for <strong style={{ color: "var(--tt-fg)" }}>{session.user.email}</strong>.
          </p>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password (8+ characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSetNewPassword(); }}
            style={inputStyle}
          />
          {formError && <p style={{ fontSize: 13, color: "#b3402a", margin: "0 2px" }}>{formError}</p>}
          <button
            onClick={() => void handleSetNewPassword()}
            disabled={busy || !newPassword}
            style={{ ...primaryButtonStyle, opacity: busy || !newPassword ? 0.5 : 1 }}
          >
            {busy ? "…" : "Save new password"}
          </button>
        </div>
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
