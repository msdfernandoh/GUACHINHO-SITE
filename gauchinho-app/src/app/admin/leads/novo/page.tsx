import { createLeadManualAction, fetchSrdOptions } from "../actions";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { TIPOS_INTERESSE } from "@/lib/types";
import Link from "next/link";

export default async function NovoLeadPage() {
  const srds = await fetchSrdOptions();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Novo lead manual</h1>
        <Link href="/admin/leads" className="text-sm text-amber-600 hover:underline">
          Voltar
        </Link>
      </div>
      <form action={createLeadManualAction} className="space-y-4 rounded-xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div>
          <Label>Nome *</Label>
          <Input name="nome" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>WhatsApp</Label>
            <Input name="whatsapp" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input name="email" type="email" />
          </div>
        </div>
        <div>
          <Label>Cidade</Label>
          <Input name="cidade" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Origem</Label>
            <Input name="origem" defaultValue="manual" />
          </div>
          <div>
            <Label>Tipo interesse</Label>
            <Select name="tipo_interesse" defaultValue="">
              <option value="">—</option>
              {TIPOS_INTERESSE.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>SRD responsável</Label>
          <Select name="srd_responsavel_id" defaultValue="">
            <option value="">—</option>
            {srds.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </Select>
          <Input name="srd_responsavel_nome" className="mt-2" placeholder="Nome SRD (opcional)" />
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea name="observacoes" rows={3} />
        </div>
        <Button type="submit">Salvar lead</Button>
      </form>
    </div>
  );
}
