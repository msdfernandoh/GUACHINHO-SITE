import { taxaAnualParaMensalPercentual } from "./math";
import { getIndiceByCodigo, listIndicesFinanceiros } from "./repository";
import { refreshIndiceAutomatico, refreshTodosAutomaticos } from "./refresh";
import type { IndiceCodigo, IndiceFinanceiroRow, IndicePublico, IndiceRefreshResult } from "./types";

export type { IndiceCodigo, IndicePublico, IndiceFinanceiroRow, IndiceRefreshResult };
export { taxaAnualParaMensalPercentual, taxaMensalParaAnualPercentual } from "./math";
export { refreshIndiceAutomatico, refreshTodosAutomaticos };

function toPublic(row: IndiceFinanceiroRow, usando_fallback: boolean): IndicePublico {
  return {
    codigo: row.codigo as IndiceCodigo,
    nome: row.nome,
    valor_mensal: row.valor_mensal,
    valor_anual: row.valor_anual,
    valor_acumulado_12m: row.valor_acumulado_12m,
    data_referencia: row.data_referencia,
    ultima_atualizacao: row.ultima_atualizacao,
    fonte: row.fonte,
    usando_fallback,
    atualizacao_automatica: row.atualizacao_automatica,
  };
}

export async function getIndicesPublicos(options?: {
  tentarAtualizarAutomaticos?: boolean;
}): Promise<{ indices: IndicePublico[]; refreshErrors: string[] }> {
  const refreshErrors: string[] = [];
  try {
    if (options?.tentarAtualizarAutomaticos) {
      const results = await refreshTodosAutomaticos();
      for (const r of results) {
        if (!r.ok && r.message) refreshErrors.push(`${r.codigo}: ${r.message}`);
      }
    }

    const rows = await listIndicesFinanceiros();
    const indices = rows
      .filter((r) => r.ativo)
      .map((r) => toPublic(r, refreshErrors.some((e) => e.startsWith(`${r.codigo}:`))));

    return { indices, refreshErrors };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao carregar índices";
    return { indices: [], refreshErrors: [message] };
  }
}

export async function getIndicePublico(codigo: string): Promise<IndicePublico | null> {
  const row = await getIndiceByCodigo(codigo);
  if (!row || !row.ativo) return null;
  return toPublic(row, false);
}

/** Percentual único para reajuste anual de aluguel (12 meses). */
export function percentualReajusteAluguel12m(indice: IndicePublico | null, manual: number): number {
  if (!indice) return manual;
  if (indice.codigo === "ipca" || indice.codigo === "igpm") {
    return indice.valor_acumulado_12m ?? manual;
  }
  return manual;
}

/** Taxa mensal (% a.m.) para simulação de aplicação a partir do índice. */
export function taxaMensalAplicacaoFromIndice(
  codigo: IndiceCodigo,
  indice: IndicePublico | null,
  opts: { percentualCdi?: number; taxaManualAnual?: number; taxaManualMensal?: number },
): number | null {
  if (codigo === "taxa_manual") {
    if (opts.taxaManualMensal != null && Number.isFinite(opts.taxaManualMensal)) {
      return opts.taxaManualMensal;
    }
    if (opts.taxaManualAnual != null && Number.isFinite(opts.taxaManualAnual)) {
      return taxaAnualParaMensalPercentual(opts.taxaManualAnual);
    }
    return null;
  }

  if (!indice) return null;

  if (codigo === "cdi") {
    const pct = opts.percentualCdi ?? 100;
    const anual = (indice.valor_anual ?? indice.valor_acumulado_12m ?? 0) * (pct / 100);
    if (anual === 0) return 0;
    return taxaAnualParaMensalPercentual(anual);
  }

  if (codigo === "poupanca") {
    if (indice.valor_mensal != null) return indice.valor_mensal;
    if (indice.valor_anual != null) return taxaAnualParaMensalPercentual(indice.valor_anual);
    return null;
  }

  if (codigo === "tesouro_selic" || codigo === "tesouro_ipca") {
    if (indice.valor_anual == null) return null;
    return taxaAnualParaMensalPercentual(indice.valor_anual);
  }

  return null;
}

export function formatDataReferenciaBr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
