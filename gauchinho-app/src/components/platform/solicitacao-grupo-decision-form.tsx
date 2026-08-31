"use client";

import { useActionState } from "react";
import { decidirSolicitacaoGrupoAction, type GroupActionState } from "@/app/platform/grupos-actions";

const initialState: GroupActionState = { status: "IDLE", message: "" };

export function SolicitacaoGrupoDecisionForm({ solicitacaoId }: { solicitacaoId: string }) {
  const [state, action, pending] = useActionState(decidirSolicitacaoGrupoAction, initialState);

  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4">
      <input type="hidden" name="solicitacao_id" value={solicitacaoId} />
      <label className="min-w-64 flex-1 text-xs font-semibold">
        Observação
        <input name="observacao" disabled={pending} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60" placeholder="Obrigatória quando devolver ou rejeitar" />
      </label>
      <button disabled={pending} name="decisao" value="DEVOLVER" className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-50">Devolver</button>
      <button disabled={pending} name="decisao" value="REJEITAR" className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50">Rejeitar</button>
      <button disabled={pending} name="decisao" value="APROVAR" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{pending ? "Processando..." : "Aprovar e publicar"}</button>
      {state.message ? (
        <p role="status" className={`w-full rounded-lg px-3 py-2 text-sm font-semibold ${state.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
