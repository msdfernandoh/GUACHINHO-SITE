"use client";

import { useState } from "react";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { surfaceInputDark, surfaceSelectDark } from "@/components/ui/form-primitives";
import {
  AGENDA_FECHAMENTO_PRODUTOS,
  AGENDA_PERDA_MOTIVOS,
  type AgendaFechamentoTipoParcela,
} from "@/lib/agenda/fechamento";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
};

export function AgendaConcluirForm({ action }: Props) {
  const [outcome, setOutcome] = useState<"ganho" | "perda">("ganho");
  const [tipoParcela, setTipoParcela] = useState<AgendaFechamentoTipoParcela>("integral");

  return (
    <form action={action} className="mt-3 space-y-3 border-t border-zinc-800 pt-3">
      <input type="hidden" name="outcome" value={outcome} />

      <div>
        <Label>Resultado do atendimento</Label>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="outcome_ui"
              checked={outcome === "ganho"}
              onChange={() => setOutcome("ganho")}
            />
            Ganho (fechou)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="outcome_ui"
              checked={outcome === "perda"}
              onChange={() => setOutcome("perda")}
            />
            Perda
          </label>
        </div>
      </div>

      {outcome === "ganho" ? (
        <div className="space-y-3 rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3">
          <div>
            <Label>Tipo do bem</Label>
            <Select name="produto_fechado" required className={surfaceSelectDark}>
              <option value="">Selecione…</option>
              {AGENDA_FECHAMENTO_PRODUTOS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Valor do crédito vendido (R$)</Label>
            <Input
              name="valor_credito"
              type="text"
              inputMode="decimal"
              placeholder="Ex.: 150000 ou 150.000,00"
              required
              className={surfaceInputDark}
            />
          </div>
          <div>
            <Label>Tipo de parcela</Label>
            <Select
              name="tipo_parcela"
              value={tipoParcela}
              onChange={(e) => setTipoParcela(e.target.value as AgendaFechamentoTipoParcela)}
              className={surfaceSelectDark}
            >
              <option value="integral">Integral</option>
              <option value="reduzida">Reduzida (%)</option>
            </Select>
          </div>
          {tipoParcela === "reduzida" ? (
            <div>
              <Label>Percentual da parcela reduzida (%)</Label>
              <Input
                name="percentual_parcela"
                type="number"
                min={1}
                max={100}
                step="0.01"
                placeholder="Ex.: 60"
                required
                className={surfaceInputDark}
              />
            </div>
          ) : null}
          <div>
            <Label>Valor da parcela (opcional)</Label>
            <Input
              name="valor_parcela"
              type="text"
              inputMode="decimal"
              placeholder="Ex.: 850,00"
              className={surfaceInputDark}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-red-900/40 bg-red-950/20 p-3">
          <div>
            <Label>Motivo</Label>
            <Select name="motivo_perda" required className={surfaceSelectDark}>
              {AGENDA_PERDA_MOTIVOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      <div>
        <Label>Observação</Label>
        <Textarea name="observacao_resultado" rows={2} placeholder="Opcional" className={surfaceInputDark} />
      </div>

      <AdminFormSubmitButton size="sm" label="Registrar conclusão" pendingLabel="Registrando…" />
    </form>
  );
}
