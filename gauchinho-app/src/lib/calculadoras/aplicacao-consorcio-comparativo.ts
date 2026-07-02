import { DEFAULT_SIMULADOR_IMOVEL } from "@/lib/config/defaults";
import { percentualParcelaReduzidaPadrao } from "@/lib/config/simulador-parcela-opcoes";
import { taxaAnualParaMensalPercentual } from "@/lib/indices-financeiros/math";
import type { IndicePublico } from "@/lib/indices-financeiros/types";
import {
  calcularAplicacaoComparativo,
  taxaCdiEfetivaAnual,
  type AplicacaoComparativoInput,
  type AplicacaoComparativoResult,
  type PerfilAplicacaoCodigo,
} from "./aplicacao-comparativo";
import {
  estimarCreditoConsorcioPorParcela,
  projetarCreditoReajustado,
} from "@/lib/simulador/estimar-credito-por-parcela";

export const AVISO_COMPARATIVO_CONSORCIO =
  "Na aplicação financeira, o rendimento incide apenas sobre os valores depositados ao longo do tempo. No consórcio, a projeção considera o crédito contratado inteiro, que pode ser reajustado conforme as regras do grupo e da administradora. Esta comparação é uma estimativa e não representa garantia de contemplação, rentabilidade ou disponibilidade.";

export const TEXTO_DIFERENCA_PATRIMONIAL =
  "Em muitos cenários, o crédito programado pode gerar uma projeção patrimonial maior, porque a valorização incide sobre o crédito contratado, não apenas sobre os aportes mensais.";

export const TEXTO_PARCELA_REDUZIDA_COMPARATIVO =
  "A comparação usa a parcela reduzida inicial do consórcio como referência para aproximar o valor do aporte mensal. O crédito estimado considera uma parcela reduzida inicial próxima ao aporte mensal informado. A parcela integral é exibida apenas como referência da parcela cheia do plano.";

export type TaxaIndiceAplicacaoInfo = {
  perfil: PerfilAplicacaoCodigo;
  label: string;
  taxaAnualPercentual: number | null;
  taxaMensalPercentual: number | null;
  ultimaAtualizacao: string | null;
  fonte: string | null;
  percentualCdi?: number;
  taxaManualMensal?: number;
};

export function infoTaxaAplicacaoIndice(
  perfil: PerfilAplicacaoCodigo,
  indice: IndicePublico | null,
  opts: { percentualCdi?: number; taxaManualMensal?: number },
): TaxaIndiceAplicacaoInfo {
  const ultimaAtualizacao = indice?.ultima_atualizacao?.slice(0, 10) ?? indice?.data_referencia ?? null;
  const fonte = indice?.fonte ?? null;

  if (perfil === "taxa_manual") {
    const m = opts.taxaManualMensal ?? null;
    return {
      perfil,
      label: "Taxa manual",
      taxaAnualPercentual: m != null ? null : null,
      taxaMensalPercentual: m,
      ultimaAtualizacao: null,
      fonte: null,
      taxaManualMensal: m ?? undefined,
    };
  }

  if (!indice) {
    return {
      perfil,
      label: perfil,
      taxaAnualPercentual: null,
      taxaMensalPercentual: null,
      ultimaAtualizacao,
      fonte,
    };
  }

  if (perfil === "cdi") {
    const pct = opts.percentualCdi ?? 100;
    const cdiAnual = indice.valor_anual ?? indice.valor_acumulado_12m ?? null;
    const anualUsada = cdiAnual != null ? taxaCdiEfetivaAnual(cdiAnual, pct) : null;
    const mensal =
      anualUsada != null ? taxaAnualParaMensalPercentual(anualUsada) : null;
    return {
      perfil,
      label: pct === 100 ? "CDI" : `${pct}% do CDI`,
      taxaAnualPercentual: anualUsada,
      taxaMensalPercentual: mensal,
      ultimaAtualizacao,
      fonte,
      percentualCdi: pct,
    };
  }

  if (perfil === "poupanca") {
    let mensal: number | null = null;
    let anual: number | null = null;
    if (indice.valor_mensal != null) {
      mensal = indice.valor_mensal;
    } else if (indice.valor_anual != null) {
      anual = indice.valor_anual;
      mensal = taxaAnualParaMensalPercentual(anual);
    }
    return {
      perfil,
      label: "Poupança",
      taxaAnualPercentual: anual,
      taxaMensalPercentual: mensal,
      ultimaAtualizacao,
      fonte,
    };
  }

  if (perfil === "tesouro_selic" || perfil === "tesouro_ipca") {
    const anual = indice.valor_anual;
    const mensal = anual != null ? taxaAnualParaMensalPercentual(anual) : null;
    return {
      perfil,
      label: perfil === "tesouro_selic" ? "Tesouro Selic" : "Tesouro IPCA+",
      taxaAnualPercentual: anual,
      taxaMensalPercentual: mensal,
      ultimaAtualizacao,
      fonte,
    };
  }

  return {
    perfil,
    label: perfil,
    taxaAnualPercentual: null,
    taxaMensalPercentual: null,
    ultimaAtualizacao,
    fonte,
  };
}

export type AplicacaoComConsorcioInput = AplicacaoComparativoInput & {
  aumentoAnualAportePercentual?: number;
  compararComConsorcio?: boolean;
  percentualParcelaReduzidaConsorcio?: number;
  reajusteAnualCreditoPercentual?: number;
  prazoConsorcioMeses?: number;
  taxaAdministrativaConsorcio?: number;
  fundoReservaConsorcio?: number;
  seguroPrestamistaConsorcio?: number;
  indicePrincipal?: IndicePublico | null;
};

export type ConsorcioComparativoBloco = {
  parcelaReduzidaEstimada: number;
  parcelaIntegralEstimada: number;
  creditoContratadoEstimado: number;
  saldoDevedorEstimado: number;
  creditoReajustadoConsorcio: number;
  reajusteAnualCreditoPercentual: number;
  prazoConsorcioMeses: number;
  percentualParcelaReduzida: number;
};

export type AplicacaoComConsorcioResult = Omit<AplicacaoComparativoResult, "tipo_calculadora"> & {
  tipo_calculadora: "aplicacao_comparativo_consorcio";
  aumentoAnualAportePercentual: number;
  taxaAnualUsada: number | null;
  taxaMensalEquivalente: number | null;
  indiceAplicacao: PerfilAplicacaoCodigo | "comparar_todos";
  compararComConsorcio: boolean;
  consorcio: ConsorcioComparativoBloco | null;
  diferencaPatrimonial: number | null;
  avisoComparativo: string;
  textoDiferenca: string;
};

export function calcularAplicacaoComConsorcio(
  input: AplicacaoComConsorcioInput,
): AplicacaoComConsorcioResult {
  const aumentoAnualAporte = input.aumentoAnualAportePercentual ?? 0;
  const comparar = input.compararComConsorcio !== false;

  const baseComReajuste = calcularAplicacaoComparativo({
    ...input,
    aumentoAnualAportePercentual: aumentoAnualAporte,
  });

  const perfilAtivo: PerfilAplicacaoCodigo | null =
    input.perfil === "comparar_todos"
      ? baseComReajuste.melhorResultadoEstimado
      : input.perfil;

  const taxaInfo = perfilAtivo
    ? infoTaxaAplicacaoIndice(perfilAtivo, input.indicePrincipal ?? null, {
        percentualCdi: input.percentualCdi,
        taxaManualMensal: input.taxaManualMensal,
      })
    : null;

  let consorcio: ConsorcioComparativoBloco | null = null;
  let diferencaPatrimonial: number | null = null;

  if (comparar && input.aporteMensal > 0 && input.prazoMeses > 0) {
    const pctReduzida =
      input.percentualParcelaReduzidaConsorcio ??
      percentualParcelaReduzidaPadrao(DEFAULT_SIMULADOR_IMOVEL);
    const reajusteCredito = input.reajusteAnualCreditoPercentual ?? 6;
    const prazoConsorcio = input.prazoConsorcioMeses ?? 220;
    const taxaAdm = input.taxaAdministrativaConsorcio ?? DEFAULT_SIMULADOR_IMOVEL.taxaAdministrativaPadrao;
    const fundo = input.fundoReservaConsorcio ?? DEFAULT_SIMULADOR_IMOVEL.fundoReservaPadrao;
    const seguro =
      input.seguroPrestamistaConsorcio ?? DEFAULT_SIMULADOR_IMOVEL.seguroPrestamistaPadrao;

    const estimado = estimarCreditoConsorcioPorParcela({
      parcelaDesejada: input.aporteMensal,
      prazoMeses: prazoConsorcio,
      percentualParcelaReduzida: pctReduzida,
      taxaAdministrativaPercentual: taxaAdm,
      fundoReservaPercentual: fundo,
      seguroPrestamistaPercentual: seguro,
    });

    if (estimado) {
      const creditoReajustado = projetarCreditoReajustado(
        estimado.creditoContratadoEstimado,
        reajusteCredito,
        input.prazoMeses,
      );
      consorcio = {
        parcelaReduzidaEstimada: estimado.parcelaReduzida,
        parcelaIntegralEstimada: estimado.parcelaIntegral,
        creditoContratadoEstimado: estimado.creditoContratadoEstimado,
        saldoDevedorEstimado: estimado.saldoDevedorEstimado,
        creditoReajustadoConsorcio: creditoReajustado,
        reajusteAnualCreditoPercentual: reajusteCredito,
        prazoConsorcioMeses: prazoConsorcio,
        percentualParcelaReduzida: pctReduzida,
      };
      diferencaPatrimonial =
        Math.round((creditoReajustado - baseComReajuste.valorFinalEstimado) * 100) / 100;
    }
  }

  return {
    ...baseComReajuste,
    tipo_calculadora: "aplicacao_comparativo_consorcio",
    aumentoAnualAportePercentual: aumentoAnualAporte,
    taxaAnualUsada: taxaInfo?.taxaAnualPercentual ?? null,
    taxaMensalEquivalente: taxaInfo?.taxaMensalPercentual ?? null,
    indiceAplicacao: input.perfil,
    compararComConsorcio: comparar,
    consorcio,
    diferencaPatrimonial,
    avisoComparativo: AVISO_COMPARATIVO_CONSORCIO,
    textoDiferenca: TEXTO_DIFERENCA_PATRIMONIAL,
  };
}

/** Payload estruturado para lead / dados_simulacao. */
export function leadPayloadAplicacaoConsorcio(
  input: AplicacaoComConsorcioInput,
  result: AplicacaoComConsorcioResult,
): Record<string, unknown> {
  return {
    tipo_calculadora: "aplicacao_comparativo_consorcio",
    aporte_inicial_mensal: input.aporteMensal,
    aumento_anual_aporte_percentual: result.aumentoAnualAportePercentual,
    prazo_meses: input.prazoMeses,
    indice_aplicacao: result.indiceAplicacao,
    taxa_anual_usada: result.taxaAnualUsada,
    taxa_mensal_equivalente: result.taxaMensalEquivalente,
    total_investido: result.totalInvestido,
    valor_final_aplicacao: result.valorFinalEstimado,
    credito_consorcio_estimado: result.consorcio?.creditoContratadoEstimado ?? null,
    parcela_reduzida_estimada: result.consorcio?.parcelaReduzidaEstimada ?? null,
    parcela_integral_estimada: result.consorcio?.parcelaIntegralEstimada ?? null,
    reajuste_anual_credito_percentual: result.consorcio?.reajusteAnualCreditoPercentual ?? null,
    credito_reajustado_consorcio: result.consorcio?.creditoReajustadoConsorcio ?? null,
    diferenca_patrimonial: result.diferencaPatrimonial,
  };
}
