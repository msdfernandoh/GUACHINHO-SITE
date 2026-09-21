import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { createClient } from "@/lib/supabase/server";
import { ComissoesMobile, type ComissaoMobileItem } from "@/components/app-indicador/comissoes-mobile";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";

export default async function ComissoesDoAppPage() {
  const { empresaAtiva, usuario } = await getCurrentTenantContext();
  if (!empresaAtiva || !usuario) redirect("/app-indicador/login");
  const db = await createClient();
  const { data: participante } = await db.from("participantes_comerciais").select("id,nome,nome_exibicao").eq("empresa_id", empresaAtiva.id).eq("usuario_id", usuario.id).eq("status", "ATIVO").maybeSingle();
  if (!participante) redirect("/app-indicador");
  const { data } = await db.from("comissao_previsoes_participantes").select("id,nome_etapa,competencia,valor_previsto,valor_pago,status,conferido_por_participante,venda:vendas(valor_credito,cliente:clientes(nome))").eq("empresa_id", empresaAtiva.id).eq("participante_comercial_id", participante.id).neq("status", "cancelada").order("competencia", { ascending: false });
  const itens: ComissaoMobileItem[] = (data ?? []).map((row: any) => { const venda = Array.isArray(row.venda) ? row.venda[0] : row.venda; const cliente = Array.isArray(venda?.cliente) ? venda?.cliente[0] : venda?.cliente; return { id: row.id, etapa: row.nome_etapa, competencia: row.competencia, valorPrevisto: Number(row.valor_previsto || 0), valorPago: Number(row.valor_pago || 0), status: row.status, conferido: Boolean(row.conferido_por_participante), cliente: cliente?.nome, credito: venda?.valor_credito ? Number(venda.valor_credito) : undefined }; });
  const tenant = await getResolvedTenant();
  return <ComissoesMobile nome={participante.nome_exibicao || participante.nome} itens={itens} racon={isRaconModel(tenant?.siteModel)} />;
}
