import { createClient } from "@/lib/supabase/server";
import { AssinaturasListingClient, type AssinaturaItem, type PlanoOption } from "./client";

export default async function PlatformAssinaturasPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const db = await createClient();

  const [assinaturasRes, planosRes, overridesRes, quotasRes, empresasRes] = await Promise.all([
    db
      .from("saas_assinaturas")
      .select(
        "id, empresa_id, plano_id, status, usuarios_contratados, sites_parceiros_contratados, sites_dominio_proprio_contratados, valor_mensal, taxa_implantacao, valor_total_estimado, data_inicio, observacao, created_at, empresa:empresas(id, nome_fantasia, slug), plano:saas_planos(id, nome, codigo, valor_mensal, limite_usuarios, max_sites_parceiros, max_sites_dominio_proprio, valor_site_parceiro, valor_site_dominio_proprio, modulos_habilitados)",
      )
      .order("created_at", { ascending: false }),
    db
      .from("saas_planos")
      .select("id, nome, codigo, status, valor_mensal, limite_usuarios, max_sites_parceiros, max_sites_dominio_proprio, valor_site_parceiro, valor_site_dominio_proprio, modulos_habilitados")
      .order("valor_mensal", { ascending: true }),
    db
      .from("saas_empresa_overrides")
      .select("id, empresa_id, tipo, recurso_codigo, efeito, valor_numerico, status")
      .eq("status", "ATIVO"),
    db
      .from("empresa_quotas")
      .select("empresa_id, limite_usuarios, limite_sites_parceiros, limite_dominios_proprios"),
    db
      .from("empresas")
      .select("id, nome_fantasia, razao_social, slug, cnpj, status, ativo")
      .order("nome_fantasia", { ascending: true }),
  ]);

  let assinaturasRaw = assinaturasRes.data ?? [];
  const overridesRaw = overridesRes.data ?? [];
  const quotasRaw = quotasRes.data ?? [];

  if (filters.busca) {
    const term = filters.busca.toLowerCase();
    assinaturasRaw = assinaturasRaw.filter((a) => {
      const empNome = (a.empresa as { nome_fantasia?: string } | null)?.nome_fantasia?.toLowerCase() || "";
      const planoNome = (a.plano as { nome?: string } | null)?.nome?.toLowerCase() || "";
      return empNome.includes(term) || planoNome.includes(term);
    });
  }
  if (filters.status) {
    assinaturasRaw = assinaturasRaw.filter((a) => a.status === filters.status);
  }

  const assinaturasEnriched: AssinaturaItem[] = assinaturasRaw.map((a) => {
    const empOverrides = overridesRaw.filter((o) => o.empresa_id === a.empresa_id);
    const quota = quotasRaw.find((q) => q.empresa_id === a.empresa_id);

    return {
      id: a.id,
      empresa_id: a.empresa_id,
      plano_id: a.plano_id,
      status: a.status,
      usuarios_contratados: a.usuarios_contratados || 10,
      sites_parceiros_contratados: a.sites_parceiros_contratados || 0,
      sites_dominio_proprio_contratados: a.sites_dominio_proprio_contratados || 0,
      valor_mensal: a.valor_mensal,
      taxa_implantacao: a.taxa_implantacao,
      valor_total_estimado: a.valor_total_estimado || a.valor_mensal || 0,
      data_inicio: a.data_inicio,
      observacao: a.observacao,
      created_at: a.created_at,
      empresa: (Array.isArray(a.empresa) ? a.empresa[0] : a.empresa) as AssinaturaItem["empresa"],
      plano: (Array.isArray(a.plano) ? a.plano[0] : a.plano) as AssinaturaItem["plano"],
      overrides_ativos: empOverrides.map((o) => ({
        id: o.id,
        tipo: o.tipo,
        recurso_codigo: o.recurso_codigo,
        efeito: o.efeito,
        valor_numerico: o.valor_numerico,
      })),
      quota_efetiva: {
        limite_usuarios: quota?.limite_usuarios ?? a.usuarios_contratados ?? 10,
        limite_sites: quota?.limite_sites_parceiros ?? a.sites_parceiros_contratados ?? 5,
        limite_dominios: quota?.limite_dominios_proprios ?? a.sites_dominio_proprio_contratados ?? 0,
      },
    };
  });

  const planosOptions: PlanoOption[] = (planosRes.data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    codigo: p.codigo,
    status: p.status,
    valor_mensal: p.valor_mensal,
    limite_usuarios: p.limite_usuarios || 10,
    max_sites_parceiros: p.max_sites_parceiros || 0,
    max_sites_dominio_proprio: p.max_sites_dominio_proprio || 0,
    valor_site_parceiro: p.valor_site_parceiro || 0,
    valor_site_dominio_proprio: p.valor_site_dominio_proprio || 0,
    modulos_habilitados: p.modulos_habilitados || [],
  }));

  const empresasOptions = (empresasRes.data ?? []).map((e) => ({
    id: e.id,
    nome_fantasia: e.nome_fantasia,
    razao_social: e.razao_social,
    slug: e.slug,
    cnpj: e.cnpj,
    status: e.status,
    ativo: e.ativo,
  }));

  return (
    <AssinaturasListingClient
      assinaturas={assinaturasEnriched}
      planosDisponiveis={planosOptions}
      empresasDisponiveis={empresasOptions}
    />
  );
}

