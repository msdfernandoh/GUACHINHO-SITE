import { createClient } from "@/lib/supabase/server";
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
      status,
      tipo_gatilho,
      conferido_por_participante,
      venda:vendas(id, valor_credito, cliente:clientes(nome), cota:cotas_definitivas(numero_cota, numero_grupo))
    `)
    .eq("empresa_id", empresaAtiva.id)
    .eq("participante_comercial_id", participante.id)
    .order("competencia");

  const previsoes: PrevisaoParticipanteItem[] = (data ?? []).map((row: any) => {
    const venda = Array.isArray(row.venda) ? row.venda[0] : row.venda;
    const cliente = Array.isArray(venda?.cliente) ? venda?.cliente[0] : venda?.cliente;
    const cota = Array.isArray(venda?.cota) ? venda?.cota[0] : venda?.cota;

    return {
      id: row.id,
      nome_etapa: row.nome_etapa,
      competencia: row.competencia,
      valor_previsto: Number(row.valor_previsto),
      valor_elegivel: Number(row.valor_elegivel),
      valor_pago: Number(row.valor_pago),
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
      />
    </main>
  );
}