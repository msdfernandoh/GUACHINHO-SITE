"use client";

import { useActionState } from "react";
import { salvarDadosAdministradoraAction, type PlatformFormState } from "@/app/platform/administradoras-actions";

const initial: PlatformFormState = { status: "IDLE", message: "" };
const field = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2";

export function AdministratorNewForm() {
  const [state, action, pending] = useActionState(salvarDadosAdministradoraAction, initial);
  return <form action={action} className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-semibold">Nome *<input name="nome" required minLength={2} className={field}/></label>
      <label className="text-sm font-semibold">Nome fantasia<input name="nome_fantasia" className={field}/></label>
      <label className="text-sm font-semibold">Status<select name="status" defaultValue="ATIVA" className={field}><option>ATIVA</option><option>INATIVA</option></select></label>
      <label className="text-sm font-semibold md:col-span-2">Descrição institucional<textarea name="descricao_institucional" rows={4} className={field}/></label>
    </div>
    {state.message && <p role="status" className={`rounded-lg p-3 text-sm ${state.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{state.message}</p>}
    <p className="text-sm text-slate-500">ID e código técnico são gerados automaticamente.</p>
    <button disabled={pending} className="rounded-xl bg-cyan-700 px-5 py-3 font-bold text-white disabled:opacity-50">{pending ? "Salvando…" : "Criar Administradora"}</button>
  </form>;
}
