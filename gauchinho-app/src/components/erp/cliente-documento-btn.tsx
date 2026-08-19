"use client";

import { useState } from "react";
import { FileText, Download, ExternalLink, Loader2 } from "lucide-react";
import { obterUrlDocumentoContratacaoAction } from "@/app/erp/clientes/actions";

export function ClienteDocumentoBtn({
  arquivoUrl,
  arquivoNome,
  tipoDocumento,
}: {
  arquivoUrl: string;
  arquivoNome: string;
  tipoDocumento?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    try {
      setLoading(true);
      const url = await obterUrlDocumentoContratacaoAction(arquivoUrl);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        alert("Não foi possível carregar o documento com segurança.");
      }
    } catch {
      alert("Erro ao obter documento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-blue-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
    >
      {loading ? (
        <Loader2 size={13} className="animate-spin text-blue-600" />
      ) : (
        <ExternalLink size={13} className="text-blue-600" />
      )}
      <span>Visualizar</span>
    </button>
  );
}
