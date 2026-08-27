"use client";

import { useRef, useState, useTransition } from "react";
import {
  uploadTabelaGrupoAction,
  visualizarTabelaGrupoAction,
} from "@/app/grupos-tabela-actions";
import type { GrupoTabelaMetadata } from "@/lib/grupos/grupo-tabela.server";

function formatUploadDate(value?: string | null) {
  if (!value) return "Sem tabela";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function GrupoTabelaActions({
  grupoId,
  origemPortal,
  tabela,
  compact = false,
}: {
  grupoId: string;
  origemPortal: "SITE" | "ERP";
  tabela?: GrupoTabelaMetadata | null;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [metadata, setMetadata] = useState(tabela ?? null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  function onFileSelected(file?: File) {
    if (!file) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("arquivo", file);
      const result = await uploadTabelaGrupoAction(grupoId, origemPortal, formData);
      if (!result.ok) {
        setFeedback({ ok: false, text: result.error });
        return;
      }
      setMetadata((current) => ({
        ...(current ?? ({ id: "", grupo_id: grupoId } as GrupoTabelaMetadata)),
        arquivo_nome: file.name,
        mime_type: file.type,
        tamanho_bytes: file.size,
        uploaded_at: result.uploaded_at || new Date().toISOString(),
        origem_portal: origemPortal,
      }));
      setFeedback({ ok: true, text: result.message });
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function visualizar() {
    startTransition(async () => {
      const result = await visualizarTabelaGrupoAction(grupoId);
      if (!result.ok) {
        setFeedback({ ok: false, text: result.error });
        return;
      }
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className={compact ? "inline-flex flex-wrap items-center justify-center gap-1.5" : "space-y-2"}>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => onFileSelected(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
      >
        {pending ? "Aguarde..." : "Tabela"}
      </button>
      <button
        type="button"
        disabled={pending || !metadata}
        onClick={visualizar}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
      >
        Visualizar
      </button>
      <span className={compact ? "w-full text-center text-[10px] text-slate-500" : "block text-xs text-slate-500"}>
        {metadata ? `Enviada em ${formatUploadDate(metadata.uploaded_at)}` : "Nenhuma tabela enviada"}
      </span>
      {feedback ? (
        <span role="status" className={`${compact ? "w-full text-center" : "block"} text-xs ${feedback.ok ? "text-emerald-700" : "text-red-700"}`}>
          {feedback.text}
        </span>
      ) : null}
    </div>
  );
}
