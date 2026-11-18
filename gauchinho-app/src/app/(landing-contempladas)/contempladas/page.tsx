import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { getAcesso } from "@/lib/contempladas/acesso";
import { comissaoVisivel, configsPorDono, estatisticas, listarCotas } from "@/lib/contempladas/repo";
import { configPublica, type ConfigPublica } from "@/lib/contempladas/publico";
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
  const [cotas, stats, cfgs, a] = await Promise.all([
    listarCotas(tenant.empresaId),
    estatisticas(tenant.empresaId),
    configsPorDono(tenant.empresaId),
    getAcesso(tenant.empresaId),
  ]);
  // Comissão só vai para o navegador de quem está logado.
  const lista = cotas.map((c) => ({ ...c, comissao_parceiro: a ? comissaoVisivel(c, cfgs.de(c.dono_auth_id)) : 0 }));
  // WhatsApp, PIX e sinal de cada unidade dona de cota ("" = padrão da empresa).
  const unidades: Record<string, ConfigPublica> = {};
  for (const c of cotas) {
    const k = c.dono_auth_id ?? "";
    if (!unidades[k]) unidades[k] = configPublica(cfgs.de(c.dono_auth_id), c.dono_nome);
  }
  if (!unidades[""]) unidades[""] = configPublica(cfgs.padrao);
  return (
    <Shell titulo="Cotas Contempladas" sub="Racon · imóveis e automóveis" papel={a?.papel ?? null}>
      <Portal cotas={lista} stats={stats} logado={a ? a.nome : null}
        adicional={a?.adicional ?? null}
        unidades={unidades}
      />
    </Shell>
  );
}
