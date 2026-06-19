import type { FinanciamentoConfig, SimuladorTipoBemConfig } from "@/lib/config/defaults";
import { opcoesParcelaAtivas } from "@/lib/config/simulador-parcela-opcoes";
import { calcularParcelaConsorcio } from "@/lib/simulador/consorcio";
import {
  entradaPadraoFinanciamento,
  taxaFinanciamentoEfetiva,
} from "@/lib/simulador/financiamento-entrada";
import { simularFinanciamento } from "@/lib/simulador/financiamento";
import {
  listPrazosConsorcio,
  listPrazosFinanciamento,
  PRAZOS_FINANCIAMENTO_BASE,
  snapPrazoToLista,
} from "@/lib/simulador/prazos";

export type SimuladorConfigsBundle = {
  imovel: SimuladorTipoBemConfig;
  automovel: SimuladorTipoBemConfig;
  financiamento: FinanciamentoConfig;
};

export {
  listPrazosConsorcio,
  listPrazosFinanciamento,
  PRAZOS_FINANCIAMENTO_BASE,
  snapPrazoToLista,
};

export const entradaFinanciamentoInicial = entradaPadraoFinanciamento;

export function financiamentoTaxaConfigurada(finCfg: FinanciamentoConfig): boolean {
  return taxaFinanciamentoEfetiva(finCfg) != null;
}

export function financiamentoEntradaValida(
  valorBem: number,
  finCfg: FinanciamentoConfig,
): boolean {
  const entrada = entradaPadraoFinanciamento(valorBem, finCfg);
  return valorBem - entrada > 0;
}

export type QuickSimulatorPreview = {
  parcela: number | null;
  prazoMeses: number;
  aviso: string | null;
};

export function computeQuickSimulatorPreview(
  modo: "consorcio" | "financiamento",
  valorCredito: number,
  prazoMeses: number,
  configs: SimuladorConfigsBundle,
  tipoBem: "imovel" | "automovel" = "imovel",
): QuickSimulatorPreview {
  const valor = Math.max(0, valorCredito);
  const bemCfg = tipoBem === "automovel" ? configs.automovel : configs.imovel;
  const finCfg = configs.financiamento;

  if (modo === "consorcio") {
    const prazos = listPrazosConsorcio(bemCfg);
    const prazo = snapPrazoToLista(prazoMeses, prazos, bemCfg.prazoPadrao);
    const percentualParcela = opcoesParcelaAtivas(bemCfg)[0]?.percentual ?? 100;
    const r = calcularParcelaConsorcio({
      valorCredito: valor,
      prazoMeses: prazo,
      taxaAdministrativaPercentual: bemCfg.taxaAdministrativaPadrao,
      fundoReservaPercentual: bemCfg.fundoReservaPadrao,
      seguroPrestamistaPercentual: bemCfg.seguroPrestamistaPadrao,
      percentualParcelaInicial: percentualParcela,
    });
    return { parcela: r.parcelaEstimada, prazoMeses: prazo, aviso: null };
  }

  const prazos = listPrazosFinanciamento(finCfg);
  const prazo = snapPrazoToLista(prazoMeses, prazos, finCfg.prazoPadrao);
  const taxa = taxaFinanciamentoEfetiva(finCfg);

  if (taxa == null) {
    return {
      parcela: null,
      prazoMeses: prazo,
      aviso: "Configure as taxas de financiamento no admin para exibir a simulação.",
    };
  }
  if (!financiamentoEntradaValida(valor, finCfg)) {
    return {
      parcela: null,
      prazoMeses: prazo,
      aviso:
        "Ajuste a entrada padrão (%) no admin — o valor financiado precisa ser maior que zero.",
    };
  }

  const entrada = entradaPadraoFinanciamento(valor, finCfg);
  const parcela = simularFinanciamento({
    valorBem: valor,
    entrada,
    taxaMensalPercentual: taxa,
    prazoMeses: prazo,
  }).parcelaEstimada;

  if (!Number.isFinite(parcela) || parcela <= 0) {
    return {
      parcela: null,
      prazoMeses: prazo,
      aviso: "Configure as taxas de financiamento no admin para exibir a simulação.",
    };
  }

  return { parcela, prazoMeses: prazo, aviso: null };
}

export function computeQuickSimulatorParcela(
  modo: "consorcio" | "financiamento",
  valorCredito: number,
  prazoMeses: number,
  configs: SimuladorConfigsBundle,
  tipoBem: "imovel" | "automovel" = "imovel",
): number {
  const r = computeQuickSimulatorPreview(modo, valorCredito, prazoMeses, configs, tipoBem);
  return r.parcela ?? 0;
}

export function getQuickSimDefaults(configs: SimuladorConfigsBundle, tipoBem: "imovel" | "automovel" = "imovel") {
  const cfg = tipoBem === "automovel" ? configs.automovel : configs.imovel;
  const prazos = listPrazosConsorcio(cfg);
  const prazo =
    prazos.find((p) => p === cfg.prazoPadrao) ?? prazos[Math.floor(prazos.length / 2)] ?? cfg.prazoPadrao;
  return {
    valorCredito: cfg.valorPadraoInicial,
    valorMin: cfg.valorMinimoCredito,
    valorMax: cfg.valorMaximoCredito,
    prazo,
    prazosConsorcio: prazos,
    prazosFinanciamento: listPrazosFinanciamento(configs.financiamento),
  };
}
