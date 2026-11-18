import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { comissaoVisivel, estatisticas, getConfig, listarCotas } from "@/lib/contempladas/repo";
import { Shell } from "@/components/contempladas/ui";
import { Portal } from "@/components/contempladas/portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Cotas Contempladas · Racon" },
  description: "Simule, junte cartas contempladas e reserve com PIX.",
  robots: { index: false },
};

export default async function Page() {
  const tenant = await getResolvedTenant();
  if (!tenant) notFound();
  const [cotas, stats, cfg, u] = await Promise.all([
    listarCotas(tenant.empresaId),
    estatisticas(tenant.empresaId),
    getConfig(tenant.empresaId),
    getUsuarioNegocio(),
  ]);
  // Comissão só vai para o navegador de quem está logado.
  const lista = cotas.map((c) => ({ ...c, comissao_parceiro: u ? comissaoVisivel(c, cfg) : 0 }));
  return (
    <Shell titulo="Cotas Contempladas" sub="Racon · compra, reserva e junção">
      <Portal cotas={lista} stats={stats} logado={u ? u.nome : null} />
    </Shell>
  );
}
