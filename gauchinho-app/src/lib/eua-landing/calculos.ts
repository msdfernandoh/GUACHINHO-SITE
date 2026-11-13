/**
 * Cálculos comerciais da página de vendas EUA. São estimativas de apresentação:
 * a proposta oficial é recalculada pela equipe na conferência.
 *
 * Fatores de parcela reduzida extraídos da tabela comercial Racon divulgada
 * (imóvel grupo 1563 / 200 meses: R$ 100 mil → R$ 375; veículo grupos
 * 5388/5588: R$ 150 mil → R$ 870).
 */

export type EuaTipoBem = "imovel" | "veiculo";
export type EuaObjetivo = "imovel" | "renda" | "veiculo" | "alavancagem";
export type EuaUrgencia = "ja" | "ano" | "calma";

export type EuaGrupoReferencia = {
  tipoBem: EuaTipoBem;
  fatorParcelaReduzida: number;
  creditoMinimo: number;
  creditoMaximo: number;
  passo: number;
  prazoMeses: number;
  grupo: string;
};

export const EUA_GRUPOS: Record<EuaTipoBem, EuaGrupoReferencia> = {
  imovel: {
    tipoBem: "imovel",
    fatorParcelaReduzida: 0.00375,
    creditoMinimo: 100_000,
    creditoMaximo: 1_000_000,
    passo: 10_000,
    prazoMeses: 200,
    grupo: "1563",
  },
  veiculo: {
    tipoBem: "veiculo",
    fatorParcelaReduzida: 0.0058,
    creditoMinimo: 36_562,
    creditoMaximo: 200_000,
    passo: 5_000,
    prazoMeses: 120,
    grupo: "5388/5588",
  },
};

export const EUA_OBJETIVO_TIPO_BEM: Record<EuaObjetivo, EuaTipoBem> = {
  imovel: "imovel",
  renda: "imovel",
  veiculo: "veiculo",
  alavancagem: "imovel",
};

/** Limite de lance embutido usado nas simulações da página (confirmar por grupo). */
export const EUA_LANCE_EMBUTIDO_MAX = 0.3;
/** Aluguel estimado ao mês sobre o valor do imóvel. */
export const EUA_ALUGUEL_MENSAL = 0.005;
/** Taxa de administração ilustrativa no comparativo com financiamento. */
export const EUA_TAXA_ADM_ILUSTRATIVA = 0.2;
/** Juros anuais de referência do financiamento no comparativo. */
export const EUA_JUROS_FINANCIAMENTO_AA = 0.12;
export const EUA_CAMBIO_PADRAO = 5.4;

export type EuaPlano = {
  tipoBem: EuaTipoBem;
  grupo: EuaGrupoReferencia;
  reaisMensal: number;
  /** Crédito bruto que o valor mensal sustenta, antes de limites do grupo. */
  creditoPossivel: number;
  abaixoDoMinimo: boolean;
  quantidadeCotas: number;
  creditoPorCota: number;
  creditoTotal: number;
  parcelaReduzidaTotal: number;
};

function arredondarPara(valor: number, passo: number): number {
  return Math.floor(valor / passo) * passo;
}

export function cambioValido(valor: number | null | undefined): number {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 1 && valor < 20
    ? valor
    : EUA_CAMBIO_PADRAO;
}

export function creditoPorValorMensal(reaisMensal: number, grupo: EuaGrupoReferencia): number {
  if (!(reaisMensal > 0)) return 0;
  return arredondarPara(reaisMensal / grupo.fatorParcelaReduzida, grupo.passo);
}

export function calcularPlano(usdMensal: number, cambio: number, tipoBem: EuaTipoBem): EuaPlano {
  const grupo = EUA_GRUPOS[tipoBem];
  const reaisMensal = Math.max(0, usdMensal) * cambioValido(cambio);
  const creditoPossivel = creditoPorValorMensal(reaisMensal, grupo);
  const abaixoDoMinimo = creditoPossivel < grupo.creditoMinimo;

  let quantidadeCotas = 1;
  let creditoPorCota = Math.min(Math.max(creditoPossivel, grupo.creditoMinimo), grupo.creditoMaximo);
  if (creditoPossivel > grupo.creditoMaximo) {
    quantidadeCotas = Math.ceil(creditoPossivel / grupo.creditoMaximo);
    creditoPorCota = arredondarPara(creditoPossivel / quantidadeCotas, grupo.passo);
  }

  return {
    tipoBem,
    grupo,
    reaisMensal,
    creditoPossivel,
    abaixoDoMinimo,
    quantidadeCotas,
    creditoPorCota,
    creditoTotal: creditoPorCota * quantidadeCotas,
    parcelaReduzidaTotal: creditoPorCota * grupo.fatorParcelaReduzida * quantidadeCotas,
  };
}

/** Opções de cota próximas do plano, dentro dos limites do grupo. */
export function opcoesDeCota(plano: EuaPlano): number[] {
  const { grupo, creditoPorCota } = plano;
  const candidatos = [creditoPorCota - 4 * grupo.passo, creditoPorCota, creditoPorCota + 4 * grupo.passo];
  return candidatos.filter((v) => v >= grupo.creditoMinimo && v <= grupo.creditoMaximo);
}

export function parcelaReduzida(credito: number, tipoBem: EuaTipoBem): number {
  return credito * EUA_GRUPOS[tipoBem].fatorParcelaReduzida;
}

export function lanceEmbutido(credito: number, percentual: number) {
  const p = Math.min(Math.max(percentual, 0), EUA_LANCE_EMBUTIDO_MAX);
  const lance = credito * p;
  return { lance, liquido: credito - lance, percentual: p };
}

/** Carta necessária para ficar com `liquidoDesejado` após o lance embutido máximo. */
export function cartaParaLiquido(liquidoDesejado: number, passo = 10_000): number {
  if (!(liquidoDesejado > 0)) return 0;
  return Math.ceil(liquidoDesejado / (1 - EUA_LANCE_EMBUTIDO_MAX) / passo) * passo;
}

export function aluguelEstimado(quantidadeImoveis: number, valorImovel: number): number {
  return Math.max(0, quantidadeImoveis) * Math.max(0, valorImovel) * EUA_ALUGUEL_MENSAL;
}

export function comparativoFinanciamento(valor: number, prazoMeses = 200) {
  const i = Math.pow(1 + EUA_JUROS_FINANCIAMENTO_AA, 1 / 12) - 1;
  const parcela = (valor * i) / (1 - Math.pow(1 + i, -prazoMeses));
  return {
    totalFinanciamento: parcela * prazoMeses,
    totalConsorcio: valor * (1 + EUA_TAXA_ADM_ILUSTRATIVA),
  };
}
