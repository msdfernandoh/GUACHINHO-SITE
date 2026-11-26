"use client";

import { useActionState } from "react";
import { iniciarContratacaoAction } from "./actions";

export function IniciarContratacaoForm({ clienteId, requestId }: { clienteId: string; requestId: string }) {
  const [estado, action, pendente] = useActionState(iniciarContratacaoAction, { erro: "" });
  return <form action={action} className="space-y-3">
    <input type="hidden" name="cliente_id" value={clienteId} />
    <input type="hidden" name="request_id" value={requestId} />
    {estado.erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{estado.erro}</p>}
    <button disabled={pendente} className="min-h-11 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
      {pendente ? "Iniciando contratação…" : "Continuar · escolher grupo e cota"}
    </button>
  </form>;
}
