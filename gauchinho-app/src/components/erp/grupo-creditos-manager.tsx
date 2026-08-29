"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { excluirCreditoGrupoLocalAction, salvarCreditoGrupoLocalAction } from "@/app/erp/grupos/actions";

type Cota = { id: string; valor_credito: number; status: string; ativo: boolean };

export function GrupoCreditosManager({ grupoId, cotas, canManage }: { grupoId: string; cotas: Cota[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState("");

  function executar(action: () => Promise<void>) {
    setErro("");
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        setErro(error instanceof Error ? error.message : "Não foi possível atualizar o crédito.");
      }
    });
  }

  if (cotas.length === 0) {
    return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Nenhum crédito cadastrado neste grupo.</p>;
  }

  return <div className="space-y-3">
    {erro ? <p className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-800">{erro}</p> : null}
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3">Crédito</th><th className="p-3">Status</th><th className="p-3 text-right">Ações</th></tr></thead>
        <tbody className="divide-y dark:divide-slate-800">{cotas.map((cota) => <tr key={cota.id}>
          <td className="p-3">
            {canManage ? <input id={`credito-${cota.id}`} defaultValue={Number(cota.valor_credito).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} className="w-48 rounded-lg border px-3 py-2 font-mono font-bold dark:bg-slate-800" inputMode="decimal" /> : <strong>{Number(cota.valor_credito).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>}
          </td>
          <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${cota.ativo !== false ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{cota.status || (cota.ativo !== false ? "Disponível" : "Inativo")}</span></td>
          <td className="p-3 text-right">
            {canManage ? <div className="flex justify-end gap-3">
              <button disabled={pending} type="button" onClick={() => executar(async () => {
                const input = document.getElementById(`credito-${cota.id}`) as HTMLInputElement | null;
                const data = new FormData();
                data.set("grupo_id", grupoId); data.set("cota_id", cota.id); data.set("valor_credito", input?.value ?? "");
                await salvarCreditoGrupoLocalAction(data);
              })} className="text-xs font-bold text-blue-700 disabled:opacity-50">Editar</button>
              <button disabled={pending} type="button" onClick={() => {
                if (!confirm("Deseja excluir este crédito? Se ele possuir histórico, será apenas inativado.")) return;
                executar(async () => {
                  const data = new FormData(); data.set("grupo_id", grupoId); data.set("cota_id", cota.id);
                  await excluirCreditoGrupoLocalAction(data);
                });
              }} className="text-xs font-bold text-red-600 disabled:opacity-50">Excluir</button>
            </div> : <span className="text-xs text-slate-400">Catálogo global: edição pela Platform</span>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
