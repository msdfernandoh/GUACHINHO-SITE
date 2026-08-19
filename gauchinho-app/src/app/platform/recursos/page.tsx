import { createClient } from "@/lib/supabase/server";
import { RecursosOverridesClient } from "./client";

export default async function PlatformRecursosOverridesPage() {
  const db = await createClient();

  const [overridesRes, empresasRes, modulosRes] = await Promise.all([
    db
      .from("saas_empresa_overrides")
      .select("id,empresa_id,recurso_codigo,efeito,motivo,vigencia_inicio,vigencia_fim,created_at,empresa:empresas(id,nome_fantasia,slug)")
      .order("created_at", { ascending: false }),
    db
      .from("empresas")
      .select("id,nome_fantasia,slug")
      .order("nome_fantasia"),
    db
      .from("erp_modulos_catalogo")
      .select("codigo,nome")
      .order("ordem_padrao"),
  ]);

  return (
    <RecursosOverridesClient
      overrides={(overridesRes.data ?? []) as never[]}
      empresas={empresasRes.data ?? []}
      modulos={modulosRes.data ?? []}
    />
  );
}
