import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { MascoteGauchinho } from "@/components/public/mascote-gauchinho";

type Props = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  className?: string;
};

export function ConteudoHero({ title, subtitle, eyebrow, className }: Props) {
  return (
    <header
      className={cn(
        "border-b border-zinc-800/80 bg-gradient-to-b from-zinc-950/80 to-transparent py-16 md:py-24",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-500">{eyebrow}</p>
        ) : null}
        <h1 className="mt-3 max-w-4xl text-3xl font-bold tracking-tight text-white md:text-5xl">{title}</h1>
        {subtitle ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}

export function ConteudoPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="pb-20">
      <div className="pointer-events-none fixed bottom-24 right-4 z-30 hidden opacity-80 sm:block">
        <MascoteGauchinho variant="floating" />
      </div>
      {children}
    </main>
  );
}

export function ConteudoBackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-amber-400 hover:text-amber-300">
      ← {children}
    </Link>
  );
}
