"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  type PlatformFormState,
  salvarDadosProgramaPlatformAction,
  salvarRegraProgramaPlatformAction,
  gerarRegrasPadraoProgramaPlatformAction,
  excluirRegraProgramaPlatformAction,
  statusProgramaAction,
  novaVersaoProgramaAction,
  excluirProgramaAction,
} from "@/app/platform/administradoras-actions";
import { validateProgramRule, type ProgramRule, type ProgramRuleStage } from "@/lib/platform/homologacao";

const initial: PlatformFormState = { status: "IDLE", message: "" };

function Feedback({ state }: { state: PlatformFormState }) {
  if (state.status === "IDLE" || !state.message) return null;
  const isErr = state.status !== "SUCCESS";
  return (
    <div
      className={`rounded-xl p-3 text-xs font-semibold ${
        isErr
          ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          : "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
      }`}
    >
      {state.message}
    </div>
  );
}

export type TipoItem = { id: string; nome: string; codigo?: string };
export type ModalidadeItem = { id: string; nome: string; codigo?: string };
export type CurvaItem = { id: string; nome: string; versao: number };
export type EmpresaItem = { id: string; nome_fantasia: string };

export type ProgramaDetail = {
  id: string;
  nome: string;
  descricao?: string | null;
  versao: number;
  status: string;
  ativo: boolean;
  administradora_id: string;
  empresa_id?: string | null;
  administradora?: { nome?: string; nome_fantasia?: string } | null;
  empresa?: { nome_fantasia?: string } | null;
  regras?: ProgramRule[];
};

export function ProgramaWorkspace({
  programa,
  administradoraId,
  tipos,
  modalidades,
  curvas,
}: {
  programa: ProgramaDetail;
  administradoraId: string;
  tipos: TipoItem[];
  modalidades: ModalidadeItem[];
  curvas: CurvaItem[];
}) {
  const [editingProgramModal, setEditingProgramModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ProgramRule | null>(null);
  const [isCreatingNewRule, setIsCreatingNewRule] = useState(false);

  const [stateDados, actionDados, isPendingDados] = useActionState(salvarDadosProgramaPlatformAction, initial);
  const [stateRegra, actionRegra, isPendingRegra] = useActionState(salvarRegraProgramaPlatformAction, initial);
  const [stateGerar, actionGerar, isPendingGerar] = useActionState(gerarRegrasPadraoProgramaPlatformAction, initial);
  const [stateExcluirRegra, actionExcluirRegra, isPendingExcluirRegra] = useActionState(excluirRegraProgramaPlatformAction, initial);
  const [stateStatus, actionStatus, isPendingStatus] = useActionState(statusProgramaAction, initial);
  const [stateNovaVersao, actionNovaVersao, isPendingNovaVersao] = useActionState(novaVersaoProgramaAction, initial);
  const [stateExcluirProg, actionExcluirProg, isPendingExcluirProg] = useActionState(excluirProgramaAction, initial);

  const regras = programa.regras ?? [];
  const isHistorical = programa.status === "SUBSTITUIDO";
  const isHomologado = programa.status === "ATIVO";
  const isRascunho = programa.status === "RASCUNHO";
  const admin = programa.administradora;
  const empresa = programa.empresa;

  const readinessList = regras.map(validateProgramRule);
  const allIssues: string[] = [];
  if (regras.length === 0) {
    allIssues.push("Nenhuma regra de comissão cadastrada nesta versão");
  } else {
    regras.forEach((r, idx) => {
      const check = readinessList[idx];
      const label = r.modalidade?.nome || r.tipo?.nome || `Regra ${idx + 1}`;
      check.issues.forEach((iss) => allIssues.push(`${label}: ${iss}`));
    });
  }

  const mayHomologate = isRascunho && regras.length > 0 && allIssues.length === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <Link
            href={`/platform/administradoras/${administradoraId}?tab=programas`}
            className="text-xs font-bold text-cyan-700 hover:underline dark:text-cyan-400"
          >
            ← Voltar aos Programas da Administradora
          </Link>
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-cyan-600">
            Platform · Catálogo Oficial de Comissões
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">{programa.nome}</h1>
            <span className="rounded-md bg-cyan-100 px-2.5 py-0.5 text-xs font-bold text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200">
              v{programa.versao}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                isHomologado
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : isHistorical
                  ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {isHistorical
                ? "SUBSTITUÍDA · HISTÓRICO"
                : isHomologado
                ? "HOMOLOGADO"
                : "RASCUNHO"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {admin?.nome_fantasia || admin?.nome} · Franqueadora: {empresa?.nome_fantasia || "Gauchinho Consórcios"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isRascunho && (
            <>
              <button
                type="button"
                onClick={() => setEditingProgramModal(true)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                ✎ Renomear Programa
              </button>

              <form action={actionStatus}>
                <input type="hidden" name="administradora_id" value={administradoraId} />
                <input type="hidden" name="programa_id" value={programa.id} />
                <input type="hidden" name="status" value="ATIVO" />
                <button
                  disabled={!mayHomologate || isPendingStatus}
                  title={
                    mayHomologate
                      ? "Homologar esta versão para o motor oficial de novas vendas"
                      : `Não pode homologar:\n${allIssues.join("\n")}`
                  }
                  className={`rounded-lg px-4 py-2 text-xs font-bold shadow-sm transition-colors ${
                    mayHomologate
                      ? "bg-emerald-700 text-white hover:bg-emerald-800"
                      : "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                  }`}
                >
                  {isPendingStatus ? "Homologando..." : `Homologar Versão v${programa.versao}`}
                </button>
              </form>

              <form
                action={actionExcluirProg}
                onSubmit={(e) => {
                  if (!confirm("Tem certeza que deseja excluir definitivamente este rascunho de programa?")) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="administradora_id" value={administradoraId} />
                <input type="hidden" name="programa_id" value={programa.id} />
                <button
                  disabled={isPendingExcluirProg}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                >
                  Excluir Rascunho
                </button>
              </form>
            </>
          )}

          {isHomologado && (
            <>
              <form
                action={actionNovaVersao}
                onSubmit={(e) => {
                  if (!confirm("Será criada uma nova versão em Rascunho clonando as regras atuais. Continuar?")) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="administradora_id" value={administradoraId} />
                <input type="hidden" name="programa_id" value={programa.id} />
                <button
                  disabled={isPendingNovaVersao}
                  className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-cyan-800"
                >
                  Criar Nova Versão (v{programa.versao + 1})
                </button>
              </form>

              <form action={actionStatus}>
                <input type="hidden" name="administradora_id" value={administradoraId} />
                <input type="hidden" name="programa_id" value={programa.id} />
                <input type="hidden" name="status" value="INATIVO" />
                <button
                  disabled={isPendingStatus}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Inativar
                </button>
              </form>
            </>
          )}
        </div>
      </header>

      <Feedback state={stateDados} />
      <Feedback state={stateRegra} />
      <Feedback state={stateGerar} />
      <Feedback state={stateExcluirRegra} />
      <Feedback state={stateStatus} />
      <Feedback state={stateNovaVersao} />
      <Feedback state={stateExcluirProg} />

      <div
        className={`rounded-2xl border p-4 text-xs ${
          isHomologado
            ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
            : isHistorical
            ? "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
        }`}
      >
        <p className="font-bold text-sm">
          {isRascunho
            ? "RASCUNHO — Versão em edição e revisão. Não participa de novas vendas até ser homologada."
            : isHistorical
            ? "VERSÃO SUBSTITUÍDA — Histórico congelado para auditoria e comissões passadas."
            : "PROGRAMA HOMOLOGADO — Ativo e alimentando o motor de novas vendas da Franqueadora."}
        </p>
        <p className="mt-1">
          {isRascunho
            ? "Configure as regras para cada Tipo e Modalidade, ajuste o cronograma de repasse e vincule curvas de estorno antes de homologar."
            : isHistorical
            ? "Preserva os snapshots de vendas contratadas no período desta versão."
            : "Todas as vendas elegíveis desta Administradora utilizam esta matriz canônica de regras."}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase text-slate-500">Administradora</p>
          <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
            {admin?.nome_fantasia || admin?.nome || "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase text-slate-500">Franqueadora</p>
          <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
            {empresa?.nome_fantasia || "Gauchinho Consórcios"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase text-slate-500">Regras Cadastradas</p>
          <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
            {regras.length} modalidade{regras.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase text-slate-500">Prontidão para Homologação</p>
          <p className={`mt-1 text-base font-bold ${mayHomologate ? "text-emerald-600" : "text-amber-600"}`}>
            {mayHomologate ? "✓ 100% Pronto" : `${allIssues.length} pendência(s)`}
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Regras de Comissão do Programa ({regras.length})
          </h2>
          <p className="text-xs text-slate-500">
            Estrutura de comissão, parcelamento e curva de estorno por Tipo e Modalidade.
          </p>
        </div>

        {isRascunho && (
          <div className="flex flex-wrap items-center gap-2">
            <form action={actionGerar}>
              <input type="hidden" name="administradora_id" value={administradoraId} />
              <input type="hidden" name="programa_id" value={programa.id} />
              <input type="hidden" name="percentual_padrao" value="4.00" />
              <button
                type="submit"
                disabled={isPendingGerar}
                className="rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-200"
                title="Gera automaticamente regras padrão de 4% para todos os Tipos e Modalidades ativos da Administradora"
              >
                {isPendingGerar ? "Gerando..." : "⚡ Gerar Regras Padrão (Tipos e Modalidades)"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setEditingRule(null);
                setIsCreatingNewRule(true);
              }}
              className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-cyan-800"
            >
              + Adicionar Regra
            </button>
          </div>
        )}
      </div>

      {regras.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-8 text-center dark:border-amber-900 dark:bg-amber-950/20">
          <div className="mx-auto max-w-md space-y-3">
            <span className="text-3xl">📋</span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Nenhuma regra de comissão cadastrada
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Para homologar o programa <strong>{programa.nome}</strong> e permitir novas vendas, cadastre as regras de comissão para os Tipos e Modalidades da Administradora.
            </p>
            {isRascunho ? (
              <div className="flex flex-wrap justify-center gap-3 pt-3">
                <form action={actionGerar}>
                  <input type="hidden" name="administradora_id" value={administradoraId} />
                  <input type="hidden" name="programa_id" value={programa.id} />
                  <input type="hidden" name="percentual_padrao" value="4.00" />
                  <button
                    type="submit"
                    disabled={isPendingGerar}
                    className="rounded-lg bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-cyan-800"
                  >
                    {isPendingGerar ? "Gerando..." : "⚡ Gerar Regras Padrão Automaticamente"}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => {
                    setEditingRule(null);
                    setIsCreatingNewRule(true);
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  + Cadastrar Manualmente
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {regras.map((rule, index) => {
          const check = readinessList[index];
          const etapas = (rule.etapas ?? []).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
          const totalScheduled = etapas.reduce((sum, item) => sum + Number(item.percentual_venda || 0), 0);
          const expectedCommission =
            rule.base_calculo === "valor_fixo" ? rule.valor_fixo_total : rule.percentual_total_comissao;

          return (
            <article
              key={rule.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {rule.tipo?.nome || "Tipo pendente"} · {rule.modalidade?.nome || "Modalidade pendente"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Vigência: {rule.vigencia_inicio} → {rule.vigencia_fim || "aberta"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {check.ready ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                      ✓ Validação OK
                    </span>
                  ) : (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                      ⚠ {check.issues[0]}
                    </span>
                  )}

                  {isRascunho && (
                    <div className="flex items-center gap-1.5 pl-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewRule(false);
                          setEditingRule(rule);
                        }}
                        className="rounded-lg bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-800 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-200"
                      >
                        ✎ Editar Regra & Cronograma
                      </button>

                      <form
                        action={actionExcluirRegra}
                        onSubmit={(e) => {
                          if (!confirm(`Excluir a regra de ${rule.tipo?.nome} · ${rule.modalidade?.nome}?`)) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="administradora_id" value={administradoraId} />
                        <input type="hidden" name="regra_id" value={rule.id} />
                        <button
                          type="submit"
                          disabled={isPendingExcluirRegra}
                          className="rounded-lg p-1.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                          title="Excluir regra"
                        >
                          ✕
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <dt className="text-[11px] font-bold uppercase text-slate-500">Comissão Total</dt>
                  <dd className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                    {rule.base_calculo === "valor_fixo"
                      ? `R$ ${rule.valor_fixo_total ?? "—"}`
                      : `${rule.percentual_total_comissao ?? "—"}%`}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <dt className="text-[11px] font-bold uppercase text-slate-500">Cronograma (Soma)</dt>
                  <dd className={`mt-1 text-base font-bold ${check.ready ? "text-emerald-700" : "text-amber-700"}`}>
                    {totalScheduled}% {expectedCommission != null && `de ${expectedCommission}%`}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <dt className="text-[11px] font-bold uppercase text-slate-500">Curva de Estorno</dt>
                  <dd className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {rule.curva ? `${rule.curva.nome} · v${rule.curva.versao}` : "Nenhuma vinculada"}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <dt className="text-[11px] font-bold uppercase text-slate-500">Origem</dt>
                  <dd className="mt-1 text-xs font-mono text-slate-700 dark:text-slate-300">
                    {rule.origem_configuracao || "PLATFORM"}
                  </dd>
                </div>
              </dl>

              <div className="mt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Cronograma de Repasse ({etapas.length} etapa{etapas.length === 1 ? "" : "s"})
                </h4>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left font-bold uppercase text-slate-400 dark:border-slate-800">
                        <th className="p-2">Ordem</th>
                        <th className="p-2">Gatilho</th>
                        <th className="p-2">Mês Relativo</th>
                        <th className="p-2">Nome da Etapa</th>
                        <th className="p-2">Percentual sobre Venda</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {etapas.map((e) => (
                        <tr key={e.id ?? String(e.ordem)}>
                          <td className="p-2 font-medium">{e.ordem}</td>
                          <td className="p-2">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold dark:bg-slate-800">
                              {e.tipo_gatilho === "CONTEMPLACAO" ? "Contemplação" : "Mês Relativo"}
                            </span>
                          </td>
                          <td className="p-2">{e.mes_relativo != null ? `${e.mes_relativo}º mês` : "Na contemplação"}</td>
                          <td className="p-2 font-semibold text-slate-900 dark:text-white">{e.nome}</td>
                          <td className="p-2 font-bold text-slate-900 dark:text-white">{e.percentual_venda}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-slate-50 font-bold dark:border-slate-800 dark:bg-slate-800/40">
                        <td colSpan={4} className="p-2 text-right">
                          Total do Cronograma:
                        </td>
                        <td className="p-2 text-emerald-700 dark:text-emerald-400 font-extrabold">
                          {totalScheduled}% {expectedCommission != null && `(Comissão: ${expectedCommission}%)`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {editingProgramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Renomear Programa</h3>
              <button
                type="button"
                onClick={() => setEditingProgramModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form
              action={async (formData) => {
                await actionDados(formData);
                setEditingProgramModal(false);
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="administradora_id" value={administradoraId} />
              <input type="hidden" name="programa_id" value={programa.id} />

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Nome do Programa:</label>
                <input
                  name="nome"
                  defaultValue={programa.nome}
                  placeholder="Ex: SOCIOS, Racon Imóvel - Comissão V2"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Descrição (Opcional):</label>
                <textarea
                  name="descricao"
                  defaultValue={programa.descricao ?? ""}
                  rows={3}
                  placeholder="Descrição sobre a aplicabilidade deste programa..."
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProgramModal(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingDados}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingDados ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(editingRule || isCreatingNewRule) && (
        <RegraEditorModal
          programaId={programa.id}
          administradoraId={administradoraId}
          rule={editingRule}
          tipos={tipos}
          modalidades={modalidades}
          curvas={curvas}
          onClose={() => {
            setEditingRule(null);
            setIsCreatingNewRule(false);
          }}
          actionRegra={actionRegra}
          isPendingRegra={isPendingRegra}
        />
      )}
    </div>
  );
}

function RegraEditorModal({
  programaId,
  administradoraId,
  rule,
  tipos,
  modalidades,
  curvas,
  onClose,
  actionRegra,
  isPendingRegra,
}: {
  programaId: string;
  administradoraId: string;
  rule: ProgramRule | null;
  tipos: TipoItem[];
  modalidades: ModalidadeItem[];
  curvas: CurvaItem[];
  onClose: () => void;
  actionRegra: (formData: FormData) => void;
  isPendingRegra: boolean;
}) {
  const isEditing = Boolean(rule?.id);

  const [tipoId, setTipoId] = useState(rule?.tipo_administradora_id ?? (tipos[0]?.id || ""));
  const [modalidadeId, setModalidadeId] = useState(rule?.modalidade_comissao_id ?? (modalidades[0]?.id || ""));
  const [percentualTotal, setPercentualTotal] = useState(
    rule?.percentual_total_comissao != null ? String(rule.percentual_total_comissao) : "4.00"
  );
  const [baseCalculo, setBaseCalculo] = useState(rule?.base_calculo ?? "credito");
  const [curvaId, setCurvaId] = useState(rule?.curva_estorno_id ?? "");
  const [vigenciaInicio, setVigenciaInicio] = useState(
    rule?.vigencia_inicio ?? new Date().toISOString().slice(0, 10)
  );
  const [vigenciaFim, setVigenciaFim] = useState(rule?.vigencia_fim ?? "");

  const [etapas, setEtapas] = useState<ProgramRuleStage[]>(() => {
    if (rule?.etapas && rule.etapas.length > 0) {
      return rule.etapas.map((e, idx) => ({
        id: e.id || `e-${idx}`,
        ordem: e.ordem || idx + 1,
        tipo_gatilho: e.tipo_gatilho || "MES_RELATIVO",
        mes_relativo: e.mes_relativo ?? 1,
        nome: e.nome || (e.tipo_gatilho === "CONTEMPLACAO" ? "Contemplação" : `${idx + 1}ª Parcela`),
        percentual_venda: Number(e.percentual_venda || 0),
      }));
    }
    const pct = Number(percentualTotal.replace(",", ".")) || 4.00;
    return [
      {
        id: "e-default",
        ordem: 1,
        tipo_gatilho: "MES_RELATIVO",
        mes_relativo: 1,
        nome: "Parcela Única",
        percentual_venda: pct,
      },
    ];
  });

  const numTotal = Number(percentualTotal.replace(",", ".")) || 0;
  const scheduledSum = etapas.reduce((sum, e) => sum + Number(e.percentual_venda || 0), 0);
  const isSumValid = Math.abs(scheduledSum - numTotal) < 0.0001;

  function setPreset(type: "unica" | "2x" | "3x" | "racon") {
    const total = Number(percentualTotal.replace(",", ".")) || 4.00;
    if (type === "unica") {
      setEtapas([
        {
          id: `e-${Date.now()}-1`,
          ordem: 1,
          tipo_gatilho: "MES_RELATIVO",
          mes_relativo: 1,
          nome: "Parcela Única",
          percentual_venda: total,
        },
      ]);
    } else if (type === "2x") {
      const half = Number((total / 2).toFixed(4));
      setEtapas([
        {
          id: `e-${Date.now()}-1`,
          ordem: 1,
          tipo_gatilho: "MES_RELATIVO",
          mes_relativo: 1,
          nome: "1ª Parcela",
          percentual_venda: half,
        },
        {
          id: `e-${Date.now()}-2`,
          ordem: 2,
          tipo_gatilho: "MES_RELATIVO",
          mes_relativo: 2,
          nome: "2ª Parcela",
          percentual_venda: Number((total - half).toFixed(4)),
        },
      ]);
    } else if (type === "3x") {
      const p1 = Number((total / 3).toFixed(4));
      const p2 = p1;
      const p3 = Number((total - p1 - p2).toFixed(4));
      setEtapas([
        {
          id: `e-${Date.now()}-1`,
          ordem: 1,
          tipo_gatilho: "MES_RELATIVO",
          mes_relativo: 1,
          nome: "1ª Parcela",
          percentual_venda: p1,
        },
        {
          id: `e-${Date.now()}-2`,
          ordem: 2,
          tipo_gatilho: "MES_RELATIVO",
          mes_relativo: 2,
          nome: "2ª Parcela",
          percentual_venda: p2,
        },
        {
          id: `e-${Date.now()}-3`,
          ordem: 3,
          tipo_gatilho: "MES_RELATIVO",
          mes_relativo: 3,
          nome: "3ª Parcela",
          percentual_venda: p3,
        },
      ]);
    } else if (type === "racon") {
      const pctParc = Number((total * 0.6875).toFixed(4));
      const pctCont = Number((total - pctParc).toFixed(4));
      setEtapas([
        {
          id: `e-${Date.now()}-1`,
          ordem: 1,
          tipo_gatilho: "MES_RELATIVO",
          mes_relativo: 1,
          nome: "1ª Parcela",
          percentual_venda: pctParc,
        },
        {
          id: `e-${Date.now()}-2`,
          ordem: 2,
          tipo_gatilho: "CONTEMPLACAO",
          mes_relativo: null,
          nome: "Contemplação",
          percentual_venda: pctCont,
        },
      ]);
    }
  }

  function adicionarEtapa() {
    setEtapas((prev) => {
      const nextOrdem = prev.length + 1;
      return [
        ...prev,
        {
          id: `e-${Date.now()}-${nextOrdem}`,
          ordem: nextOrdem,
          tipo_gatilho: "MES_RELATIVO",
          mes_relativo: nextOrdem,
          nome: `${nextOrdem}ª Parcela`,
          percentual_venda: 0,
        },
      ];
    });
  }

  function removerEtapa(index: number) {
    setEtapas((prev) => {
      const updated = prev.filter((_, idx) => idx !== index);
      return updated.map((e, idx) => ({ ...e, ordem: idx + 1 }));
    });
  }

  function atualizarEtapa(index: number, updates: Partial<ProgramRuleStage>) {
    setEtapas((prev) =>
      prev.map((e, idx) => (idx === index ? { ...e, ...updates } : e))
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isEditing ? "Editar Regra de Comissão" : "Adicionar Nova Regra ao Programa"}
            </h3>
            <p className="text-xs text-slate-500">
              Defina Tipo, Modalidade, Comissão Total e o Cronograma de Repasse correspondente.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <form
          action={async (formData) => {
            formData.set("etapas_json", JSON.stringify(etapas));
            await actionRegra(formData);
            onClose();
          }}
          className="space-y-4 text-xs"
        >
          <input type="hidden" name="administradora_id" value={administradoraId} />
          <input type="hidden" name="programa_id" value={programaId} />
          {isEditing && rule && <input type="hidden" name="regra_id" value={rule.id} />}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Tipo Oficial:</label>
              <select
                name="tipo_id"
                value={tipoId}
                onChange={(e) => setTipoId(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Modalidade de Comissão:</label>
              <select
                name="modalidade_id"
                value={modalidadeId}
                onChange={(e) => setModalidadeId(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {modalidades.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Comissão Total (%):</label>
              <input
                name="percentual_comissao"
                value={percentualTotal}
                onChange={(e) => setPercentualTotal(e.target.value)}
                placeholder="Ex: 4.00"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs font-bold text-cyan-700 dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-300"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Base de Cálculo:</label>
              <select
                name="base_calculo"
                value={baseCalculo}
                onChange={(e) => setBaseCalculo(e.target.value as "credito" | "valor_fixo")}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="credito">% sobre o Crédito</option>
                <option value="valor_fixo">Valor Fixo (R$)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Curva de Estorno:</label>
              <select
                name="curva_estorno_id"
                value={curvaId}
                onChange={(e) => setCurvaId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Nenhuma curva</option>
                {curvas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} · v{c.versao}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Início de Vigência:</label>
              <input
                type="date"
                name="vigencia_inicio"
                value={vigenciaInicio}
                onChange={(e) => setVigenciaInicio(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Fim de Vigência (Opcional):</label>
              <input
                type="date"
                name="vigencia_fim"
                value={vigenciaFim}
                onChange={(e) => setVigenciaFim(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Cronograma de Repasse / Parcelas</p>
                <p className="text-[11px] text-slate-500">
                  A soma das etapas deve fechar exatamente em <strong>{numTotal}%</strong>.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Atalhos:</span>
                <button
                  type="button"
                  onClick={() => setPreset("unica")}
                  className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700"
                >
                  1x 100%
                </button>
                <button
                  type="button"
                  onClick={() => setPreset("2x")}
                  className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700"
                >
                  2x Parcelas
                </button>
                <button
                  type="button"
                  onClick={() => setPreset("3x")}
                  className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700"
                >
                  3x Parcelas
                </button>
                <button
                  type="button"
                  onClick={() => setPreset("racon")}
                  className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700"
                >
                  Racon (Parcela + Contemplação)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {etapas.map((etapa, idx) => (
                <div
                  key={etapa.id || idx}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
                >
                  <span className="w-5 text-center font-bold text-slate-400">{idx + 1}º</span>

                  <select
                    value={etapa.tipo_gatilho}
                    onChange={(e) => {
                      const tg = e.target.value;
                      atualizarEtapa(idx, {
                        tipo_gatilho: tg,
                        mes_relativo: tg === "CONTEMPLACAO" ? null : etapa.mes_relativo || 1,
                        nome: tg === "CONTEMPLACAO" ? "Contemplação" : `${idx + 1}ª Parcela`,
                      });
                    }}
                    className="rounded border border-slate-200 p-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="MES_RELATIVO">Mês Relativo</option>
                    <option value="CONTEMPLACAO">Na Contemplação</option>
                  </select>

                  {etapa.tipo_gatilho === "MES_RELATIVO" ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={etapa.mes_relativo ?? 1}
                        onChange={(e) => atualizarEtapa(idx, { mes_relativo: Number(e.target.value) || 1 })}
                        className="w-14 rounded border border-slate-200 p-1.5 text-xs text-center dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <span className="text-[11px] text-slate-500">º mês</span>
                    </div>
                  ) : null}

                  <input
                    type="text"
                    value={etapa.nome ?? ""}
                    onChange={(e) => atualizarEtapa(idx, { nome: e.target.value })}
                    placeholder="Nome da etapa"
                    className="flex-1 min-w-[120px] rounded border border-slate-200 p-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />

                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.0001"
                      value={etapa.percentual_venda || ""}
                      onChange={(e) => atualizarEtapa(idx, { percentual_venda: Number(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-20 rounded border border-slate-200 p-1.5 text-xs text-right font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <span className="font-bold text-slate-600 dark:text-slate-400">%</span>
                  </div>

                  {etapas.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removerEtapa(idx)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Remover etapa"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={adicionarEtapa}
                className="text-xs font-bold text-cyan-700 hover:underline dark:text-cyan-400"
              >
                + Adicionar Etapa ao Cronograma
              </button>

              <div className="text-xs font-bold">
                <span className="text-slate-500">Soma: </span>
                <span className={isSumValid ? "text-emerald-600 font-extrabold" : "text-red-600 font-extrabold"}>
                  {scheduledSum.toFixed(2)}%
                </span>
                <span className="text-slate-500"> de {numTotal}% </span>
                {isSumValid ? (
                  <span className="text-emerald-600">✓ Fechado</span>
                ) : (
                  <span className="text-red-600">
                    ⚠ Diferença de {Math.abs(numTotal - scheduledSum).toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPendingRegra || !isSumValid}
              className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800 disabled:opacity-50"
            >
              {isPendingRegra ? "Salvando..." : isEditing ? "Salvar Alterações da Regra" : "Adicionar Regra"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
