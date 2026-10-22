export type ResultadoCota = {
  cota: string;
  modalidade: string;
  percentual_lance: number;
  situacao_cota: string;
};
export type ResultadoAssembleia = {
  id: string;
  grupo_id: string;
  assembleia_numero: number;
  assembleia_data: string;
  criado_em: string;
  cotas: ResultadoCota[];
};

export function resultadosVigentes(rows: ResultadoAssembleia[]) {
  const mapa = new Map<string, ResultadoAssembleia>();
  for (const row of rows) {
    const key = `${row.grupo_id}:${row.assembleia_numero}`;
    const anterior = mapa.get(key);
    if (!anterior || row.criado_em > anterior.criado_em) mapa.set(key, row);
  }
  return [...mapa.values()].sort((a, b) => b.assembleia_numero - a.assembleia_numero);
}

export function cotasUnicas<T extends ResultadoCota>(rows: T[]) {
  return [...new Map(rows.map(row => [
    `${row.cota}:${row.modalidade}:${row.situacao_cota}`, row,
  ])).values()];
}

export function contempladasAtivas(rows: ResultadoCota[]) {
  return new Set(rows.filter(c => c.situacao_cota === "ATIVA").map(c => c.cota)).size;
}

export function situacaoContemplacao(c: ResultadoCota) {
  if (c.situacao_cota === "DESCLASSIFICADA") return "Desclassificada";
  if (c.situacao_cota === "CANCELADA") return "Confirmada (cancelada)";
  return c.modalidade === "SORTEIO" ? "Sorteada" : "Confirmada (ativa)";
}

export function indicadoresContemplacoes(rows: ResultadoAssembleia[], ultima: number, ativas: number | null, semAssembleiasVerificado = false) {
  const vigentes = resultadosVigentes(rows);
  const faltantes = Array.from({ length: Math.max(0, ultima) }, (_, i) => i + 1)
    .filter(n => !vigentes.some(a => a.assembleia_numero === n));
  const completo = (ultima > 0 && faltantes.length === 0) || (ultima === 0 && semAssembleiasVerificado);
  const media = (meses: number) => {
    // Janelas por número de assembleia, sem deslocar a janela quando falta histórico.
    const janela = vigentes.filter(a => a.assembleia_numero > ultima - meses && a.assembleia_numero <= ultima);
    if (janela.length !== Math.min(meses, ultima)) return null;
    const valores = janela.flatMap(a => cotasUnicas(a.cotas))
      .filter(c => c.situacao_cota === "ATIVA" && c.modalidade === "LANCE_LIVRE")
      .map(c => Number(c.percentual_lance)).filter(n => Number.isFinite(n) && n > 0 && n <= 100);
    return valores.length ? Math.round(valores.reduce((s, n) => s + Math.round(n * 10000), 0) / valores.length) / 10000 : null;
  };
  const entregues = completo ? new Set(vigentes.flatMap(a => a.cotas)
    .filter(c => c.situacao_cota === "ATIVA").map(c => c.cota)).size : null;
  return {
    media_lance_1m: media(1), media_lance_3m: media(3),
    media_lance_6m: media(6), media_lance_12m: media(12),
    historico_completo: completo, assembleias_faltantes: faltantes,
    cotas_entregues: entregues,
    cotas_a_entregar: entregues != null && ativas != null && ativas >= entregues ? ativas - entregues : null,
  };
}
