import {
  fetchPublicImobiliariasParceiras,
} from "@/app/admin/imobiliarias/actions";
import { fetchPublicImoveis } from "@/app/admin/imoveis/actions";
import { ImoveisPublicClient } from "@/components/public/imoveis-public-client";
import { toImobiliariaPublic } from "@/lib/imobiliarias/public-card-utils";
import type { ImovelPublic } from "@/lib/imoveis/types";
import { safeFetch } from "@/lib/home/safe-fetch";
import { DEFAULT_CONTATO, getConfigJsonPublic } from "@/server/config";

export const dynamic = "force-dynamic";

export default async function OportunidadesImobiliariasPage() {
  const contato = await getConfigJsonPublic("contato", DEFAULT_CONTATO);
  const [imoveis, parceirasRaw] = await Promise.all([
    safeFetch(() => fetchPublicImoveis(), [] as ImovelPublic[]),
    safeFetch(() => fetchPublicImobiliariasParceiras(), [] as Awaited<
      ReturnType<typeof fetchPublicImobiliariasParceiras>
    >),
  ]);
  const parceiras = parceirasRaw.map((p) => toImobiliariaPublic(p));
  const vitrineIndisponivel = imoveis.length === 0 && parceiras.length === 0;
  return (
    <>
      {vitrineIndisponivel ? (
        <p className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
          Oportunidades imobiliárias em configuração. Em breve novos imóveis — ou cadastre imobiliárias
          no admin após aplicar a migration{" "}
          <code className="text-amber-200">005_oportunidades_imobiliarias.sql</code> no Supabase.
        </p>
      ) : null}
      <ImoveisPublicClient
        imoveis={imoveis}
        parceiras={parceiras}
        whatsappFallback={contato.whatsappPrincipal || null}
      />
    </>
  );
}
