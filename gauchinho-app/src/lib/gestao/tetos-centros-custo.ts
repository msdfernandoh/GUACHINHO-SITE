export type CentroComTeto = {
  id: string;
  nome: string;
  ativo: boolean;
  limite_mensal: number | null;
};

export type ContaParaTeto = {
  centro_custo_id: string | null;
  valor: number;
  status: string;
  pago_em: string | null;
  excluida_em: string | null;
  retirar_reserva_impostos: boolean;
};

export type SituacaoTeto = "dentro" | "atencao" | "ultrapassado";

export type TetoMensalCentro = {
  centroId: string;
  nome: string;
  limite: number;
  gasto: number;
  restante: number;
  percentual: number;
  situacao: SituacaoTeto;
};

export function calcularTetosMensais(
  centros: CentroComTeto[],
  contas: ContaParaTeto[],
  mes: string,
): TetoMensalCentro[] {
  const gastoPorCentro = new Map<string, number>();
  for (const conta of contas) {
    if (
      conta.status !== "paga" ||
      !conta.pago_em?.startsWith(`${mes}-`) ||
      !conta.centro_custo_id ||
      conta.excluida_em ||
      conta.retirar_reserva_impostos
    ) continue;
    const centavos = Math.round(Number(conta.valor) * 100);
    if (!Number.isFinite(centavos) || centavos <= 0) continue;
    gastoPorCentro.set(conta.centro_custo_id, (gastoPorCentro.get(conta.centro_custo_id) || 0) + centavos);
  }

  return centros
    .filter((centro) => centro.ativo && Number(centro.limite_mensal) > 0)
    .map((centro) => {
      const limiteCentavos = Math.round(Number(centro.limite_mensal) * 100);
      const gastoCentavos = gastoPorCentro.get(centro.id) || 0;
      const percentual = Math.round((gastoCentavos / limiteCentavos) * 100);
      return {
        centroId: centro.id,
        nome: centro.nome,
        limite: limiteCentavos / 100,
        gasto: gastoCentavos / 100,
        restante: Math.max(0, limiteCentavos - gastoCentavos) / 100,
        percentual,
        situacao: gastoCentavos > limiteCentavos ? "ultrapassado" as const
          : gastoCentavos >= limiteCentavos * 0.8 ? "atencao" as const
          : "dentro" as const,
      };
    })
    .sort((a, b) => {
      const ordem = { ultrapassado: 0, atencao: 1, dentro: 2 };
      return ordem[a.situacao] - ordem[b.situacao] || a.nome.localeCompare(b.nome, "pt-BR");
    });
}
