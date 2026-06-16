import type { ParceiroInstitucional } from "@/lib/conteudo/types";
import { PARCEIRO_TIPOS } from "@/lib/conteudo/types";
import { ConteudoImageField } from "./conteudo-image-field";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";

type Props = {
  action: (formData: FormData) => Promise<void>;
  initial?: Partial<ParceiroInstitucional>;
  deleteAction?: (id: string) => Promise<void>;
};

export function ParceiroForm({ action, initial, deleteAction }: Props) {
  return (
    <form action={action} className="space-y-6 rounded-xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nome">Nome *</Label>
          <Input id="nome" name="nome" defaultValue={initial?.nome ?? ""} required />
        </div>
        <div>
          <Label htmlFor="tipo">Tipo</Label>
          <select
            id="tipo"
            name="tipo"
            defaultValue={initial?.tipo ?? ""}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">—</option>
            {PARCEIRO_TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" name="cidade" defaultValue={initial?.cidade ?? ""} />
        </div>
        <div>
          <Label htmlFor="estado">Estado</Label>
          <Input id="estado" name="estado" defaultValue={initial?.estado ?? ""} maxLength={2} />
        </div>
        <div>
          <Label htmlFor="site_url">Site</Label>
          <Input id="site_url" name="site_url" defaultValue={initial?.site_url ?? ""} />
        </div>
        <div>
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" name="whatsapp" defaultValue={initial?.whatsapp ?? ""} />
        </div>
        <div>
          <Label htmlFor="ordem">Ordem</Label>
          <Input id="ordem" name="ordem" type="number" defaultValue={initial?.ordem ?? 0} />
        </div>
      </div>
      <div>
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea id="descricao" name="descricao" rows={3} defaultValue={initial?.descricao ?? ""} />
      </div>
      <ConteudoImageField bucket="parceiros" name="logo_url" label="Logo" defaultUrl={initial?.logo_url} />
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="publicado" defaultChecked={initial?.publicado ?? true} /> Publicado
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="destaque" defaultChecked={initial?.destaque ?? false} /> Destaque home
        </label>
      </div>
      <div className="flex gap-3">
        <Button type="submit">Salvar</Button>
        {initial?.id && deleteAction ? (
          <Button type="submit" formAction={deleteAction.bind(null, initial.id)} variant="outline">
            Excluir
          </Button>
        ) : null}
      </div>
    </form>
  );
}
