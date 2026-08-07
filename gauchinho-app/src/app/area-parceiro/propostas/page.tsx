import Link from "next/link";
import { createPropostaAreaParceiroAction, listPropostasAreaParceiro } from "../actions";

export default async function AreaParceiroPropostasPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const sp = await searchParams;
  const org = sp.org ?? null;
  let result: Awaited<ReturnType<typeof listPropostasAreaParceiro>> | null = null;
  let error: string | null = null;
  try {
    result = await listPropostasAreaParceiro(org);
  } catch (e) {
    error = e instanceof Error ? e.message : "Erro ao listar propostas.";
  }

  if (error || !result) {
    return <p className="text-sm text-stone-600">{error}</p>;
  }

  const { session, rows } = result;
  const orgQ = session.organizacaoAtivaId
    ? `?org=${encodeURIComponent(session.organizacaoAtivaId)}`
    : "";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Propostas</h1>
          <p className="text-sm text-stone-600">
            Edição apenas em status Gerada / PDF gerado (equivalente a rascunho).
          </p>
        </div>
        <Link href={`/area-parceiro${orgQ}`} className="text-sm underline">
          Voltar
        </Link>
      </div>

      {session.permissoes.criarPropostas && session.organizacaoAtivaId && (
        <form
          action={createPropostaAreaParceiroAction}
          className="space-y-3 rounded-lg border border-stone-200 bg-white p-5"
        >
          <p className="font-medium">Nova proposta</p>
          <input type="hidden" name="org" value={session.organizacaoAtivaId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Nome do cliente
              <input
                name="nome_cliente"
                required
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              WhatsApp
              <input name="whatsapp_cliente" className="mt-1 w-full border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              E-mail
              <input
                name="email_cliente"
                type="email"
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Tipo
              <input name="tipo_proposta" className="mt-1 w-full border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              Crédito
              <input
                name="valor_credito"
                type="number"
                step="0.01"
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Prazo
              <input name="prazo" type="number" className="mt-1 w-full border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              Lead ID (opcional)
              <input name="lead_id" className="mt-1 w-full border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-sm sm:col-span-2">
              Observações
              <textarea name="observacoes" rows={2} className="mt-1 w-full border border-stone-300 px-3 py-2" />
            </label>
          </div>
          <button type="submit" className="bg-stone-900 px-4 py-2 text-sm text-white">
            Criar proposta
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Crédito</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Criada</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-stone-500">
                  Nenhuma proposta no escopo.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={String(p.id)} className="border-t border-stone-100">
                  <td className="px-3 py-2">
                    <Link
                      href={`/area-parceiro/propostas/${p.id}${orgQ}`}
                      className="font-medium underline"
                    >
                      {String(p.nome_cliente ?? "—")}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {p.valor_credito != null ? String(p.valor_credito) : "—"}
                  </td>
                  <td className="px-3 py-2">{String(p.status ?? "—")}</td>
                  <td className="px-3 py-2">
                    {p.created_at
                      ? new Date(String(p.created_at)).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
