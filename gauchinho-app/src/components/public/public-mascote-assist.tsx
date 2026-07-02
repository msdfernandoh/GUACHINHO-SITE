import Link from "next/link";
import { MascoteGauchinho } from "@/components/public/mascote-gauchinho";
import { cn } from "@/lib/utils/cn";

type Props = {
  variant?: "floating" | "cta";
  className?: string;
  showCta?: boolean;
};

/** Mascote discreto + card opcional para páginas públicas. */
export function PublicMascoteAssist({ variant = "floating", className, showCta = false }: Props) {
  if (variant === "floating") {
    return null;
  }

  return (
    <aside
      className={cn(
        "mt-8 flex items-center gap-4 rounded-2xl border border-amber-500/25 bg-zinc-900/60 p-4 sm:p-5",
        className,
      )}
    >
      <MascoteGauchinho variant="cta" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">Fale com o Gauchinho</p>
        <p className="mt-1 text-xs text-slate-400">
          Tire dúvidas sobre consórcio, financiamento e oportunidades.
        </p>
        {showCta ? (
          <Link
            href="/simulador"
            className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-amber-500/15 px-4 text-sm font-semibold text-amber-300 hover:bg-amber-500/25"
          >
            Simular agora
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
