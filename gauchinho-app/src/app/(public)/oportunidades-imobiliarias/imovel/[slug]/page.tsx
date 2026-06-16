import { notFound } from "next/navigation";
import { fetchPublicImovelBySlug, registrarImovelVisualizado } from "@/app/admin/imoveis/actions";
import { ImovelDetalheClient } from "@/components/public/imovel-detalhe-client";
import { DEFAULT_CONTATO, getConfigJsonPublic } from "@/server/config";

export const dynamic = "force-dynamic";

export default async function ImovelPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [imovel, contato] = await Promise.all([
    fetchPublicImovelBySlug(slug),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
  ]);
  if (!imovel) notFound();
  await registrarImovelVisualizado(imovel.id, `/oportunidades-imobiliarias/imovel/${slug}`);
  return (
    <ImovelDetalheClient
      imovel={imovel}
      imobiliaria={imovel.imobiliaria ?? null}
      whatsappFallback={contato.whatsappPrincipal || null}
    />
  );
}
