export type VendaParaResumoMensal = {
  id: string;
  valor_credito?: number | string | null;
  quantidade_cotas?: number | string | null;
  data_venda?: string | null;
  status?: string | null;
  afeta_faturamento?: boolean | null;
};

export type ResumoVendasMes = {
  competencia: string;
  valorVendido: number;
  quantidadeCotas: number;
  quantidadeVendas: number;
};

export function mesAtualEmCuiaba(agora = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(agora);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) {
    throw new Error("Não foi possível determinar a competência atual.");
  }

  return `${year}-${month}`;
}

function quantidadeCotasNormalizada(valor: VendaParaResumoMensal["quantidade_cotas"]): number {
  const quantidade = Number(valor);
  return Number.isInteger(quantidade) && quantidade > 0 ? quantidade : 1;
}

export function calcularResumoVendasMes(
  vendas: VendaParaResumoMensal[],
  competencia: string,
): ResumoVendasMes {
  const vendasUnicas = new Map<string, VendaParaResumoMensal>();

  for (const venda of vendas) {
    if (
      !venda.id ||
      venda.status !== "confirmada" ||
      venda.afeta_faturamento !== true ||
      venda.data_venda?.slice(0, 7) !== competencia
    ) {
      continue;
    }
    vendasUnicas.set(venda.id, venda);
  }

  let valorVendido = 0;
  let quantidadeCotas = 0;
  for (const venda of vendasUnicas.values()) {
    valorVendido += Number(venda.valor_credito ?? 0) || 0;
    quantidadeCotas += quantidadeCotasNormalizada(venda.quantidade_cotas);
  }

  return {
    competencia,
    valorVendido: Math.round(valorVendido * 100) / 100,
    quantidadeCotas,
    quantidadeVendas: vendasUnicas.size,
  };
}
