import { savePropostaAction } from "@/app/admin/propostas/actions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { PROPOSTA_STATUS } from "@/lib/types";
import { PARCEIROS_SUGERIDOS } from "@/lib/proposta/pdf/types";

export function PropostaForm({ initial }: { initial?: Record<string, unknown> }) {
  return (
    <form action={savePropostaAction} className="space-y-4 rounded-xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {initial?.id ? <input type="hidden" name="id" value={String(initial.id)} /> : null}
      <div>
        <Label>Lead ID (opcional)</Label>
        <Input name="lead_id" defaultValue={String(initial?.lead_id ?? "")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Cliente</Label>
          <Input name="nome_cliente" defaultValue={String(initial?.nome_cliente ?? "")} required />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input name="whatsapp_cliente" defaultValue={String(initial?.whatsapp_cliente ?? "")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Parceiro</Label>
          <Select name="parceiro_nome" defaultValue={String(initial?.parceiro_nome ?? "")}>
            <option value="">—</option>
            {PARCEIROS_SUGERIDOS.map((par) => (
              <option key={par} value={par === "Outro" ? "" : par}>
                {par}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Cidade cliente</Label>
          <Input name="cidade_cliente" defaultValue={String(initial?.cidade_cliente ?? "")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>E-mail cliente</Label>
          <Input name="email_cliente" type="email" defaultValue={String(initial?.email_cliente ?? "")} />
        </div>
        <div>
          <Label>Entrada</Label>
          <Input name="entrada" type="number" step="0.01" defaultValue={String(initial?.entrada ?? "")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Tipo proposta</Label>
          <Input name="tipo_proposta" defaultValue={String(initial?.tipo_proposta ?? "Consórcio")} />
        </div>
        <div>
          <Label>Tipo bem</Label>
          <Input name="tipo_bem" defaultValue={String(initial?.tipo_bem ?? "")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Valor crédito</Label>
          <Input name="valor_credito" type="number" step="0.01" defaultValue={String(initial?.valor_credito ?? "")} />
        </div>
        <div>
          <Label>Prazo</Label>
          <Input name="prazo" type="number" defaultValue={String(initial?.prazo ?? "")} />
        </div>
        <div>
          <Label>Parcela</Label>
          <Input name="valor_parcela" type="number" step="0.01" defaultValue={String(initial?.valor_parcela ?? "")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Consultor</Label>
          <Input name="consultor_nome" defaultValue={String(initial?.consultor_nome ?? "")} />
        </div>
        <div>
          <Label>WhatsApp consultor</Label>
          <Input name="consultor_telefone" defaultValue={String(initial?.consultor_telefone ?? "")} />
        </div>
        <div>
          <Label>E-mail consultor</Label>
          <Input name="consultor_email" defaultValue={String(initial?.consultor_email ?? "")} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Validade (dias)</Label>
          <Input name="validade_dias" type="number" defaultValue={String(initial?.validade_dias ?? 7)} />
        </div>
        <div>
          <Label>Validade manual</Label>
          <Input name="validade_data" type="date" defaultValue={String(initial?.validade_data ?? "")} />
        </div>
      </div>
      <div>
        <Label>Status</Label>
        <Select name="status" defaultValue={String(initial?.status ?? "Gerada")}>
          {PROPOSTA_STATUS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea name="observacoes" rows={3} defaultValue={String(initial?.observacoes ?? "")} />
      </div>
      <Button type="submit">Salvar proposta</Button>
    </form>
  );
}
