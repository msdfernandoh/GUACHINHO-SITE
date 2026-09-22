export type ComissaoIndicadorParcela = {
  id: string;
  vendaId: string;
  ordemEtapa: number;
  etapa: string;
  competencia: string;
  valorPrevisto: number;
  valorPago: number;
  status: string;
  conferido: boolean;
  cliente?: string;
  credito?: number;
  dataVenda?: string;
  dataPrimeiraParcela?: string;
  percentualAplicado?: number;
  comissaoFranqueadoraBruta?: number;
  impostoPercentual?: number;
  impostoValor?: number;
  comissaoFranqueadoraLiquida?: number;
};

export type ComissaoIndicadorVenda = {
  vendaId: string;
  cliente: string;
  credito?: number;
  dataVenda?: string;
  percentualAplicado: number;
  comissaoFranqueadoraBruta: number;
  impostoPercentual: number;
  impostoValor: number;
  comissaoFranqueadoraLiquida: number;
  totalIndicador: number;
  totalPago: number;
  parcelas: ComissaoIndicadorParcela[];
};

const numberOrZero = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

/**
 * Agrupa as previsões pelo fato financeiro da venda. Os valores da
 * franqueadora são snapshots da previsão canônica, e nunca são recalculados
 * no app do indicador.
 */
export function agruparComissoesIndicador(
  itens: ComissaoIndicadorParcela[],
): ComissaoIndicadorVenda[] {
  const vendas = new Map<string, ComissaoIndicadorVenda>();

  for (const item of itens) {
    const atual = vendas.get(item.vendaId);
    if (atual) {
      atual.totalIndicador += numberOrZero(item.valorPrevisto);
      atual.totalPago += numberOrZero(item.valorPago);
      atual.percentualAplicado = Math.max(
        atual.percentualAplicado,
        numberOrZero(item.percentualAplicado),
      );
      atual.parcelas.push(item);
      continue;
    }

    const bruto = numberOrZero(item.comissaoFranqueadoraBruta);
    const liquido = numberOrZero(item.comissaoFranqueadoraLiquida);
    const impostoValor = numberOrZero(item.impostoValor) || Math.max(0, bruto - liquido);
    vendas.set(item.vendaId, {
      vendaId: item.vendaId,
      cliente: item.cliente || "Cliente da venda",
      credito: item.credito,
      dataVenda: item.dataVenda,
      percentualAplicado: numberOrZero(item.percentualAplicado),
      comissaoFranqueadoraBruta: bruto,
      impostoPercentual:
        numberOrZero(item.impostoPercentual) ||
        (bruto > 0 ? (impostoValor / bruto) * 100 : 0),
      impostoValor,
      comissaoFranqueadoraLiquida: liquido || Math.max(0, bruto - impostoValor),
      totalIndicador: numberOrZero(item.valorPrevisto),
      totalPago: numberOrZero(item.valorPago),
      parcelas: [item],
    });
  }

  return [...vendas.values()]
    .map((venda) => ({
      ...venda,
      parcelas: [...venda.parcelas].sort(
        (a, b) => a.ordemEtapa - b.ordemEtapa || a.competencia.localeCompare(b.competencia),
      ),
    }))
    .sort((a, b) => (b.dataVenda || "").localeCompare(a.dataVenda || ""));
}

export function dataPrevistaDaParcela(
  parcela: Pick<ComissaoIndicadorParcela, "dataVenda" | "ordemEtapa" | "competencia">,
) {
  if (parcela.dataVenda) {
    const base = new Date(`${parcela.dataVenda.slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(base.getTime())) {
      base.setDate(base.getDate() + Math.max(1, parcela.ordemEtapa) * 30);
      return `Até ${new Intl.DateTimeFormat("pt-BR").format(base)}`;
    }
  }

  const [ano, mes] = parcela.competencia.split("-");
  if (ano && mes) {
    return `Previsão em ${new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(new Date(Number(ano), Number(mes) - 1, 1))}`;
  }
  return "Data de previsão a confirmar";
}
