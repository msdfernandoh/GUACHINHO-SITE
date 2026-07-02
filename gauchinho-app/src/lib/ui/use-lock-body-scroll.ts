"use client";

import { useEffect } from "react";

let lockCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";

function lockBody() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;
    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarGap > 0) {
      document.body.style.paddingRight = `${scrollbarGap}px`;
    }
  }
  lockCount += 1;
}

function unlockBody() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

/** Trava scroll do documento com contador (menu/modal/chat). Restaura ao desmontar. */
export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockBody();
    return () => unlockBody();
  }, [active]);
}

export function clearLenisScrollArtifacts() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("lenis", "lenis-smooth", "lenis-stopped");
  document.documentElement.style.removeProperty("height");
  document.documentElement.style.removeProperty("overflow");
  document.body.style.removeProperty("overflow");
}
