import {
  fetchPublicImobiliariasParceiras,
} from "@/app/admin/imobiliarias/actions";
import { fetchPublicImoveis } from "@/app/admin/imoveis/actions";
import { ImoveisPublicClient } from "@/components/public/imoveis-public-client";

export const dynamic = "force-dynamic";

export default async function OportunidadesImobiliariasPage() {
  const [imoveis, parceiras] = await Promise.all([
    fetchPublicImoveis(),
    fetchPublicImobiliariasParceiras(),
  ]);
  return <ImoveisPublicClient imoveis={imoveis} parceiras={parceiras} />;
}
