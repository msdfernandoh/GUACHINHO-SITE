import type { Metadata } from "next";
import { PublicPremiumHero } from "@/components/public/public-premium-hero";
import { HomeV2ParceirosStrip } from "@/components/public/home/home-v2-parceiros-strip";
import { simuladorShell } from "@/components/simulador/simulador-ui";
import { SeguradorasPublicClient } from "@/components/public/seguradoras-public-client";
import { fetchPublicSeguradoras } from "@/app/admin/seguradoras/actions";
import { safeFetch } from "@/lib/home/safe-fetch";
import { loadHomeConteudoDestaques } from "@/lib/home/load-home-data";
import type { SeguradoraRow } from "@/lib/seguradoras/types";

export const metadata: Metadata = {
  title: "Seguradoras | Gauchinho",
  description: "Parceiros seguradores do Gauchinho Consórcios.",
};

export const dynamic = "force-dynamic";

export default async function SeguradorasPublicPage() {
  const [seguradoras, conteudo] = await Promise.all([
    safeFetch(() => fetchPublicSeguradoras(), [] as SeguradoraRow[]),
    loadHomeConteudoDestaques(),
  ]);

  return (
    <div className={simuladorShell}>
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:px-6 sm:pt-14">
        <PublicPremiumHero
          eyebrow="Gauchinho · Seguradoras"
          title="Seguradoras"
          subtitle="Empresas parceiras com atuação em seguros e proteção patrimonial."
        />

        <div className="mx-auto max-w-5xl">
          <SeguradorasPublicClient seguradoras={seguradoras} />
        </div>
      </div>

      {conteudo.parceirosDestaque.length > 0 ? (
        <HomeV2ParceirosStrip parceiros={conteudo.parceirosDestaque} anchorFooter />
      ) : null}
    </div>
  );
}
