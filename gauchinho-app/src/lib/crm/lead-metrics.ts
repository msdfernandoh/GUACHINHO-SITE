/** Cálculo puro compartilhado entre dashboard servidor e Kanban cliente. */
export function extrairValorParcelaLead(lead: {
  valor_fechado?: number | null;
  valor_parcela_fechamento?: number | null;
  valor_parcela?: number | null;
  valor_credito?: number | null;
  valor_estimado?: number | null;
  valor_simulado?: number | null;
  prazo_simulado?: number | null;
  dados_simulacao?: unknown;
}): number {
  if (lead.valor_parcela && Number(lead.valor_parcela) > 0) return Number(lead.valor_parcela);
  if (lead.valor_parcela_fechamento && Number(lead.valor_parcela_fechamento) > 0) return Number(lead.valor_parcela_fechamento);
  if (lead.dados_simulacao && typeof lead.dados_simulacao === "object") {
    const ds = lead.dados_simulacao as Record<string, unknown>;
    const res = ds.resultado as Record<string, unknown> | undefined;
    const p1 = res?.parcela ?? res?.valorParcela ?? res?.parcelaReduzida ?? res?.parcelaIntegral;
    if (p1 && Number(p1) > 0) return Number(p1);
    const p2 = ds.parcela ?? ds.valorParcela ?? ds.valor_parcela ?? ds.valor_mensal_disponivel;
    if (p2 && Number(p2) > 0) return Number(p2);
  }
  const credito = Number(lead.valor_fechado ?? lead.valor_credito ?? lead.valor_estimado ?? lead.valor_simulado ?? 0);
  if (credito <= 5000) return 0;
  const prazo = Number(lead.prazo_simulado && lead.prazo_simulado > 0 ? lead.prazo_simulado : 160);
  return Math.round(((credito * 1.18) / prazo) * 100) / 100;
}
