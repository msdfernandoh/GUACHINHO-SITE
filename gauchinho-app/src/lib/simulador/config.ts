export { getSimuladorConfigsPublic } from "@/server/config";
export type { FinanciamentoConfig, SimuladorTipoBemConfig } from "@/lib/config/defaults";
export type { SimuladorConfigsBundle } from "@/lib/simulador/simulador-shared";
export {
  computeQuickSimulatorParcela,
  computeQuickSimulatorPreview,
  getQuickSimDefaults,
  listPrazosConsorcio,
  listPrazosFinanciamento,
  entradaFinanciamentoInicial,
  financiamentoTaxaConfigurada,
  PRAZOS_FINANCIAMENTO_BASE,
} from "@/lib/simulador/simulador-shared";
export type { QuickSimulatorResult } from "@/lib/simulador/preview-home";
export { computeQuickSimulatorResult } from "@/lib/simulador/preview-home";

/** Alias semântico — mesma fonte usada na Home e em `/simulador`. */
export { getSimuladorConfigsPublic as getSimuladorConfig } from "@/server/config";
