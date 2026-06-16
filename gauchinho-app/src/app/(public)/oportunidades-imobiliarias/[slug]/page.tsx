import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { fetchImobiliariaBySlug } from "@/app/admin/imobiliarias/actions";
import { fetchPublicImoveis } from "@/app/admin/imoveis/actions";
import { ImovelCardInline } from "@/components/public/imovel-card-inline";
import { ImobiliariaPublicCard } from "@/components/public/imobiliaria-public-card";
import { toImobiliariaPublic } from "@/lib/imobiliarias/public-card-utils";
import { DEFAULT_CONTATO, getConfigJsonPublic } from "@/server/config";

export const dynamic = "force-dynamic";

export default async function ImobiliariaPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [imob, contato] = await Promise.all([
    fetchImobiliariaBySlug(slug),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
  ]);
  if (!imob) notFound();

  const imoveis = await fetchPublicImoveis({ imobiliaria_id: imob.id });
  const profile = toImobiliariaPublic(imob);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {imob.banner_url && (
        <div className="relative h-40 w-full md:h-56">
          <Image src={imob.banner_url} alt="" fill className="object-cover opacity-70" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
        </div>
      )}
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        <ImobiliariaPublicCard
          imob={profile}
          variant="hero"
          imoveisCount={imoveis.length}
          whatsappFallback={contato.whatsappPrincipal || null}
          className={imob.banner_url ? "-mt-16 relative z-10 md:-mt-20" : undefined}
        />
        <h2 className="mt-12 text-xl font-semibold text-amber-400">Imóveis desta imobiliária</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {imoveis.map((i) => (
            <ImovelCardInline key={i.id} imovel={i} />
          ))}
        </div>
        {imoveis.length === 0 ? (
          <p className="mt-8 text-center text-zinc-500">Nenhum imóvel publicado no momento.</p>
        ) : null}
        <Link
          href="/oportunidades-imobiliarias"
          className="mt-10 inline-block text-sm text-zinc-400 hover:text-amber-400"
        >
          ← Todas as oportunidades
        </Link>
      </div>
    </div>
  );
}
