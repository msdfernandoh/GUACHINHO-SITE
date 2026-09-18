"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicarLeadParaNovaNegociacaoAction } from "@/app/admin/leads/actions";
import { CopyPlus, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/form-primitives";

export function CrmNovaNegociacaoButton({
  leadId,
  leadNome,
  isWon,
}: {
  leadId: string;
  leadNome: string;
  isWon?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDuplicar() {
    const msg = isWon
      ? `Este cliente já possui uma negociação ganha. Deseja abrir uma NOVA NEGOCIAÇÃO para “${leadNome}”? Um novo card será criado no funil inicial com todo o histórico consolidado.`
      : `Deseja gerar uma NOVA NEGOCIAÇÃO (cópia) para “${leadNome}”?`;

    if (!confirm(msg)) return;

    setError(null);
    startTransition(async () => {
      try {
        const res = await duplicarLeadParaNovaNegociacaoAction(leadId);
        if (res?.newLeadId) {
          router.push(`/admin/leads/${res.newLeadId}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao gerar nova negociação");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        onClick={handleDuplicar}
        disabled={isPending}
        className={`flex items-center gap-1.5 text-xs font-semibold shadow transition ${
          isWon
            ? "border border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
            : "border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
        }`}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isWon ? (
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
        ) : (
          <CopyPlus className="h-3.5 w-3.5" />
        )}
        {isPending ? "Criando..." : isWon ? "Nova Negociação (Cliente Ganho)" : "Nova Negociação"}
      </Button>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
