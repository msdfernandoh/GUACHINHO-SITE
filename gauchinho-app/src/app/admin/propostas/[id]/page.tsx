import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProposta } from "../actions";
import { PropostaForm } from "@/components/admin/proposta-form";
import { PropostaPdfToolbar } from "@/components/admin/proposta-pdf-toolbar";
import { formatCurrency, formatDate } from "@/lib/utils/format";

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

  const p = proposta as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/propostas" className="text-sm text-amber-600 hover:underline">
        ← Propostas
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{String(p.nome_cliente ?? "Proposta")}</h1>
        <p className="text-sm text-zinc-500">
          {String(p.tipo_proposta ?? "")} · {String(p.status ?? "")} · {formatDate(String(p.created_at))}
        </p>
        {p.lead_id ? (
          <Link href={`/admin/leads/${p.lead_id}`} className="text-sm text-amber-600 hover:underline">
            Ver lead vinculado
          </Link>
        ) : null}
      </div>

      <PropostaPdfToolbar
        propostaId={id}
        pdfUrl={(p.pdf_url as string) ?? null}
        defaults={{
          consultor_nome: p.consultor_nome as string,
          consultor_telefone: p.consultor_telefone as string,
          consultor_email: p.consultor_email as string,
          parceiro_nome: p.parceiro_nome as string,
          validade_dias: p.validade_dias as number,
          validade_data: p.validade_data as string,
          nome_cliente: p.nome_cliente as string,
        }}
      />

      <div className="rounded-xl border bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 font-semibold">Resumo</h2>
        <p>Crédito: {formatCurrency(Number(p.valor_credito))}</p>
        <p>Parcela: {formatCurrency(Number(p.valor_parcela))}</p>
        <p>Prazo: {String(p.prazo ?? "—")} meses</p>
        {p.parceiro_nome ? <p>Parceiro: {String(p.parceiro_nome)}</p> : null}
      </div>

      <PropostaForm initial={proposta as Record<string, unknown>} />
    </div>
  );
}
