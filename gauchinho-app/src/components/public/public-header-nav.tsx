"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, LogIn } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/simulador", label: "Simulador" },
  { href: "/calculadoras", label: "Calculadoras" },
  { href: "/grupos", label: "Grupos" },
  { href: "/cartas-contempladas", label: "Cartas" },
  { href: "/oportunidades-imobiliarias", label: "Imóveis" },
  { href: "/login", label: "Admin" },
] as const;

export function PublicHeaderNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <nav
        className="hidden items-center gap-x-6 text-sm font-medium text-zinc-400 md:flex"
        aria-label="Navegação principal"
      >
        {LINKS.filter((l) => l.href !== "/login").map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "transition hover:text-amber-400",
              pathname === l.href && "text-amber-400",
            )}
          >
            {l.label}
          </Link>
        ))}
        <Link
          href="#contato"
          className="rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-amber-300 transition hover:bg-amber-500/20 hover:text-amber-200"
        >
          Especialista
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-600/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-zinc-300 transition hover:border-amber-500/40 hover:text-amber-300"
        >
          <LogIn className="h-3.5 w-3.5" />
          Login
        </Link>
      </nav>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg border border-zinc-700 p-2 text-zinc-200 md:hidden"
        aria-expanded={open}
        aria-controls="public-nav-mobile"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sr-only">Menu</span>
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open ? (
        <div
          id="public-nav-mobile"
          className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-md md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-end p-4">
            <button
              type="button"
              className="rounded-lg border border-zinc-700 p-2 text-zinc-200"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 px-6 py-4" aria-label="Navegação mobile">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-lg px-4 py-3 text-lg font-medium text-zinc-200 hover:bg-zinc-900",
                  pathname === l.href && "bg-zinc-900 text-amber-400",
                )}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="#contato"
              className="mt-2 rounded-full bg-amber-500 px-4 py-3 text-center text-sm font-bold text-zinc-950"
            >
              Falar com especialista
            </Link>
          </nav>
        </div>
      ) : null}
    </>
  );
}
