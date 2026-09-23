"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  fetchPropostasDoLeadComArquivosAction,
  getPropostaArquivoHistoricoUrlAction,
  getPropostaPdfAtualUrlAction,
  uploadPdfPropostaAction,
  type PropostaDoLeadComArquivos,
} from "@/app/admin/propostas/actions";
import { AlertCircle, Download, Eye, FileText, Loader2, Upload, X } from "lucide-react";
import { formatDate } from "@/lib/utils/format";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function openUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function CrmLeadPropostasModal({
  leadId,
  leadName,
  onClose,
}: {
  leadId: string;
  leadName: string;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [propostas, setPropostas] = useState<PropostaDoLeadComArquivos[] | null>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const loadPropostas = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const rows = await fetchPropostasDoLeadComArquivosAction(leadId);
      setPropostas(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as propostas.");
      setPropostas([]);
    } finally {
      setIsLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void loadPropostas();
  }, [loadPropostas]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function selectFile(propostaId: string) {
    setUploadTargetId(propostaId);
    inputRef.current?.click();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const propostaId = uploadTargetId;
    event.target.value = "";
    if (!file || !propostaId) return;

    setError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await uploadPdfPropostaAction(propostaId, formData);
      await loadPropostas();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar o PDF.");
    } finally {
      setUploadTargetId(null);
      setIsUploading(false);
    }
  }

  async function openCurrentPdf(propostaId: string, download: boolean) {
    const key = `current-${propostaId}-${download ? "download" : "view"}`;
    setBusyKey(key);
    setError(null);
    try {
      openUrl(await getPropostaPdfAtualUrlAction(propostaId, download));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir o PDF atual.");
    } finally {
      setBusyKey(null);
    }
  }

  async function openHistoricalPdf(propostaId: string, arquivoId: string, download: boolean) {
    const key = `history-${arquivoId}-${download ? "download" : "view"}`;
    setBusyKey(key);
    setError(null);
    try {
      openUrl(await getPropostaArquivoHistoricoUrlAction(propostaId, arquivoId, download));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível abrir o PDF do histórico.");
    } finally {
      setBusyKey(null);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Propostas do lead" onMouseDown={onClose}>
      <section className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-100">Propostas e PDFs</h2>
            <p className="mt-0.5 text-xs text-zinc-400">Histórico de {leadName}: visualize, baixe ou envie a versão em PDF.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileChange} />

        {error ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
        ) : propostas?.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">Este lead ainda não possui uma proposta gerada.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {propostas?.map((proposta) => (
              <article key={proposta.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-100">{proposta.tipo_proposta || "Proposta"}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{proposta.status} · gerada em {formatDate(proposta.created_at)}</p>
                  </div>
                  <button type="button" onClick={() => selectFile(proposta.id)} disabled={isLoading || isUploading} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60">
                    {isUploading && uploadTargetId === proposta.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Enviar PDF
                  </button>
                </div>

                {proposta.pdf_url ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5">
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-blue-200"><FileText className="h-4 w-4" />PDF atual gerado</span>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => openCurrentPdf(proposta.id, false)} disabled={busyKey === `current-${proposta.id}-view`} className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"><Eye className="h-3.5 w-3.5" />Ver</button>
                      <button type="button" onClick={() => openCurrentPdf(proposta.id, true)} disabled={busyKey === `current-${proposta.id}-download`} className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"><Download className="h-3.5 w-3.5" />Baixar</button>
                    </div>
                  </div>
                ) : null}

                {proposta.arquivos.length ? (
                  <div className="mt-3 border-t border-zinc-800 pt-3">
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">PDFs guardados no histórico</p>
                    <div className="divide-y divide-zinc-800/70">
                      {proposta.arquivos.map((arquivo) => (
                        <div key={arquivo.id} className="flex items-center justify-between gap-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-zinc-200">{arquivo.arquivo_nome}</p>
                            <p className="text-[10px] text-zinc-500">{formatFileSize(arquivo.tamanho_bytes)} · {formatDate(arquivo.created_at)}</p>
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <button type="button" onClick={() => openHistoricalPdf(proposta.id, arquivo.id, false)} disabled={busyKey === `history-${arquivo.id}-view`} className="rounded p-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-white" title="Visualizar PDF"><Eye className="h-3.5 w-3.5" /></button>
                            <button type="button" onClick={() => openHistoricalPdf(proposta.id, arquivo.id, true)} disabled={busyKey === `history-${arquivo.id}-download`} className="rounded p-1.5 text-zinc-300 hover:bg-zinc-800 hover:text-white" title="Baixar PDF"><Download className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
