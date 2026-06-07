"use client";

import { useEffect } from "react";
import { startSync } from "@/lib/sync";

/** Mounts once in the root layout and boots the sync engine (no UI). */
export default function SyncBoot() {
  useEffect(() => {
    startSync();
  }, []);
  return null;
}
