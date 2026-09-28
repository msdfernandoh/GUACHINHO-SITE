export type CentroHistorico = {
  id: string;
  nome: string;
  limite_mensal: number | null;
  descontado_comissao?: boolean;
};

export type ContaHistorico = {
  id?: string;
  descricao?: string;
  centro_custo_id: string | null;
  valor: number;
  status: string;
  pago_em: string | null;
  excluida_em: string | null;
  retirar_reserva_impostos: boolean;
};

export type TipoDespesaMensal = {
  centroId: string | null;
  nome: string;
  pago: number;
  teto: number | null;
  excesso: number;
};

export type DespesaPagaMensal = {
  mes: string;
  totalPago: number;
  totalExcedente: number;
  tipos: TipoDespesaMensal[];
  despesas: Array<{ id: string; descricao: string; valor: number; pagoEm: string; tipo: string }>;
};

function mesesDeAte(inicio: string, fim: string): string[] {
  const meses: string[] = [];
  const [anoInicial, mesInicial] = inicio.split("-").map(Number);
  const [anoFinal, mesFinal] = fim.split("-").map(Number);
  for (let ano = anoInicial, mes = mesInicial; ano < anoFinal || (ano === anoFinal && mes <= mesFinal); mes++) {
    if (mes > 12) { ano++; mes = 1; }
    meses.push(`${ano}-${String(mes).padStart(2, "0")}`);
  }
  return meses;
}

export function montarHistoricoDespesasPagas(
  centros: CentroHistorico[],
  contas: ContaHistorico[],
  hoje: string,
): DespesaPagaMensal[] {
  const operacionais = centros.filter((centro) => !centro.descontado_comissao);
  const idsOperacionais = new Set(operacionais.map((centro) => centro.id));
  const pagas = contas.filter((conta) =>
    conta.status === "paga" &&
    Boolean(conta.pago_em && conta.pago_em <= hoje) &&
    !conta.excluida_em &&
    !conta.retirar_reserva_impostos &&
    (!conta.centro_custo_id || idsOperacionais.has(conta.centro_custo_id)) &&
    Number(conta.valor) > 0,
  );
  if (pagas.length === 0) return [];

  const inicio = pagas.reduce((menor, conta) => {
    const mes = conta.pago_em!.slice(0, 7);
    return mes < menor ? mes : menor;
  }, hoje.slice(0, 7));

  const valores = new Map<string, number>();
  for (const conta of pagas) {
    const chave = `${conta.pago_em!.slice(0, 7)}|${conta.centro_custo_id || "sem-centro"}`;
    valores.set(chave, (valores.get(chave) || 0) + Math.round(Number(conta.valor) * 100));
  }

  const semCentro = pagas.some((conta) => !conta.centro_custo_id);
  return mesesDeAte(inicio, hoje.slice(0, 7)).map((mes) => {
    const tipos: TipoDespesaMensal[] = operacionais.map((centro) => {
      const pagoCentavos = valores.get(`${mes}|${centro.id}`) || 0;
      const teto = centro.limite_mensal === null ? null : Number(centro.limite_mensal);
      const tetoCentavos = teto === null ? null : Math.round(teto * 100);
      return {
        centroId: centro.id,
        nome: centro.nome,
        pago: pagoCentavos / 100,
        teto,
        excesso: tetoCentavos === null ? 0 : Math.max(0, pagoCentavos - tetoCentavos) / 100,
      };
    });
    if (semCentro) {
      tipos.push({
        centroId: null,
        nome: "Sem centro de custo",
        pago: (valores.get(`${mes}|sem-centro`) || 0) / 100,
        teto: null,
        excesso: 0,
      });
    }
    return {
      mes,
      totalPago: Math.round(tipos.reduce((soma, tipo) => soma + Math.round(tipo.pago * 100), 0)) / 100,
      totalExcedente: Math.round(tipos.reduce((soma, tipo) => soma + Math.round(tipo.excesso * 100), 0)) / 100,
      tipos,
      despesas: pagas
        .filter((conta) => conta.pago_em!.startsWith(mes))
        .map((conta, indice) => ({
          id: conta.id || `${mes}-${indice}`,
          descricao: conta.descricao?.trim() || "Despesa sem descrição",
          valor: Number(conta.valor),
          pagoEm: conta.pago_em!,
          tipo: operacionais.find((centro) => centro.id === conta.centro_custo_id)?.nome || "Sem centro de custo",
        }))
        .sort((a, b) => b.valor - a.valor),
    };
  });
}
