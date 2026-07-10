"use client";

import Link from "next/link";
import { simuladorShell } from "@/components/simulador/simulador-ui";
import { cn } from "@/lib/utils/cn";

export default function PropostaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={cn(simuladorShell, "flex min-h-screen flex-col items-center justify-center gap-4 p-8")}>
      <h1 className="text-xl font-bold text-white">Não foi possível abrir a proposta</h1>
      <p className="max-w-md text-center text-sm text-slate-400">
        {error.message || "Ocorreu um erro ao carregar esta página. Tente novamente ou gere um novo link."}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950"
          onClick={reset}
        >
          Tentar novamente
        </button>
        <Link href="/" className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200">
          Voltar ao site
        </Link>
      </div>
    </div>
  );
}
