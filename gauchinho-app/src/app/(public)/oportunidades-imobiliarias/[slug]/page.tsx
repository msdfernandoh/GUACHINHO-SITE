import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { fetchImobiliariaBySlug } from "@/app/admin/imobiliarias/actions";
import { fetchPublicImoveis } from "@/app/admin/imoveis/actions";
import { ImovelCardInline } from "@/components/public/imovel-card-inline";

export const dynamic = "force-dynamic";

export default async function ImobiliariaPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const imob = await fetchImobiliariaBySlug(slug);
  if (!imob) notFound();

  const imoveis = await fetchPublicImoveis({ imobiliaria_id: imob.id });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {imob.banner_url && (
        <div className="relative h-48 w-full md:h-64">
          <Image src={imob.banner_url} alt="" fill className="object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
        </div>
      )}
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-start gap-6">
          {imob.logo_url && (
            <Image src={imob.logo_url} alt="" width={96} height={96} className="rounded-lg border border-zinc-700" />
          )}
          <div>
            <h1 className="text-3xl font-bold text-white">{imob.nome}</h1>
            {imob.cidade && <p className="text-zinc-400">{imob.cidade}</p>}
            {imob.descricao && <p className="mt-4 max-w-2xl text-zinc-300">{imob.descricao}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              {imob.whatsapp && (
                <a
                  href={`https://wa.me/${imob.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
                >
                  WhatsApp
                </a>
              )}
              {imob.site && (
                <a href={imob.site} target="_blank" rel="noreferrer" className="text-amber-400 underline">
                  Site
                </a>
              )}
            </div>
          </div>
        </div>
        <h2 className="mt-12 text-xl font-semibold text-amber-400">Imóveis</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {imoveis.map((i) => (
            <ImovelCardInline key={i.id} imovel={i} />
          ))}
        </div>
        <Link href="/oportunidades-imobiliarias" className="mt-10 inline-block text-sm text-zinc-400 hover:text-amber-400">
          ← Todas as oportunidades
        </Link>
      </div>
    </div>
  );
}
