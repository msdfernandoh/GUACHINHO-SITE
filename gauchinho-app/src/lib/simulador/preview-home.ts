import type { SimuladorConfigsBundle } from "@/lib/simulador/simulador-shared";
import {
  computeQuickSimulatorPreview,
  computeQuickSimulatorParcela,
  getQuickSimDefaults,
  listPrazosConsorcio,
  listPrazosFinanciamento,
  entradaFinanciamentoInicial,
  financiamentoTaxaConfigurada,
} from "@/lib/simulador/simulador-shared";

export type { SimuladorConfigsBundle };

export {
  computeQuickSimulatorParcela,
  computeQuickSimulatorPreview,
  getQuickSimDefaults,
  listPrazosConsorcio,
  listPrazosFinanciamento,
  entradaFinanciamentoInicial,
  financiamentoTaxaConfigurada,
};

export type QuickSimulatorResult = {
  ok: boolean;
  parcela: number | null;
  prazoEfetivo: number;
  motivo: string | null;
};

export function computeQuickSimulatorResult(
  modo: "consorcio" | "financiamento",
  valorCredito: number,
  prazoMeses: number,
  configs: SimuladorConfigsBundle,
  tipoBem: "imovel" | "automovel" = "imovel",
): QuickSimulatorResult {
  const r = computeQuickSimulatorPreview(modo, valorCredito, prazoMeses, configs, tipoBem);
  const ok = r.parcela != null && Number.isFinite(r.parcela) && r.parcela > 0;
  return {
    ok,
    parcela: ok ? r.parcela : null,
    prazoEfetivo: r.prazoMeses,
    motivo: ok ? null : r.aviso,
  };
}
