import type { Metadata } from "next";
import Link from "next/link";
import { eventoSplAtivoSlug } from "@/lib/spl/evento-checkin";
import { fetchPublicSorteioByEventoSlug } from "@/lib/eventos-sorteio/public";
import { SplEventoCheckinServer } from "@/components/spl/spl-evento-checkin-server";
import { SplHeader } from "@/components/spl/spl-ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Pesquisa, Sorteio e Desafio · Chaves para o Futuro" },
  robots: { index: false, follow: false },
};

export default async function SplEventoPage() {
  const slug = await eventoSplAtivoSlug();
  const sorteio = slug ? await fetchPublicSorteioByEventoSlug(slug, { requirePublicado: false }) : null;
  return (
    <div className="min-h-screen bg-[#06101F]">
      <SplHeader
        direita={
          <Link href="/spl" className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-bold text-white">
            Voltar ao site
          </Link>
        }
      />
      <main className="px-4">
        {sorteio ? (
          <SplEventoCheckinServer eventoId={sorteio.eventoId} eventoNome={sorteio.eventoNome} />
        ) : (
          <div className="mx-auto max-w-lg py-24 text-center text-white">
            <p className="text-2xl font-black">Check-in fechado</p>
            <p className="mt-2 text-white/70">O check-in do encontro abre no dia do evento.</p>
          </div>
        )}
      </main>
    </div>
  );
}
