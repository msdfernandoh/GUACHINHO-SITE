import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { MinhasComissoesClient, type PrevisaoParticipanteItem } from "@/components/erp/comissoes/minhas-comissoes-client";

export default async function MinhasComissoesPage() {
  const { empresaAtiva, usuario } = await getCurrentTenantContext();
  if (!empresaAtiva || !usuario) return null;

  const db = await createClient();
  const { data: participante } = await db
    .from("participantes_comerciais")
    .select("id,nome,nome_exibicao")
    .eq("empresa_id", empresaAtiva.id)
    .eq("usuario_id", usuario.id)
    .eq("status", "ATIVO")
    .maybeSingle();

  if (!participante) {
    return (
      <div className="rounded-2xl bg-amber-50 p-6 text-xs font-bold text-amber-900 border border-amber-200">
        Seu usuário ainda não possui identidade de participante comercial ativa nesta empresa.
      </div>
    );
  }

  const { data } = await db
    .from("comissao_previsoes_participantes")
    .select(`
      id,
      nome_etapa,
      competencia,
      valor_previsto,
      valor_elegivel,
      valor_pago,
      base_calculo_valor,
      percentual_aplicado,
      previsao_franquia_id,
      status,
      tipo_gatilho,
      conferido_por_participante,
      venda:vendas(id, valor_credito, cliente:clientes(nome), cota:cotas_definitivas(numero_cota, numero_grupo))
    `)
    .eq("empresa_id", empresaAtiva.id)
    .eq("participante_comercial_id", participante.id)
    .order("competencia");

  const admin = createAdminClient();
  const previsaoFranquiaIds = [...new Set(
    (data ?? [])
      .map((row: any) => row.previsao_franquia_id)
      .filter((id: unknown): id is string => typeof id === "string" && id.length > 0),
  )];
  const [{ data: previsoesFranquia }, { data: fiscal }] = await Promise.all([
    previsaoFranquiaIds.length
      ? admin
          .from("comissao_previsoes_franquia")
          .select("id,empresa_id,valor_bruto,percentual_imposto,valor_imposto,valor_liquido")
          .eq("empresa_id", empresaAtiva.id)
          .in("id", previsaoFranquiaIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    admin
      .from("empresa_configuracoes_fiscais")
      .select("participante_exibe_detalhes_fiscais")
      .eq("empresa_id", empresaAtiva.id)
      .eq("ativo", true)
      .lte("vigencia_inicio", new Date().toISOString().slice(0, 10))
      .or(`vigencia_fim.is.null,vigencia_fim.gte.${new Date().toISOString().slice(0, 10)}`)
      .order("vigencia_inicio", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const franquiaMap = new Map((previsoesFranquia ?? []).map((item: any) => [item.id, item]));
  const mostrarDetalhesFiscais = Boolean(fiscal?.participante_exibe_detalhes_fiscais);

  const previsoes: PrevisaoParticipanteItem[] = (data ?? []).map((row: any) => {
    const venda = Array.isArray(row.venda) ? row.venda[0] : row.venda;
    const cliente = Array.isArray(venda?.cliente) ? venda?.cliente[0] : venda?.cliente;
    const cota = Array.isArray(venda?.cota) ? venda?.cota[0] : venda?.cota;
    const franquia = row.previsao_franquia_id ? franquiaMap.get(row.previsao_franquia_id) : null;
    const liquidoFranquia = Number(franquia?.valor_liquido ?? row.base_calculo_valor ?? 0);
    const liquidoParticipante = Number(row.valor_previsto ?? 0);
    const proporcaoParticipante = liquidoFranquia > 0
      ? Math.min(1, Math.max(0, liquidoParticipante / liquidoFranquia))
      : 0;
    const brutoAtribuido = franquia?.valor_bruto != null
      ? Number(franquia.valor_bruto) * proporcaoParticipante
      : null;
    const impostoAtribuido = franquia?.valor_imposto != null
      ? Number(franquia.valor_imposto) * proporcaoParticipante
      : null;

    return {
      id: row.id,
      nome_etapa: row.nome_etapa,
      competencia: row.competencia,
      valor_previsto: Number(row.valor_previsto),
      valor_elegivel: Number(row.valor_elegivel),
      valor_pago: Number(row.valor_pago),
      valor_bruto_atribuido: brutoAtribuido,
      valor_imposto_atribuido: impostoAtribuido,
      valor_liquido: liquidoParticipante,
      percentual_imposto: franquia?.percentual_imposto != null ? Number(franquia.percentual_imposto) : null,
      status: row.status,
      tipo_gatilho: row.tipo_gatilho,
      conferido_por_participante: Boolean(row.conferido_por_participante),
      cliente_nome: cliente?.nome || undefined,
      cota_numero: cota?.numero_cota || null,
      grupo_codigo: cota?.numero_grupo || undefined,
      valor_credito: venda?.valor_credito ? Number(venda.valor_credito) : undefined,
    };
  });

  return (
    <main className="p-6">
      <MinhasComissoesClient
        participanteNome={participante.nome_exibicao || participante.nome}
        previsoes={previsoes}
        mostrarDetalhesFiscais={mostrarDetalhesFiscais}
      />
    </main>
  );
}
