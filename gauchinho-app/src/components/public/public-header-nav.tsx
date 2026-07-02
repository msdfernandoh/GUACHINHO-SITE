"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, LogIn, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { EspecialistaLeadModal } from "@/components/public/especialista-lead-modal";
import { useLockBodyScroll } from "@/lib/ui/use-lock-body-scroll";

const PRIMARY_LINKS = [
  { href: "/", label: "Início" },
  { href: "/simulador", label: "Simulador" },
  { href: "/calculadoras", label: "Calculadoras" },
  { href: "/eventos", label: "Eventos" },
  { href: "/grupos", label: "Grupos" },
  { href: "/cartas-contempladas", label: "Contempladas" },
  { href: "/oportunidades-imobiliarias", label: "Imóveis" },
  { href: "/seguradoras", label: "Seguradoras" },
] as const;

const MORE_LINKS = [
  { href: "/dicas-do-tche", label: "Dicas" },
  { href: "/indicar", label: "Indicar cliente" },
  { href: "/perguntas-frequentes", label: "FAQ" },
  { href: "/parceiros", label: "Parceiros" },
] as const;

export function PublicHeaderNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [especialistaOpen, setEspecialistaOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  useLockBodyScroll(open);

  const linkClass = (href: string) =>
    cn("whitespace-nowrap transition hover:text-amber-400", pathname === href && "text-amber-400");

  const allMobile = [...PRIMARY_LINKS, ...MORE_LINKS, { href: "/login", label: "Login" }] as const;

  return (
    <>
      <nav
        className="hidden min-w-0 flex-1 items-center justify-end gap-x-3 text-sm font-medium text-zinc-400 lg:flex xl:gap-x-4"
        aria-label="Navegação principal"
      >
        {PRIMARY_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={linkClass(l.href)}>
            {l.label}
          </Link>
        ))}
        <div className="relative">
          <button
            type="button"
            className="inline-flex items-center gap-1 whitespace-nowrap hover:text-amber-400"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
          >
            Mais <ChevronDown className="h-4 w-4" />
          </button>
          {moreOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] rounded-xl border border-zinc-700 bg-zinc-950 py-1 shadow-xl">
              {MORE_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="block px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
                  onClick={() => setMoreOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
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
      {open ? (
        <div
          id="public-nav-mobile"
          className="fixed inset-x-0 bottom-0 top-14 z-[60] flex flex-col overflow-y-auto overflow-x-hidden border-t border-zinc-800 bg-zinc-950/98 backdrop-blur-md lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-end p-3">
            <button type="button" className="rounded-lg border border-zinc-700 p-2 text-zinc-200" onClick={() => setOpen(false)} aria-label="Fechar menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 px-4 pb-8" aria-label="Navegação mobile">
            {allMobile.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-lg px-4 py-3 text-base font-medium text-zinc-200 hover:bg-zinc-900",
                  pathname === l.href && "bg-zinc-900 text-amber-400",
                )}
              >
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              className="mt-2 rounded-full bg-amber-500 px-4 py-3 text-center text-sm font-bold text-zinc-950"
              onClick={() => {
                setOpen(false);
                setEspecialistaOpen(true);
              }}
            >
              Falar com especialista
            </button>
          </nav>
        </div>
      ) : null}
      <EspecialistaLeadModal open={especialistaOpen} onClose={() => setEspecialistaOpen(false)} />
    </>
  );
}
