"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gerarProximaEdicaoEventoAction } from "@/app/admin/eventos/actions";

export function GerarProximaEdicaoButton({ eventoId }: { eventoId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    const result = await gerarProximaEdicaoEventoAction(eventoId);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/admin/eventos/${result.id}`);
    router.refresh();
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void generate()}
        disabled={pending}
        className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-800 transition hover:bg-sky-500/20 disabled:cursor-wait disabled:opacity-60 dark:text-sky-200"
      >
        {pending ? "Gerando…" : "Gerar próxima edição"}
      </button>
      {error ? (
        <span className="max-w-56 text-right text-[11px] font-medium text-rose-600 dark:text-rose-300">
          {error}
        </span>
      ) : null}
    </div>
  );
}
