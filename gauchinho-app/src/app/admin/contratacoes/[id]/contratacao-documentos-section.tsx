"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Download, Eye, Upload } from "lucide-react";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import {
  getContratacaoDocumentoSignedUrlAction,
  getContratacaoDocumentosBulkDownloadAction,
  uploadContratacaoDocumentoAdminAction,
} from "../actions";
import type { ContratacaoDocumentoRow, TipoDocumentoContratacao } from "@/lib/contratacoes-online/types";
import { cn } from "@/lib/utils/cn";
import { formatTamanhoArquivo, labelTipoDocumento } from "@/lib/contratacoes-online/documentos-labels";
import {
  adminSectionClass,
  adminSectionTitleClass,
  adminTableCellClass,
  adminTableHeadClass,
} from "@/components/admin/admin-contrast";

const TIPOS_UPLOAD: TipoDocumentoContratacao[] = [
  "documento_foto",
  "cpf",
  "cartao_cnpj",
  "documento_responsavel",
  "cpf_responsavel",
  "comprovante_endereco",
  "comprovante_pix",
  "outro",
];

type Props = {
  contratacaoId: string;
  documentos: ContratacaoDocumentoRow[];
  podeAcessarDocumentos: boolean;
  mensagemSemPermissao: string;
};

export function ContratacaoDocumentosSection({
  contratacaoId,
  documentos,
  podeAcessarDocumentos,
  mensagemSemPermissao,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [baixandoTodos, setBaixandoTodos] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [tipoUpload, setTipoUpload] = useState<TipoDocumentoContratacao>("documento_foto");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  async function abrir(documentoId: string, mode: "view" | "download") {
    setLoadingId(`${documentoId}-${mode}`);
    setErro(null);
    try {
      const res = await getContratacaoDocumentoSignedUrlAction(contratacaoId, documentoId, mode);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      if (mode === "download") {
        const a = document.createElement("a");
        a.href = res.url;
        a.rel = "noopener noreferrer";
        a.target = "_blank";
        a.click();
      } else {
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function baixarTodos() {
    setBaixandoTodos(true);
    setErro(null);
    try {
      const res = await getContratacaoDocumentosBulkDownloadAction(contratacaoId);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      for (const arq of res.arquivos) {
        const a = document.createElement("a");
        a.href = arq.url;
        a.rel = "noopener noreferrer";
        a.download = arq.nome;
        a.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    } finally {
      setBaixandoTodos(false);
    }
  }

  function anexar() {
    if (!arquivo) {
      setErro("Selecione um arquivo para anexar.");
      return;
    }
    setErro(null);
    setOkMsg(null);
    const fd = new FormData();
    fd.set("contratacao_id", contratacaoId);
    fd.set("tipo_documento", tipoUpload);
    fd.set("arquivo", arquivo);
    startTransition(async () => {
      const res = await uploadContratacaoDocumentoAdminAction(fd);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setArquivo(null);
      setFileInputKey((k) => k + 1);
      setOkMsg("Documento anexado com sucesso.");
      router.refresh();
    });
  }

  if (!podeAcessarDocumentos) {
    return (
      <section className={adminSectionClass}>
        <h2 className={adminSectionTitleClass}>Documentos</h2>
        <p className="text-sm font-medium text-amber-200">{mensagemSemPermissao}</p>
      </section>
    );
  }

  return (
    <section className={adminSectionClass}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className={adminSectionTitleClass}>Documentos enviados</h2>
        {documentos.length > 0 ? (
          <Button
            type="button"
            variant="gold"
            className="h-9 text-xs"
            disabled={Boolean(loadingId) || baixandoTodos || pending}
            onClick={() => void baixarTodos()}
          >
            <Download className="mr-1 h-4 w-4" />
            {baixandoTodos ? "Baixando…" : "Baixar todos os documentos"}
          </Button>
        ) : null}
      </div>
      <p className="mb-4 text-xs text-zinc-400">
        Links temporários (≈1 h). O bucket permanece privado; não há URL pública permanente.
      </p>

      <div className="mb-5 rounded-xl border border-zinc-700 bg-zinc-950/50 p-4">
        <p className="mb-3 text-sm font-semibold text-zinc-200">Anexar documento (admin)</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <div>
            <Label>Tipo</Label>
            <select
              value={tipoUpload}
              onChange={(e) => setTipoUpload(e.target.value as TipoDocumentoContratacao)}
              className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              {TIPOS_UPLOAD.map((t) => (
                <option key={t} value={t}>
                  {labelTipoDocumento(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Arquivo</Label>
            <Input
              key={fileInputKey}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
              className="mt-1 file:mr-3 file:rounded-md file:border-0 file:bg-amber-500/90 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-zinc-950"
              disabled={pending}
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-zinc-500">PDF, JPG, PNG ou WEBP — máx. 5 MB</p>
          </div>
          <Button
            type="button"
            variant="gold"
            className="h-10"
            disabled={pending || !arquivo}
            onClick={anexar}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {pending ? "Enviando…" : "Anexar"}
          </Button>
        </div>
        {arquivo ? (
          <p className="mt-2 text-xs text-zinc-400">
            Selecionado: <span className="text-zinc-200">{arquivo.name}</span>
          </p>
        ) : null}
      </div>

      {erro ? <p className="mb-3 text-sm font-medium text-red-400">{erro}</p> : null}
      {okMsg ? <p className="mb-3 text-sm font-medium text-emerald-400">{okMsg}</p> : null}

      {documentos.length === 0 ? (
        <p className="text-sm text-zinc-300">Nenhum documento enviado.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-700">
          <table className="min-w-full text-sm">
            <thead className={adminTableHeadClass}>
              <tr>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Arquivo</th>
                <th className="px-3 py-2">Enviado em</th>
                <th className="px-3 py-2">Tamanho</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((d) => {
                const busyView = loadingId === `${d.id}-view`;
                const busyDown = loadingId === `${d.id}-download`;
                return (
                  <tr key={d.id} className="border-t border-zinc-800">
                    <td className={adminTableCellClass}>{labelTipoDocumento(d.tipo_documento)}</td>
                    <td className={cn(adminTableCellClass, "break-all")}>{d.arquivo_nome ?? "—"}</td>
                    <td className={cn(adminTableCellClass, "whitespace-nowrap")}>
                      {new Date(d.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className={adminTableCellClass}>{formatTamanhoArquivo(d.tamanho_bytes)}</td>
                    <td className={adminTableCellClass}>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          disabled={Boolean(loadingId)}
                          onClick={() => void abrir(d.id, "view")}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" />
                          {busyView ? "…" : "Visualizar documento"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          disabled={Boolean(loadingId)}
                          onClick={() => void abrir(d.id, "download")}
                        >
                          <Download className="mr-1 h-3.5 w-3.5" />
                          {busyDown ? "…" : "Baixar documento"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 px-2 text-xs"
                          disabled={Boolean(loadingId)}
                          onClick={() => void abrir(d.id, "view")}
                        >
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          Abrir em nova aba
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
