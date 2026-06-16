import type { CalculadoraId } from "@/lib/calculadoras/types";
import type { CalculadorasFinanceirasConfig } from "@/lib/config/defaults";

export type CalculadoraMeta = {
  id: CalculadoraId;
  title: string;
  question: string;
  description: string;
};

export const CALCULADORAS_META: CalculadoraMeta[] = [
  {
    id: "aplicacao_mensal",
    title: "Aplicação mensal",
    question: "Quanto vou acumular investindo todos os meses?",
    description: "Valor inicial, aportes e rentabilidade ao longo do prazo.",
  },
  {
    id: "valor_futuro",
    title: "Valor futuro",
    question: "Quanto um valor pode render ao longo do tempo?",
    description: "Projeção com juros compostos sobre um capital inicial.",
  },
  {
    id: "financiamento",
    title: "Financiamento",
    question: "Quanto ficaria uma prestação financiada?",
    description: "Parcela estimada pela Tabela Price.",
  },
  {
    id: "correcao",
    title: "Correção de valores",
    question: "Quanto vale hoje um valor corrigido por percentual?",
    description: "Correção mensal ou anual acumulada.",
  },
];

export function calculadorasAtivas(config: CalculadorasFinanceirasConfig): CalculadoraMeta[] {
  const flags: Record<CalculadoraId, boolean> = {
    aplicacao_mensal: config.ativoAplicacaoMensal !== false,
    valor_futuro: config.ativoValorFuturo !== false,
    financiamento: config.ativoFinanciamento !== false,
    correcao: config.ativoCorrecao !== false,
  };
  return CALCULADORAS_META.filter((m) => flags[m.id]);
}

export function parseCalcId(raw: string | undefined): CalculadoraId | undefined {
  if (raw === "aplicacao_mensal" || raw === "valor_futuro" || raw === "financiamento" || raw === "correcao") {
    return raw;
  }
  return undefined;
}
