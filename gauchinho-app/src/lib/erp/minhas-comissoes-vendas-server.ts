import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularResumoVendasMes, type VendaParaResumoMensal } from "./minhas-comissoes-vendas";

/** IDs devem vir exclusivamente da identidade/empresa resolvidas no servidor. */
export async function carregarResumoVendasMes(empresaId: string, participanteId: string, competencia: string) {
  const db = createAdminClient();
  const [ano, mes] = competencia.split("-").map(Number);
  const proximoMes = new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
  const filtroCompetencia = `and(data_primeira_parcela.gte.${competencia}-01,data_primeira_parcela.lt.${proximoMes}),and(data_primeira_parcela.is.null,data_venda.gte.${competencia}-01,data_venda.lt.${proximoMes})`;
  const campos = "id,valor_credito,quantidade_cotas,data_venda,data_primeira_parcela,status,afeta_faturamento";
  const vendas: VendaParaResumoMensal[] = [];
  // Não depender de previsões: uma venda também conta antes de gerar comissões.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("vendas").select(campos)
      .eq("empresa_id", empresaId).eq("participante_comercial_id", participanteId)
      .eq("status", "confirmada").eq("afeta_faturamento", true)
      .or(filtroCompetencia)
      .order("id").range(offset, offset + 499);
    if (error) throw new Error("Não foi possível consultar as vendas do mês.");
    vendas.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("venda_participantes")
      .select(`id,venda:vendas!inner(${campos})`)
      .eq("empresa_id", empresaId).eq("participante_comercial_id", participanteId)
      .eq("venda.empresa_id", empresaId).eq("venda.status", "confirmada").eq("venda.afeta_faturamento", true)
      .or(filtroCompetencia, { referencedTable: "venda" })
      .order("id").range(offset, offset + 499);
    if (error) throw new Error("Não foi possível consultar a participação nas vendas do mês.");
    for (const row of data ?? []) {
      const itens = Array.isArray(row.venda) ? row.venda : [row.venda];
      vendas.push(...itens.filter(Boolean));
    }
    if ((data?.length ?? 0) < 500) break;
  }
  return calcularResumoVendasMes(vendas, competencia);
}
