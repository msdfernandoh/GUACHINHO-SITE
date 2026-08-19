import { createClient } from "@/lib/supabase/server";
import { OnboardingFranquiaClient } from "./client";

export default async function NovaFranquiaPage() {
  const db = await createClient();

  const [modelosRes, modulosRes, adminsRes, planosRes, planoModulosRes] = await Promise.all([
    db
      .from("site_modelos")
      .select("id,codigo,nome,status,identidade_visual,catalogo_menus,permite_logo_propria")
      .neq("status", "INATIVO")
      .order("versao", { ascending: false }),
    db
      .from("erp_modulos_catalogo")
      .select("id,codigo,nome,descricao,ordem_padrao,categoria,dependencias")
      .eq("status", "ATIVO")
      .order("ordem_padrao"),
    db
      .from("administradoras")
      .select("id,nome,nome_fantasia,status")
      .eq("status", "ATIVA")
      .order("nome"),
    db
      .from("saas_planos")
      .select("id,codigo,nome,descricao,valor_mensal,taxa_implantacao,limite_usuarios,erp_incluido,site_principal_incluido,permite_sites_parceiros,max_parceiros,max_sites_parceiros,max_sites_dominio_proprio,valor_site_parceiro,valor_site_dominio_proprio,disponivel_novas_assinaturas")
      .eq("status", "ATIVO")
      .order("valor_mensal", { ascending: true }),
    db
      .from("saas_plano_modulos")
      .select("plano_id,modulo:erp_modulos_catalogo(codigo)")
      .eq("habilitado", true),
  ]);

  const planoModulosMap: Record<string, string[]> = {};
  (planoModulosRes.data ?? []).forEach((pm) => {
    const mod = pm.modulo as { codigo?: string } | null;
    if (mod?.codigo) {
      if (!planoModulosMap[pm.plano_id]) planoModulosMap[pm.plano_id] = [];
      planoModulosMap[pm.plano_id].push(mod.codigo);
    }
  });

  const planosComModulos = (planosRes.data ?? []).map((p) => ({
    ...p,
    modulos_habilitados: planoModulosMap[p.id] ?? [],
  }));

  return (
    <OnboardingFranquiaClient
      modelos={modelosRes.data ?? []}
      modulos={modulosRes.data ?? []}
      administradoras={adminsRes.data ?? []}
      planos={planosComModulos as never[]}
    />
  );
}


