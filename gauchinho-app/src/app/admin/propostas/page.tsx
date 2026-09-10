import Link from "next/link";
import { excluirPropostasEmLoteAction, fetchPropostasList } from "./actions";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { BulkArchiveSelection } from "@/components/erp/bulk-archive-selection";
import { MarcarPropostaContratadaButton } from "@/components/admin/marcar-proposta-contratada-button";
import { BaixarPropostaPdfButton } from "@/components/admin/baixar-proposta-pdf-button";
import { agruparPropostasPorClienteEData } from "@/lib/proposta/proposta-unificacao-service";

export default async function PropostasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; unificar?: string }>;
}) {
  const sp = await searchParams;
  const { rows, podeExcluirEmLote } = await fetchPropostasList(sp.status);
  const unificar = sp.unificar !== "0";

  const displayedRows = unificar
    ? agruparPropostasPorClienteEData(rows).map((g) => ({
        ...g.propostaPrincipal,
        _totalNoDia: g.totalNoDia,
      }))
    : rows.map((r) => ({ ...r, _totalNoDia: 1 }));

  const table = (
    <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="min-w-full text-sm">
        <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
          <tr>
            {podeExcluirEmLote && <th className="w-10 px-3 py-2"><span className="sr-only">Selecionar</span></th>}
            <th className="px-3 py-2">Data</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Crédito</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>{displayedRows.map((p) => <tr key={p.id} className="border-b dark:border-zinc-800">
          {podeExcluirEmLote && <td className="px-3 py-2"><input type="checkbox" name="ids" value={p.id} aria-label={`Selecionar proposta de ${p.nome_cliente ?? "cliente não informado"}`} /></td>}
          <td className="px-3 py-2">{formatDate(p.created_at)}</td>
          <td className="px-3 py-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.nome_cliente ?? "—"}</span>
              {p._totalNoDia > 1 && (
                <span
                  className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300"
                  title={`${p._totalNoDia} cotações geradas por este cliente nesta data`}
                >
                  {p._totalNoDia} no dia
                </span>
              )}
            </div>
            {p.whatsapp_cliente && (
              <div className="text-xs text-zinc-500">{p.whatsapp_cliente}</div>
            )}
          </td>
          <td className="px-3 py-2">{p.tipo_proposta ?? "—"}</td>
          <td className="px-3 py-2">{formatCurrency(Number(p.valor_credito))}</td>
          <td className="px-3 py-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              p.status === "Contratada"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : p.status === "Aprovada"
                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
            }`}>
              {p.status}
            </span>
          </td>
          <td className="px-3 py-2 text-right">
            <div className="flex items-center justify-end gap-2">
              <BaixarPropostaPdfButton propostaId={p.id} />
              <MarcarPropostaContratadaButton
                propostaId={p.id}
                contratacaoId={p.contratacao_id}
                contratacaoProtocolo={p.contratacao_protocolo}
                isContratada={p.status === "Contratada" || Boolean(p.contratacao_id)}
                origem="admin"
              />
              <Link href={`/admin/propostas/${p.id}`} className="rounded px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50 hover:underline dark:hover:bg-amber-950/40">
                Editar
              </Link>
            </div>
          </td>
        </tr>)}</tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Propostas</h1>
          <p className="text-sm text-zinc-500">Gestão integrada, unificação diária e download direto de PDF</p>
        </div>
        <Link href="/admin/propostas/nova">
          <Button>Nova proposta</Button>
        </Link>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Status</Label>
          <Input name="status" defaultValue={sp.status ?? ""} placeholder="Gerada, Enviada…" />
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            name="unificar"
            value="1"
            defaultChecked={unificar}
            className="rounded border-zinc-300"
          />
          Unificar por cliente e data
        </label>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
      </form>
      {podeExcluirEmLote ? <BulkArchiveSelection entityLabel="propostas" action={excluirPropostasEmLoteAction}>{table}</BulkArchiveSelection> : table}
    </div>
  );
}
