import { createClient } from "@/lib/supabase/server";
import { AssinaturasListingClient } from "./client";

export default async function PlatformAssinaturasPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string }>;
}) {
  const filters = await searchParams;
  const db = await createClient();

  const [assinaturasRes, planosRes] = await Promise.all([
    db
      .from("saas_assinaturas")
      .select("id,empresa_id,plano_id,status,usuarios_contratados,sites_parceiros_contratados,sites_dominio_proprio_contratados,valor_mensal,taxa_implantacao,valor_total_estimado,data_inicio,observacao,created_at,empresa:empresas(id,nome_fantasia,slug),plano:saas_planos(id,nome,codigo,valor_mensal,max_sites_parceiros,max_sites_dominio_proprio)")
      .order("created_at", { ascending: false }),
    db
      .from("saas_planos")
      .select("id,nome,codigo,status,valor_mensal,max_sites_parceiros,max_sites_dominio_proprio")
      .neq("status", "INATIVO")
      .order("nome"),
  ]);

  let assinaturas = assinaturasRes.data ?? [];
  if (filters.busca) {
    const term = filters.busca.toLowerCase();
    assinaturas = assinaturas.filter((a) => {
      const empNome = (a.empresa as { nome_fantasia?: string } | null)?.nome_fantasia?.toLowerCase() || "";
      const planoNome = (a.plano as { nome?: string } | null)?.nome?.toLowerCase() || "";
      return empNome.includes(term) || planoNome.includes(term);
    });
  }
  if (filters.status) {
    assinaturas = assinaturas.filter((a) => a.status === filters.status);
  }

  return (
    <AssinaturasListingClient
      assinaturas={assinaturas as never[]}
      planosDisponiveis={planosRes.data ?? []}
    />
  );
}
