/** Produto vendido ao concluir compromisso com ganho */
export const AGENDA_FECHAMENTO_PRODUTOS = [
  { value: "Imóvel", label: "Imóvel" },
  { value: "Automóvel", label: "Automóvel" },
  { value: "Caminhão", label: "Caminhão" },
] as const;

export const AGENDA_PERDA_MOTIVOS = [
  { value: "Sem interesse", label: "Sem interesse" },
  { value: "Sem resposta", label: "Sem resposta" },
  { value: "Em negociação", label: "Em negociação (continua no funil)" },
  { value: "Outro", label: "Outro" },
] as const;

export type AgendaFechamentoTipoParcela = "integral" | "reduzida";

export function parseValorMonetario(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const normalized = t.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function parsePercentualParcela(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return n;
}
