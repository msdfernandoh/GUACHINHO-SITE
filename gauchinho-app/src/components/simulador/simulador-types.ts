import type {
  FinanciamentoConfig,
  SimuladorTipoBemConfig,
} from "@/lib/config/defaults";

export type SimuladorConfigs = {
  imovel: SimuladorTipoBemConfig;
  automovel: SimuladorTipoBemConfig;
  financiamento: FinanciamentoConfig;
};

export type Modo = "consorcio" | "financiamento";
export type TipoBem = "imovel" | "automovel" | "moto" | "caminhonete";
export type EstrategiaPagamento = "integral" | "reduzida";
export type AcaoCaptura = "analise" | "proposta" | "especialista";

export const AVISO_PROJECAO =
  "Projeção estimada com base nos índices configurados. Os valores podem variar conforme administradora, grupo, índice de reajuste, regras contratuais e data de contemplação. Esta simulação não representa garantia de rentabilidade, contemplação ou disponibilidade.";
