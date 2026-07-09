import type { ContratacaoOnlineRow } from "./types";

/** Resposta pública: sem paths de storage nem listagem de documentos. */
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
