import { fetchCdiAcumulado12m, fetchIpcaAcumulado12m, fetchSelicAnual } from "./bcb";
import { parseDataBr, taxaAnualParaMensalPercentual } from "./math";
import { getIndiceByCodigo, persistIndiceAtualizado } from "./repository";
import type { IndiceRefreshResult } from "./types";

async function refreshFromBcb(codigo: string): Promise<IndiceRefreshResult> {
  if (codigo === "ipca") {
    const p = await fetchIpcaAcumulado12m();
    if (!p) return { codigo, ok: false, message: "BCB IPCA (433) indisponível" };
    const dataRef = parseDataBr(p.data);
    await persistIndiceAtualizado("ipca", {
      valor_acumulado_12m: p.valor,
      fonte: "BCB SGS 433",
      fonte_url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json",
      data_referencia: dataRef,
      observacao: null,
    });
    return { codigo, ok: true };
  }

  if (codigo === "selic") {
    const p = await fetchSelicAnual();
    if (!p) return { codigo, ok: false, message: "BCB Selic (432) indisponível" };
    const dataRef = parseDataBr(p.data);
    await persistIndiceAtualizado("selic", {
      valor_anual: p.valor,
      fonte: "BCB SGS 432",
      fonte_url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json",
      data_referencia: dataRef,
      observacao: null,
    });
    return { codigo, ok: true };
  }

  if (codigo === "cdi") {
    const p = await fetchCdiAcumulado12m();
    if (!p) return { codigo, ok: false, message: "BCB CDI 12m (4390) indisponível" };
    const dataRef = parseDataBr(p.data);
    const valorAnual = p.valor;
    const valorMensal = taxaAnualParaMensalPercentual(valorAnual);
    await persistIndiceAtualizado("cdi", {
      valor_acumulado_12m: p.valor,
      valor_anual: valorAnual,
      valor_mensal: valorMensal,
      fonte: "BCB SGS 4390",
      fonte_url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.4390/dados/ultimos/1?formato=json",
      data_referencia: dataRef,
      observacao: null,
    });
    return { codigo, ok: true };
  }

  return { codigo, ok: false, message: "Sem integração automática para este código" };
}

export async function refreshIndiceAutomatico(codigo: string): Promise<IndiceRefreshResult> {
  const row = await getIndiceByCodigo(codigo);
  if (!row) return { codigo, ok: false, message: "Índice não encontrado" };

  const result = await refreshFromBcb(codigo);
  if (!result.ok && row.fallback_manual) {
    return {
      codigo,
      ok: false,
      message: `${result.message ?? "Falha"} — mantidos valores cadastrados.`,
    };
  }
  return result;
}

export async function refreshTodosAutomaticos(): Promise<IndiceRefreshResult[]> {
  const automaticos = ["ipca", "cdi", "selic"];
  const results: IndiceRefreshResult[] = [];
  for (const codigo of automaticos) {
    const row = await getIndiceByCodigo(codigo);
    if (row?.atualizacao_automatica) {
      results.push(await refreshIndiceAutomatico(codigo));
    }
  }
  return results;
}
