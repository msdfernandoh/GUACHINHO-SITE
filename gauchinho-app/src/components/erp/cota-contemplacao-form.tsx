"use client";
import { useActionState } from "react";
import {
  marcarCotaContempladaAction,
  type ContemplacaoState,
} from "@/app/erp/clientes/[id]/contemplacao-actions";
const initial: ContemplacaoState = { ok: false, message: "" };
export function CotaContemplacaoForm({
  clienteId,
  cotaId,
  creditoOriginal,
}: {
  clienteId: string;
  cotaId: string;
  creditoOriginal: number;
}) {
  const [state, action, pending] = useActionState(
    marcarCotaContempladaAction,
    initial,
  );
  return (
    <details className="mt-3 rounded-xl border border-blue-200 bg-white p-3">
      <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-blue-700">
        Marcar como contemplada
      </summary>
      <form action={action} className="mt-3 grid gap-3">
        <input type="hidden" name="cliente_id" value={clienteId} />
        <input type="hidden" name="cota_id" value={cotaId} />
        <label className="grid gap-1 text-xs font-bold text-slate-700">
          Data
          <input
            required
            name="data_contemplacao"
            type="date"
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">
          Tipo
          <select
            required
            name="tipo_contemplacao"
            defaultValue=""
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Selecione
            </option>
            <option value="SORTEIO">Sorteio</option>
            <option value="LANCE">Lance</option>
            <option value="OUTRO">Outro</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">
          Valor atual do crédito
          <input
            required
            name="valor_credito_contemplacao"
            inputMode="decimal"
            defaultValue={creditoOriginal.toFixed(2).replace(".", ",")}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <span className="font-normal text-slate-500">
            Histórico/BI; não altera a base original da comissão.
          </span>
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-700">
          Observação
          <textarea
            name="observacao"
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </label>
        <label className="flex gap-2 text-xs font-semibold">
          <input required type="checkbox" name="confirmacao" /> Confirmo esta
          contemplação.
        </label>
        {state.message && (
          <p
            role="status"
            className={`rounded-lg p-2 text-xs ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
          >
            {state.message}
          </p>
        )}
        <button
          disabled={pending}
          className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
        >
          {pending ? "Registrando..." : "Confirmar contemplação"}
        </button>
      </form>
    </details>
  );
}
