"use client";

import { useState } from "react";
import { ExternalLink, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/form-primitives";
import { getContratacaoDocumentoSignedUrlAction } from "../actions";
import type { ContratacaoDocumentoRow } from "@/lib/contratacoes-online/types";
import { cn } from "@/lib/utils/cn";
import { formatTamanhoArquivo, labelTipoDocumento } from "@/lib/contratacoes-online/documentos-labels";
import {
  adminSectionClass,
  adminSectionTitleClass,
  adminTableCellClass,
  adminTableHeadClass,
} from "@/components/admin/admin-contrast";

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
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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
      <h2 className={adminSectionTitleClass}>Documentos enviados</h2>
      <p className="mb-4 text-xs text-zinc-400">
        Links temporários (≈1 h). O bucket permanece privado; não há URL pública permanente.
      </p>
      {erro ? <p className="mb-3 text-sm font-medium text-red-400">{erro}</p> : null}
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
