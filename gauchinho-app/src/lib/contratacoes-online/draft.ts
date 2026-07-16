import type { ContratacaoModo, ContratacaoOrigem } from "./types";

export const CONTRATACAO_DRAFT_STORAGE_KEY = "gauchinho_contratacao_draft_v1";

export type ContratacaoDraftPayload = {
  modo: ContratacaoModo;
  origem: ContratacaoOrigem;
  dados_simulacao: Record<string, unknown>;
  createdAt: string;
};

export function isContratacaoDraftPayload(v: unknown): v is ContratacaoDraftPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    (o.modo === "cliente_site" || o.modo === "sdr_link") &&
    (o.origem === "simulador" || o.origem === "grupos") &&
    !!o.dados_simulacao &&
    typeof o.dados_simulacao === "object"
  );
}

export function readContratacaoDraftFromStorage(): ContratacaoDraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CONTRATACAO_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isContratacaoDraftPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeContratacaoDraftToStorage(draft: ContratacaoDraftPayload): void {
  sessionStorage.setItem(CONTRATACAO_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function clearContratacaoDraftStorage(): void {
  sessionStorage.removeItem(CONTRATACAO_DRAFT_STORAGE_KEY);
}
