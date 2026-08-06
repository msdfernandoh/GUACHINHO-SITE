import "server-only";

/**
 * API server-side de índices financeiros (usa service role via repository).
 * Client Components devem importar apenas de `./client-safe` ou `./types` / `./math`.
 */
import { getIndiceByCodigo, listIndicesFinanceiros } from "./repository";
import { refreshTodosAutomaticos } from "./refresh";
import type { IndiceCodigo, IndiceFinanceiroRow, IndicePublico, IndiceRefreshResult } from "./types";

export type { IndiceCodigo, IndicePublico, IndiceFinanceiroRow, IndiceRefreshResult };
export { refreshIndiceAutomatico, refreshTodosAutomaticos } from "./refresh";
export {
  percentualReajusteAluguel12m,
  cdiAnualReferenciaPercentual,
  taxaMensalAplicacaoFromIndice,
  formatDataReferenciaBr,
} from "./client-safe";
export { taxaAnualParaMensalPercentual, taxaMensalParaAnualPercentual } from "./math";

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
