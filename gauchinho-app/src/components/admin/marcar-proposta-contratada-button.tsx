"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, FileCheck, Loader2, Sparkles } from "lucide-react";
import { marcarPropostaContratadaAction } from "@/app/admin/propostas/actions";

interface Props {
  propostaId: string;
  contratacaoId?: string | null;
  contratacaoProtocolo?: string | null;
  isContratada?: boolean;
  origem?: "admin" | "erp";
  variant?: "table-btn" | "banner-btn";
  className?: string;
}

export function MarcarPropostaContratadaButton({
  propostaId,
  contratacaoId,
  contratacaoProtocolo,
  isContratada = false,
  origem = "admin",
  variant = "table-btn",
  className = "",
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetContratacaoUrl = contratacaoId
    ? origem === "erp"
      ? `/erp/contratacoes/${contratacaoId}`
      : `/admin/contratacoes/${contratacaoId}`
    : null;

  // Se já está contratada ou possui contratação vinculada
  if (isContratada || contratacaoId) {
    if (variant === "banner-btn") {
      return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <div>
              <span className="font-semibold text-white">Proposta Contratada</span>
              {contratacaoProtocolo && (
                <span className="ml-2 font-mono text-xs text-emerald-300">
                  (Protocolo: {contratacaoProtocolo})
                </span>
              )}
            </div>
          </div>
          {targetContratacaoUrl && (
            <Link
              href={targetContratacaoUrl}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
            >
              <FileCheck size={14} />
              Acessar Contratação
            </Link>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <CheckCircle2 size={12} />
          Contratada
        </span>
        {targetContratacaoUrl && (
          <Link
            href={targetContratacaoUrl}
            className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            title="Ver contratação vinculada"
          >
            Ver contratação
          </Link>
        )}
      </div>
    );
  }

  async function handleMarcarContratada() {
    const confirmMsg = "Deseja marcar esta proposta como CONTRATADA e transferir seus dados para a fila de contratações?";
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    setError(null);

    try {
      const res = await marcarPropostaContratadaAction({
        propostaId,
        origemInterface: origem,
      });

      if (!res.ok) {
        throw new Error(res.error);
      }

      // Redireciona diretamente para a tela de contratação
      router.push(res.redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao converter proposta.");
      setLoading(false);
    }
  }

  if (variant === "banner-btn") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-transparent p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Formalizar Negócio
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Transforme esta proposta comercial em uma contratação ativa e envie diretamente para a fila de formalização.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={handleMarcarContratada}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-amber-400 active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <FileCheck size={16} />
                <span>Marcar Contratada e Enviar</span>
              </>
            )}
          </button>
        </div>
        {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        disabled={loading}
        onClick={handleMarcarContratada}
        title="Marcar como contratada e enviar para contratações"
        className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 hover:border-emerald-600 active:scale-95 disabled:opacity-50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 ${className}`}
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin text-emerald-600" />
        ) : (
          <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
        )}
        <span>{loading ? "Enviando..." : "Marcar Contratada"}</span>
      </button>
      {error && <span className="text-[11px] text-red-500" title={error}>Erro!</span>}
    </div>
  );
}
