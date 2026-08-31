type FiscalPersistido = {
  valor_bruto?: unknown;
  imposto_valor?: unknown;
  imposto_aliquota?: unknown;
  valor_liquido?: unknown;
};

/** Apenas lê fatos fiscais persistidos; não recalcula nem desconta na interface. */
export function lerFiscalParticipante(snapshot: Record<string, unknown> | null | undefined) {
  const fiscal = (snapshot?.fiscal_lote ?? (snapshot?.origem === "IMPORTACAO_LEGADO" ? snapshot : null)) as FiscalPersistido | null;
  if (!fiscal) return null;
  const valores = [fiscal.valor_bruto, fiscal.imposto_valor, fiscal.imposto_aliquota, fiscal.valor_liquido];
  if (valores.some((valor) => valor == null || !Number.isFinite(Number(valor)))) return null;
  return {
    bruto: Number(fiscal.valor_bruto),
    imposto: Number(fiscal.imposto_valor),
    aliquota: Number(fiscal.imposto_aliquota),
    liquido: Number(fiscal.valor_liquido),
  };
}
