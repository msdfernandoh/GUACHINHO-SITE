import { createClient } from "@/lib/supabase/server";
import { PlanosListingClient } from "./client";

export default async function PlatformPlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const db = await createClient();

  const [planosRes, modulosRes, assinaturasRes] = await Promise.all([
    db
      .from("saas_planos")
      .select("id,codigo,nome,descricao,status,valor_mensal,taxa_implantacao,limite_usuarios,erp_incluido,site_principal_incluido,permite_sites_parceiros,max_parceiros,max_sites_parceiros,max_sites_dominio_proprio,valor_site_parceiro,valor_site_dominio_proprio,disponivel_novas_assinaturas,categoria,updated_at")
      .order("valor_mensal", { ascending: true })
      .order("nome"),
    db
      .from("saas_plano_modulos")
      .select("plano_id,modulo_id,modulo:erp_modulos_catalogo(codigo,nome)")
      .eq("habilitado", true),
    db
      .from("saas_assinaturas")
      .select("id,plano_id,empresa_id,status,valor_total_estimado"),
  ]);

  let planos = planosRes.data ?? [];
  if (filters.busca) {
    const term = filters.busca.toLowerCase();
    planos = planos.filter(
      (p) => p.nome.toLowerCase().includes(term) || p.codigo.toLowerCase().includes(term),
    );
  }
  if (filters.status) {
    planos = planos.filter((p) => p.status === filters.status);
  }

  const planoModulosMap: Record<string, string[]> = {};
  (modulosRes.data ?? []).forEach((pm) => {
    const mod = pm.modulo as { nome?: string } | null;
    if (mod?.nome) {
      if (!planoModulosMap[pm.plano_id]) planoModulosMap[pm.plano_id] = [];
      planoModulosMap[pm.plano_id].push(mod.nome);
    }
  });

  const assinaturasCountMap: Record<string, number> = {};
  const assinaturasMrrMap: Record<string, number> = {};
  (assinaturasRes.data ?? []).forEach((a) => {
    if (a.status === "ATIVA") {
      assinaturasCountMap[a.plano_id] = (assinaturasCountMap[a.plano_id] || 0) + 1;
      assinaturasMrrMap[a.plano_id] = (assinaturasMrrMap[a.plano_id] || 0) + Number(a.valor_total_estimado || 0);
    }
  });

  const enrichedPlanos = planos.map((p) => ({
    ...p,
    modulos_nomes: planoModulosMap[p.id] ?? [],
    assinantes_ativos: assinaturasCountMap[p.id] ?? 0,
    mrr_estimado: assinaturasMrrMap[p.id] ?? 0,
  }));

  return <PlanosListingClient planos={enrichedPlanos as never[]} />;
}
