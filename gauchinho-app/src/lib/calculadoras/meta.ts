import type { CalculadoraId } from "@/lib/calculadoras/types";
import type { CalculadorasFinanceirasConfig } from "@/lib/config/defaults";

export type CalculadoraMeta = {
  id: CalculadoraId;
  title: string;
  question: string;
  description: string;
  subtitle?: string;
};

export const CALCULADORAS_META: CalculadoraMeta[] = [
  {
    id: "aplicacao_mensal",
    title: "Aplicação mensal",
    question: "Quanto vou acumular investindo todos os meses?",
    description: "Compare Poupança, CDI, Tesouro Direto e taxa personalizada.",
    subtitle: "Compare Poupança, CDI, Tesouro Direto e taxa personalizada.",
  },
  {
    id: "valor_futuro",
    title: "Valor futuro",
    question: "Quanto um valor pode render — ou qual taxa você paga?",
    description:
      "Projeção com juros compostos ou descubra a taxa mensal de uma proposta a partir do crédito, prazo e parcela.",
  },
  {
    id: "financiamento",
    title: "Financiamento",
    question: "Quanto ficaria uma prestação financiada?",
    description: "Parcela estimada pela Tabela Price.",
  },
  {
    id: "correcao",
    title: "Correção aluguel",
    question: "Qual o novo valor do aluguel após o reajuste?",
    description: "Atualize valores por IPCA, IGP-M ou uma taxa personalizada.",
    subtitle: "Atualize valores por IPCA, IGP-M ou uma taxa personalizada.",
  },
  {
    id: "juros_real",
    title: "Juros real",
    question: "Qual juros real estou pagando?",
    description: "Veja qual taxa está embutida em uma parcela.",
    subtitle: "Descubra a taxa mensal e anual a partir do valor financiado, parcela e prazo.",
  },
];

export function calculadorasAtivas(config: CalculadorasFinanceirasConfig): CalculadoraMeta[] {
  const flags: Record<CalculadoraId, boolean> = {
    aplicacao_mensal: config.ativoAplicacaoMensal !== false,
    valor_futuro: config.ativoValorFuturo !== false,
    financiamento: config.ativoFinanciamento !== false,
    correcao: config.ativoCorrecao !== false,
    juros_real: config.ativoJurosReal !== false,
  };
  return CALCULADORAS_META.filter((m) => flags[m.id]);
}

export function parseCalcId(raw: string | undefined): CalculadoraId | undefined {
  if (
    raw === "aplicacao_mensal" ||
    raw === "valor_futuro" ||
    raw === "financiamento" ||
    raw === "correcao" ||
    raw === "juros_real"
  ) {
    return raw;
  }
  return undefined;
}
