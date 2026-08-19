"use client";

import { useActionState, useState } from "react";
import {
  salvarOverridePlatformAction,
  excluirOverridePlatformAction,
  type PlatformFormState,
} from "@/app/platform/recursos-actions";

type OverrideItem = {
  id: string;
  empresa_id: string;
  recurso_codigo: string;
  efeito: "LIBERAR" | "BLOQUEAR";
  motivo: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  created_at: string;
  empresa?: { id: string; nome_fantasia: string; slug: string } | null;
};

type EmpresaOption = { id: string; nome_fantasia: string; slug: string };
type ModuloOption = { codigo: string; nome: string };

const initial: PlatformFormState = { status: "IDLE", message: "" };

export function RecursosOverridesClient({
  overrides,
  empresas,
  modulos,
}: {
  overrides: OverrideItem[];
  empresas: EmpresaOption[];
  modulos: ModuloOption[];
}) {
  const [modalNovo, setModalNovo] = useState(false);

  const [stateSave, actionSave, isPendingSave] = useActionState(salvarOverridePlatformAction, initial);
  const [stateDelete, actionDelete, isPendingDelete] = useActionState(excluirOverridePlatformAction, initial);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Platform</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">Liberações & Overrides</h1>
          <p className="mt-1 text-sm text-slate-500">
            Concessões pontuais e bloqueios excepcionais de módulos e recursos por Master Franquia.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalNovo(true)}
          className="rounded-lg bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-cyan-800"
        >
          + Novo Override
        </button>
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
      {stateDelete.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs font-bold ${
            stateDelete.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {stateDelete.message}
        </p>
      )}

      {/* Tabela de Overrides */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="p-3">Master Franquia</th>
                <th className="p-3">Recurso / Módulo</th>
                <th className="p-3 text-center">Efeito</th>
                <th className="p-3">Motivo da Liberação/Bloqueio</th>
                <th className="p-3">Vigência</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {overrides.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Nenhum override ativo cadastrado.
                  </td>
                </tr>
              ) : (
                overrides.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      {o.empresa?.nome_fantasia || "Empresa não informada"}
                    </td>
                    <td className="p-3 font-mono font-bold text-cyan-700 dark:text-cyan-400">
                      {o.recurso_codigo}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          o.efeito === "LIBERAR"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {o.efeito}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{o.motivo}</td>
                    <td className="p-3 text-[11px] text-slate-500">
                      De {new Date(o.vigencia_inicio).toLocaleDateString("pt-BR")}
                      {o.vigencia_fim ? ` até ${new Date(o.vigencia_fim).toLocaleDateString("pt-BR")}` : " (Indeterminado)"}
                    </td>
                    <td className="p-3 text-center">
                      <form action={actionDelete} className="inline">
                        <input type="hidden" name="id" value={o.id} />
                        <button
                          type="submit"
                          disabled={isPendingDelete}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remover
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Novo Override */}
      {modalNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Novo Override de Recurso</h3>
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
                await actionSave(formData);
                setModalNovo(false);
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Master Franquia:</label>
                <select
                  name="empresa_id"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Selecione a empresa...</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome_fantasia}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Recurso / Módulo:</label>
                  <select
                    name="recurso_codigo"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Selecione...</option>
                    {modulos.map((m) => (
                      <option key={m.codigo} value={m.codigo}>
                        {m.nome} ({m.codigo})
                      </option>
                    ))}
                    <option value="sites_parceiros">Sites de Parceiros</option>
                    <option value="dominios_proprios">Domínios Próprios</option>
                    <option value="limite_usuarios_extra">Usuários Extras</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Efeito:</label>
                  <select
                    name="efeito"
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="LIBERAR">LIBERAR</option>
                    <option value="BLOQUEAR">BLOQUEAR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Motivo / Justificativa *:</label>
                <textarea
                  name="motivo"
                  required
                  placeholder="Ex: Concessão comercial autorizada pela diretoria, teste de homologação"
                  rows={3}
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
                  disabled={isPendingSave}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingSave ? "Salvando..." : "Cadastrar Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
