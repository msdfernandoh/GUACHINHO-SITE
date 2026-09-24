"use client";

import { useActionState } from "react";
import { criarAcessoCadastroAction, type CadastroAcessoState } from "./actions";

const initial: CadastroAcessoState = { status: "IDLE", message: "" };

export function AcessoCadastroClient() {
  const [state, action, pending] = useActionState(criarAcessoCadastroAction, initial);
  return <section className="mx-auto max-w-2xl space-y-5">
    <div><h1 className="text-3xl font-bold">Acesso para revisão técnica</h1><p className="mt-2 text-sm text-slate-500">Consulta de dados existentes em produção, sem ações de criação, edição ou exclusão. Acesso expira em 30 dias.</p></div>
    <form action={action} className="space-y-4 rounded-2xl border bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <label className="block text-sm font-medium">Nome<input name="nome" required minLength={2} defaultValue="Bruno" className="mt-1 w-full rounded-lg border p-2 text-slate-900" /></label>
      <label className="block text-sm font-medium">E-mail<input name="email" type="email" required defaultValue="bruno@msdeducacao.com.br" className="mt-1 w-full rounded-lg border p-2 text-slate-900" /></label>
      <button disabled={pending} className="rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white disabled:opacity-60">{pending ? "Criando..." : "Criar acesso de leitura"}</button>
    </form>
    {state.message && <div role="status" className="rounded-lg border p-4 text-sm"><p>{state.message}</p>{state.status === "SUCCESS" && <p className="mt-3 font-mono">{state.email}<br />{state.senha}</p>}</div>}
  </section>;
}
