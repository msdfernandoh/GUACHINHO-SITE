import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { getAcesso } from "@/lib/contempladas/acesso";
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
  const [cotas, stats, cfg, a] = await Promise.all([
    listarCotas(tenant.empresaId),
    estatisticas(tenant.empresaId),
    getConfig(tenant.empresaId),
    getAcesso(tenant.empresaId),
  ]);
  // Comissão só vai para o navegador de quem está logado.
  const lista = cotas.map((c) => ({ ...c, comissao_parceiro: a ? comissaoVisivel(c, cfg) : 0 }));
  return (
    <Shell titulo="Cotas Contempladas" sub="Racon · imóveis e automóveis" papel={a?.papel ?? null}>
      <Portal cotas={lista} stats={stats} logado={a ? a.nome : null}
        adicional={a?.adicional ?? null}
        cfg={{
          whatsapp: cfg.whatsapp,
          chavePix:
            cfg.chave_pix_tipo === "CELULAR" && cfg.chave_pix && /^\d{11}$/.test(cfg.chave_pix.replace(/\D/g, ""))
              ? cfg.chave_pix.replace(/\D/g, "").replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3")
              : cfg.chave_pix,
          tipoPix: { CELULAR: "celular", EMAIL: "e-mail", CPF: "CPF", CNPJ: "CNPJ", ALEATORIA: "aleatória" }[cfg.chave_pix_tipo],
          favorecido: cfg.favorecido_pix,
          minutos: cfg.pre_reserva_minutos,
        }}
      />
    </Shell>
  );
}
