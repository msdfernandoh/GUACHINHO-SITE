import type { FinanciamentoConfig, SimuladorTipoBemConfig } from "@/lib/config/defaults";
import { calcularParcelaConsorcio } from "@/lib/simulador/consorcio";
import { simularFinanciamento } from "@/lib/simulador/financiamento";

export type SimuladorConfigsBundle = {
  imovel: SimuladorTipoBemConfig;
  automovel: SimuladorTipoBemConfig;
  financiamento: FinanciamentoConfig;
};

export function computeQuickSimulatorParcela(
  modo: "consorcio" | "financiamento",
  valorCredito: number,
  prazoMeses: number,
  configs: SimuladorConfigsBundle,
  tipoBem: "imovel" | "automovel" = "imovel",
): number {
  const valor = Math.max(0, valorCredito);
  const prazo = Math.max(1, prazoMeses);

  if (modo === "consorcio") {
    const cfg = tipoBem === "automovel" ? configs.automovel : configs.imovel;
    const prazoEfetivo =
      cfg.prazosDisponiveis?.length && !cfg.prazosDisponiveis.includes(prazo)
        ? cfg.prazoPadrao
        : prazo;
    const r = calcularParcelaConsorcio({
      valorCredito: valor,
      prazoMeses: prazoEfetivo,
      taxaAdministrativaPercentual: cfg.taxaAdministrativaPadrao,
      fundoReservaPercentual: cfg.fundoReservaPadrao,
      seguroPrestamistaPercentual: cfg.seguroPrestamistaPadrao,
      percentualParcelaInicial: 100,
    });
    return r.parcelaEstimada;
  }

  const fin = configs.financiamento;
  const prazoFin = prazo || fin.prazoPadrao;
  const entrada =
    valor * (Math.max(0, fin.entradaMinimaSugeridaPercentual) / 100);
  return simularFinanciamento({
    valorBem: valor,
    entrada,
    taxaMensalPercentual: fin.taxaMensalPadrao,
    prazoMeses: prazoFin,
  }).parcelaEstimada;
}
