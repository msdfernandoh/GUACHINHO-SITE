import Link from "next/link";
import { LEAD_STATUS_SIMPLES_PARCEIRO } from "@/lib/parceiros/constants";
import { getLeadAreaParceiro, updateLeadAreaParceiroAction } from "../../actions";

export default async function AreaParceiroLeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  let result: Awaited<ReturnType<typeof getLeadAreaParceiro>> | null = null;
  let error: string | null = null;
  try {
    result = await getLeadAreaParceiro(id, sp.org ?? null);
  } catch (e) {
    error = e instanceof Error ? e.message : "Lead indisponível.";
  }

  if (error || !result) {
    return <p className="text-sm text-stone-600">{error}</p>;
  }

  const { session, lead, historico } = result;
  const orgQ = session.organizacaoAtivaId
    ? `?org=${encodeURIComponent(session.organizacaoAtivaId)}`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{String(lead.nome)}</h1>
        <Link href={`/area-parceiro/leads${orgQ}`} className="text-sm underline">
          Voltar aos leads
        </Link>
      </div>

      {session.permissoes.editarLeads ? (
        <form
          action={updateLeadAreaParceiroAction}
          className="space-y-3 rounded-lg border border-stone-200 bg-white p-5"
        >
          <input type="hidden" name="id" value={String(lead.id)} />
          <input type="hidden" name="org" value={session.organizacaoAtivaId ?? ""} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Nome
              <input
                name="nome"
                defaultValue={String(lead.nome ?? "")}
                required
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              WhatsApp
              <input
                name="whatsapp"
                defaultValue={String(lead.whatsapp ?? "")}
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              E-mail
              <input
                name="email"
                type="email"
                defaultValue={String(lead.email ?? "")}
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Status
              <select
                name="status"
                defaultValue={String(lead.status ?? "Novo")}
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              >
                {LEAD_STATUS_SIMPLES_PARCEIRO.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              Observações
              <textarea
                name="observacoes"
                rows={3}
                defaultValue={String(lead.observacoes ?? "")}
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
            </label>
          </div>
          <button type="submit" className="bg-stone-900 px-4 py-2 text-sm text-white">
            Salvar
          </button>
        </form>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-white p-5 text-sm">
          <p>WhatsApp: {String(lead.whatsapp ?? "—")}</p>
          <p>E-mail: {String(lead.email ?? "—")}</p>
          <p>Status: {String(lead.status ?? "—")}</p>
          <p className="mt-2 whitespace-pre-wrap">{String(lead.observacoes ?? "")}</p>
        </div>
      )}

      <div className="rounded-lg border border-stone-200 bg-white p-5">
        <p className="font-medium">Histórico básico</p>
        <ul className="mt-3 space-y-2 text-sm text-stone-600">
          {historico.length === 0 ? (
            <li>Sem eventos.</li>
          ) : (
            historico.map((h) => (
              <li key={String(h.id)}>
                {h.created_at ? new Date(String(h.created_at)).toLocaleString("pt-BR") : ""} —{" "}
                {String(h.descricao || h.acao)}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
