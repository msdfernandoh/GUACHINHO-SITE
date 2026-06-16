"use client";

import { useEffect, useState, type ReactNode } from "react";

export function PublicHeaderWrapper({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={className}
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        transition: "all 0.4s ease",
        borderBottom: scrolled
          ? "1px solid rgba(201,168,76,0.2)"
          : "1px solid rgba(255,255,255,0.06)",
        background: scrolled
          ? "rgba(10,22,40,0.92)"
          : "rgba(10,22,40,0.60)",
        backdropFilter: "blur(20px)",
        boxShadow: scrolled ? "0 4px 32px rgba(0,0,0,0.4)" : "none",
      }}
    >
      {children}
    </header>
  );
}
