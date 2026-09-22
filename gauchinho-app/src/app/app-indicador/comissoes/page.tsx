import { redirect } from "next/navigation";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { ComissoesMobile, type ComissaoMobileItem } from "@/components/app-indicador/comissoes-mobile";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { isRaconModel } from "@/lib/tenant/model-family";

type ClienteDaVenda = { nome?: string | null };
type VendaDaPrevisao = {
  valor_credito?: number | string | null;
  data_venda?: string | null;
  data_primeira_parcela?: string | null;
  cliente?: ClienteDaVenda | ClienteDaVenda[] | null;
};
type PrevisaoParticipante = {
  id: string;
  venda_id: string;
  ordem_etapa?: number | string | null;
  nome_etapa?: string | null;
  competencia: string;
  base_calculo_valor?: number | string | null;
  percentual_aplicado?: number | string | null;
  valor_previsto?: number | string | null;
  valor_pago?: number | string | null;
  status: string;
  conferido_por_participante?: boolean | null;
  snapshot_regra?: Record<string, unknown> | null;
  venda?: VendaDaPrevisao | VendaDaPrevisao[] | null;
};
type PrevisaoFranqueadora = {
  venda_id: string;
  valor_bruto?: number | string | null;
  valor_previsto?: number | string | null;
  valor_liquido?: number | string | null;
  valor_imposto?: number | string | null;
  percentual_imposto?: number | string | null;
};

export default async function ComissoesDoAppPage() {
  const { empresaAtiva, usuario } = await getCurrentTenantContext();
  if (!empresaAtiva || !usuario) redirect("/app-indicador/login");
  // A sessão é validada antes do uso do cliente administrativo. Assim o app
  // lê somente as previsões do próprio participante, mas pode exibir o
  // snapshot fiscal canônico da franqueadora vinculado à mesma venda.
  const db = createAdminClient({ noStore: true });
  const { data: participante } = await db.from("participantes_comerciais").select("id,nome,nome_exibicao").eq("empresa_id", empresaAtiva.id).eq("usuario_id", usuario.id).eq("status", "ATIVO").maybeSingle();
  if (!participante) redirect("/app-indicador");
  const { data } = await db
    .from("comissao_previsoes_participantes")
    .select("id,venda_id,ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,valor_previsto,valor_pago,status,conferido_por_participante,snapshot_regra,venda:vendas(valor_credito,data_venda,data_primeira_parcela,cliente:clientes(nome))")
    .eq("empresa_id", empresaAtiva.id)
    .eq("participante_comercial_id", participante.id)
    .neq("status", "cancelada")
    .order("competencia", { ascending: false });
  const previsoes = (data ?? []) as unknown as PrevisaoParticipante[];
  const vendaIds = [...new Set(previsoes.map((row) => row.venda_id).filter(Boolean))];
  const { data: previsoesFranqueadora } = vendaIds.length
    ? await db
        .from("comissao_previsoes_franquia")
        .select("venda_id,valor_bruto,valor_previsto,valor_liquido,valor_imposto,percentual_imposto")
        .eq("empresa_id", empresaAtiva.id)
        .in("venda_id", vendaIds)
    : { data: [] as PrevisaoFranqueadora[] };
  const franqueadoraPorVenda = new Map<string, { bruto: number; liquido: number; imposto: number; percentualImposto: number }>();
  for (const previsao of (previsoesFranqueadora ?? []) as unknown as PrevisaoFranqueadora[]) {
    const atual = franqueadoraPorVenda.get(previsao.venda_id) ?? { bruto: 0, liquido: 0, imposto: 0, percentualImposto: 0 };
    atual.bruto += Number(previsao.valor_bruto ?? previsao.valor_previsto ?? 0);
    atual.liquido += Number(previsao.valor_liquido ?? previsao.valor_previsto ?? 0);
    atual.imposto += Number(previsao.valor_imposto ?? 0);
    atual.percentualImposto = Math.max(atual.percentualImposto, Number(previsao.percentual_imposto ?? 0));
    franqueadoraPorVenda.set(previsao.venda_id, atual);
  }
  const itens: ComissaoMobileItem[] = previsoes.map((row) => {
    const venda = Array.isArray(row.venda) ? row.venda[0] : row.venda;
    const cliente = Array.isArray(venda?.cliente) ? venda?.cliente[0] : venda?.cliente;
    const snapshot = row.snapshot_regra && typeof row.snapshot_regra === "object" ? row.snapshot_regra : {};
    const franqueadora = franqueadoraPorVenda.get(row.venda_id);
    return {
      id: row.id,
      vendaId: row.venda_id,
      ordemEtapa: Number(row.ordem_etapa ?? 1),
      etapa: row.nome_etapa || "Comissão",
      competencia: row.competencia,
      valorPrevisto: Number(row.valor_previsto || 0),
      valorPago: Number(row.valor_pago || 0),
      status: row.status,
      conferido: Boolean(row.conferido_por_participante),
      cliente: cliente?.nome ?? undefined,
      credito: venda?.valor_credito ? Number(venda.valor_credito) : undefined,
      dataVenda: venda?.data_venda ?? undefined,
      dataPrimeiraParcela: venda?.data_primeira_parcela ?? undefined,
      percentualAplicado: Number(row.percentual_aplicado ?? 0),
      comissaoFranqueadoraBruta: franqueadora?.bruto ?? Number(snapshot.base_bruta_franquia ?? row.base_calculo_valor ?? 0),
      impostoPercentual: franqueadora?.percentualImposto ?? Number(snapshot.percentual_imposto ?? 0),
      impostoValor: franqueadora?.imposto ?? 0,
      comissaoFranqueadoraLiquida: franqueadora?.liquido ?? Number(snapshot.base_liquida_franquia ?? 0),
    };
  });
  const tenant = await getResolvedTenant();
  return <ComissoesMobile nome={participante.nome_exibicao || participante.nome} itens={itens} racon={isRaconModel(tenant?.siteModel)} />;
}
