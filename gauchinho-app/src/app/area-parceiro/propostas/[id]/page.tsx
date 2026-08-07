import Link from "next/link";
import {
  gerarPdfPropostaAreaParceiroAction,
  getPdfUrlPropostaAreaParceiro,
  getPropostaAreaParceiro,
  updatePropostaAreaParceiroAction,
} from "../../actions";

export default async function AreaParceiroPropostaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  let result: Awaited<ReturnType<typeof getPropostaAreaParceiro>> | null = null;
  let error: string | null = null;
  let pdfUrl: string | null = null;
  try {
    result = await getPropostaAreaParceiro(id, sp.org ?? null);
  } catch (e) {
    error = e instanceof Error ? e.message : "Proposta indisponível.";
  }
  if (result) {
    try {
      pdfUrl = await getPdfUrlPropostaAreaParceiro(id, sp.org ?? null);
    } catch {
      pdfUrl = null;
    }
  }

  if (error || !result) {
    return <p className="text-sm text-stone-600">{error}</p>;
  }

  const { session, proposta, editavel } = result;
  const orgQ = session.organizacaoAtivaId
    ? `?org=${encodeURIComponent(session.organizacaoAtivaId)}`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{String(proposta.nome_cliente)}</h1>
          <p className="text-sm text-stone-600">Status: {String(proposta.status)}</p>
        </div>
        <Link href={`/area-parceiro/propostas${orgQ}`} className="text-sm underline">
          Voltar às propostas
        </Link>
      </div>

      {session.permissoes.editarPropostas && editavel ? (
        <form
          action={updatePropostaAreaParceiroAction}
          className="space-y-3 rounded-lg border border-stone-200 bg-white p-5"
        >
          <input type="hidden" name="id" value={String(proposta.id)} />
          <input type="hidden" name="org" value={session.organizacaoAtivaId ?? ""} />
          <input type="hidden" name="status" value={String(proposta.status ?? "Gerada")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Nome do cliente
              <input
                name="nome_cliente"
                defaultValue={String(proposta.nome_cliente ?? "")}
                required
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              WhatsApp
              <input
                name="whatsapp_cliente"
                defaultValue={String(proposta.whatsapp_cliente ?? "")}
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              E-mail
              <input
                name="email_cliente"
                type="email"
                defaultValue={String(proposta.email_cliente ?? "")}
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Tipo
              <input
                name="tipo_proposta"
                defaultValue={String(proposta.tipo_proposta ?? "")}
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Crédito
              <input
                name="valor_credito"
                type="number"
                step="0.01"
                defaultValue={proposta.valor_credito != null ? String(proposta.valor_credito) : ""}
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Prazo
              <input
                name="prazo"
                type="number"
                defaultValue={proposta.prazo != null ? String(proposta.prazo) : ""}
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Entrada
              <input
                name="entrada"
                type="number"
                step="0.01"
                defaultValue={proposta.entrada != null ? String(proposta.entrada) : ""}
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Parcela
              <input
                name="valor_parcela"
                type="number"
                step="0.01"
                defaultValue={proposta.valor_parcela != null ? String(proposta.valor_parcela) : ""}
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              Observações
              <textarea
                name="observacoes"
                rows={3}
                defaultValue={String(proposta.observacoes ?? "")}
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
          </div>
          <button type="submit" className="bg-stone-900 px-4 py-2 text-sm text-white">
            Salvar rascunho
          </button>
        </form>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-white p-5 text-sm space-y-1">
          {!editavel && (
            <p className="mb-3 text-amber-800">
              Proposta fora de rascunho — edição bloqueada na área parceiro.
            </p>
          )}
          <p>WhatsApp: {String(proposta.whatsapp_cliente ?? "—")}</p>
          <p>E-mail: {String(proposta.email_cliente ?? "—")}</p>
          <p>Crédito: {proposta.valor_credito != null ? String(proposta.valor_credito) : "—"}</p>
          <p className="whitespace-pre-wrap">{String(proposta.observacoes ?? "")}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {session.permissoes.editarPropostas && editavel && (
          <form action={gerarPdfPropostaAreaParceiroAction}>
            <input type="hidden" name="id" value={String(proposta.id)} />
            <input type="hidden" name="org" value={session.organizacaoAtivaId ?? ""} />
            <button type="submit" className="border border-stone-300 bg-white px-4 py-2 text-sm">
              Gerar / atualizar PDF
            </button>
          </form>
        )}
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="border border-stone-300 bg-white px-4 py-2 text-sm"
          >
            Baixar / visualizar PDF
          </a>
        )}
      </div>
    </div>
  );
}
