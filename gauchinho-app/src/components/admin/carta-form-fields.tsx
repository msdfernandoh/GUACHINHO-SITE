"use client";

import type { ParsedCartaWhatsApp } from "@/lib/cartas/types";
import { CARTA_STATUS, CARTA_STATUS_LABELS, CARTA_TIPOS } from "@/lib/cartas/types";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";

type Initial = Record<string, unknown> | ParsedCartaWhatsApp | undefined;

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function moneyStr(v: unknown): string {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CartaFormFields({
  initial,
  submitLabel = "Salvar carta",
}: {
  initial?: Initial;
  submitLabel?: string;
}) {
  const g = (initial ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Tipo da carta</Label>
          <Select name="tipo_carta" defaultValue={str(g.tipo_carta) || "imovel"} required>
            {CARTA_TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Administradora</Label>
          <Input name="administradora" defaultValue={str(g.administradora)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Crédito</Label>
          <Input name="credito" placeholder="1.012.000,00" defaultValue={moneyStr(g.credito)} />
        </div>
        <div>
          <Label>Entrada</Label>
          <Input name="entrada" placeholder="389.000,00" defaultValue={moneyStr(g.entrada)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Prazo (parcelas)</Label>
          <Input name="prazo_quantidade" type="number" defaultValue={str(g.prazo_quantidade)} />
        </div>
        <div>
          <Label>Valor da parcela</Label>
          <Input name="valor_parcela" placeholder="14.025,00" defaultValue={moneyStr(g.valor_parcela)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Saldo devedor</Label>
          <Input name="saldo_devedor" defaultValue={moneyStr(g.saldo_devedor)} />
        </div>
        <div>
          <Label>Próxima parcela</Label>
          <Input name="proxima_parcela_data" type="date" defaultValue={str(g.proxima_parcela_data).slice(0, 10)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Taxa de transferência</Label>
          <Input name="taxa_transferencia" defaultValue={moneyStr(g.taxa_transferencia)} />
        </div>
        <div>
          <Label>Status</Label>
          <Select name="status" defaultValue={str(g.status) || "consultar_disponibilidade"}>
            {CARTA_STATUS.map((s) => (
              <option key={s} value={s}>
                {CARTA_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="destaque" defaultChecked={!!g.destaque} />
        Destaque
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="ativo" defaultChecked={g.ativo !== false} />
        Ativo
      </label>
      <div>
        <Label>Observações</Label>
        <Textarea name="observacoes" rows={3} defaultValue={str(g.observacoes)} />
      </div>
      <input type="hidden" name="texto_original" value={str(g.texto_original)} />
      <Button type="submit">{submitLabel}</Button>
    </div>
  );
}
