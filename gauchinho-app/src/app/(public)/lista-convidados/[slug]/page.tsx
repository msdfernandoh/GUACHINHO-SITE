import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ListaConvidadosPublicForm } from "@/components/public/lista-convidados-public-form";
import { fetchPublicListaConvidadosBySlug } from "@/lib/comercial-eventos/listas-convidados-public";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ListaConvidadosPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lista = await fetchPublicListaConvidadosBySlug(slug);
  if (!lista) notFound();

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-12">
      <ListaConvidadosPublicForm lista={lista} />
      <p className="mt-6 text-center text-xs text-slate-500">
        Lista de convites do consultor
      </p>
    </main>
  );
}
