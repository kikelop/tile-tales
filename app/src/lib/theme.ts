"use client";

export type Theme = "light" | "dark";

const STORAGE_KEY = "tile-tales-theme";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {}
  return null;
}

export function systemTheme(): Theme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getActiveTheme(): Theme {
  return getStoredTheme() ?? systemTheme();
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function setTheme(theme: Theme) {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  applyTheme(theme);
}

type Listener = (theme: Theme) => void;
const listeners = new Set<Listener>();

export function subscribeTheme(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function notifyThemeChange(theme: Theme) {
  listeners.forEach((l) => l(theme));
}
