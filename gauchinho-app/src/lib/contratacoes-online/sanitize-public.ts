import type { ContratacaoOnlineRow } from "./types";

/** Metadados de documento na API pública (sem path de storage). */
export type DocumentoContratacaoPublico = {
  id: string;
  tipo_documento: string;
  arquivo_nome: string | null;
  tamanho_bytes: number | null;
  created_at: string;
};

export function sanitizeDocumentosPublicos(
  rows: Array<{
    id: string;
    tipo_documento: string;
    arquivo_nome?: string | null;
    tamanho_bytes?: number | null;
    created_at: string;
  }>,
): DocumentoContratacaoPublico[] {
  return rows.map((d) => ({
    id: d.id,
    tipo_documento: d.tipo_documento,
    arquivo_nome: d.arquivo_nome ?? null,
    tamanho_bytes: d.tamanho_bytes ?? null,
    created_at: d.created_at,
  }));
}

/** Resposta pública: sem paths de storage. */
export function sanitizeContratacaoPublica(row: ContratacaoOnlineRow) {
  const {
    pix_comprovante_url: _pixPath,
    ...rest
  } = row;
  return {
    ...rest,
    pix_comprovante_enviado: Boolean(_pixPath),
  };
}
