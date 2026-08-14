"use client";
import { useActionState, useState } from "react";
import {
  salvarEstrategiaLanceAction,
  type BidState,
} from "@/app/erp/lances/actions";
const initial: BidState = { ok: false, message: "" };
const field =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const money = (v: number | null) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export type BidRow = {
  id: string;
  numero_grupo: string;
  numero_cota: string | null;
  valor_credito: number;
  status: string;
  contemplada: boolean;
  clienteNome: string;
  clienteDocumento: string | null;
  administradoraNome: string;
  tipoNome: string;
  grupoCodigo: string;
  grupoLimite: number | null;
  estrategia: null | {
    lance_fixo_ativo: boolean;
    lance_fixo_percentual: number | null;
    lance_fixo_valor: number | null;
    lance_fixo_inicio: string | null;
    lance_fixo_fim: string | null;
    lance_livre_ativo: boolean;
    lance_livre_valor: number | null;
    lance_livre_percentual: number | null;
    lance_livre_inicio: string | null;
    lance_livre_fim: string | null;
    recurso_proprio_valor: number | null;
    lance_embutido_percentual: number | null;
    parcela_reduzida_ativa: boolean;
    observacoes: string | null;
    ativa: boolean;
  };
  historico: { created_at: string; motivo: string | null }[];
};
function badge(row: BidRow) {
  const today = new Date().toISOString().slice(0, 10);
  if (row.contemplada) return "CONTEMPLADA";
  if (!row.estrategia) return "SEM ESTRATÉGIA";
  const dates = [
    row.estrategia.lance_fixo_fim,
    row.estrategia.lance_livre_fim,
  ].filter(Boolean) as string[];
  if (dates.some((x) => x < today)) return "VENCIDO";
  if (
    dates.some(
      (x) =>
        x >= today &&
        x <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    )
  )
    return "VENCENDO";
  return row.estrategia.ativa ? "ATIVO" : "INATIVO";
}
export function BidStrategyTable({ rows }: { rows: BidRow[] }) {
  const [editing, setEditing] = useState<BidRow | null>(null);
  const [state, action, pending] = useActionState(
    salvarEstrategiaLanceAction,
    initial,
  );
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-[1200px] text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Cliente</th>
              <th>Grupo / Cota</th>
              <th>Administradora</th>
              <th>Tipo</th>
              <th>Crédito</th>
              <th>Status cota</th>
              <th>Lance fixo / validade</th>
              <th>Lance livre / validade</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3">
                  <strong>{row.clienteNome}</strong>
                  <br />
                  <span className="text-xs text-slate-500">
                    {row.clienteDocumento ?? "Sem documento"}
                  </span>
                </td>
                <td>
                  Grupo {row.grupoCodigo} / Cota {row.numero_cota ?? "pendente"}
                </td>
                <td>{row.administradoraNome}</td>
                <td>{row.tipoNome}</td>
                <td>{money(Number(row.valor_credito))}</td>
                <td>{row.status}</td>
                <td>
                  {row.estrategia?.lance_fixo_ativo
                    ? `${row.estrategia.lance_fixo_percentual ?? "—"}% · até ${row.estrategia.lance_fixo_fim ?? "aberta"}`
                    : "—"}
                </td>
                <td>
                  {row.estrategia?.lance_livre_ativo
                    ? `${money(row.estrategia.lance_livre_valor)} · até ${row.estrategia.lance_livre_fim ?? "aberta"}`
                    : "—"}
                </td>
                <td>
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold">
                    {badge(row)}
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => setEditing(row)}
                    className="font-semibold text-blue-700"
                  >
                    {row.estrategia
                      ? "Editar estratégia"
                      : "Configurar estratégia"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <form
          action={action}
          className="space-y-4 rounded-xl border border-blue-200 bg-white p-5"
        >
          <input type="hidden" name="cota_id" value={editing.id} />
          <input type="hidden" name="ativa" value="true" />
          <div className="flex justify-between">
            <div>
              <h2 className="font-bold">
                {editing.clienteNome} — Grupo {editing.grupoCodigo} / Cota{" "}
                {editing.numero_cota ?? "pendente"}
              </h2>
              <p className="text-sm text-slate-500">
                Limite do Grupo para lance embutido: {editing.grupoLimite ?? 0}%
              </p>
            </div>
            <button type="button" onClick={() => setEditing(null)}>
              Fechar
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <fieldset className="space-y-3 rounded-lg border p-4">
              <legend className="font-semibold">Lance fixo</legend>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  name="lance_fixo_ativo"
                  defaultChecked={editing.estrategia?.lance_fixo_ativo}
                />{" "}
                Ativo
              </label>
              <label className="text-sm">
                Percentual
                <input
                  className={field}
                  name="lance_fixo_percentual"
                  defaultValue={editing.estrategia?.lance_fixo_percentual ?? ""}
                />
              </label>
              <label className="text-sm">
                Valor
                <input
                  className={field}
                  name="lance_fixo_valor"
                  defaultValue={editing.estrategia?.lance_fixo_valor ?? ""}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={field}
                  type="date"
                  name="lance_fixo_inicio"
                  defaultValue={editing.estrategia?.lance_fixo_inicio ?? ""}
                />
                <input
                  className={field}
                  type="date"
                  name="lance_fixo_fim"
                  defaultValue={editing.estrategia?.lance_fixo_fim ?? ""}
                />
              </div>
            </fieldset>
            <fieldset className="space-y-3 rounded-lg border p-4">
              <legend className="font-semibold">Lance livre</legend>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  name="lance_livre_ativo"
                  defaultChecked={editing.estrategia?.lance_livre_ativo}
                />{" "}
                Ativo
              </label>
              <label className="text-sm">
                Valor
                <input
                  className={field}
                  name="lance_livre_valor"
                  defaultValue={editing.estrategia?.lance_livre_valor ?? ""}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={field}
                  type="date"
                  name="lance_livre_inicio"
                  defaultValue={editing.estrategia?.lance_livre_inicio ?? ""}
                />
                <input
                  className={field}
                  type="date"
                  name="lance_livre_fim"
                  defaultValue={editing.estrategia?.lance_livre_fim ?? ""}
                />
              </div>
            </fieldset>
            <label className="text-sm">
              Recurso próprio
              <input
                className={field}
                name="recurso_proprio_valor"
                defaultValue={editing.estrategia?.recurso_proprio_valor ?? ""}
              />
            </label>
            <label className="text-sm">
              Lance embutido (%)
              <input
                className={field}
                name="lance_embutido_percentual"
                defaultValue={
                  editing.estrategia?.lance_embutido_percentual ?? ""
                }
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="parcela_reduzida_ativa"
                defaultChecked={editing.estrategia?.parcela_reduzida_ativa}
              />{" "}
              Parcela reduzida aplicável
            </label>
            <label className="text-sm">
              Motivo da alteração
              <input className={field} name="motivo" />
            </label>
          </div>
          <label className="text-sm">
            Observações
            <textarea
              className={field}
              name="observacoes"
              defaultValue={editing.estrategia?.observacoes ?? ""}
            />
          </label>
          {editing.historico.length > 0 && (
            <details>
              <summary className="cursor-pointer font-semibold">
                Histórico ({editing.historico.length})
              </summary>
              <ul className="mt-2 text-sm">
                {editing.historico.map((h, i) => (
                  <li key={i}>
                    {h.created_at} · {h.motivo ?? "Alteração operacional"}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {state.message && (
            <p
              role="status"
              className={`rounded-lg p-3 ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
            >
              {state.message}
            </p>
          )}
          <button
            disabled={pending || editing.contemplada}
            className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-50"
          >
            {pending ? "Salvando..." : "Salvar estratégia"}
          </button>
          {editing.contemplada && (
            <p className="text-sm text-amber-700">
              Cota contemplada: estratégia encerrada operacionalmente. A
              contemplação continua no fluxo canônico da cota.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
