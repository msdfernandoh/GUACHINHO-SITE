import {
  fetchCdiAnualReferencia,
  fetchIpcaAcumulado12m,
  fetchSelicAnual,
} from "./bcb";
import { parseDataBr, taxaAnualParaMensalPercentual } from "./math";
import { getIndiceByCodigo, persistIndiceAtualizado } from "./repository";
import type { IndiceRefreshResult } from "./types";
import { mensagemPreservacaoFallback, validarValoresIndiceAutomatico } from "./validation";

async function persistSeValido(
  codigo: string,
  fields: Parameters<typeof persistIndiceAtualizado>[1],
): Promise<IndiceRefreshResult> {
  const validacao = validarValoresIndiceAutomatico(codigo, fields);
  if (!validacao.ok) {
    const row = await getIndiceByCodigo(codigo);
    return {
      codigo,
      ok: false,
      message: `${validacao.message} ${mensagemPreservacaoFallback(row)}`,
    };
  }
  await persistIndiceAtualizado(codigo, fields);
  return { codigo, ok: true, message: `${codigo.toUpperCase()} atualizado com sucesso.` };
}

async function refreshFromBcb(codigo: string): Promise<IndiceRefreshResult> {
  if (codigo === "ipca") {
    const p = await fetchIpcaAcumulado12m();
    if (!p) return { codigo, ok: false, message: "BCB IPCA (433) indisponível" };
    const dataRef = parseDataBr(p.data);
    return persistSeValido("ipca", {
      valor_acumulado_12m: p.valor,
      fonte: "BCB SGS 433",
      fonte_url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/1?formato=json",
      data_referencia: dataRef,
      observacao: null,
    });
  }

  if (codigo === "selic") {
    const p = await fetchSelicAnual();
    if (!p) return { codigo, ok: false, message: "BCB Selic (432) indisponível" };
    const dataRef = parseDataBr(p.data);
    const valorMensal = taxaAnualParaMensalPercentual(p.valor);
    return persistSeValido("selic", {
      valor_anual: p.valor,
      valor_mensal: valorMensal,
      fonte: "BCB SGS 432",
      fonte_url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json",
      data_referencia: dataRef,
      observacao: null,
    });
  }

  if (codigo === "cdi") {
    const p = await fetchCdiAnualReferencia();
    if (!p) return { codigo, ok: false, message: "BCB CDI anual (4389) indisponível" };
    const dataRef = parseDataBr(p.data);
    const valorAnual = p.valor;
    const valorMensal = taxaAnualParaMensalPercentual(valorAnual);
    return persistSeValido("cdi", {
      valor_anual: valorAnual,
      valor_mensal: valorMensal,
      valor_acumulado_12m: valorAnual,
      fonte: "BCB SGS 4389 (CDI a.a.)",
      fonte_url: "https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json",
      data_referencia: dataRef,
      observacao: "Taxa anual de referência; mensal = equivalente composto.",
    });
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
      message: result.message?.includes("Mantido")
        ? result.message
        : `${result.message ?? "Falha na atualização"} — ${mensagemPreservacaoFallback(row)}`,
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
