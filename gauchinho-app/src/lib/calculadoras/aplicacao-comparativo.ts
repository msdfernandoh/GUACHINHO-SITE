import { calcularAplicacaoMensal, type AplicacaoMensalResult } from "./aplicacao";
import type { IndiceCodigo } from "@/lib/indices-financeiros/types";

export type PerfilAplicacaoCodigo =
  | "poupanca"
  | "cdi"
  | "tesouro_selic"
  | "tesouro_ipca"
  | "taxa_manual";

export type AplicacaoComparativoInput = {
  valorInicial: number;
  aporteMensal: number;
  prazoMeses: number;
  perfil: PerfilAplicacaoCodigo | "comparar_todos";
  percentualCdi: number;
  taxaManualMensal?: number;
  taxaManualAnual?: number;
  taxasPorPerfil: Partial<Record<PerfilAplicacaoCodigo, number>>;
  labelsPorPerfil?: Partial<Record<PerfilAplicacaoCodigo, string>>;
  aumentoAnualAportePercentual?: number;
};

export type AplicacaoComparativoItem = {
  codigo: PerfilAplicacaoCodigo;
  label: string;
  taxaMensalPercentual: number;
  resultado: AplicacaoMensalResult;
  estimativaTesouro: boolean;
};

export type AplicacaoComparativoResult = {
  tipo_calculadora: "aplicacao_comparativo";
  totalInvestido: number;
  comparativo: AplicacaoComparativoItem[];
  melhorResultadoEstimado: PerfilAplicacaoCodigo | null;
  perfilSelecionado: PerfilAplicacaoCodigo | "comparar_todos";
  valorFinalEstimado: number;
  rendimentoEstimado: number;
};

const DEFAULT_LABELS: Record<PerfilAplicacaoCodigo, string> = {
  poupanca: "Poupança",
  cdi: "CDI",
  tesouro_selic: "Tesouro Selic",
  tesouro_ipca: "Tesouro IPCA+",
  taxa_manual: "Taxa manual",
};

export function taxaCdiEfetivaAnual(cdiAnualPercentual: number, percentualDoCdi: number): number {
  return cdiAnualPercentual * (percentualDoCdi / 100);
}

export function calcularAplicacaoComparativo(input: AplicacaoComparativoInput): AplicacaoComparativoResult {
  const perfis: PerfilAplicacaoCodigo[] =
    input.perfil === "comparar_todos"
      ? ["poupanca", "cdi", "tesouro_selic", "tesouro_ipca", "taxa_manual"]
      : [input.perfil];

  const comparativo: AplicacaoComparativoItem[] = [];

  for (const codigo of perfis) {
    const taxa = input.taxasPorPerfil[codigo];
    if (taxa == null || !Number.isFinite(taxa)) continue;

    const resultado = calcularAplicacaoMensal({
      valorInicial: input.valorInicial,
      aporteMensal: input.aporteMensal,
      taxaMensalPercentual: taxa,
      prazoMeses: input.prazoMeses,
      aumentoAnualAportePercentual: input.aumentoAnualAportePercentual,
    });

    comparativo.push({
      codigo,
      label: input.labelsPorPerfil?.[codigo] ?? DEFAULT_LABELS[codigo],
      taxaMensalPercentual: taxa,
      resultado,
      estimativaTesouro: codigo === "tesouro_selic" || codigo === "tesouro_ipca",
    });
  }

  let melhor: PerfilAplicacaoCodigo | null = null;
  let maxFuturo = -1;
  for (const item of comparativo) {
    if (item.resultado.valorFuturo > maxFuturo) {
      maxFuturo = item.resultado.valorFuturo;
      melhor = item.codigo;
    }
  }

  const principal =
    input.perfil === "comparar_todos"
      ? comparativo.find((c) => c.codigo === melhor) ?? comparativo[0]
      : comparativo[0];

  return {
    tipo_calculadora: "aplicacao_comparativo",
    totalInvestido: principal?.resultado.totalInvestido ?? 0,
    comparativo,
    melhorResultadoEstimado: melhor,
    perfilSelecionado: input.perfil,
    valorFinalEstimado: principal?.resultado.valorFuturo ?? 0,
    rendimentoEstimado: principal?.resultado.rendimentoEstimado ?? 0,
  };
}

export function perfilToIndiceCodigo(perfil: PerfilAplicacaoCodigo): IndiceCodigo {
  return perfil;
}
