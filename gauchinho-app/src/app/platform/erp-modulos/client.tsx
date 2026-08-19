"use client";

import { useActionState, useState } from "react";
import {
  salvarModuloCatalogoPlatformAction,
  toggleStatusModuloPlatformAction,
  criarModuloCatalogoPlatformAction,
  type PlatformFormState,
} from "@/app/platform/erp-modulos-actions";

type ModuloItem = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  status: string;
  estado_produto: string;
  ordem_padrao: number;
  dependencias: string[];
  categoria: string;
  updated_at: string;
};

const initial: PlatformFormState = { status: "IDLE", message: "" };

export function ErpModulosListingClient({ modulos }: { modulos: ModuloItem[] }) {
  const [editItem, setEditItem] = useState<ModuloItem | null>(null);
  const [modalNovo, setModalNovo] = useState(false);

  const [stateSave, actionSave, isPendingSave] = useActionState(salvarModuloCatalogoPlatformAction, initial);
  const [stateToggle, actionToggle, isPendingToggle] = useActionState(toggleStatusModuloPlatformAction, initial);
  const [stateNovo, actionNovo, isPendingNovo] = useActionState(criarModuloCatalogoPlatformAction, initial);

  const totalAtivos = modulos.filter((m) => m.status === "ATIVO").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Platform</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">Catálogo Global ERP</h1>
          <p className="mt-1 text-sm text-slate-500">
            Catálogo mestre de módulos operacionais consumidos pelos Planos SaaS e Master Franquias.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalNovo(true)}
          className="rounded-lg bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-cyan-800"
        >
          + Novo Módulo
        </button>
      </div>

      {/* Feedbacks */}
      {stateNovo.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs font-bold ${
            stateNovo.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {stateNovo.message}
        </p>
      )}


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
      {stateToggle.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs font-bold ${
            stateToggle.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {stateToggle.message}
        </p>
      )}

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-slate-500">Total de Módulos</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{modulos.length}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-emerald-600">Módulos Ativos</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{totalAtivos}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-cyan-600">Categorias de Negócio</p>
          <p className="mt-2 text-2xl font-bold text-cyan-700">5 Categorias</p>
        </article>
      </section>

      {/* Tabela de Módulos */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="p-3">Ordem</th>
                <th className="p-3">Módulo & Código</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Dependências</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {modulos.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-mono font-bold text-slate-500">{m.ordem_padrao}</td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900 dark:text-white">{m.nome}</div>
                    <div className="font-mono text-[11px] text-slate-400">{m.codigo}</div>
                  </td>
                  <td className="p-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {m.categoria}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                    {m.descricao || "—"}
                  </td>
                  <td className="p-3">
                    {m.dependencias?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {m.dependencias.map((d) => (
                          <span
                            key={d}
                            className="rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">Nenhuma</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <form action={actionToggle} className="inline">
                      <input type="hidden" name="id" value={m.id} />
                      <input type="hidden" name="status" value={m.status === "ATIVO" ? "INATIVO" : "ATIVO"} />
                      <button
                        type="submit"
                        disabled={isPendingToggle}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          m.status === "ATIVO"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                        }`}
                      >
                        {m.status}
                      </button>
                    </form>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => setEditItem(m)}
                      className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Editar Módulo */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Editar Módulo do Catálogo</h3>
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
                <label className="font-bold text-slate-700 dark:text-slate-300">Nome do Módulo:</label>
                <input
                  name="nome"
                  defaultValue={editItem.nome}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Código Técnico:</label>
                <input
                  defaultValue={editItem.codigo}
                  disabled
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 p-2.5 text-xs font-mono text-slate-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Categoria:</label>
                  <select
                    name="categoria"
                    defaultValue={editItem.categoria}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="OPERACIONAL">Operacional</option>
                    <option value="CRM">CRM</option>
                    <option value="COMERCIAL">Comercial</option>
                    <option value="FINANCEIRO">Financeiro</option>
                    <option value="GESTAO">Gestão</option>
                    <option value="SISTEMA">Sistema</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Ordem de Exibição:</label>
                  <input
                    name="ordem_padrao"
                    type="number"
                    defaultValue={editItem.ordem_padrao}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Descrição:</label>
                <textarea
                  name="descricao"
                  rows={3}
                  defaultValue={editItem.descricao ?? ""}
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
                  {isPendingSave ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Novo Módulo */}
      {modalNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">+ Novo Módulo no Catálogo</h3>
              <button
                type="button"
                onClick={() => setModalNovo(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form
              action={async (formData) => {
                await actionNovo(formData);
                setModalNovo(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Nome do Módulo:</label>
                <input
                  name="nome"
                  required
                  placeholder="Ex: Auditoria Operacional"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Código Técnico (Opcional - gerado automático):</label>
                <input
                  name="codigo"
                  placeholder="Ex: auditoria_operacional"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Categoria:</label>
                  <select
                    name="categoria"
                    defaultValue="OPERACIONAL"
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="OPERACIONAL">Operacional</option>
                    <option value="CRM">CRM</option>
                    <option value="COMERCIAL">Comercial</option>
                    <option value="FINANCEIRO">Financeiro</option>
                    <option value="GESTAO">Gestão</option>
                    <option value="SISTEMA">Sistema</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Ordem de Exibição:</label>
                  <input
                    name="ordem_padrao"
                    type="number"
                    defaultValue={modulos.length + 1}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Descrição:</label>
                <textarea
                  name="descricao"
                  rows={3}
                  placeholder="Finalidade e governança deste módulo no ERP."
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalNovo(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingNovo}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingNovo ? "Cadastrando..." : "Cadastrar Módulo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

