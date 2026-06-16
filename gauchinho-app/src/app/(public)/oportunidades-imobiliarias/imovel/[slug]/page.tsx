import { notFound } from "next/navigation";
import { fetchPublicImovelBySlug, registrarImovelVisualizado } from "@/app/admin/imoveis/actions";
import { ImovelDetalheClient } from "@/components/public/imovel-detalhe-client";

export const dynamic = "force-dynamic";

export default async function ImovelPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const imovel = await fetchPublicImovelBySlug(slug);
  if (!imovel) notFound();
  await registrarImovelVisualizado(imovel.id, `/oportunidades-imobiliarias/imovel/${slug}`);
  return <ImovelDetalheClient imovel={imovel} />;
}
