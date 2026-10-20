/** Parcela líquida do participante proporcional ao repasse efetivamente alocado.
 * Aceita reversões negativas do livro append-only; conferência não altera o crédito.
 */
export function calcularComissaoRecebida(comissao: number, previstoFranquia: number, recebido: number): number {
  if (![comissao, previstoFranquia, recebido].every(Number.isFinite)) throw new Error("Valor inválido no repasse.");
  if (previstoFranquia <= 0) return 0;
  return Math.round(comissao * recebido / previstoFranquia * 100) / 100;
}

type Movimento = { conta_bancaria_id: string; pagamento_id: string | null; transferencia_conta_id: string | null; tipo: string; valor: unknown; data_movimento: string };

/** Só fatos com saída/retorno da conta empresarial alteram a posição do sócio. */
export function calcularTransferenciasSocio(input: {
  inicio: string; fim: string; contasDoSocio: Set<string>; contasEmpresa: Set<string>;
  pagamentosDoSocio: Set<string>; movimentos: Movimento[];
}): number {
  let total = 0;
  for (const m of input.movimentos) {
    if (m.data_movimento < input.inicio || m.data_movimento > input.fim) continue;
    if (m.pagamento_id && input.pagamentosDoSocio.has(m.pagamento_id) && input.contasEmpresa.has(m.conta_bancaria_id)) {
      total += (m.tipo === "SAIDA" ? 1 : -1) * Number(m.valor);
    } else if (m.transferencia_conta_id && input.contasDoSocio.has(m.conta_bancaria_id)
      && input.movimentos.some((outro) => outro.transferencia_conta_id === m.transferencia_conta_id && input.contasEmpresa.has(outro.conta_bancaria_id) && outro.tipo !== m.tipo)) {
      total += (m.tipo === "ENTRADA" ? 1 : -1) * Number(m.valor);
    }
  }
  return Math.round(total * 100) / 100;
}
