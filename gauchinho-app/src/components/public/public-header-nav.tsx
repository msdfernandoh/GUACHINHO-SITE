"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogIn, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { EspecialistaLeadModal } from "@/components/public/especialista-lead-modal";

const PRIMARY_LINKS = [
  { href: "/", label: "Início" },
  { href: "/simulador", label: "Simulador" },
  { href: "/calculadoras", label: "Calculadoras" },
  { href: "/eventos", label: "Eventos" },
  { href: "/grupos", label: "Grupos" },
  { href: "/cartas-contempladas", label: "Contempladas" },
  { href: "/oportunidades-imobiliarias", label: "Imobiliárias" },
  { href: "/seguradoras", label: "Seguradoras" },
  { href: "/indicar", label: "Indicação" },
] as const;

function readPublicHeaderHeight(): number {
  if (typeof document === "undefined") return 64;
  const header = document.querySelector("header");
  return header?.getBoundingClientRect().height ?? 64;
}

export function PublicHeaderNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [especialistaOpen, setEspecialistaOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuTopPx, setMenuTopPx] = useState(64);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const syncTop = () => setMenuTopPx(readPublicHeaderHeight());
    syncTop();
    window.addEventListener("resize", syncTop, { passive: true });
    return () => window.removeEventListener("resize", syncTop);
  }, [open]);

  const closeMobile = () => setOpen(false);

  const linkClass = (href: string) =>
    cn("whitespace-nowrap transition hover:text-amber-400", pathname === href && "text-amber-400");

  const allMobile = PRIMARY_LINKS;

  const mobilePanel =
    open && mounted ? (
      <div
        id="public-nav-mobile"
        className="fixed inset-x-0 z-[9999] max-h-[calc(100dvh-var(--public-header-h,4rem))] overflow-y-auto overflow-x-hidden border-t border-white/10 bg-[#07111f] shadow-2xl lg:hidden"
        style={{ top: menuTopPx, ["--public-header-h" as string]: `${menuTopPx}px` }}
        role="dialog"
        aria-modal="true"
      >
        <nav className="mx-auto flex max-w-screen-xl flex-col gap-1 px-5 py-5" aria-label="Navegação mobile">
          {allMobile.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-4 py-3 text-base font-medium text-zinc-100 hover:bg-white/5",
                pathname === l.href && "bg-white/5 text-amber-400",
              )}
              onClick={closeMobile}
            >
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            className="mt-2 rounded-full bg-amber-500 px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-zinc-950"
            onClick={() => {
              closeMobile();
              setEspecialistaOpen(true);
            }}
          >
            Especialista
          </button>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-600/60 px-4 py-3 text-sm font-bold uppercase tracking-wide text-zinc-200 hover:border-amber-500/40"
            onClick={closeMobile}
          >
            <LogIn className="h-4 w-4" aria-hidden />
            Login
          </Link>
        </nav>
      </div>
    ) : null;

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 lg:min-w-0 lg:flex-1 lg:justify-end">
        <nav
          className="hidden min-w-0 flex-1 items-center justify-end gap-x-3 text-sm font-medium text-zinc-400 lg:flex xl:gap-x-4"
          aria-label="Navegação principal"
        >
          {PRIMARY_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setEspecialistaOpen(true)}
            className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-300 hover:bg-amber-500/20 xl:px-4"
          >
            Especialista
          </button>
          <Link
            href="/login"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-600/60 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-300 hover:border-amber-500/40 xl:px-4"
          >
            <LogIn className="h-3.5 w-3.5" />
            Login
          </Link>
        </nav>
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-700 p-2 text-zinc-200 lg:hidden"
          aria-expanded={open}
          aria-controls="public-nav-mobile"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Menu</span>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {mobilePanel && typeof document !== "undefined" ? createPortal(mobilePanel, document.body) : null}
      <EspecialistaLeadModal open={especialistaOpen} onClose={() => setEspecialistaOpen(false)} />
    </>
  );
}
