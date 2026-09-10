"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { getPropostaDownloadUrlAction } from "@/app/admin/propostas/actions";

interface Props {
  propostaId: string;
  variant?: "table-btn" | "icon-btn" | "pill-btn";
  label?: string;
  className?: string;
}

export function BaixarPropostaPdfButton({
  propostaId,
  variant = "table-btn",
  label = "PDF",
  className = "",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const url = await getPropostaDownloadUrlAction(propostaId);
      if (url) {
        window.open(url, "_blank");
      } else {
        throw new Error("Link não disponível");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao baixar PDF";
      setError(msg);
      // Limpa erro após 4 segundos
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  }

  if (variant === "icon-btn") {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={handleDownload}
        title={error ? error : "Baixar PDF da proposta"}
        className={`inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-1.5 text-slate-700 transition hover:border-amber-500 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 ${className}`}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin text-amber-500" />
        ) : (
          <Download size={14} />
        )}
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={handleDownload}
        title={error ? error : "Baixar PDF oficial da proposta"}
        className={`inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800 active:scale-95 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-amber-500/50 dark:hover:bg-zinc-750 ${className}`}
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin text-amber-500" />
        ) : (
          <Download size={12} className="text-amber-600 dark:text-amber-400" />
        )}
        <span>{loading ? "Gerando..." : label}</span>
      </button>
      {error && (
        <span className="text-[10px] text-red-500" title={error}>
          Falha
        </span>
      )}
    </div>
  );
}
