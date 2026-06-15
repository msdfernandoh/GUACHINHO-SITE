/**
 * Fórmulas de grupos/cotas — única fonte para UI e persistência.
 * TODO: validar cada função contra planilha Excel antes de travar regras.
 */

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
  void params;
  return linhas.reduce((acc, l) => {
    const q = l.quantidadeCotas ?? 1;
    const base =
      l.saldoDevedorInformado != null
        ? num(l.saldoDevedorInformado)
        : num(l.valorCredito);
    return acc + base * q;
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
  return saldoDevedor * (num(params.seguroPercentual) / 100);
}

/** Parcelas restantes (prazo restante do grupo). */
export function calcularParcelasRestantes(params: ParametrosGrupo): number {
  if (params.prazoRestante != null) return num(params.prazoRestante);
  const total = num(params.prazoTotal);
  const realizadas = num(params.parcelasRealizadas);
  return Math.max(total - realizadas, 0);
}

/**
 * Crédito líquido após contemplação (crédito − lances).
 * TODO Excel: ordem de abatimentos e seguro pós-contemplação.
 */
export function calcularCreditoLiquido(
  somaCotas: number,
  lanceTotal: number,
): number {
  return Math.max(somaCotas - lanceTotal, 0);
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
  seguro_pos_contemplacao?: boolean;
  cet_percentual?: number | null;
}): ParametrosGrupo {
  return {
    taxaAdministrativaPercentual: num(grupo.taxa_administrativa_percentual),
    fundoReservaPercentual: num(grupo.fundo_reserva_percentual),
    seguroHabilitado: !!grupo.seguro_habilitado,
    seguroPercentual: num(grupo.seguro_percentual),
    permiteLanceEmbutido: !!grupo.permite_lance_embutido,
    percentualLanceEmbutido: num(grupo.percentual_lance_embutido),
    percentualRecursoProprioSugerido: num(
      grupo.percentual_recurso_proprio_sugerido,
    ),
    prazoTotal: num(grupo.prazo_total),
    parcelasRealizadas: num(grupo.parcelas_realizadas),
    prazoRestante: grupo.prazo_restante ?? undefined,
    seguroPosContemplacao: !!grupo.seguro_pos_contemplacao,
    cetPercentual: grupo.cet_percentual ?? undefined,
  };
}

/** Calcula totais para uma cota/grupo e agrega várias seleções. */
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
  const lanceEmbutido = selecoes.reduce(
    (acc, s) =>
      acc +
      calcularLanceEmbutido(
        calcularSaldoDevedor([s.linha], s.params),
        s.params,
      ),
    0,
  );
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
  const creditoLiquido = calcularCreditoLiquido(somaCotas, lanceTotal);

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
