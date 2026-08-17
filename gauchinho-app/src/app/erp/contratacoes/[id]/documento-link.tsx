"use client";

import { useState } from "react";
import { getContratacaoDocumentoSignedUrlAction } from "@/app/admin/contratacoes/actions";

export function DocumentoLink({ contratacaoId, documentoId, nome }: { contratacaoId: string; documentoId: string; nome: string }) {
  const [erro, setErro] = useState("");
  const abrir = async () => {
    const result = await getContratacaoDocumentoSignedUrlAction(contratacaoId, documentoId, "view");
    if (!result.ok) return setErro(result.error);
    window.open(result.url, "_blank", "noopener,noreferrer");
  };
  return <div><button type="button" onClick={abrir} className="font-semibold text-blue-700 hover:underline">{nome}</button>{erro && <p className="text-xs text-red-700">{erro}</p>}</div>;
}
