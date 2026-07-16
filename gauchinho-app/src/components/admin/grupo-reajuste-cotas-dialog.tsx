"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  fetchCotasParaReajusteAction,
  reajustarCotasGrupoAction,
  type CotaReajusteAdminRow,
} from "@/app/admin/grupos/actions";
import {
  aplicarFatorCreditoEmTodas,
  aplicarFatorParcelaEmTodas,
  aplicarPercentualNasCotas,
  type CotaReajusteBase,
} from "@/lib/grupos/reajuste-cotas";
import { formatCurrency } from "@/lib/utils/format";
import { Button, Input, Label } from "@/components/ui/form-primitives";

type LinhaEdit = {
  id: string;
  valor_credito_atual: number;
  valor_parcela_atual: number;
  valor_credito_novo: number;
  valor_parcela_nova: number;
};

type Props = {
  grupoId: string;
  codigoGrupo: string;
  open: boolean;
  onClose: () => void;
};

function toBase(cotas: CotaReajusteAdminRow[]): CotaReajusteBase[] {
  return cotas.map((c) => ({
    id: c.id,
    valor_credito: c.valor_credito,
    valor_parcela: c.valor_parcela,
    parcela_integral: c.parcela_integral,
    parcela_reduzida: c.parcela_reduzida,
    saldo_devedor: c.saldo_devedor,
    ordem: c.ordem,
  }));
}

export function GrupoReajusteCotasDialog({ grupoId, codigoGrupo, open, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseCotas, setBaseCotas] = useState<CotaReajusteAdminRow[]>([]);
  const [marco, setMarco] = useState(0);
  const [precisaMarcar, setPrecisaMarcar] = useState(false);
  const [percentual, setPercentual] = useState("0");
  const [ajusteFino, setAjusteFino] = useState(false);
  const [linhas, setLinhas] = useState<LinhaEdit[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPercentual("0");
    setAjusteFino(false);
    void fetchCotasParaReajusteAction(grupoId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        setBaseCotas([]);
        setLinhas([]);
        return;
      }
      setBaseCotas(res.cotas);
      setMarco(res.marco);
      setPrecisaMarcar(res.precisaMarcarReajuste);
      setLinhas(aplicarPercentualNasCotas(toBase(res.cotas), 0));
    });
    return () => {
      cancelled = true;
    };
  }, [open, grupoId]);

  const base = useMemo(() => toBase(baseCotas), [baseCotas]);

  const aplicarPercentual = () => {
    const pct = Number(String(percentual).replace(",", "."));
    if (!Number.isFinite(pct)) {
      setError("Percentual inválido.");
      return;
    }
    setError(null);
    setLinhas(aplicarPercentualNasCotas(base, pct));
  };

  const patchLinha = (
    id: string,
    field: "valor_credito_novo" | "valor_parcela_nova",
    raw: string,
  ) => {
    const n = Number(raw);
    setLinhas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: Number.isFinite(n) ? n : 0 } : l)),
    );
  };

  /** Ao sair do campo crédito: propaga o mesmo fator (desligado no ajuste fino). */
  const propagarCredito = (id: string, raw: string) => {
    if (ajusteFino) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    const { percentual: pct, linhas: next } = aplicarFatorCreditoEmTodas(base, id, n);
    setPercentual(String(pct));
    setLinhas(next);
  };

  /** Ao sair do campo parcela: propaga o mesmo fator (desligado no ajuste fino). */
  const propagarParcela = (id: string, raw: string) => {
    if (ajusteFino) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    const { percentual: pct, linhas: next } = aplicarFatorParcelaEmTodas(base, id, n);
    setPercentual(String(pct));
    setLinhas(next);
  };

  const confirmar = () => {
    if (
      !confirm(
        `Confirmar reajuste do grupo ${codigoGrupo} em ${linhas.length} cota(s)?\n\nOs valores de crédito e parcela serão salvos${precisaMarcar ? ` e o destaque de ${marco} meses será removido` : ""}.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await reajustarCotasGrupoAction(
        grupoId,
        linhas.map((l) => ({
          id: l.id,
          valor_credito: l.valor_credito_novo,
          valor_parcela: l.valor_parcela_nova,
        })),
        { marcarReajuste: true },
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reajuste-cotas-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div>
            <h2 id="reajuste-cotas-title" className="text-lg font-bold text-zinc-50">
              Ajustar cotas — {codigoGrupo}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              Só crédito e parcela. Use o % ou edite uma linha (ao sair do campo, replica nas
              demais). Depois ajuste fino e confirme.
            </p>
            {precisaMarcar ? (
              <p className="mt-1 text-xs font-semibold text-amber-400">
                Marco {marco} meses — ao confirmar, o destaque sai da lista.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3">
          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-400">Carregando cotas…</p>
          ) : linhas.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-400">Nenhuma cota ativa neste grupo.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="min-w-[8rem]">
                  <Label>Percentual (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={percentual}
                    onChange={(e) => setPercentual(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        aplicarPercentual();
                      }
                    }}
                    className="mt-1"
                  />
                </div>
                <Button type="button" onClick={aplicarPercentual} disabled={pending}>
                  Aplicar % em todas
                </Button>
                <label className="flex items-center gap-2 pb-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={ajusteFino}
                    onChange={(e) => setAjusteFino(e.target.checked)}
                  />
                  Ajuste fino (editar uma cota sem alterar as outras)
                </label>
              </div>

              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-400">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Crédito atual</th>
                      <th className="px-3 py-2">Crédito novo</th>
                      <th className="px-3 py-2">Parcela atual</th>
                      <th className="px-3 py-2">Parcela nova</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, idx) => (
                      <tr key={l.id} className="border-t border-zinc-800">
                        <td className="px-3 py-2 text-zinc-500">{idx + 1}</td>
                        <td className="px-3 py-2 tabular-nums text-zinc-400">
                          {formatCurrency(l.valor_credito_atual)}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={l.valor_credito_novo}
                            onChange={(e) => patchLinha(l.id, "valor_credito_novo", e.target.value)}
                            onBlur={(e) => propagarCredito(l.id, e.target.value)}
                            className="min-w-[8rem] tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-2 tabular-nums text-zinc-400">
                          {formatCurrency(l.valor_parcela_atual)}
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={l.valor_parcela_nova}
                            onChange={(e) => patchLinha(l.id, "valor_parcela_nova", e.target.value)}
                            onBlur={(e) => propagarParcela(l.id, e.target.value)}
                            className="min-w-[7rem] tabular-nums"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-800 px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={confirmar}
            disabled={pending || loading || linhas.length === 0}
            className="min-w-[10rem]"
          >
            {pending ? "Salvando…" : "Confirmar reajuste"}
          </Button>
        </div>
      </div>
    </div>
  );
}
