"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  criarPlanoPlatformAction,
  duplicarPlanoPlatformAction,
  type PlatformFormState,
} from "@/app/platform/planos-actions";

export type PlanoListItem = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  status: string;
  valor_mensal: number;
  taxa_implantacao: number;
  limite_usuarios: number;
  erp_incluido: boolean;
  site_principal_incluido: boolean;
  permite_sites_parceiros: boolean;
  max_parceiros: number;
  max_sites_parceiros: number;
  max_sites_dominio_proprio: number;
  valor_site_parceiro: number;
  valor_site_dominio_proprio: number;
  disponivel_novas_assinaturas: boolean;
  categoria: string;
  modulos_nomes: string[];
  assinantes_ativos: number;
  mrr_estimado: number;
};

const initial: PlatformFormState = { status: "IDLE", message: "" };

export function PlanosListingClient({ planos }: { planos: PlanoListItem[] }) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroErp, setFiltroErp] = useState("TODOS");

  const [modalNovo, setModalNovo] = useState(false);
  const [duplicarItem, setDuplicarItem] = useState<PlanoListItem | null>(null);

  const [stateNovo, actionNovo, isPendingNovo] = useActionState(criarPlanoPlatformAction, initial);
  const [stateDuplicar, actionDuplicar, isPendingDuplicar] = useActionState(duplicarPlanoPlatformAction, initial);

  const filtrados = planos.filter((p) => {
    const matchBusca =
      !busca ||
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.codigo.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "TODOS" || p.status === filtroStatus;
    const matchErp =
      filtroErp === "TODOS" ||
      (filtroErp === "SIM" && p.erp_incluido) ||
      (filtroErp === "NAO" && !p.erp_incluido);
    return matchBusca && matchStatus && matchErp;
  });

  const totalPlanos = planos.length;
  const totalAtivos = planos.filter((p) => p.status === "ATIVO").length;
  const totalAssinantes = planos.reduce((acc, p) => acc + p.assinantes_ativos, 0);
  const mrrGlobal = planos.reduce((acc, p) => acc + p.mrr_estimado, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Plataforma SaaS</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">Planos SaaS</h1>
          <p className="mt-1 text-sm text-slate-500">
            Catálogo comercial e operacional de planos com entitlements de ERP, Usuários, Sites de Parceiros e Precificação.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalNovo(true)}
          className="rounded-lg bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-cyan-800 transition-colors"
        >
          + Novo Plano
        </button>
      </div>

      {/* Feedbacks */}
      {[stateNovo, stateDuplicar].map((st, i) =>
        st.message ? (
          <p
            key={i}
            role="status"
            className={`rounded-lg p-3 text-xs font-bold ${
              st.status === "SUCCESS"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
            }`}
          >
            {st.message}
          </p>
        ) : null,
      )}

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-slate-500">Total de Planos</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalPlanos}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-emerald-600">Planos Ativos</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{totalAtivos}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-cyan-600">Master Franquias Assinantes</p>
          <p className="mt-2 text-2xl font-bold text-cyan-700">{totalAssinantes}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-slate-400">MRR Contratual Estimado</p>
          <p className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-200">
            R$ {mrrGlobal.toFixed(2)}
          </p>
        </article>
      </section>

      {/* Filtros */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Buscar Plano:</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome ou código do plano..."
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Status:</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="ATIVO">Ativo</option>
              <option value="RASCUNHO">Rascunho</option>
              <option value="INATIVO">Inativo</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Módulos ERP:</label>
            <select
              value={filtroErp}
              onChange={(e) => setFiltroErp(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todos</option>
              <option value="SIM">Com ERP Incluso</option>
              <option value="NAO">Sem ERP</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Planos */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="p-3">Plano & Código</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Mensalidade Base</th>
                <th className="p-3 text-center">ERP</th>
                <th className="p-3 text-center">Usuários</th>
                <th className="p-3 text-center">Parceiros</th>
                <th className="p-3 text-center">Sites Parceiros</th>
                <th className="p-3 text-center">Domínios Próprios</th>
                <th className="p-3 text-right">Valor por Site</th>
                <th className="p-3 text-center">Assinantes</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 font-medium">
                    Nenhum plano encontrado com os filtros informados.
                  </td>
                </tr>
              ) : (
                filtrados.map((p) => {
                  const isAtivo = p.status === "ATIVO";
                  const isRascunho = p.status === "RASCUNHO";

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3">
                        <Link href={`/platform/planos/${p.id}`} className="font-bold text-slate-900 dark:text-white hover:underline">
                          {p.nome}
                        </Link>
                        <div className="font-mono text-[11px] text-slate-400">{p.codigo}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                            isAtivo
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : isRascunho
                              ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-cyan-700 dark:text-cyan-400">
                        R$ {Number(p.valor_mensal || 0).toFixed(2)}/mês
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            p.erp_incluido
                              ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                          }`}
                        >
                          {p.erp_incluido ? `${p.modulos_nomes.length} módulos` : "Sem ERP"}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">
                        {p.limite_usuarios}
                      </td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-400 font-medium">
                        {p.permite_sites_parceiros ? `${p.max_parceiros}` : "—"}
                      </td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-400 font-medium">
                        {p.permite_sites_parceiros ? `${p.max_sites_parceiros}` : "—"}
                      </td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-400 font-medium">
                        {p.permite_sites_parceiros ? `${p.max_sites_dominio_proprio}` : "—"}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {p.permite_sites_parceiros && p.valor_site_parceiro > 0
                          ? `R$ ${Number(p.valor_site_parceiro).toFixed(2)}`
                          : "Incluso"}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-900 dark:text-white">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                          {p.assinantes_ativos}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDuplicarItem(p)}
                            className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                          >
                            📋 Duplicar
                          </button>
                          <Link
                            href={`/platform/planos/${p.id}`}
                            className="rounded bg-cyan-700 px-2.5 py-1 text-xs font-bold text-white shadow hover:bg-cyan-800"
                          >
                            Gerenciar →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Novo Plano */}
      {modalNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Novo Plano SaaS</h3>
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
                <label className="font-bold text-slate-700 dark:text-slate-300">Nome do Plano *:</label>
                <input
                  name="nome"
                  placeholder="Ex: Plano Enterprise Master, Plano Start"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Valor Mensal Base (R$):</label>
                  <input
                    name="valor_mensal"
                    type="number"
                    step="0.01"
                    defaultValue="999.00"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-bold text-cyan-700 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Limite Base de Usuários:</label>
                  <input
                    name="limite_usuarios"
                    type="number"
                    defaultValue="10"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="erp_incluido" value="true" defaultChecked className="h-4 w-4 rounded text-cyan-600" />
                  <span className="font-semibold">ERP Incluído</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="permite_sites_parceiros" value="true" defaultChecked className="h-4 w-4 rounded text-cyan-600" />
                  <span className="font-semibold">Sites de Parceiros</span>
                </label>
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
                  {isPendingNovo ? "Criando..." : "Criar Plano em Rascunho"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Duplicar */}
      {duplicarItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Duplicar Plano SaaS</h3>
              <button
                type="button"
                onClick={() => setDuplicarItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form
              action={async (formData) => {
                await actionDuplicar(formData);
                setDuplicarItem(null);
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="plano_id" value={duplicarItem.id} />
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Novo Nome para a Cópia:</label>
                <input
                  name="novo_nome"
                  defaultValue={`${duplicarItem.nome} (Cópia)`}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                A cópia será criada no status <strong>RASCUNHO</strong> clonando todos os módulos e limites.
              </p>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDuplicarItem(null)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingDuplicar}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingDuplicar ? "Duplicando..." : "Duplicar Plano"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
