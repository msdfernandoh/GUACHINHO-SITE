/**
 * Helper functions and business domain rules for ERP Solicitações de Repasse
 */

export type SolicitacaoRepasseStatus =
  | "RASCUNHO"
  | "SOLICITADO"
  | "EM_ANALISE"
  | "APROVADO"
  | "AGUARDANDO_RECEBIMENTO"
  | "RECEBIDO"
  | "CORRECAO_SOLICITADA"
  | "RECUSADO"
  | "CANCELADO";

export const STATUS_LABELS: Record<SolicitacaoRepasseStatus, string> = {
  RASCUNHO: "Rascunho",
  SOLICITADO: "Solicitado",
  EM_ANALISE: "Em Análise",
  APROVADO: "Aprovado",
  AGUARDANDO_RECEBIMENTO: "Aguardando Recebimento",
  RECEBIDO: "Recebido",
  CORRECAO_SOLICITADA: "Correção Solicitada",
  RECUSADO: "Recusado",
  CANCELADO: "Cancelado",
};

export const STATUS_COLORS: Record<
  SolicitacaoRepasseStatus,
  { bg: string; text: string; border: string }
> = {
  RASCUNHO: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", border: "border-slate-200" },
  SOLICITADO: { bg: "bg-blue-50 dark:bg-blue-950/60", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200" },
  EM_ANALISE: { bg: "bg-indigo-50 dark:bg-indigo-950/60", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200" },
  APROVADO: { bg: "bg-cyan-50 dark:bg-cyan-950/60", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200" },
  AGUARDANDO_RECEBIMENTO: { bg: "bg-amber-50 dark:bg-amber-950/60", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200" },
  RECEBIDO: { bg: "bg-emerald-50 dark:bg-emerald-950/60", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200" },
  CORRECAO_SOLICITADA: { bg: "bg-orange-50 dark:bg-orange-950/60", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200" },
  RECUSADO: { bg: "bg-rose-50 dark:bg-rose-950/60", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200" },
  CANCELADO: { bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-500 dark:text-zinc-400", border: "border-zinc-200" },
};

/**
 * Normaliza e deduplica lista de pedidos informados em lote (textarea, quebra de linha, vírgulas, espaços).
 */
export function normalizarPedidos(input: string | string[]): string[] {
  if (!input) return [];
  const rawList = Array.isArray(input) ? input : input.split(/[\n,;\s]+/);
  const set = new Set<string>();
  for (const item of rawList) {
    const trimmed = item.trim();
    if (trimmed.length > 0) {
      set.add(trimmed);
    }
  }
  return Array.from(set);
}

/**
 * Formata mês de referência (ex: '2026-07' -> 'Julho/2026')
 */
export function formatarMesReferencia(mesReferencia: string): string {
  if (!mesReferencia || !mesReferencia.includes("-")) return mesReferencia || "";
  const [ano, mes] = mesReferencia.split("-");
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const mesNum = parseInt(mes, 10);
  if (isNaN(mesNum) || mesNum < 1 || mesNum > 12) return mesReferencia;
  return `${meses[mesNum - 1]}/${ano}`;
}

/**
 * Retorna se há divergência entre o valor solicitado e o valor da Nota Fiscal.
 */
export function verificarDivergenciaValores(
  valorSolicitado: number,
  valorNotaFiscal?: number | null
): { divergente: boolean; diferenca: number } {
  if (valorNotaFiscal === undefined || valorNotaFiscal === null || isNaN(valorNotaFiscal)) {
    return { divergente: false, diferenca: 0 };
  }
  const diff = Number((valorSolicitado - valorNotaFiscal).toFixed(2));
  return {
    divergente: Math.abs(diff) > 0.009,
    diferenca: diff,
  };
}

/**
 * Calcula o valor sugerido para o recebimento financeiro:
 * Prioriza o valor da NF se fornecido; caso contrário, utiliza o valor solicitado.
 */
export function calcularValorSugeridoRecebimento(
  valorSolicitado: number,
  valorNotaFiscal?: number | null
): number {
  if (valorNotaFiscal !== undefined && valorNotaFiscal !== null && Number(valorNotaFiscal) > 0) {
    return Number(valorNotaFiscal);
  }
  return Number(valorSolicitado || 0);
}

/**
 * Verifica se a solicitação está em status elegível para registrar recebimento financeiro.
 */
export function isElegivelParaRecebimento(status: SolicitacaoRepasseStatus, recebimentoId?: string | null): boolean {
  if (recebimentoId) return false; // Já possui recebimento
  return ["SOLICITADO", "EM_ANALISE", "APROVADO", "AGUARDANDO_RECEBIMENTO"].includes(status);
}

/**
 * Gera chave de idempotência segura para o registro do recebimento.
 */
export function gerarIdempotencyKeyRecebimento(solicitacaoId: string): string {
  return `SOLIC-${solicitacaoId}-${Date.now()}`;
}
