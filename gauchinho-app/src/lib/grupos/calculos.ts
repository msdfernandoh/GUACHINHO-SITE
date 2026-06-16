/**
 * Fórmulas de grupos/cotas — única fonte para UI e persistência.
 */

import { fatorSeguroGrupo } from "./seguro";
import { calcularPrazoGrupoFromRow } from "./prazos";
import type { GrupoConsorcio } from "@/lib/types";

/** Seguro entra na parcela “com seguro” quando habilitado ou pós-contemplação (planilha). */
export function grupoUsaSeguroNaParcela(grupo: {
  seguro_habilitado?: boolean;
  seguro_pos_contemplacao?: boolean;
}): boolean {
  return !!grupo.seguro_habilitado || !!grupo.seguro_pos_contemplacao;
}

export function seguroMensalSobreSaldo(
  saldoDevedor: number,
  grupo: GrupoBulkEstimateInput,
): number {
  if (!grupoUsaSeguroNaParcela(grupo)) return 0;
  const valorFixo = grupo.seguro_valor != null ? num(grupo.seguro_valor) : 0;
  const pct = fatorSeguroGrupo(grupo.seguro_percentual);
  if (pct > 0 && saldoDevedor > 0) {
    return Math.round(saldoDevedor * pct * 100) / 100;
  }
  return valorFixo > 0 ? valorFixo : 0;
}

export type ParametrosGrupo = {
  taxaAdministrativaPercentual: number;
  fundoReservaPercentual: number;
  seguroHabilitado: boolean;
  seguroPercentual: number;
  permiteLanceEmbutido: boolean;
  percentualLanceEmbutido: number;
  percentualRecursoProprioSugerido: number;
  prazoTotal: number;
  parcelasRealizadas: number;
  prazoRestante?: number;
  seguroPosContemplacao: boolean;
  cetPercentual?: number;
};

export type LinhaCalculoCota = {
  valorCredito: number;
  saldoDevedorInformado?: number | null;
  valorParcelaInformado?: number | null;
  quantidadeCotas?: number;
  recursoProprioManual?: number | null;
};

export type TotaisGrupoCalculados = {
  somaCotas: number;
  saldoDevedor: number;
  lanceEmbutido: number;
  recursoProprio: number;
  lanceTotal: number;
  primeiraParcela: number;
  seguro: number;
  parcelasRestantes: number;
  creditoLiquido: number;
};

function num(v: number | null | undefined, fallback = 0): number {
  return v != null && Number.isFinite(v) ? v : fallback;
}

/** Soma dos créditos selecionados (× quantidade por linha). */
export function calcularSomaCotas(
  linhas: LinhaCalculoCota[],
): number {
  return linhas.reduce(
    (acc, l) => acc + num(l.valorCredito) * (l.quantidadeCotas ?? 1),
    0,
  );
}

/**
 * Saldo devedor agregado.
 * TODO Excel: confirmar se usa crédito bruto, crédito + taxas ou saldo cadastrado na cota.
 */
export function calcularSaldoDevedor(
  linhas: LinhaCalculoCota[],
  params: ParametrosGrupo,
): number {
  return linhas.reduce((acc, l) => {
    const q = l.quantidadeCotas ?? 1;
    const soma = num(l.valorCredito) * q;
    return (
      acc +
      calcularSaldoDevedorLinha(soma, params, l.saldoDevedorInformado, q)
    );
  }, 0);
}

/**
 * Lance embutido = saldo devedor × percentual configurado (quando permitido).
 * TODO Excel: validar base (saldo vs crédito).
 */
export function calcularLanceEmbutido(
  saldoDevedor: number,
  params: ParametrosGrupo,
  overrides?: Partial<ParametrosGrupo>,
): number {
  const p = { ...params, ...overrides };
  if (!p.permiteLanceEmbutido) return 0;
  return saldoDevedor * (num(p.percentualLanceEmbutido) / 100);
}

/** Recurso próprio sugerido sobre o crédito (ou valor manual por linha). */
export function calcularRecursoProprio(
  credito: number,
  params: ParametrosGrupo,
  manual?: number | null,
): number {
  if (manual != null && manual >= 0) return manual;
  return credito * (num(params.percentualRecursoProprioSugerido) / 100);
}

/** Lance total = embutido + recurso próprio. */
export function calcularLanceTotal(
  lanceEmbutido: number,
  recursoProprio: number,
): number {
  return lanceEmbutido + recursoProprio;
}

/**
 * Primeira parcela total (soma parcelas informadas ou estimativa).
 * TODO Excel: parcela reduzida vs integral vs seguro.
 */
export function calcularPrimeiraParcela(
  linhas: LinhaCalculoCota[],
): number {
  return linhas.reduce((acc, l) => {
    const q = l.quantidadeCotas ?? 1;
    const parcela = num(l.valorParcelaInformado);
    return acc + parcela * q;
  }, 0);
}

/**
 * Seguro total conforme flags do grupo.
 * TODO Excel: percentual sobre saldo, crédito ou parcela.
 */
export function calcularSeguro(
  saldoDevedor: number,
  params: ParametrosGrupo,
): number {
  if (!params.seguroHabilitado) return 0;
  const fator = fatorSeguroGrupo(params.seguroPercentual);
  return Math.round(saldoDevedor * fator * 100) / 100;
}

/** Parcelas restantes (prazo restante do grupo). */
export function calcularParcelasRestantes(params: ParametrosGrupo): number {
  if (params.prazoRestante != null) return num(params.prazoRestante);
  const total = num(params.prazoTotal);
  const realizadas = num(params.parcelasRealizadas);
  return Math.max(total - realizadas, 0);
}

/** Prazo do grupo para parcela inicial (planilha: saldo ÷ prazo total, ex. 220). */
export function prazoParcelaInicialGrupo(params: ParametrosGrupo): number {
  return Math.max(num(params.prazoTotal), 1);
}

/**
 * Crédito líquido após contemplação (planilha Excel): soma das cotas − lance embutido.
 * Recurso próprio não reduz o crédito da carta.
 */
export function calcularCreditoLiquidoPosContemplacao(
  somaCotas: number,
  lanceEmbutido: number,
): number {
  return Math.max(somaCotas - lanceEmbutido, 0);
}

/** @deprecated use calcularCreditoLiquidoPosContemplacao com lance embutido apenas */
export function calcularCreditoLiquido(
  somaCotas: number,
  lanceTotal: number,
): number {
  return Math.max(somaCotas - lanceTotal, 0);
}

/** Saldo devedor da linha: saldo cadastrado na cota × qtd ou crédito + taxas + fundo. */
export function calcularSaldoDevedorLinha(
  somaCotas: number,
  params: ParametrosGrupo,
  saldoDevedorUnitCadastrado?: number | null,
  quantidade = 1,
): number {
  const q = Math.max(quantidade, 1);
  if (saldoDevedorUnitCadastrado != null && Number.isFinite(saldoDevedorUnitCadastrado)) {
    return Math.round(num(saldoDevedorUnitCadastrado) * q * 100) / 100;
  }
  const taxa = calcularTaxaAdministrativaTotal(somaCotas, params.taxaAdministrativaPercentual);
  const fundo = calcularFundoReservaTotal(somaCotas, params.fundoReservaPercentual);
  return Math.round((somaCotas + taxa + fundo) * 100) / 100;
}

export function calcularTaxaAdministrativaTotal(credito: number, taxaPercentual: number): number {
  return credito * (num(taxaPercentual) / 100);
}

export function calcularFundoReservaTotal(credito: number, fundoPercentual: number): number {
  return credito * (num(fundoPercentual) / 100);
}

/** Lance embutido sobre o saldo devedor da linha (base Excel). */
export function calcularLanceEmbutidoLinha(
  saldoDevedor: number,
  percentualEmbutido: number,
): number {
  const pct = num(percentualEmbutido);
  if (pct <= 0) return 0;
  return Math.round(saldoDevedor * (pct / 100) * 100) / 100;
}

export function grupoToParametros(grupo: {
  taxa_administrativa_percentual?: number | null;
  fundo_reserva_percentual?: number | null;
  seguro_habilitado?: boolean;
  seguro_percentual?: number | null;
  permite_lance_embutido?: boolean;
  percentual_lance_embutido?: number | null;
  percentual_recurso_proprio_sugerido?: number | null;
  prazo_total?: number | null;
  parcelas_realizadas?: number | null;
  prazo_restante?: number | null;
  parcelas_realizadas_base?: number | null;
  data_base_parcelas?: string | null;
  atualizacao_parcelas_automatica?: boolean | null;
  seguro_pos_contemplacao?: boolean;
  cet_percentual?: number | null;
}): ParametrosGrupo {
  const prazo = calcularPrazoGrupoFromRow(grupo as GrupoConsorcio);
  return {
    taxaAdministrativaPercentual: num(grupo.taxa_administrativa_percentual),
    fundoReservaPercentual: num(grupo.fundo_reserva_percentual),
    seguroHabilitado: grupoUsaSeguroNaParcela(grupo),
    seguroPercentual: num(grupo.seguro_percentual),
    permiteLanceEmbutido: !!grupo.permite_lance_embutido,
    percentualLanceEmbutido: num(grupo.percentual_lance_embutido),
    percentualRecursoProprioSugerido: num(
      grupo.percentual_recurso_proprio_sugerido,
    ),
    prazoTotal: prazo.prazoTotal,
    parcelasRealizadas: prazo.parcelasRealizadasAtuais,
    prazoRestante: prazo.prazoRestanteAtual,
    seguroPosContemplacao: !!grupo.seguro_pos_contemplacao,
    cetPercentual: grupo.cet_percentual ?? undefined,
  };
}

/** Calcula totais para uma cota/grupo e agrega várias seleções. */
export type GrupoBulkEstimateInput = {
  taxa_administrativa_percentual?: number | null;
  fundo_reserva_percentual?: number | null;
  seguro_habilitado?: boolean;
  seguro_pos_contemplacao?: boolean;
  seguro_percentual?: number | null;
  seguro_valor?: number | null;
  tem_parcela_reduzida?: boolean;
  percentual_parcela_reduzida?: number | null;
  prazo_total?: number | null;
  parcelas_realizadas?: number | null;
  prazo_restante?: number | null;
};

/** Recalcula parcelas com seguro (0,0004 ou % do saldo devedor) — integral e reduzida. */
export function calcularParcelasSeguroDaCota(
  entradas: {
    saldoDevedor: number;
    parcelaIntegral: number;
    parcelaReduzida: number | null;
  },
  grupo: GrupoBulkEstimateInput,
): {
  seguroMensal: number;
  parcelaIntegralComSeguro: number;
  parcelaReduzidaComSeguro: number | null;
  /** Campo `parcela_com_seguro`: reduzida+seguro se o grupo usa parcela reduzida. */
  parcelaComSeguroPersistida: number;
  parcelaSemSeguro: number;
} {
  const saldo = Math.max(num(entradas.saldoDevedor), 0);
  const integral = num(entradas.parcelaIntegral);
  const reduzida =
    entradas.parcelaReduzida != null && Number.isFinite(entradas.parcelaReduzida)
      ? num(entradas.parcelaReduzida)
      : null;
  const seguroMensal = seguroMensalSobreSaldo(saldo, grupo);
  const parcelaSemSeguro = integral;
  const parcelaIntegralComSeguro = Math.round((integral + seguroMensal) * 100) / 100;
  const parcelaReduzidaComSeguro =
    reduzida != null ? Math.round((reduzida + seguroMensal) * 100) / 100 : null;
  const parcelaComSeguroPersistida =
    grupo.tem_parcela_reduzida && reduzida != null && parcelaReduzidaComSeguro != null
      ? parcelaReduzidaComSeguro
      : parcelaIntegralComSeguro;
  return {
    seguroMensal,
    parcelaIntegralComSeguro,
    parcelaReduzidaComSeguro,
    parcelaComSeguroPersistida,
    parcelaSemSeguro,
  };
}

/** @deprecated use calcularParcelasSeguroDaCota */
export function aplicarSeguroParcelaCota(
  cota: {
    saldo_devedor?: number | null;
    valor_credito?: number | null;
    parcela_integral?: number | null;
    parcela_sem_seguro?: number | null;
    parcela_reduzida?: number | null;
    valor_parcela?: number | null;
  },
  grupo: GrupoBulkEstimateInput,
): { parcela_com_seguro: number; parcela_sem_seguro: number } {
  const saldo = num(cota.saldo_devedor) || num(cota.valor_credito);
  const integral =
    num(cota.parcela_integral) ||
    num(cota.parcela_sem_seguro) ||
    num(cota.valor_parcela) ||
    num(cota.parcela_reduzida);
  const reduzida = cota.parcela_reduzida != null ? num(cota.parcela_reduzida) : null;
  const p = calcularParcelasSeguroDaCota(
    { saldoDevedor: saldo, parcelaIntegral: integral, parcelaReduzida: reduzida },
    grupo,
  );
  return {
    parcela_com_seguro: p.parcelaComSeguroPersistida,
    parcela_sem_seguro: p.parcelaSemSeguro,
  };
}

/** Estima parcela e saldo quando só o crédito é colado no bulk paste. */
export function estimarCamposCotaBulk(
  valorCredito: number,
  grupo: GrupoBulkEstimateInput,
  saldoDevedorInformado?: number | null,
): {
  saldo_devedor: number;
  valor_parcela: number;
  parcela_integral: number;
  parcela_reduzida: number | null;
  parcela_com_seguro: number;
  parcela_sem_seguro: number;
} {
  const params = grupoToParametros(grupo);
  const taxaAdm = calcularTaxaAdministrativaTotal(
    valorCredito,
    params.taxaAdministrativaPercentual,
  );
  const fundo = calcularFundoReservaTotal(valorCredito, params.fundoReservaPercentual);
  const saldo_devedor =
    saldoDevedorInformado != null && Number.isFinite(saldoDevedorInformado) && saldoDevedorInformado > 0
      ? Math.round(saldoDevedorInformado * 100) / 100
      : Math.round((valorCredito + taxaAdm + fundo) * 100) / 100;
  const prazo = prazoParcelaInicialGrupo(params);
  const parcela_integral = Math.round((saldo_devedor / prazo) * 100) / 100;
  const temReduzida = !!grupo.tem_parcela_reduzida;
  const pctRed = num(grupo.percentual_parcela_reduzida, 100);
  const parcela_reduzida = temReduzida
    ? Math.round(((parcela_integral * pctRed) / 100) * 100) / 100
    : null;
  const valor_parcela = parcela_reduzida ?? parcela_integral;
  const seguro = calcularParcelasSeguroDaCota(
    { saldoDevedor: saldo_devedor, parcelaIntegral: parcela_integral, parcelaReduzida: parcela_reduzida },
    grupo,
  );

  return {
    saldo_devedor,
    valor_parcela,
    parcela_integral,
    parcela_reduzida,
    parcela_com_seguro: seguro.parcelaComSeguroPersistida,
    parcela_sem_seguro: seguro.parcelaSemSeguro,
  };
}

export function calcularTotaisGrupos(
  selecoes: Array<{
    linha: LinhaCalculoCota;
    params: ParametrosGrupo;
  }>,
): TotaisGrupoCalculados {
  const linhas = selecoes.map((s) => s.linha);
  const somaCotas = calcularSomaCotas(linhas);
  const saldoDevedor = selecoes.reduce((acc, s) => {
    const sd = calcularSaldoDevedor([s.linha], s.params);
    return acc + sd;
  }, 0);
  const lanceEmbutido = selecoes.reduce((acc, s) => {
    const sd = calcularSaldoDevedor([s.linha], s.params);
    const pct = s.params.percentualLanceEmbutido;
    if (!s.params.permiteLanceEmbutido || pct <= 0) return acc;
    return acc + calcularLanceEmbutidoLinha(sd, pct);
  }, 0);
  const recursoProprio = selecoes.reduce(
    (acc, s) =>
      acc +
      calcularRecursoProprio(
        num(s.linha.valorCredito) * (s.linha.quantidadeCotas ?? 1),
        s.params,
        s.linha.recursoProprioManual,
      ),
    0,
  );
  const lanceTotal = calcularLanceTotal(lanceEmbutido, recursoProprio);
  const primeiraParcela = calcularPrimeiraParcela(linhas);
  const seguro = selecoes.reduce(
    (acc, s) =>
      acc +
      calcularSeguro(calcularSaldoDevedor([s.linha], s.params), s.params),
    0,
  );
  const parcelasRestantes =
    selecoes.length > 0
      ? Math.max(
          ...selecoes.map((s) => calcularParcelasRestantes(s.params)),
        )
      : 0;
  const creditoLiquido = calcularCreditoLiquidoPosContemplacao(
    somaCotas,
    lanceEmbutido,
  );

  return {
    somaCotas,
    saldoDevedor,
    lanceEmbutido,
    recursoProprio,
    lanceTotal,
    primeiraParcela,
    seguro,
    parcelasRestantes,
    creditoLiquido,
  };
}
