import {
  fetchPublicImobiliariasParceiras,
} from "@/app/admin/imobiliarias/actions";
import { fetchPublicImoveis } from "@/app/admin/imoveis/actions";
import { ImoveisPublicClient } from "@/components/public/imoveis-public-client";
import { toImobiliariaPublic } from "@/lib/imobiliarias/public-card-utils";
import { DEFAULT_CONTATO, getConfigJsonPublic } from "@/server/config";

export const dynamic = "force-dynamic";

export default async function OportunidadesImobiliariasPage() {
  const [imoveis, parceirasRaw, contato] = await Promise.all([
    fetchPublicImoveis(),
    fetchPublicImobiliariasParceiras(),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
  ]);
  const parceiras = parceirasRaw.map((p) => toImobiliariaPublic(p));
  return (
    <ImoveisPublicClient
      imoveis={imoveis}
      parceiras={parceiras}
      whatsappFallback={contato.whatsappPrincipal || null}
    />
  );
}
