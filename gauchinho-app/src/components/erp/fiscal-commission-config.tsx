"use client";
import { useActionState, useState } from "react";
import {
  saveFiscalCommissionConfigAction,
  type CommissionActionState,
} from "@/app/erp/regras-comissao/actions";
const initial: CommissionActionState = { ok: false, message: "" };
export function FiscalCommissionConfig({
  empresaId,
  configs,
}: {
  empresaId: string;
  configs: {
    id: string;
    percentual_imposto: number;
    vigencia_inicio: string;
    vigencia_fim: string | null;
    participante_exibe_detalhes_fiscais: boolean;
    ativo: boolean;
  }[];
}) {
  const [state, action, pending] = useActionState(
    saveFiscalCommissionConfigAction,
    initial,
  );
  const current = configs.find(
    (x) =>
      x.ativo &&
      x.vigencia_inicio <= new Date().toISOString().slice(0, 10) &&
      (!x.vigencia_fim ||
        x.vigencia_fim >= new Date().toISOString().slice(0, 10)),
  );
  const [history, setHistory] = useState(false);
  return (
    <section className="space-y-4 rounded-xl border border-emerald-200 bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="font-bold">Configuração fiscal vigente</h2>
          {current ? (
            <p className="mt-1 text-sm">
              Imposto:{" "}
              <strong>
                {Number(current.percentual_imposto).toLocaleString("pt-BR")}%
              </strong>{" "}
              · Vigência: {current.vigencia_inicio} →{" "}
              {current.vigencia_fim ?? "aberta"} · Participante vê:{" "}
              {current.participante_exibe_detalhes_fiscais
                ? "Bruto, imposto e líquido"
                : "Somente líquido"}
            </p>
          ) : (
            <p className="text-sm text-amber-700">
              Nenhuma configuração vigente.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setHistory((x) => !x)}
          className="rounded-lg border px-3 py-2 text-sm font-semibold"
        >
          Histórico
        </button>
      </div>
      <form action={action} className="grid gap-3 md:grid-cols-5">
        <input type="hidden" name="empresa_id" value={empresaId} />
        <label className="text-sm font-medium">
          Imposto (%)
          <input
            className="mt-1 w-full rounded border p-2"
            name="percentual_imposto"
            inputMode="decimal"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Início
          <input
            className="mt-1 w-full rounded border p-2"
            type="date"
            name="vigencia_inicio"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Fim
          <input
            className="mt-1 w-full rounded border p-2"
            type="date"
            name="vigencia_fim"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="participante_exibe_detalhes_fiscais" />{" "}
          Participante vê detalhes fiscais
        </label>
        <button
          disabled={pending}
          className="self-end rounded bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Nova vigência"}
        </button>
      </form>
      {state.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
        >
          {state.message}
        </p>
      )}
      {history && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th>Percentual</th>
                <th>Vigência</th>
                <th>Visibilidade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((x) => (
                <tr key={x.id} className="border-t">
                  <td className="py-2">{x.percentual_imposto}%</td>
                  <td>
                    {x.vigencia_inicio} → {x.vigencia_fim ?? "aberta"}
                  </td>
                  <td>
                    {x.participante_exibe_detalhes_fiscais
                      ? "Detalhada"
                      : "Somente líquido"}
                  </td>
                  <td>{x.ativo ? "Ativa" : "Inativa"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
