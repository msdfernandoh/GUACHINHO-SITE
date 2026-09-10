"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  reajustarCreditosGrupoPlatformAction,
  type ReajusteCreditoPlatformInput,
} from "@/app/platform/grupos-actions";
import {
  obterStatusReajusteAnual,
  calcularNovoCreditoPorPercentual,
  calcularPropagacaoCotaBase,
} from "@/lib/grupos/reajuste-anual";
import { formatBRL, formatDateBR } from "@/lib/platform/grupos-prontidao";

type CotaItem = {
  id: string;
  valor_credito: number;
  status?: string;
  ativo?: boolean;
};

type Props = {
  grupo: {
    id: string;
    codigo_grupo: string;
    data_primeira_assembleia?: string | Date | null;
    tipo_reajuste_anual?: "FIXO" | "VARIAVEL" | string | null;
    reajuste_anual_percentual?: number | null;
    reajuste_anual_indice?: string | null;
    credito_reajustado_ate_meses?: number | null;
    ano_ultimo_reajuste?: number | null;
    prazo_total?: number | null;
  };
  cotas: CotaItem[];
  onClose: () => void;
};

export function GrupoReajusteAnualModal({ grupo, cotas, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const statusAnual = useMemo(() => obterStatusReajusteAnual(grupo), [grupo]);

  const cotasAtivas = useMemo(
    () => cotas.filter((c) => c.ativo !== false && Number(c.valor_credito) > 0),
    [cotas],
  );

  const isFixo = grupo.tipo_reajuste_anual === "FIXO";
  const pctFixoPadrao = Number(grupo.reajuste_anual_percentual) || 0;

  // Estado do percentual
  const [percentual, setPercentual] = useState<string>(
    isFixo && pctFixoPadrao > 0 ? String(pctFixoPadrao) : "0",
  );

  // Estado dos valores de crédito por cota
  const [valores, setValores] = useState<Record<string, number>>(() => {
    const initialMap: Record<string, number> = {};
    const pct = isFixo && pctFixoPadrao > 0 ? pctFixoPadrao : 0;
    for (const c of cotasAtivas) {
      initialMap[c.id] =
        pct > 0
          ? calcularNovoCreditoPorPercentual(Number(c.valor_credito), pct)
          : Number(c.valor_credito);
    }
    return initialMap;
  });

  const [observacao, setObservacao] = useState("");

  const alteradosCount = useMemo(() => {
    return cotasAtivas.filter(
      (c) => Math.abs(Number(valores[c.id]) - Number(c.valor_credito)) > 0.009,
    ).length;
  }, [cotasAtivas, valores]);

  // Aplica percentual em todas
  function handleAplicarPercentual(novoPct?: number) {
    const pctNum =
      novoPct != null ? novoPct : Number(String(percentual).replace(",", "."));
    if (!Number.isFinite(pctNum) || pctNum <= -100) {
      setError("Informe um percentual de reajuste válido.");
      return;
    }
    setError(null);
    const updated: Record<string, number> = {};
    for (const c of cotasAtivas) {
      updated[c.id] = calcularNovoCreditoPorPercentual(Number(c.valor_credito), pctNum);
    }
    setValores(updated);
  }

  // Ao alterar o valor de uma das cotas (no modo VARIÁVEL), propaga o percentual para todas as outras
  function handleValorCotaChange(cotaId: string, novoValorRaw: string) {
    const n = Number(novoValorRaw.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setValores((prev) => ({ ...prev, [cotaId]: 0 }));
      return;
    }

    const { percentualCalculado, cotasAtualizadas } = calcularPropagacaoCotaBase(
      cotasAtivas,
      cotaId,
      n,
    );

    setPercentual(String(percentualCalculado));
    const nextMap: Record<string, number> = {};
    for (const item of cotasAtualizadas) {
      nextMap[item.id] = item.novo_credito;
    }
    setValores(nextMap);
  }

  function handleConfirmar() {
    if (alteradosCount === 0) {
      setError("Nenhum crédito foi alterado para reajuste.");
      return;
    }

    const confirmMsg = isFixo
      ? `Confirmar reajuste fixo de ${percentual}% no Grupo ${grupo.codigo_grupo} para ${alteradosCount} cota(s)?\n\nOs novos valores serão publicados imediatamente nos sites e ERP.`
      : `Confirmar reajuste do Grupo ${grupo.codigo_grupo} com variação de ${percentual}% para ${alteradosCount} cota(s)?\n\nOs novos valores serão publicados imediatamente nos sites e ERP.`;

    if (!confirm(confirmMsg)) return;

    startTransition(async () => {
      setError(null);
      const payloadCreditos: ReajusteCreditoPlatformInput[] = cotasAtivas.map((c) => ({
        id: c.id,
        valor_credito: Number(valores[c.id]),
      }));

      const marcoMeses = Math.max(12, Number(grupo.credito_reajustado_ate_meses) || 12);
      const pctNum = Number(String(percentual).replace(",", ".")) || 0;

      const res = await reajustarCreditosGrupoPlatformAction(
        grupo.id,
        marcoMeses,
        pctNum,
        payloadCreditos,
        observacao,
        statusAnual.anoAtual,
      );

      if (!res.ok) {
        setError(res.error);
        return;
      }

      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-reajuste-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-950 dark:border dark:border-slate-800"
      >
        {/* Cabeçalho */}
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 id="modal-reajuste-title" className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Aplicar Reajuste Anual — Grupo {grupo.codigo_grupo}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    isFixo
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  }`}
                >
                  {isFixo ? "FIXO" : "VARIÁVEL"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                1ª Assembleia: {formatDateBR(grupo.data_primeira_assembleia as string)} ·
                Mês de aniversário: <strong>{statusAnual.nomeMesAniversario}</strong> · Ano {statusAnual.anoAtual}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>

          {/* Painel de Controle por Classificação */}
          {isFixo ? (
            <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-purple-900 dark:text-purple-200">
                    Reajuste Contratual Fixo: {pctFixoPadrao}% ao ano
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    Todas as {cotasAtivas.length} cotas abaixo foram recalculadas com o percentual cadastrado.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAplicarPercentual(pctFixoPadrao)}
                  className="rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-800"
                >
                  Restaurar {pctFixoPadrao}% Fixo
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-900/50 dark:bg-cyan-950/20">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Percentual de Reajuste (%)
                    {grupo.reajuste_anual_indice ? (
                      <span className="ml-1 text-[11px] font-normal text-cyan-700 dark:text-cyan-400">
                        (Índice: {grupo.reajuste_anual_indice})
                      </span>
                    ) : null}
                    <input
                      type="number"
                      step="0.01"
                      value={percentual}
                      onChange={(e) => setPercentual(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAplicarPercentual();
                        }
                      }}
                      className="mt-1 block w-32 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => handleAplicarPercentual()}
                  className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-800"
                >
                  Calcular todas com este %
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                💡 <strong>Dica:</strong> Você também pode alterar diretamente o valor de <em>qualquer uma das cotas</em> na tabela abaixo. O sistema calculará automaticamente o percentual e atualizará todas as demais.
              </p>
            </div>
          )}
        </div>

        {/* Lista de Cotas */}
        <div className="flex-1 overflow-y-auto p-5">
          {error ? (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Crédito Atual</th>
                  <th className="px-4 py-2.5">Novo Crédito Reajustado</th>
                  <th className="px-4 py-2.5 text-right">Variação %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {cotasAtivas.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400">
                      Nenhuma cota ativa cadastrada neste grupo.
                    </td>
                  </tr>
                ) : (
                  cotasAtivas.map((cota, idx) => {
                    const novoVal = Number(valores[cota.id] ?? cota.valor_credito);
                    const varPct =
                      Number(cota.valor_credito) > 0
                        ? ((novoVal / Number(cota.valor_credito)) - 1) * 100
                        : 0;

                    return (
                      <tr
                        key={cota.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40"
                      >
                        <td className="px-4 py-2.5 text-xs text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-600 dark:text-slate-300">
                          {formatBRL(Number(cota.valor_credito))}
                        </td>
                        <td className="px-4 py-2.5">
                          {isFixo ? (
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatBRL(novoVal)}
                            </span>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-400">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={novoVal || ""}
                                onChange={(e) => handleValorCotaChange(cota.id, e.target.value)}
                                className="w-36 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold">
                          <span
                            className={
                              varPct > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : varPct < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-slate-400"
                            }
                          >
                            {varPct > 0 ? "+" : ""}
                            {varPct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
              Observação interna do reajuste (opcional)
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: Reajuste anual aplicado conforme comunicado da Administradora"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-cyan-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex flex-wrap items-center justify-between border-t border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <span className="text-xs font-medium text-slate-500">
            {alteradosCount} de {cotasAtivas.length} cota(s) serão atualizadas
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={pending || alteradosCount === 0}
              className="rounded-lg bg-cyan-700 px-5 py-2 text-xs font-bold text-white shadow hover:bg-cyan-800 disabled:opacity-50"
            >
              {pending ? "Publicando reajuste…" : "Confirmar e Aplicar Reajuste"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
