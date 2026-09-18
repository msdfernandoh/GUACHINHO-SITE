"use client";

import { useState, useTransition } from "react";
import type { LeadArquivoRow } from "@/lib/crm/types";
import {
  uploadLeadArquivoAction,
  getLeadArquivoSignedUrlAction,
} from "@/app/admin/leads/actions";
import {
  FileText,
  Upload,
  Download,
  Loader2,
  File,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/form-primitives";

export function CrmLeadArquivos({
  leadId,
  arquivosIniciais,
}: {
  leadId: string;
  arquivosIniciais: LeadArquivoRow[];
}) {
  const [arquivos, setArquivos] = useState<LeadArquivoRow[]>(arquivosIniciais);
  const [isUploading, startUpload] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    startUpload(async () => {
      try {
        await uploadLeadArquivoAction(leadId, formData);
        // Atualização local
        setArquivos((prev) => [
          {
            id: String(Date.now()),
            empresa_id: "",
            lead_id: leadId,
            arquivo_url: "",
            arquivo_nome: file.name,
            arquivo_tamanho: file.size,
            mime_type: file.type,
            criado_por_usuario_id: null,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        e.target.value = "";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao anexar arquivo.");
      }
    });
  }

  async function handleDownload(arq: LeadArquivoRow) {
    if (!arq.arquivo_url) return;
    setDownloadingId(arq.id);
    try {
      const url = await getLeadArquivoSignedUrlAction(arq.arquivo_url);
      window.open(url, "_blank");
    } catch (err) {
      setError("Falha ao abrir arquivo.");
    } finally {
      setDownloadingId(null);
    }
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-100">Documentos e Anexos do Lead</h3>
          <p className="text-xs text-zinc-400">
            Propostas assinadas, comprovantes, CNH/RG e simulações do cliente
          </p>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-blue-500">
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isUploading ? "Enviando..." : "Anexar Arquivo"}
          <input
            type="file"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/20 p-2.5 text-xs text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <div className="divide-y divide-zinc-800/60">
        {arquivos.map((arq) => (
          <div key={arq.id} className="flex items-center justify-between py-2.5 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <File className="h-4 w-4 shrink-0 text-blue-400" />
              <div className="truncate">
                <p className="font-medium text-zinc-200 truncate">{arq.arquivo_nome}</p>
                <p className="text-[10px] text-zinc-500">
                  {formatFileSize(arq.arquivo_tamanho)} • {formatDate(arq.created_at)}
                </p>
              </div>
            </div>

            {arq.arquivo_url ? (
              <button
                onClick={() => handleDownload(arq)}
                disabled={downloadingId === arq.id}
                className="flex shrink-0 items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
              >
                {downloadingId === arq.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Baixar
              </button>
            ) : null}
          </div>
        ))}

        {arquivos.length === 0 && (
          <div className="py-6 text-center text-xs text-zinc-500">
            Nenhum arquivo anexado a este lead até o momento.
          </div>
        )}
      </div>
    </div>
  );
}
