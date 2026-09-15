"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSignature, Loader2, Undo2 } from "lucide-react";
import { alternarContratoAssinadoAction } from "@/app/erp/contratacoes/actions";

interface MarcarContratoAssinadoButtonProps {
  contratacaoId: string;
  contratoAssinado: boolean;
  contratoAssinadoEm?: string | null;
  formalizada?: boolean;
  canAlterar?: boolean;
  variant?: "hero" | "banner" | "inline" | "table";
  className?: string;
  onSuccess?: (assinado: boolean) => void;
}

export function MarcarContratoAssinadoButton({
  contratacaoId,
  contratoAssinado,
  contratoAssinadoEm,
  formalizada = false,
  canAlterar = true,
  variant = "hero",
  className = "",
  onSuccess,
}: MarcarContratoAssinadoButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  if (formalizada) {
    return null;
  }

  const handleToggle = (proximoEstado: boolean) => {
    if (!canAlterar || isPending) return;

    if (!proximoEstado) {
      const confirmou = window.confirm(
        "Deseja realmente desmarcar a assinatura deste contrato?\n\nIsso retornará o status para 'Aguardando assinatura' e bloqueará a formalização da venda até uma nova confirmação.",
      );
      if (!confirmou) return;
    }

    setErro(null);
    startTransition(async () => {
      const res = await alternarContratoAssinadoAction({
        contratacaoId,
        assinado: proximoEstado,
      });

      if (!res.ok) {
        setErro(res.error);
        alert(`Erro: ${res.error}`);
        return;
      }

      onSuccess?.(proximoEstado);
      router.refresh();
    });
  };

  // 1. Variante TABLE (usada na lista de contratações)
  if (variant === "table") {
    if (contratoAssinado) {
      return (
        <button
          type="button"
          disabled={!canAlterar || isPending}
          onClick={() => handleToggle(false)}
          title={
            canAlterar
              ? `Assinado em ${contratoAssinadoEm ? new Date(contratoAssinadoEm).toLocaleString("pt-BR") : "—"}. Clique para desmarcar se necessário.`
              : "Contrato assinado."
          }
          className={`inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 ${className}`}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin text-emerald-700" />
          ) : (
            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          )}
          <span>Assinado</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled={!canAlterar || isPending}
        onClick={() => handleToggle(true)}
        title={canAlterar ? "Clique para marcar este contrato como assinado" : "Sem permissão"}
        className={`inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 ${className}`}
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin text-amber-700" />
        ) : (
          <FileSignature className="h-3 w-3 text-amber-700 dark:text-amber-400" />
        )}
        <span>Marcar assinado</span>
      </button>
    );
  }

  // 2. Variante INLINE (usada dentro do resumo / checklist de formalização)
  if (variant === "inline") {
    if (contratoAssinado) {
      return null;
    }

    return (
      <button
        type="button"
        disabled={!canAlterar || isPending}
        onClick={() => handleToggle(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-800 disabled:opacity-50 cursor-pointer ${className}`}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileSignature className="h-3.5 w-3.5" />
        )}
        <span>Marcar como assinada agora</span>
      </button>
    );
  }

  // 3. Variante BANNER (usada no topo do detalhe)
  if (variant === "banner") {
    if (contratoAssinado) {
      return null;
    }

    return (
      <button
        type="button"
        disabled={!canAlterar || isPending}
        onClick={() => handleToggle(true)}
        className={`inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 cursor-pointer ${className}`}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        <span>Marcar como assinada</span>
      </button>
    );
  }

  // 4. Variante HERO (usada no cabeçalho da página de conferência)
  if (contratoAssinado) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            Assinado{contratoAssinadoEm ? ` em ${new Date(contratoAssinadoEm).toLocaleString("pt-BR")}` : ""}
          </span>
        </span>

        {canAlterar && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleToggle(false)}
            title="Clique para desmarcar a assinatura deste contrato"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Undo2 className="h-3 w-3" />
            )}
            <span>Desmarcar assinatura</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        disabled={!canAlterar || isPending}
        onClick={() => handleToggle(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileSignature className="h-4 w-4" />
        )}
        <span>Marcar como assinada</span>
      </button>
      {erro && <span className="text-xs font-semibold text-red-600">{erro}</span>}
    </div>
  );
}
