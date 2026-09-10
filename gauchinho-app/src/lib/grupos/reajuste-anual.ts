import type { GrupoConsorcio } from "@/lib/types";

export const NOMES_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export function descricaoReajusteAnual(
  grupo: Pick<
    GrupoConsorcio,
    "tipo_reajuste_anual" | "reajuste_anual_percentual" | "reajuste_anual_indice"
  >,
): string | null {
  if (grupo.tipo_reajuste_anual === "FIXO" && Number(grupo.reajuste_anual_percentual) > 0) {
    return `Reajuste anual: ${Number(grupo.reajuste_anual_percentual).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% fixo`;
  }
  if (grupo.tipo_reajuste_anual === "VARIAVEL" && grupo.reajuste_anual_indice?.trim()) {
    return `Reajuste anual: ${grupo.reajuste_anual_indice.trim()}`;
  }
  return null;
}

export type StatusReajusteAnual = {
  temPrimeiraAssembleia: boolean;
  dataPrimeiraAssembleia: string | null;
  mesAniversario: number | null; // 1 a 12
  nomeMesAniversario: string | null;
  anoAtual: number;
  deuUmAno: boolean; // Completou >= 12 meses desde a 1ª assembleia
  aniversarioAtingidoNoAno: boolean; // No ano atual, o mês de aniversário já chegou
  jaReajustadoAnoAtual: boolean; // Já foi reajustado ou dispensado no ano atual
  precisaReajuste: boolean; // deuUmAno && aniversarioAtingidoNoAno && !jaReajustadoAnoAtual
  tagTexto: string;
  tagTipo: "atencao" | "sucesso" | "neutro";
};

export type GrupoReajusteAnualInput = {
  data_primeira_assembleia?: string | Date | null;
  tipo_reajuste_anual?: "FIXO" | "VARIAVEL" | string | null;
  reajuste_anual_percentual?: number | null;
  reajuste_anual_indice?: string | null;
  ano_ultimo_reajuste?: number | null;
  data_ultimo_reajuste?: string | Date | null;
  credito_reajustado_ate_meses?: number | null;
};

/**
 * Analisa a temporalidade da 1ª assembleia para determinar se o grupo
 * completou 1 ano e atingiu o mês de aniversário no ano corrente.
 */
export function obterStatusReajusteAnual(
  grupo: GrupoReajusteAnualInput,
  dataReferencia: string | Date = new Date(),
): StatusReajusteAnual {
  const dRef = typeof dataReferencia === "string" ? new Date(dataReferencia) : dataReferencia;
  const anoAtual = dRef.getFullYear();
  const mesAtual = dRef.getMonth() + 1; // 1..12

  if (!grupo.data_primeira_assembleia) {
    return {
      temPrimeiraAssembleia: false,
      dataPrimeiraAssembleia: null,
      mesAniversario: null,
      nomeMesAniversario: null,
      anoAtual,
      deuUmAno: false,
      aniversarioAtingidoNoAno: false,
      jaReajustadoAnoAtual: false,
      precisaReajuste: false,
      tagTexto: "Sem 1ª assembleia",
      tagTipo: "neutro",
    };
  }

  let yInicio: number;
  let mInicio: number; // 1..12
  let rawIso: string;

  if (typeof grupo.data_primeira_assembleia === "string") {
    const raw = grupo.data_primeira_assembleia.split("T")[0];
    rawIso = raw;
    const [y, m] = raw.split("-").map(Number);
    yInicio = y;
    mInicio = m;
  } else {
    yInicio = grupo.data_primeira_assembleia.getUTCFullYear();
    mInicio = grupo.data_primeira_assembleia.getUTCMonth() + 1;
    rawIso = grupo.data_primeira_assembleia.toISOString().split("T")[0];
  }

  const mesAniversario = mInicio;
  const nomeMesAniversario = NOMES_MESES[mesAniversario - 1] ?? `Mês ${mesAniversario}`;

  // Completou 1 ano se o ano de início foi anterior a este ano e no ano seguinte o mês já foi atingido
  // Exemplo: início 05/2025 -> em 05/2026 completa 1 ano.
  const deuUmAno =
    anoAtual - yInicio > 1 || (anoAtual - yInicio === 1 && mesAtual >= mesAniversario);

  // No ano atual, o mês de aniversário já chegou?
  // Se o grupo tem pelo menos 1 ano de histórico e mesAtual >= mesAniversario
  const aniversarioAtingidoNoAno =
    deuUmAno && mesAtual >= mesAniversario;

  const anoUltimoReajuste =
    grupo.ano_ultimo_reajuste != null ? Number(grupo.ano_ultimo_reajuste) : null;
  const jaReajustadoAnoAtual = Boolean(anoUltimoReajuste && anoUltimoReajuste >= anoAtual);

  const precisaReajuste = deuUmAno && aniversarioAtingidoNoAno && !jaReajustadoAnoAtual;

  let tagTexto: string;
  let tagTipo: "atencao" | "sucesso" | "neutro";

  if (precisaReajuste) {
    tagTexto = `⚠ Reajuste: Mês de ${nomeMesAniversario}`;
    tagTipo = "atencao";
  } else if (jaReajustadoAnoAtual) {
    tagTexto = `✓ Reajustado (${anoAtual})`;
    tagTipo = "sucesso";
  } else if (!deuUmAno) {
    tagTexto = `Novo (< 1 ano)`;
    tagTipo = "neutro";
  } else {
    tagTexto = `Aniversário: ${nomeMesAniversario}`;
    tagTipo = "neutro";
  }

  return {
    temPrimeiraAssembleia: true,
    dataPrimeiraAssembleia: rawIso,
    mesAniversario,
    nomeMesAniversario,
    anoAtual,
    deuUmAno,
    aniversarioAtingidoNoAno,
    jaReajustadoAnoAtual,
    precisaReajuste,
    tagTexto,
    tagTipo,
  };
}

/**
 * Calcula o novo valor de crédito aplicando um percentual e arredondando para 2 casas decimais.
 */
export function calcularNovoCreditoPorPercentual(valorAtual: number, percentual: number): number {
  if (!Number.isFinite(valorAtual) || valorAtual <= 0) return 0;
  if (!Number.isFinite(percentual)) return valorAtual;
  const novo = valorAtual * (1 + percentual / 100);
  return Math.round(novo * 100) / 100;
}

/**
 * Calcula a variação percentual resultante entre um valor atual e um novo valor informado.
 */
export function calcularPercentualPorVariacao(valorAtual: number, novoValor: number): number {
  if (!Number.isFinite(valorAtual) || valorAtual <= 0) return 0;
  if (!Number.isFinite(novoValor) || novoValor <= 0) return 0;
  const pct = ((novoValor / valorAtual) - 1) * 100;
  return Math.round(pct * 10000) / 10000;
}

/**
 * Ao alterar o valor de uma cota de referência, calcula o percentual de reajuste correspondente
 * e propaga para todas as outras cotas da lista mantendo proporcionalidade.
 */
export function calcularPropagacaoCotaBase<T extends { id: string; valor_credito: number }>(
  cotas: T[],
  cotaEditadaId: string,
  novoValor: number,
): { percentualCalculado: number; cotasAtualizadas: Array<T & { novo_credito: number }> } {
  const cotaBase = cotas.find((c) => c.id === cotaEditadaId);
  if (
    !cotaBase ||
    Number(cotaBase.valor_credito) <= 0 ||
    !Number.isFinite(novoValor) ||
    novoValor <= 0
  ) {
    return {
      percentualCalculado: 0,
      cotasAtualizadas: cotas.map((c) => ({ ...c, novo_credito: Number(c.valor_credito) })),
    };
  }

  const percentual = calcularPercentualPorVariacao(Number(cotaBase.valor_credito), novoValor);

  const cotasAtualizadas = cotas.map((c) => {
    if (c.id === cotaEditadaId) {
      return { ...c, novo_credito: Math.round(novoValor * 100) / 100 };
    }
    return {
      ...c,
      novo_credito: calcularNovoCreditoPorPercentual(Number(c.valor_credito), percentual),
    };
  });

  return { percentualCalculado: percentual, cotasAtualizadas };
}
