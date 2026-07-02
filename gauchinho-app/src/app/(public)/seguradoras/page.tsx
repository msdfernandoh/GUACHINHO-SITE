import type { Metadata } from "next";
import { ConteudoHero, ConteudoPageShell } from "@/components/conteudo/conteudo-hero";
import { SeguradorasPublicClient } from "@/components/public/seguradoras-public-client";
import { fetchPublicSeguradoras } from "@/app/admin/seguradoras/actions";
import { safeFetch } from "@/lib/home/safe-fetch";
import type { SeguradoraRow } from "@/lib/seguradoras/types";

export const metadata: Metadata = {
  title: "Seguradoras | Gauchinho",
  description: "Parceiros seguradores do Gauchinho Consórcios.",
};

export const dynamic = "force-dynamic";

export default async function SeguradorasPublicPage() {
  const seguradoras = await safeFetch(() => fetchPublicSeguradoras(), [] as SeguradoraRow[]);
  return (
    <ConteudoPageShell>
      <ConteudoHero
        eyebrow="Parceiros"
        title="Seguradoras"
        subtitle="Empresas parceiras com atuação em seguros e proteção patrimonial."
      />
      <SeguradorasPublicClient seguradoras={seguradoras} />
    </ConteudoPageShell>
  );
}
