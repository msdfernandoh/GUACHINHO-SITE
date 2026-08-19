import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanoWorkspace, type PlanoDetail } from "@/components/platform/plano-workspace";

export default async function PlatformPlanoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();

  const [planoRes, modulosCatalogoRes, planoModulosRes, assinaturasRes, historicoRes] = await Promise.all([
    db
      .from("saas_planos")
      .select("id,codigo,nome,descricao,status,valor_mensal,taxa_implantacao,limite_usuarios,erp_incluido,site_principal_incluido,permite_sites_parceiros,max_parceiros,max_sites_parceiros,max_sites_dominio_proprio,valor_site_parceiro,valor_site_dominio_proprio,taxa_implantacao_site_parceiro,taxa_implantacao_dominio_proprio,disponivel_novas_assinaturas,categoria,updated_at")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("erp_modulos_catalogo")
      .select("id,codigo,nome,descricao,categoria,status,dependencias,ordem_padrao")
      .order("ordem_padrao", { ascending: true }),
    db
      .from("saas_plano_modulos")
      .select("modulo_id,modulo:erp_modulos_catalogo(codigo)")
      .eq("plano_id", id)
      .eq("habilitado", true),
    db
      .from("saas_assinaturas")
      .select("id,empresa_id,status,usuarios_contratados,sites_parceiros_contratados,sites_dominio_proprio_contratados,valor_total_estimado,created_at,empresa:empresas(nome_fantasia)")
      .eq("plano_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("plataforma_auditoria")
      .select("id,acao,entidade_tipo,entidade_id,campos_alterados,created_at")
      .eq("entidade_tipo", "saas_planos")
      .eq("entidade_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!planoRes.data) notFound();

  const modulosHabilitados = (planoModulosRes.data ?? [])
    .map((pm) => (pm.modulo as { codigo?: string } | null)?.codigo)
    .filter(Boolean) as string[];

  const assinaturasFormatadas = (assinaturasRes.data ?? []).map((a) => ({
    id: a.id,
    empresa_id: a.empresa_id,
    empresa_nome: (a.empresa as { nome_fantasia?: string } | null)?.nome_fantasia || "Empresa",
    status: a.status,
    usuarios_contratados: a.usuarios_contratados || 10,
    sites_parceiros_contratados: a.sites_parceiros_contratados || 0,
    sites_dominio_proprio_contratados: a.sites_dominio_proprio_contratados || 0,
    valor_total_estimado: a.valor_total_estimado || 0,
    created_at: a.created_at,
  }));

  const planoData: PlanoDetail = {
    ...planoRes.data,
    modulos_habilitados: modulosHabilitados,
  };

  return (
    <PlanoWorkspace
      plano={planoData}
      modulosCatalogo={(modulosCatalogoRes.data ?? []) as never[]}
      assinaturas={assinaturasFormatadas}
      historico={(historicoRes.data ?? []) as never[]}
    />
  );
}
