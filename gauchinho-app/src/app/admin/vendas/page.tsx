import { getCurrentTenantContext } from "@/lib/tenant/context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ErpVendasHubView,
  type VendaItem,
  type CotaItem,
  type ParticipanteSimples,
  type VinculoPerfilSimples,
} from "@/components/erp/vendas/erp-vendas-hub-view";

export default async function AdminVendasPage() {
  const { empresaAtiva, vinculos } = await getCurrentTenantContext();
  const empresaId = empresaAtiva?.id ?? "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
  const empresaNome = empresaAtiva?.nome_fantasia ?? empresaAtiva?.razao_social ?? "Gauchinho Consórcios";

  const vinculo = (vinculos ?? []).find((item) => item.empresa_id === empresaId);
  const papelNome = vinculo?.papel?.nome?.toLowerCase() ?? "";
  const isMaster = papelNome.includes("master") || papelNome.includes("admin") || papelNome.includes("gestor");

  const admin = createAdminClient();

  const [vendasRes, cotasRes, participantesRes, vinculosRes] = await Promise.all([
    admin
      .from("vendas")
      .select(`
        *,
        cliente:clientes(nome,cpf_cnpj,email,telefone),
        grupo:grupos_consorcio(codigo_grupo,modalidade:administradora_modalidades_comissao(codigo,nome)),
        cotas_definitivas(id,numero_cota,status),
        participante:participantes_comerciais!vendas_participante_comercial_id_fkey(id,nome,nome_exibicao)
      `)
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false }),
    admin
      .from("cotas_definitivas")
      .select("*, cliente:clientes(nome), grupo:grupos_consorcio(codigo_grupo)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false }),
    admin
      .from("participantes_comerciais")
      .select("id,nome,nome_exibicao")
      .eq("empresa_id", empresaId)
      .eq("status", "ATIVO")
      .order("nome"),
    admin
      .from("participante_comissao_perfis")
      .select("id,participante_id,papel_tipo,perfil_id,override_percentual,perfil:comissao_perfis(id,nome,papel_base)")
      .eq("empresa_id", empresaId)
      .eq("ativo", true),
  ]);

  const participantes = (participantesRes.data ?? []) as ParticipanteSimples[];
  const vinculosPerfis = ((vinculosRes.data ?? []) as unknown) as VinculoPerfilSimples[];
  const participantesMap = new Map(participantes.map((p) => [p.id, p.nome_exibicao || p.nome]));

  const vendas: VendaItem[] = (vendasRes.data ?? []).map((v: any) => {
    const cota = Array.isArray(v.cotas_definitivas) ? v.cotas_definitivas[0] : v.cotas_definitivas;
    const cliente = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
    const grupo = Array.isArray(v.grupo) ? v.grupo[0] : v.grupo;
    const grupoModalidade = Array.isArray(grupo?.modalidade) ? grupo?.modalidade[0] : grupo?.modalidade;
    const participante = Array.isArray(v.participante) ? v.participante[0] : v.participante;

    const tipoNegociacao =
      v.snapshot_venda?.tipo_negociacao ||
      v.snapshot_venda?.modalidade_nome ||
      grupoModalidade?.nome ||
      "Integral";

    return {
      id: v.id,
      cliente_nome: cliente?.nome || "Cliente",
      cliente_cpf_cnpj: cliente?.cpf_cnpj || null,
      cliente_email: cliente?.email || null,
      cliente_telefone: cliente?.telefone || null,
      valor_credito: Number(v.valor_credito),
      prazo: Number(v.prazo),
      parcela: Number(v.parcela),
      tipo_negociacao: tipoNegociacao,
      status: v.status,
      data_venda: v.data_venda,
      created_at: v.created_at,
      data_primeira_parcela: v.data_primeira_parcela || null,
      data_segunda_parcela: v.data_segunda_parcela || null,
      participante_comercial_id: v.participante_comercial_id || null,
      participante_secundario_id: v.participante_secundario_id || null,
      participante_secundario_fracao_percentual: v.participante_secundario_fracao_percentual ? Number(v.participante_secundario_fracao_percentual) : null,
      perfil_principal_id: v.perfil_principal_id || (v.snapshot_venda as any)?.perfil_principal_id || null,
      perfil_secundario_id: v.perfil_secundario_id || (v.snapshot_venda as any)?.perfil_secundario_id || null,
      snapshot_venda: v.snapshot_venda,
      consultor_nome: participante?.nome_exibicao || participante?.nome || (v.participante_comercial_id ? participantesMap.get(v.participante_comercial_id) : undefined),
      secundario_nome: v.participante_secundario_id ? participantesMap.get(v.participante_secundario_id) : undefined,
      cota_numero: cota?.numero_cota || null,
      cota_id: cota?.id || null,
      grupo_codigo: grupo?.codigo_grupo || v.numero_grupo,
    };
  });

  const cotas: CotaItem[] = (cotasRes.data ?? []).map((c: any) => {
    const cliente = Array.isArray(c.cliente) ? c.cliente[0] : c.cliente;
    const grupo = Array.isArray(c.grupo) ? c.grupo[0] : c.grupo;

    return {
      id: c.id,
      venda_id: c.venda_id,
      numero_grupo: grupo?.codigo_grupo || c.numero_grupo,
      numero_cota: c.numero_cota || null,
      valor_credito: Number(c.valor_credito),
      prazo: Number(c.prazo),
      parcela: Number(c.parcela),
      status: c.status,
      contemplada: c.contemplada,
      cliente_nome: cliente?.nome || undefined,
    };
  });

  return (
    <main className="p-6">
      <ErpVendasHubView
        vendas={vendas}
        cotas={cotas}
        participantes={participantes}
        vinculosPerfis={vinculosPerfis}
        empresaNome={empresaNome}
        isMaster={isMaster}
      />
    </main>
  );
}