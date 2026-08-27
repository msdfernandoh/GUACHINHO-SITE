"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reajustarCreditosGrupoPlatformAction } from "@/app/platform/grupos-actions";
import { formatBRL } from "@/lib/platform/grupos-prontidao";

type Cota = { id: string; valor_credito: number };

export function GrupoReajusteCreditosDialog({
  grupoId,
  codigoGrupo,
  marcoMeses,
  cotas,
  onClose,
}: {
  grupoId: string;
  codigoGrupo: string;
  marcoMeses: number;
  cotas: Cota[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [percentual, setPercentual] = useState("0");
  const [observacao, setObservacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, number>>(
    Object.fromEntries(cotas.map((cota) => [cota.id, Number(cota.valor_credito)])),
  );
  const alterados = useMemo(
    () => cotas.filter((cota) => Number(valores[cota.id]) !== Number(cota.valor_credito)).length,
    [cotas, valores],
  );

  function aplicarPercentual() {
    const valor = Number(percentual.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= -100) {
      setError("Informe um percentual válido.");
      return;
    }
    setError(null);
    setValores(Object.fromEntries(cotas.map((cota) => [
      cota.id,
      Math.round(Number(cota.valor_credito) * (1 + valor / 100) * 100) / 100,
    ])));
  }

  function confirmar() {
    if (!alterados) {
      setError("Nenhum crédito foi alterado.");
      return;
    }
    if (!confirm(`Publicar o reajuste global de ${codigoGrupo} no marco de ${marcoMeses} meses? A mudança será usada por todos os sites e ERPs vinculados.`)) return;
    startTransition(async () => {
      const resultado = await reajustarCreditosGrupoPlatformAction(
        grupoId,
        marcoMeses,
        Number(percentual.replace(",", ".")) || 0,
        cotas.map((cota) => ({ id: cota.id, valor_credito: Number(valores[cota.id]) })),
        observacao,
      );
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div role="dialog" aria-modal="true" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-950">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold">Reajuste anual de créditos — {codigoGrupo}</h2>
              <p className="mt-1 text-sm text-slate-500">Marco de {marcoMeses} meses · atualização global auditada.</p>
            </div>
            <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">Fechar</button>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-cyan-50 p-4 dark:bg-cyan-950/30">
            <label className="text-sm font-semibold">Percentual de reajuste
              <input value={percentual} onChange={(e) => setPercentual(e.target.value)} type="number" step="0.01" className="mt-1 block w-40 rounded-lg border border-slate-300 bg-white px-3 py-2" />
            </label>
            <button type="button" onClick={aplicarPercentual} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white">Aplicar em todos</button>
            <p className="pb-2 text-xs text-slate-500">As parcelas continuam sendo calculadas pelo site com prazo, taxas e modalidade.</p>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Crédito atual</th><th className="py-2">Novo crédito</th><th className="py-2">Variação</th></tr></thead>
            <tbody>
              {cotas.map((cota) => {
                const novo = Number(valores[cota.id]);
                const variacao = Number(cota.valor_credito) > 0 ? ((novo / Number(cota.valor_credito)) - 1) * 100 : 0;
                return <tr key={cota.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-3">{formatBRL(Number(cota.valor_credito))}</td>
                  <td className="py-3"><input type="number" min="0.01" step="0.01" value={novo} onChange={(e) => setValores((atual) => ({ ...atual, [cota.id]: Number(e.target.value) }))} className="w-44 rounded-lg border border-slate-300 px-3 py-2" /></td>
                  <td className="py-3 font-semibold">{variacao.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</td>
                </tr>;
              })}
            </tbody>
          </table>
          <label className="mt-4 block text-sm font-semibold">Observação do reajuste
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Ex.: reajuste anual informado pela administradora" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 p-5 dark:border-slate-800">
          <span className="text-sm text-slate-500">{alterados} crédito(s) alterado(s)</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={pending} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancelar</button>
            <button type="button" onClick={confirmar} disabled={pending || !alterados} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{pending ? "Publicando…" : "Publicar reajuste global"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
