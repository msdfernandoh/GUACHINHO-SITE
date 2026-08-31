import { getCurrentTenantContext } from "@/lib/tenant/context";
import { notFound } from "next/navigation";
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
  if (!empresaAtiva) notFound();
  const empresaId = empresaAtiva.id;
  const empresaNome = empresaAtiva?.nome_fantasia ?? empresaAtiva?.razao_social ?? "Consórcios";

  const vinculo = (vinculos ?? []).find((item) => item.empresa_id === empresaId);
  const papelNome = vinculo?.papel?.nome?.toLowerCase() ?? "";
  const isMaster = papelNome.includes("master") || papelNome.includes("admin") || papelNome.includes("gestor");

  const admin = createAdminClient();

  const [vendasRes, cotasRes, participantesRes, vinculosRes, modalidadesRes, regrasPartRes, regrasFranqRes] = await Promise.all([
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
      .select("*, venda:vendas(id,cliente_nome,cliente_cpf_cnpj,numero_grupo), grupo:grupos_consorcio(codigo_grupo)")
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
    admin
      .from("administradora_modalidades_comissao")
      .select("id,administradora_id,codigo,nome,ativo")
      .eq("ativo", true)
      .order("nome"),
    admin
      .from("comissao_regras_participantes")
      .select("id,perfil_id,programa_id,percentual_comissao,seguir_cronograma_franquia,etapas_cronograma,base_v2,status")
      .eq("empresa_id", empresaId)
      .eq("ativa", true),
    admin
      .from("comissao_regras_franquia")
      .select("id,programa_id,percentual_total_comissao,tipo_administradora_id,modalidade_comissao_id,ativa,configuracao_homologada")
      .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
      .eq("ativa", true),
  ]);

  const participantes = (participantesRes.data ?? []) as ParticipanteSimples[];
  const vinculosPerfis = ((vinculosRes.data ?? []) as unknown) as VinculoPerfilSimples[];
  const modalidades = (modalidadesRes.data ?? []) as Array<{
    id: string;
    administradora_id: string | null;
    codigo: string;
    nome: string;
    ativo: boolean;
  }>;
  const participantesMap = new Map(participantes.map((p) => [p.id, p.nome_exibicao || p.nome]));

  const vendas: VendaItem[] = (vendasRes.data ?? []).map((v: any) => {
    const cotasDaVenda = Array.isArray(v.cotas_definitivas) ? v.cotas_definitivas : v.cotas_definitivas ? [v.cotas_definitivas] : [];
    const cotaPrincipal = cotasDaVenda[0] || null;
    const cliente = Array.isArray(v.cliente) ? v.cliente[0] : v.cliente;
    const grupo = Array.isArray(v.grupo) ? v.grupo[0] : v.grupo;
    const grupoModalidade = Array.isArray(grupo?.modalidade) ? grupo?.modalidade[0] : grupo?.modalidade;
    const participante = Array.isArray(v.participante) ? v.participante[0] : v.participante;

    const modalidadeMatch = modalidades.find(
      (m) => m.id === v.modalidade_comissao_id || m.id === v.snapshot_venda?.modalidade_comissao_id
    );

    const tipoVendaCodigo =
      v.snapshot_venda?.tipo_venda ||
      v.snapshot_venda?.dados_simulacao?.tipo_venda ||
      modalidadeMatch?.codigo;

    const tipoNegociacao =
      v.snapshot_venda?.tipo_negociacao ||
      (tipoVendaCodigo === "REDUZIDA_60_99" ? "Reduzida 60%" : tipoVendaCodigo === "REDUZIDA_ABAIXO_59" ? "Abaixo de 59%" : tipoVendaCodigo === "INTEGRAL" ? "Integral" : null) ||
      modalidadeMatch?.nome ||
      v.snapshot_venda?.modalidade_nome ||
      grupoModalidade?.nome ||
      "Integral";

    const qtdCotas = Number(
      v.quantidade_cotas ||
      v.snapshot_venda?.quantidade_cotas ||
      v.snapshot_venda?.quantidade ||
      cotasDaVenda.length ||
      1
    );

    return {
      id: v.id,
      cliente_nome: cliente?.nome || v.cliente_nome || "Cliente",
      cliente_cpf_cnpj: cliente?.cpf_cnpj || v.cliente_cpf_cnpj || null,
      cliente_email: cliente?.email || v.cliente_email || null,
      cliente_telefone: cliente?.telefone || v.cliente_telefone || null,
      valor_credito: Number(v.valor_credito),
      prazo: Number(v.prazo),
      parcela: Number(v.parcela),
      quantidade_cotas: qtdCotas,
      tipo_negociacao: tipoNegociacao,
      status: v.status,
      data_venda: v.data_venda,
      created_at: v.created_at,
      data_primeira_parcela: v.data_primeira_parcela || null,
      data_segunda_parcela: v.data_segunda_parcela || null,
      modalidade_comissao_id: v.modalidade_comissao_id || (v.snapshot_venda as any)?.modalidade_comissao_id || null,
      participante_comercial_id: v.participante_comercial_id || null,
      participante_secundario_id: v.participante_secundario_id || null,
      participante_secundario_fracao_percentual: v.participante_secundario_fracao_percentual ? Number(v.participante_secundario_fracao_percentual) : null,
      perfil_principal_id: v.perfil_principal_id || (v.snapshot_venda as any)?.perfil_principal_id || null,
      perfil_secundario_id: v.perfil_secundario_id || (v.snapshot_venda as any)?.perfil_secundario_id || null,
      snapshot_venda: v.snapshot_venda,
      consultor_nome: participante?.nome_exibicao || participante?.nome || (v.participante_comercial_id ? participantesMap.get(v.participante_comercial_id) : undefined),
      secundario_nome: v.participante_secundario_id ? participantesMap.get(v.participante_secundario_id) : undefined,
      cota_numero: cotaPrincipal?.numero_cota || v.snapshot_venda?.numero_cota || null,
      cota_id: cotaPrincipal?.id || null,
      grupo_codigo: grupo?.codigo_grupo || v.numero_grupo || v.snapshot_venda?.numero_grupo || "1463",
    };
  });

  const cotasMap = new Set((cotasRes.data ?? []).map((c: any) => c.venda_id));
  const cotas: CotaItem[] = (cotasRes.data ?? []).map((c: any) => {
    const venda = Array.isArray(c.venda) ? c.venda[0] : c.venda;
    const grupo = Array.isArray(c.grupo) ? c.grupo[0] : c.grupo;

    return {
      id: c.id,
      venda_id: c.venda_id,
      numero_grupo: grupo?.codigo_grupo || c.numero_grupo || venda?.numero_grupo || "1463",
      numero_cota: c.numero_cota || null,
      valor_credito: Number(c.valor_credito),
      prazo: Number(c.prazo),
      parcela: Number(c.parcela),
      status: c.status,
      contemplada: c.status === "contemplada",
      cliente_nome: venda?.cliente_nome || c.snapshot_cota?.cliente_nome || undefined,
    };
  });

  // Adiciona fallback para vendas que já foram confirmadas para que apareçam também em cotas
  vendas.forEach((v) => {
    if (!cotasMap.has(v.id)) {
      cotas.push({
        id: v.cota_id || `venda-cota-${v.id}`,
        venda_id: v.id,
        numero_grupo: v.grupo_codigo || "1463",
        numero_cota: v.cota_numero || null,
        valor_credito: v.valor_credito,
        prazo: v.prazo,
        parcela: v.parcela,
        status: v.status === "confirmada" ? "ativa" : v.status,
        contemplada: false,
        cliente_nome: v.cliente_nome,
      });
    }
  });

  return (
    <main className="p-6">
      <ErpVendasHubView
        vendas={vendas}
        cotas={cotas}
        participantes={participantes}
        vinculosPerfis={vinculosPerfis}
        modalidades={((modalidadesRes.data ?? []) as any)}
        regrasParticipantes={((regrasPartRes.data ?? []) as any)}
        regrasFranquia={((regrasFranqRes.data ?? []) as any)}
        empresaNome={empresaNome}
        isMaster={isMaster}
      />
    </main>
  );
}
