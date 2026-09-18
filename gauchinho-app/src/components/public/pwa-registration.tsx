"use client";

import { useEffect } from "react";

/** Registra o service worker em todo o site, requisito para instalação PWA. */
export function PwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);
  return null;
}
