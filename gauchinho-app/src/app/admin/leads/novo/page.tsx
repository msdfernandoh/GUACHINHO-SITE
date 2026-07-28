import { createLeadManualAction, fetchSrdOptions } from "../actions";
import { fetchEventosOptionsForFilter } from "@/app/admin/eventos/actions";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { TIPOS_INTERESSE } from "@/lib/types";
import { TIPOS_SONHO_SORTEIO } from "@/lib/eventos-sorteio/types";
import Link from "next/link";

export default async function NovoLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const sp = await searchParams;
  const [srds, eventos] = await Promise.all([fetchSrdOptions(), fetchEventosOptionsForFilter()]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Novo lead manual</h1>
        <Link href="/admin/leads" className="text-sm text-amber-600 hover:underline">
          Voltar
        </Link>
      </div>

      {sp.ok === "1" ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Lead salvo. Preencha o formulário para incluir outro.
        </div>
      ) : null}

      <form
        action={createLeadManualAction}
        className="space-y-4 rounded-xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Tipo do sonho</Label>
            <Select name="tipo_sonho" defaultValue="">
              <option value="">—</option>
              {TIPOS_SONHO_SORTEIO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-zinc-500">Mesmas opções do cadastro de evento/sorteio.</p>
          </div>
          <div>
            <Label>Evento</Label>
            <Select name="evento_id" defaultValue="">
              <option value="">—</option>
              {eventos.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>Produto (opcional)</Label>
          <Input
            name="produto_interesse"
            placeholder="Ex.: Imóvel, Veículo — não use o nome do evento"
          />
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
        <div className="flex flex-wrap gap-2">
          <AdminFormSubmitButton label="Salvar lead" />
          <Button type="submit" name="intent" value="stay" variant="outline" className="min-h-10">
            Incluir novo lead
          </Button>
        </div>
        <p className="text-xs text-zinc-500">
          Use &quot;Incluir novo lead&quot; para salvar e continuar cadastrando sem sair da tela.
        </p>
      </form>
    </div>
  );
}
