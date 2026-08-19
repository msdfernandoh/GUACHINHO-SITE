import { createClient } from "@/lib/supabase/server";
import { OnboardingFranquiaClient } from "./client";

export default async function NovaFranquiaPage() {
  const db = await createClient();

  const [modelosRes, modulosRes, adminsRes, planosRes] = await Promise.all([
    db
      .from("site_modelos")
      .select("id,codigo,nome,status,identidade_visual,catalogo_menus,permite_logo_propria")
      .neq("status", "INATIVO")
      .order("versao", { ascending: false }),
    db
      .from("erp_modulos_catalogo")
      .select("id,codigo,nome,descricao,ordem_padrao")
      .eq("status", "ATIVO")
      .order("ordem_padrao"),
    db
      .from("administradoras")
      .select("id,nome,nome_fantasia,status")
      .eq("status", "ATIVA")
      .order("nome"),
    db
      .from("saas_planos")
      .select("id,codigo,nome,descricao,valor_mensal,taxa_implantacao,limite_usuarios")
      .neq("status", "INATIVO")
      .order("nome"),
  ]);

  return (
    <OnboardingFranquiaClient
      modelos={modelosRes.data ?? []}
      modulos={modulosRes.data ?? []}
      administradoras={adminsRes.data ?? []}
      planos={planosRes.data ?? []}
    />
  );
}

