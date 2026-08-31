"use client";
import { useActionState } from "react";
import { salvarContatosSiteAction } from "@/app/platform/empresas/site-contacts-action";

export function SiteContactsForm({ empresaId, telefone, whatsapp }: { empresaId: string; telefone?: string; whatsapp?: string }) {
  const [state, action, pending] = useActionState(salvarContatosSiteAction, { ok: false, message: "" });
  return <form action={action} className="space-y-3 rounded-xl border p-4">
    <h4 className="text-sm font-bold">Contatos do site desta empresa</h4>
    <p className="text-slate-500">Telefone do topo e WhatsApp do rodapé. Não altera o cadastro fiscal nem os contatos de outras empresas. Vazio utiliza o padrão do modelo, quando informado.</p>
    <input type="hidden" name="empresa_id" value={empresaId} />
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="font-bold">Telefone / televendas<input name="telefone" type="tel" maxLength={40} defaultValue={telefone || ""} placeholder="DDD + número ou 0800" className="mt-1 w-full rounded border p-2 text-slate-900" /></label>
      <label className="font-bold">WhatsApp<input name="whatsapp" type="tel" maxLength={40} defaultValue={whatsapp || ""} placeholder="DDD + número" className="mt-1 w-full rounded border p-2 text-slate-900" /></label>
    </div>
    <button disabled={pending} className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white">{pending ? "Salvando…" : "Salvar contatos do site"}</button>
    {state.message ? <p role="status" className={state.ok ? "text-emerald-700" : "text-red-700"}>{state.message}</p> : null}
  </form>;
}
