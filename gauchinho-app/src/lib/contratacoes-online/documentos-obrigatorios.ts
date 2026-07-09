import type { TipoDocumentoContratacao, TipoPessoa } from "./types";

export function tiposDocumentoObrigatorios(
  tipoPessoa: TipoPessoa,
): TipoDocumentoContratacao[] {
  if (tipoPessoa === "cpf") return ["documento_foto"];
  return ["cartao_cnpj", "documento_responsavel"];
}

export function documentosObrigatoriosPendentes(
  tipoPessoa: TipoPessoa,
  tiposEnviados: string[],
): TipoDocumentoContratacao[] {
  const enviados = new Set(tiposEnviados);
  return tiposDocumentoObrigatorios(tipoPessoa).filter((t) => !enviados.has(t));
}
