"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  salvarAssinaturaPlatformAction,
  alterarStatusAssinaturaPlatformAction,
  type PlatformFormState,
} from "@/app/platform/assinaturas-actions";

type AssinaturaItem = {
  id: string;
  empresa_id: string;
  plano_id: string;
  status: string;
  usuarios_contratados: number;
  sites_parceiros_contratados: number;
  sites_dominio_proprio_contratados: number;
  valor_mensal: number | null;
  taxa_implantacao: number | null;
  valor_total_estimado: number;
  data_inicio: string | null;
  observacao: string | null;
  created_at: string;
  empresa?: { id: string; nome_fantasia: string; slug: string } | null;
  plano?: {
    id: string;
    nome: string;
    codigo: string;
    valor_mensal: number;
    max_sites_parceiros: number;
    max_sites_dominio_proprio: number;
  } | null;
};

type PlanoOption = {
  id: string;
  nome: string;
  codigo: string;
  status: string;
  valor_mensal: number;
  max_sites_parceiros: number;
  max_sites_dominio_proprio: number;
};

const initial: PlatformFormState = { status: "IDLE", message: "" };

export function AssinaturasListingClient({
  assinaturas,
  planosDisponiveis,
}: {
  assinaturas: AssinaturaItem[];
  planosDisponiveis: PlanoOption[];
}) {
  const [editItem, setEditItem] = useState<AssinaturaItem | null>(null);

  const [stateSave, actionSave, isPendingSave] = useActionState(salvarAssinaturaPlatformAction, initial);
  const [stateStatus, actionStatus, isPendingStatus] = useActionState(alterarStatusAssinaturaPlatformAction, initial);

  const totalAtivas = assinaturas.filter((a) => a.status === "ATIVA").length;
  const totalMrr = assinaturas
    .filter((a) => a.status === "ATIVA")
    .reduce((acc, a) => acc + Number(a.valor_total_estimado || a.valor_mensal || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Platform</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">Assinaturas SaaS</h1>
          <p className="mt-1 text-sm text-slate-500">
            Contratos ativos das Master Franquias, com plano vinculado, quotas contratadas e vigência.
          </p>
        </div>
      </div>

      {/* Feedbacks */}
      {stateSave.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs font-bold ${
            stateSave.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {stateSave.message}
        </p>
      )}
      {stateStatus.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs font-bold ${
            stateStatus.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {stateStatus.message}
        </p>
      )}

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-slate-500">Total de Assinaturas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{assinaturas.length}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-emerald-600">Assinaturas Ativas</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{totalAtivas}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-cyan-600">MRR Contratual Total</p>
          <p className="mt-2 text-2xl font-bold text-cyan-700">R$ {totalMrr.toFixed(2)}</p>
        </article>
      </section>

      {/* Tabela de Assinaturas */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="p-3">Master Franquia</th>
                <th className="p-3">Plano SaaS</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Usuários</th>
                <th className="p-3 text-center">Sites Parceiros</th>
                <th className="p-3 text-center">Domínios Próprios</th>
                <th className="p-3 text-right">Mensalidade Estimada</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {assinaturas.map((a) => {
                const isAtiva = a.status === "ATIVA";

                return (
                  <tr key={a.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      {a.empresa?.nome_fantasia || "Empresa não informada"}
                    </td>
                    <td className="p-3 font-semibold text-cyan-700 dark:text-cyan-400">
                      {a.plano?.nome || "Sem plano"}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          isAtiva
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold">{a.usuarios_contratados}</td>
                    <td className="p-3 text-center">{a.sites_parceiros_contratados}</td>
                    <td className="p-3 text-center">{a.sites_dominio_proprio_contratados}</td>
                    <td className="p-3 text-right font-mono font-bold text-cyan-700 dark:text-cyan-400">
                      R$ {Number(a.valor_total_estimado || a.valor_mensal || 0).toFixed(2)}/mês
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditItem(a)}
                          className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        >
                          Editar Quotas
                        </button>
                        <Link
                          href={`/platform/empresas/${a.empresa_id}`}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          Ver Empresa
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Editar Quotas da Assinatura */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Editar Assinatura SaaS</h3>
                <p className="text-xs text-slate-500">{editItem.empresa?.nome_fantasia}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form
              action={async (formData) => {
                await actionSave(formData);
                setEditItem(null);
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="id" value={editItem.id} />

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Plano SaaS:</label>
                <select
                  name="plano_id"
                  defaultValue={editItem.plano_id}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                >
                  {planosDisponiveis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (R$ {Number(p.valor_mensal || 0).toFixed(2)}/mês)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Status da Assinatura:</label>
                  <select
                    name="status"
                    defaultValue={editItem.status}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="ATIVA">Ativa</option>
                    <option value="RASCUNHO">Rascunho</option>
                    <option value="SUSPENSA">Suspensa</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Usuários Contratados:</label>
                  <input
                    name="usuarios_contratados"
                    type="number"
                    defaultValue={editItem.usuarios_contratados}
                    min={1}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Sites Parceiros Contratados:</label>
                  <input
                    name="sites_parceiros_contratados"
                    type="number"
                    defaultValue={editItem.sites_parceiros_contratados}
                    min={0}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Com Domínio Próprio:</label>
                  <input
                    name="sites_dominio_proprio_contratados"
                    type="number"
                    defaultValue={editItem.sites_dominio_proprio_contratados}
                    min={0}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Observação / Condição Comercial:</label>
                <textarea
                  name="observacao"
                  rows={2}
                  defaultValue={editItem.observacao ?? ""}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingSave}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingSave ? "Salvando..." : "Salvar Assinatura"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
