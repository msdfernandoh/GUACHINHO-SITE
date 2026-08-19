"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  criarModeloSitePlatformAction,
  duplicarModeloSitePlatformAction,
  type PlatformFormState,
} from "@/app/platform/templates-actions";

type ModeloItem = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  status: string;
  versao: number;
  identidade_visual?: {
    cor_primaria?: string;
    cor_secundaria?: string;
    cor_destaque?: string;
    cor_fundo?: string;
  };
  catalogo_menus?: unknown[];
  secoes_home?: unknown[];
  permite_logo_propria?: boolean;
  updated_at?: string;
};

const initial: PlatformFormState = { status: "IDLE", message: "" };

export function TemplatesListingClient({ modelos }: { modelos: ModeloItem[] }) {
  const [modalNovo, setModalNovo] = useState(false);
  const [duplicarItem, setDuplicarItem] = useState<ModeloItem | null>(null);

  const [stateNovo, actionNovo, isPendingNovo] = useActionState(criarModeloSitePlatformAction, initial);
  const [stateDuplicar, actionDuplicar, isPendingDuplicar] = useActionState(duplicarModeloSitePlatformAction, initial);

  const totalPublicados = modelos.filter((m) => m.status === "PUBLICADO").length;
  const totalRascunhos = modelos.filter((m) => m.status === "RASCUNHO").length;
  const totalInativos = modelos.filter((m) => m.status === "INATIVO").length;

  return (
    <div className="space-y-6">
      {/* Header e Ações */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Platform</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">Modelos de Site</h1>
          <p className="mt-1 text-sm text-slate-500">
            Catálogo global de templates de site com temas, tokens de cores, menus, seções e preview seguro.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalNovo(true)}
          className="rounded-lg bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-cyan-800"
        >
          + Novo Modelo de Site
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
      {stateDuplicar.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs font-bold ${
            stateDuplicar.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {stateDuplicar.message}
        </p>
      )}

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-slate-500">Total de Modelos</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{modelos.length}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-emerald-600">Publicados (Em Uso)</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{totalPublicados}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-amber-600">Rascunhos</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{totalRascunhos}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-slate-400">Inativos</p>
          <p className="mt-2 text-2xl font-bold text-slate-600 dark:text-slate-300">{totalInativos}</p>
        </article>
      </section>

      {/* Grid de Modelos */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {modelos.map((m) => {
          const prim = m.identidade_visual?.cor_primaria || "#0284c7";
          const sec = m.identidade_visual?.cor_secundaria || "#0f172a";
          const dest = m.identidade_visual?.cor_destaque || "#f59e0b";
          const isPub = m.status === "PUBLICADO";
          const isRasc = m.status === "RASCUNHO";

          return (
            <div
              key={m.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{m.nome}</h3>
                    <p className="text-xs font-mono text-slate-400">{m.codigo}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      isPub
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : isRasc
                          ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {m.status} · v{m.versao}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                  {m.descricao || "Sem descrição informada."}
                </p>

                {/* Paleta de Cores em Miniatura */}
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-[11px] font-semibold text-slate-500">Paleta:</span>
                  <div className="flex items-center gap-1.5">
                    <span
                      style={{ backgroundColor: prim }}
                      className="h-5 w-5 rounded-full border border-white shadow-sm"
                      title={`Primária: ${prim}`}
                    />
                    <span
                      style={{ backgroundColor: sec }}
                      className="h-5 w-5 rounded-full border border-white shadow-sm"
                      title={`Secundária: ${sec}`}
                    />
                    <span
                      style={{ backgroundColor: dest }}
                      className="h-5 w-5 rounded-full border border-white shadow-sm"
                      title={`Destaque: ${dest}`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium pt-1">
                  <span>{m.catalogo_menus?.length ?? 0} menus</span>
                  <span>·</span>
                  <span>{m.secoes_home?.length ?? 0} seções</span>
                  <span>·</span>
                  <span>{m.permite_logo_propria ? "Logo própria: Sim" : "Logo padrão"}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDuplicarItem(m)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  📋 Duplicar
                </button>

                <Link
                  href={`/platform/templates/${m.id}`}
                  className="rounded-lg bg-cyan-700 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-cyan-800"
                >
                  Editar & Preview →
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Novo Modelo */}
      {modalNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Novo Modelo de Site</h3>
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
                <label className="font-bold text-slate-700 dark:text-slate-300">Nome do Modelo:</label>
                <input
                  name="nome"
                  placeholder="Ex: Racon Inspired V2, Modern Dark"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Código Técnico (Opcional - gerado automaticamente):</label>
                <input
                  name="codigo"
                  placeholder="Ex: racon_v2 (deixe vazio para automático)"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Basear-se em Modelo Existente:</label>
                <select
                  name="modelo_origem_id"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Nenhum (Começar em branco)</option>
                  {modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Descrição:</label>
                <textarea
                  name="descricao"
                  rows={3}
                  placeholder="Descrição sobre a identidade e proposta deste modelo..."
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
                  {isPendingNovo ? "Criando..." : "Criar Modelo em Rascunho"}
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
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Duplicar Modelo de Site</h3>
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
              <input type="hidden" name="modelo_id" value={duplicarItem.id} />
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
                A nova cópia será criada no status <strong>RASCUNHO</strong> com versão 1 e clonará todos os tokens de identidade, menus e seções.
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
                  {isPendingDuplicar ? "Duplicando..." : "Duplicar Modelo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
