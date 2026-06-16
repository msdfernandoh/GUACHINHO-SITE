"use client";

import { useState } from "react";
import type { GrupoCota } from "@/lib/types";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { formatCurrency } from "@/lib/utils/format";
import {
  deleteCotaAction,
  setCotaAtivoAction,
  updateCotaAction,
} from "@/app/admin/grupos/actions";

type Props = {
  grupoId: string;
  cotas: GrupoCota[];
  canHardDelete: boolean;
};

function numField(name: string, label: string, defaultValue: number | null | undefined) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        name={name}
        type="number"
        step="0.01"
        className="h-9 text-sm"
        defaultValue={defaultValue != null ? String(defaultValue) : ""}
      />
    </div>
  );
}

export function GrupoCotasAdmin({ grupoId, cotas, canHardDelete }: Props) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!cotas.length) {
    return (
      <section className="rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-2 font-semibold">Cotas cadastradas</h2>
        <p className="text-sm text-zinc-500">Nenhuma cota. Use o campo bulk acima para adicionar.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="font-semibold">Cotas cadastradas</h2>
      <p className="text-xs text-zinc-500">
        Edite valores e salve por linha. Cotas inativas não aparecem em /grupos.
      </p>
      <div className="space-y-6">
        {cotas.map((c) => {
          const update = updateCotaAction.bind(null, c.id, grupoId);
          const toggleOff = setCotaAtivoAction.bind(null, c.id, grupoId, false);
          const toggleOn = setCotaAtivoAction.bind(null, c.id, grupoId, true);
          const del = deleteCotaAction.bind(null, c.id, grupoId);
          return (
            <div
              key={c.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  {formatCurrency(Number(c.valor_credito))}
                  {!c.ativo ? (
                    <span className="ml-2 text-xs text-zinc-500">(inativa)</span>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-2">
                  {c.ativo ? (
                    <form action={toggleOff}>
                      <Button type="submit" size="sm" variant="outline" className="border-zinc-600 bg-zinc-900 text-zinc-100">
                        Inativar
                      </Button>
                    </form>
                  ) : (
                    <form action={toggleOn}>
                      <Button type="submit" size="sm" variant="outline" className="border-zinc-600 bg-zinc-900 text-zinc-100">
                        Reativar
                      </Button>
                    </form>
                  )}
                  {canHardDelete ? (
                    confirmDeleteId === c.id ? (
                      <form action={del} className="flex items-center gap-2">
                        <span className="text-xs text-red-600">Excluir definitivamente?</span>
                        <Button type="submit" size="sm" variant="danger">
                          Confirmar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancelar
                        </Button>
                      </form>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => setConfirmDeleteId(c.id)}
                      >
                        Excluir
                      </Button>
                    )
                  ) : null}
                </div>
              </div>
              <form action={update} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {numField("valor_credito", "Valor crédito", Number(c.valor_credito))}
                {numField("valor_parcela", "Parcela", c.valor_parcela != null ? Number(c.valor_parcela) : null)}
                {numField("parcela_integral", "Parcela integral", c.parcela_integral != null ? Number(c.parcela_integral) : null)}
                {numField("parcela_reduzida", "Parcela reduzida", c.parcela_reduzida != null ? Number(c.parcela_reduzida) : null)}
                {numField("parcela_com_seguro", "Com seguro", c.parcela_com_seguro != null ? Number(c.parcela_com_seguro) : null)}
                {numField("parcela_sem_seguro", "Sem seguro", c.parcela_sem_seguro != null ? Number(c.parcela_sem_seguro) : null)}
                {numField("saldo_devedor", "Saldo devedor", c.saldo_devedor != null ? Number(c.saldo_devedor) : null)}
                <div>
                  <Label className="text-xs">Status</Label>
                  <Input name="status" defaultValue={c.status} className="h-9 text-sm" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="ativo" value="on" defaultChecked={c.ativo} />
                    Ativa
                  </label>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Button type="submit" variant="gold" size="sm">
                    Salvar cota
                  </Button>
                </div>
              </form>
            </div>
          );
        })}
      </div>
      {canHardDelete ? (
        <p className="text-xs text-zinc-500">
          Master: excluir cota remove permanentemente. Use inativar para ocultar em /grupos.
        </p>
      ) : null}
    </section>
  );
}
