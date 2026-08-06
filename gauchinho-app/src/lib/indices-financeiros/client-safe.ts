/**
 * Funções puras / client-safe de índices financeiros.
 * NÃO importar repository, refresh nem supabase/admin daqui.
 */
import { taxaAnualParaMensalPercentual, taxaMensalParaAnualPercentual } from "./math";
import type { IndiceCodigo, IndicePublico } from "./types";

/** Percentual único para reajuste anual de aluguel (12 meses). */
export function percentualReajusteAluguel12m(indice: IndicePublico | null, manual: number): number {
  if (!indice) return manual;
  if (indice.codigo === "ipca" || indice.codigo === "igpm") {
    return indice.valor_acumulado_12m ?? manual;
  }
  return manual;
}

/** CDI cadastrado como taxa anual (% a.a.); ignora 0,05 e outros valores incompatíveis com anual. */
export function cdiAnualReferenciaPercentual(indice: IndicePublico | null): number | null {
  if (!indice) return null;
  for (const v of [indice.valor_anual, indice.valor_acumulado_12m]) {
    if (v != null && Number.isFinite(v) && v >= 1 && v <= 30) return v;
  }
  if (
    indice.valor_mensal != null &&
    Number.isFinite(indice.valor_mensal) &&
    indice.valor_mensal >= 0.3 &&
    indice.valor_mensal <= 2.5
  ) {
    return taxaMensalParaAnualPercentual(indice.valor_mensal);
  }
  return null;
}

function selicAnualReferenciaPercentual(indice: IndicePublico): number | null {
  if (indice.valor_anual != null && indice.valor_anual >= 1 && indice.valor_anual <= 30) {
    return indice.valor_anual;
  }
  return null;
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
    const pct =
      opts.percentualCdi == null || !Number.isFinite(opts.percentualCdi) || opts.percentualCdi <= 0
        ? 100
        : opts.percentualCdi;
    const base = cdiAnualReferenciaPercentual(indice);
    if (base == null) return null;
    return taxaAnualParaMensalPercentual(base * (pct / 100));
  }

  if (codigo === "selic") {
    const anual = selicAnualReferenciaPercentual(indice);
    if (anual != null) return taxaAnualParaMensalPercentual(anual);
    if (indice.valor_mensal != null && indice.valor_mensal > 0) return indice.valor_mensal;
    return null;
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
