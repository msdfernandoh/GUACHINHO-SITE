import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventoSorteioPublicForm } from "@/components/public/eventos/evento-sorteio-public-form";
import { fetchPublicSorteioByEventoSlug } from "@/lib/eventos-sorteio/public";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EventoSorteioPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sorteio = await fetchPublicSorteioByEventoSlug(slug);
  if (!sorteio) notFound();

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-10">
      <EventoSorteioPublicForm sorteio={sorteio} />
      <p className="mt-6 text-center text-xs text-slate-500">Sorteio de brindes</p>
    </main>
  );
}
