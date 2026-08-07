import Link from "next/link";
import { LEAD_STATUS_SIMPLES_PARCEIRO } from "@/lib/parceiros/constants";
import { createLeadAreaParceiroAction, listLeadsAreaParceiro } from "../actions";

export default async function AreaParceiroLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const sp = await searchParams;
  const org = sp.org ?? null;
  let result: Awaited<ReturnType<typeof listLeadsAreaParceiro>> | null = null;
  let error: string | null = null;
  try {
    result = await listLeadsAreaParceiro(org);
  } catch (e) {
    error = e instanceof Error ? e.message : "Erro ao listar leads.";
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
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-stone-600">Escopo da organização ativa.</p>
        </div>
        <Link href={`/area-parceiro${orgQ}`} className="text-sm underline">
          Voltar
        </Link>
      </div>

      {session.permissoes.criarLeads && session.organizacaoAtivaId && (
        <form
          action={createLeadAreaParceiroAction}
          className="space-y-3 rounded-lg border border-stone-200 bg-white p-5"
        >
          <p className="font-medium">Novo lead</p>
          <input type="hidden" name="org" value={session.organizacaoAtivaId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Nome
              <input name="nome" required className="mt-1 w-full border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              WhatsApp
              <input name="whatsapp" className="mt-1 w-full border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-sm">
              E-mail
              <input name="email" type="email" className="mt-1 w-full border border-stone-300 px-3 py-2" />
            </label>
            <label className="text-sm sm:col-span-2">
              Observações
              <textarea name="observacoes" rows={2} className="mt-1 w-full border border-stone-300 px-3 py-2" />
            </label>
          </div>
          <button type="submit" className="bg-stone-900 px-4 py-2 text-sm text-white">
            Criar lead
          </button>
          <p className="text-xs text-stone-500">
            Status inicial: Novo. Status permitidos: {LEAD_STATUS_SIMPLES_PARCEIRO.join(", ")}.
          </p>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">WhatsApp</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Criado</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-stone-500">
                  Nenhum lead no escopo.
                </td>
              </tr>
            ) : (
              rows.map((lead) => (
                <tr key={String(lead.id)} className="border-t border-stone-100">
                  <td className="px-3 py-2">
                    <Link
                      href={`/area-parceiro/leads/${lead.id}${orgQ}`}
                      className="font-medium underline"
                    >
                      {String(lead.nome)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{String(lead.whatsapp ?? "—")}</td>
                  <td className="px-3 py-2">{String(lead.status ?? "—")}</td>
                  <td className="px-3 py-2">
                    {lead.created_at
                      ? new Date(String(lead.created_at)).toLocaleDateString("pt-BR")
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
