"use client";

import { useState } from "react";
import type { GrupoConsorcio, GrupoCota } from "@/lib/types";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { formatCurrency } from "@/lib/utils/format";
import {
  calcularParcelasSeguroDaCota,
  grupoUsaSeguroNaParcela,
  type GrupoBulkEstimateInput,
} from "@/lib/grupos/calculos";
import {
  deleteCotaAction,
  setCotaAtivoAction,
  updateCotaAction,
} from "@/app/admin/grupos/actions";

type Props = {
  grupoId: string;
  grupo: GrupoConsorcio;
  cotas: GrupoCota[];
  canHardDelete: boolean;
};

function grupoConfigFromGrupo(grupo: GrupoConsorcio): GrupoBulkEstimateInput {
  return {
    seguro_habilitado: grupo.seguro_habilitado,
    seguro_pos_contemplacao: grupo.seguro_pos_contemplacao,
    seguro_percentual: grupo.seguro_percentual,
    seguro_valor: grupo.seguro_valor,
    tem_parcela_reduzida: grupo.tem_parcela_reduzida,
    percentual_parcela_reduzida: grupo.percentual_parcela_reduzida,
    taxa_administrativa_percentual: grupo.taxa_administrativa_percentual,
    fundo_reserva_percentual: grupo.fundo_reserva_percentual,
    prazo_total: grupo.prazo_total,
    parcelas_realizadas: grupo.parcelas_realizadas,
    prazo_restante: grupo.prazo_restante,
  };
}

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

function SeguroCotaResumo({
  c,
  grupoCfg,
}: {
  c: GrupoCota;
  grupoCfg: GrupoBulkEstimateInput;
}) {
  if (!grupoUsaSeguroNaParcela(grupoCfg)) {
    return (
      <p className="text-xs text-zinc-500 sm:col-span-2 lg:col-span-3">
        Seguro desligado neste grupo (marque Seguro habilitado ou pós-contemplação e salve o grupo).
      </p>
    );
  }
  const saldo =
    c.saldo_devedor != null && Number(c.saldo_devedor) > 0
      ? Number(c.saldo_devedor)
      : Number(c.valor_credito);
  const integral = Number(c.parcela_integral ?? c.parcela_sem_seguro ?? 0);
  const reduzida = c.parcela_reduzida != null ? Number(c.parcela_reduzida) : null;
  const p = calcularParcelasSeguroDaCota(
    { saldoDevedor: saldo, parcelaIntegral: integral, parcelaReduzida: reduzida },
    grupoCfg,
  );
  return (
    <div className="rounded-md border border-amber-600/30 bg-amber-500/5 p-3 text-xs text-zinc-700 dark:text-zinc-300 sm:col-span-2 lg:col-span-3">
      <p className="font-medium text-amber-800 dark:text-amber-300">Seguro prestamista (saldo × fator)</p>
      <p className="mt-1">
        Seguro mensal: <strong>{formatCurrency(p.seguroMensal)}</strong> — base saldo devedor{" "}
        {formatCurrency(saldo)}
      </p>
      <p className="mt-1">
        Com seguro (integral): <strong>{formatCurrency(p.parcelaIntegralComSeguro)}</strong>
        {p.parcelaReduzidaComSeguro != null ? (
          <>
            {" "}
            · Com seguro (reduzida):{" "}
            <strong>{formatCurrency(p.parcelaReduzidaComSeguro)}</strong>
          </>
        ) : null}
      </p>
      <p className="mt-1 text-zinc-500">
        Ao salvar a cota ou o grupo, o campo &quot;Com seguro (persistido)&quot; recebe a reduzida+seguro
        quando o grupo usa parcela reduzida; no simulador /grupos o seguro soma à parcela escolhida
        (reduzida ou integral).
      </p>
    </div>
  );
}

export function GrupoCotasAdmin({ grupoId, grupo, cotas, canHardDelete }: Props) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const grupoCfg = grupoConfigFromGrupo(grupo);

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
        Edite valores e salve por linha. Seguro = fator do grupo (ex. 0,0004) × saldo devedor, somado
        à parcela integral ou à reduzida.
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
                {numField("saldo_devedor", "Saldo devedor (base seguro)", c.saldo_devedor != null ? Number(c.saldo_devedor) : null)}
                {numField("valor_parcela", "Parcela (reduzida ou atual)", c.valor_parcela != null ? Number(c.valor_parcela) : null)}
                {numField("parcela_integral", "Parcela integral (sem seguro)", c.parcela_integral != null ? Number(c.parcela_integral) : null)}
                {numField("parcela_reduzida", "Parcela reduzida (sem seguro)", c.parcela_reduzida != null ? Number(c.parcela_reduzida) : null)}
                {numField("parcela_sem_seguro", "Sem seguro (= integral)", c.parcela_sem_seguro != null ? Number(c.parcela_sem_seguro) : null)}
                {numField("parcela_com_seguro", "Com seguro (persistido)", c.parcela_com_seguro != null ? Number(c.parcela_com_seguro) : null)}
                <SeguroCotaResumo c={c} grupoCfg={grupoCfg} />
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
