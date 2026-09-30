"use client";

import { useActionState } from "react";
import { alterarRevisorTecnicoAction, criarAcessoCadastroAction, gerarNovaSenhaRevisorAction, type CadastroAcessoState, type RevisorTecnicoItem } from "./actions";

const initial: CadastroAcessoState = { status: "IDLE", message: "" };
const dataHora = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));

function Resultado({ state }: { state: CadastroAcessoState }) {
  if (!state.message) return null;
  return <div role="status" className={`rounded-lg border p-4 text-sm ${state.status === "ERROR" ? "border-red-300 text-red-800" : "border-emerald-300 text-emerald-800"}`}><p>{state.message}</p>{state.status === "SUCCESS" && state.senha && <p className="mt-3 font-mono">{state.email}<br />{state.senha}</p>}</div>;
}

export function AcessoCadastroClient({ revisores }: { revisores: RevisorTecnicoItem[] }) {
  const [stateCriar, actionCriar, pendingCriar] = useActionState(criarAcessoCadastroAction, initial);
  const [stateSenha, actionSenha, pendingSenha] = useActionState(gerarNovaSenhaRevisorAction, initial);
  const [stateAlterar, actionAlterar, pendingAlterar] = useActionState(alterarRevisorTecnicoAction, initial);
  return <section className="mx-auto max-w-4xl space-y-5">
    <div><h1 className="text-3xl font-bold">Acesso para revisão técnica</h1><p className="mt-2 text-sm text-slate-500">Consulta de dados existentes em produção, sem ações de criação, edição ou exclusão. Acesso expira em 30 dias.</p></div>
    <form action={actionCriar} className="space-y-4 rounded-2xl border bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <label className="block text-sm font-medium">Nome<input name="nome" required minLength={2} defaultValue="Bruno" className="mt-1 w-full rounded-lg border p-2 text-slate-900" /></label>
      <label className="block text-sm font-medium">E-mail<input name="email" type="email" required defaultValue="bruno@msdeducacao.com.br" className="mt-1 w-full rounded-lg border p-2 text-slate-900" /></label>
      <button disabled={pendingCriar} className="rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white disabled:opacity-60">{pendingCriar ? "Criando..." : "Criar acesso de leitura"}</button>
    </form>
    <Resultado state={stateCriar} /><Resultado state={stateSenha} /><Resultado state={stateAlterar} />
    <section className="rounded-2xl border bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-bold">Revisores técnicos</h2><p className="mt-1 text-sm text-slate-500">Inative para bloquear o acesso imediatamente, prorrogue por 30 dias ou gere uma nova senha temporária.</p>
      {revisores.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nenhum revisor técnico cadastrado.</p> : <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b"><th className="px-3 py-2">Revisor</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2">Expira em</th><th className="px-3 py-2">Ações</th></tr></thead><tbody>{revisores.map((revisor) => {
        const status = revisor.ativo ? "Ativo" : "Inativo";
        return <tr key={revisor.usuario_id} className="border-b last:border-0"><td className="px-3 py-3"><p className="font-semibold">{revisor.nome}</p><p className="text-slate-500">{revisor.email}</p></td><td className="px-3 py-3"><span className={status === "Ativo" ? "font-semibold text-emerald-700" : "font-semibold text-slate-500"}>{status}</span></td><td className="whitespace-nowrap px-3 py-3">{dataHora(revisor.expira_em)}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-2"><form action={actionSenha}><input type="hidden" name="usuario_id" value={revisor.usuario_id} /><button disabled={pendingSenha} className="rounded-lg border border-amber-500 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-60">Nova senha</button></form><form action={actionAlterar}><input type="hidden" name="usuario_id" value={revisor.usuario_id} /><input type="hidden" name="operacao" value="alternar" /><button disabled={pendingAlterar} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-60">{revisor.ativo ? "Inativar" : "Reativar"}</button></form><form action={actionAlterar}><input type="hidden" name="usuario_id" value={revisor.usuario_id} /><input type="hidden" name="operacao" value="prorrogar" /><button disabled={pendingAlterar} className="rounded-lg border border-cyan-700 px-3 py-2 text-xs font-semibold text-cyan-800 disabled:opacity-60">+30 dias</button></form></div></td></tr>;
      })}</tbody></table></div>}
    </section>
  </section>;
}
