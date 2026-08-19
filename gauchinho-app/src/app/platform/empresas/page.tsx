import { createClient } from "@/lib/supabase/server";
import { MasterFranquiasListingClient, type MasterFranquiaItem } from "./client";

export default async function MasterFranquiasPage() {
  const db = await createClient();

  const [
    empresasRes,
    assinaturasRes,
    brandingRes,
    dominiosRes,
    adminsRes,
    usuariosRes,
    quotasRes,
    parceirosRes,
    sitesParceirosRes,
  ] = await Promise.all([
    db
      .from("empresas")
      .select("id, nome_fantasia, razao_social, slug, status, ativo, configuracoes, updated_at")
      .order("created_at", { ascending: false }),
    db
      .from("saas_assinaturas")
      .select("empresa_id, status, valor_mensal, valor_total_estimado, usuarios_contratados, sites_parceiros_contratados, plano:saas_planos(id, nome, codigo)"),
    db
      .from("empresa_branding")
      .select("empresa_id, nome_site, status_publicacao, modelo:site_modelos(id, nome)"),
    db
      .from("empresa_dominios")
      .select("empresa_id, valor, principal, ativo, verificado"),
    db
      .from("empresa_administradoras")
      .select("empresa_id, status, administradora:administradoras(id, nome)")
      .eq("status", "ATIVA"),
    db
      .from("empresa_usuarios")
      .select("empresa_id, ativo")
      .eq("ativo", true),
    db
      .from("empresa_quotas")
      .select("empresa_id, limite_usuarios, max_sites_parceiros"),
    db
      .from("organizacoes_parceiras")
      .select("empresa_id, status")
      .eq("ativo", true),
    db
      .from("parceiro_sites")
      .select("empresa_id, status_publicacao, ativo")
      .eq("ativo", true),
  ]);

  const empresasRows = empresasRes.data ?? [];
  const assinaturasMap = new Map((assinaturasRes.data ?? []).map((a) => [a.empresa_id, a]));
  const brandingMap = new Map((brandingRes.data ?? []).map((b) => [b.empresa_id, b]));
  const dominiosRows = dominiosRes.data ?? [];
  const adminsRows = adminsRes.data ?? [];
  const usuariosRows = usuariosRes.data ?? [];
  const quotasMap = new Map((quotasRes.data ?? []).map((q) => [q.empresa_id, q]));
  const parceirosRows = parceirosRes.data ?? [];
  const sitesParceirosRows = sitesParceirosRes.data ?? [];

  const items: MasterFranquiaItem[] = empresasRows.map((emp) => {
    const ass = assinaturasMap.get(emp.id);
    const branding = brandingMap.get(emp.id);
    const quota = quotasMap.get(emp.id);

    const domPrincipal = dominiosRows.find((d) => d.empresa_id === emp.id && d.principal);
    const adminsDaEmpresa = adminsRows
      .filter((a) => a.empresa_id === emp.id)
      .map((a) => (a.administradora as { nome?: string } | null)?.nome ?? "Administradora")
      .filter(Boolean);

    const totalUsuarios = usuariosRows.filter((u) => u.empresa_id === emp.id).length;
    const totalParceiros = parceirosRows.filter((p) => p.empresa_id === emp.id).length;
    const totalSites = sitesParceirosRows.filter((s) => s.empresa_id === emp.id).length;

    const configJson = (emp.configuracoes as Record<string, unknown> | null) ?? {};
    const erpConfig = configJson.erp_sistema as { habilitado?: boolean } | undefined;
    const erpHabilitado = Boolean(erpConfig?.habilitado);

    const planoData = ass?.plano as { nome?: string } | null;

    return {
      id: emp.id,
      nome_fantasia: emp.nome_fantasia,
      razao_social: emp.razao_social,
      slug: emp.slug,
      status: emp.status || (emp.ativo ? "ativa" : "em_treinamento"),
      ativo: emp.ativo,
      erp_habilitado: erpHabilitado,
      plano_nome: planoData?.nome || "Sem Plano Vinculado",
      assinatura_status: ass?.status || "PENDENTE",
      valor_mensal_estimado: Number(ass?.valor_total_estimado || ass?.valor_mensal || 0),
      modelo_site_nome: (branding?.modelo as { nome?: string } | null)?.nome || "Gauchinho Default",
      dominio_principal: domPrincipal?.valor || null,
      administradoras_nomes: adminsDaEmpresa,
      total_usuarios: totalUsuarios,
      limite_usuarios: Number(quota?.limite_usuarios || ass?.usuarios_contratados || 10),
      total_parceiros: totalParceiros,
      total_sites_parceiros: totalSites,
      updated_at: emp.updated_at,
    };
  });

  return <MasterFranquiasListingClient empresas={items} />;
}
