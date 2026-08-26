"use client";

import { useState, useTransition } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { atualizarVisualizacaoCatalogoAction } from "@/app/platform/grupos/vinculacoes/actions";

export function ErpGruposSyncButton() {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tipo: "sucesso" | "erro"; msg: string } | null>(null);

  function handleSync() {
    startTransition(async () => {
      const res = await atualizarVisualizacaoCatalogoAction();
      if (res.ok) {
        setFeedback({ tipo: "sucesso", msg: res.mensagem || "Visualização atualizada." });
      } else {
        setFeedback({ tipo: "erro", msg: res.error || "Erro ao atualizar a visualização." });
      }
      setTimeout(() => setFeedback(null), 4000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {feedback && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${
            feedback.tipo === "sucesso"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300"
          }`}
        >
          {feedback.tipo === "sucesso" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
          {feedback.msg}
        </span>
      )}

      <button
        onClick={handleSync}
        disabled={isPending}
        title="Recarrega os dados já cadastrados no catálogo SaaS. Não consulta API externa."
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        <RefreshCw size={14} className={isPending ? "animate-spin text-blue-600" : "text-slate-500"} />
        {isPending ? "Atualizando..." : "Atualizar visualização"}
      </button>
    </div>
  );
}
