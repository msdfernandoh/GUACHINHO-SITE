import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProposta } from "../actions";
import { PropostaForm } from "@/components/admin/proposta-form";

export default async function PropostaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let proposta;
  try {
    proposta = await fetchProposta(id);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin/propostas" className="text-sm text-amber-600 hover:underline">
        ← Propostas
      </Link>
      <h1 className="text-2xl font-bold">Proposta</h1>
      {proposta.pdf_url ? (
        <p className="text-sm text-zinc-500">PDF: {proposta.pdf_url}</p>
      ) : (
        <p className="text-sm text-amber-600">pdf_url reservado — geração na Fase 3</p>
      )}
      <PropostaForm initial={proposta as Record<string, unknown>} />
    </div>
  );
}
