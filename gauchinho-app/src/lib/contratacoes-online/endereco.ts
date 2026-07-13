import { sanitizeDigits } from "./validacao";
import type { ContratacaoOnlineRow } from "./types";

export type EnderecoContratacaoPatch = {
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
};

export type EnderecoContratacaoCampos = {
  cep: string;
  endereco: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
};

const UFS_BR = new Set([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
]);

export function sanitizeCep(value: string): string {
  return sanitizeDigits(value).slice(0, 8);
}

export function formatCepBrInput(raw: string): string {
  const d = sanitizeCep(raw);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function formatUfInput(raw: string): string {
  return raw.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
}

export function validarUfBr(uf: string): boolean {
  return UFS_BR.has(uf.trim().toUpperCase());
}

/** Valida endereço obrigatório da etapa pessoa e retorna campos normalizados para o banco. */
export function parseEnderecoContratacao(patch: EnderecoContratacaoPatch): EnderecoContratacaoCampos {
  const cep = sanitizeCep(patch.cep ?? "");
  if (cep.length !== 8) {
    throw new Error("CEP inválido. Informe 8 dígitos.");
  }

  const endereco = patch.endereco?.trim() ?? "";
  const numero = patch.numero?.trim() ?? "";
  const bairro = patch.bairro?.trim() ?? "";
  const cidade = patch.cidade?.trim() ?? "";
  const uf = formatUfInput(patch.uf ?? "");

  if (!endereco) throw new Error("Endereço é obrigatório.");
  if (!numero) throw new Error("Número é obrigatório.");
  if (!bairro) throw new Error("Bairro é obrigatório.");
  if (!cidade) throw new Error("Cidade é obrigatória.");
  if (!validarUfBr(uf)) throw new Error("UF inválida. Informe a sigla com 2 letras.");

  const complemento = patch.complemento?.trim() ?? "";

  return {
    cep,
    endereco,
    numero,
    complemento: complemento || null,
    bairro,
    cidade,
    uf,
  };
}

/** Mapeia campos validados para update em contratacoes_online. */
export function enderecoToDbUpdates(
  campos: EnderecoContratacaoCampos,
): Record<string, string | null> {
  return {
    cep: campos.cep,
    endereco: campos.endereco,
    numero: campos.numero,
    complemento: campos.complemento,
    bairro: campos.bairro,
    cidade: campos.cidade,
    uf: campos.uf,
  };
}

export function enderecoJsonFromCampos(campos: EnderecoContratacaoCampos) {
  return {
    cep: campos.cep,
    endereco: campos.endereco,
    numero: campos.numero,
    complemento: campos.complemento,
    bairro: campos.bairro,
    cidade: campos.cidade,
    uf: campos.uf,
  };
}

export type EnderecoViaCep = {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
};

const ENDERECO_DB_COLUMNS = [
  "cep",
  "endereco",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
] as const;

export const CONTRATACAO_ENDERECO_MIGRATION = "supabase/migrations/025_contratacoes_endereco.sql";

export function isContratacaoEnderecoSchemaError(message: string): boolean {
  return (
    /schema cache/i.test(message) &&
    /contratacoes_online/i.test(message) &&
    /(cep|endereco|numero|complemento|bairro|cidade|uf)/i.test(message)
  );
}

export function enderecoCamposFromJson(
  raw: unknown,
): EnderecoContratacaoCampos | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  try {
    return parseEnderecoContratacao({
      cep: String(o.cep ?? ""),
      endereco: String(o.endereco ?? ""),
      numero: String(o.numero ?? ""),
      complemento: o.complemento != null ? String(o.complemento) : undefined,
      bairro: String(o.bairro ?? ""),
      cidade: String(o.cidade ?? ""),
      uf: String(o.uf ?? ""),
    });
  } catch {
    return null;
  }
}

/** Preenche colunas de endereço a partir de dados_simulacao quando migration 025 ainda não foi aplicada. */
export function hydrateContratacaoEndereco(row: ContratacaoOnlineRow): ContratacaoOnlineRow {
  if (row.cep?.trim()) return row;
  const dados = row.dados_simulacao;
  if (!dados || typeof dados !== "object") return row;
  const nested = (dados as Record<string, unknown>).endereco;
  const campos = enderecoCamposFromJson(nested);
  if (!campos) return row;
  return {
    ...row,
    cep: campos.cep,
    endereco: campos.endereco,
    numero: campos.numero,
    complemento: campos.complemento,
    bairro: campos.bairro,
    cidade: campos.cidade,
    uf: campos.uf,
  };
}

export function stripEnderecoDbUpdates(
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...updates };
  for (const key of ENDERECO_DB_COLUMNS) {
    delete next[key];
  }
  return next;
}

export function contratacaoEnderecoMigrationHint(): string {
  return `Aplique a migration ${CONTRATACAO_ENDERECO_MIGRATION} no Supabase (SQL Editor) e aguarde alguns segundos para o cache do schema atualizar.`;
}
