export function valorCreditoPorCota(cota: { valor_credito?: unknown; snapshot_cota?: unknown }): number {
  const valorRegistrado = Number(cota.valor_credito || 0);
  const snapshot = cota.snapshot_cota && typeof cota.snapshot_cota === "object"
    ? (cota.snapshot_cota as Record<string, unknown>)
    : null;
  const valorRacon = Number(snapshot?.valor_bem_racon);
  if (snapshot?.fonte_dados_racon === "NEWCON" && Number.isFinite(valorRacon) && valorRacon > 0) {
    return valorRacon;
  }
  const quantidadeCotas = Number(snapshot?.quantidade_cotas || 1);
  const valorTotalVenda = Number(snapshot?.valor_credito_total_venda || 0);

  // Alguns legados gravaram o total da venda em cada linha de cota. Só divide
  // quando o snapshot comprova que o valor repetido é o total contratado.
  if (quantidadeCotas > 1 && valorTotalVenda > 0 && Math.abs(valorRegistrado - valorTotalVenda) < 0.01) {
    return Number((valorTotalVenda / quantidadeCotas).toFixed(2));
  }

  if (Number.isFinite(valorRegistrado) && valorRegistrado > 0) return valorRegistrado;

  // Cotas importadas pelo Controle de Vendas preservam o valor individual
  // conferido no relatório como valor_base_relatorio. Enquanto o backfill
  // operacional não preenche valor_credito, a tela ainda deve exibir o valor
  // real da cota, nunca "Não informado".
  const valorBaseRelatorio = Number(snapshot?.valor_bem_racon ?? snapshot?.valor_base_relatorio);
  if (Number.isFinite(valorBaseRelatorio) && valorBaseRelatorio > 0) return valorBaseRelatorio;

  // Na importação legada este campo foi gravado individualmente por cota.
  const valorLegado = Number(snapshot?.valor_credito_contratado);
  return snapshot?.origem === "IMPORTACAO_LEGADO" && Number.isFinite(valorLegado) && valorLegado > 0 ? valorLegado : 0;
}
