import type { Depoimento } from "@/lib/conteudo/types";
import { ConteudoImageField } from "./conteudo-image-field";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";

type Props = {
  action: (formData: FormData) => Promise<void>;
  initial?: Partial<Depoimento>;
  deleteAction?: (id: string) => Promise<void>;
};

export function DepoimentoForm({ action, initial, deleteAction }: Props) {
  return (
    <form action={action} className="space-y-6 rounded-xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nome">Nome *</Label>
          <Input id="nome" name="nome" defaultValue={initial?.nome ?? ""} required />
        </div>
        <div>
          <Label htmlFor="nota">Nota (1-5)</Label>
          <Input id="nota" name="nota" type="number" min={1} max={5} defaultValue={initial?.nota ?? ""} />
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
          <Label htmlFor="tipo_interesse">Tipo interesse</Label>
          <Input id="tipo_interesse" name="tipo_interesse" defaultValue={initial?.tipo_interesse ?? ""} />
        </div>
        <div>
          <Label htmlFor="ordem">Ordem</Label>
          <Input id="ordem" name="ordem" type="number" defaultValue={initial?.ordem ?? 0} />
        </div>
      </div>
      <div>
        <Label htmlFor="texto">Texto *</Label>
        <Textarea id="texto" name="texto" rows={5} defaultValue={initial?.texto ?? ""} required />
      </div>
      <ConteudoImageField bucket="depoimentos" name="foto_url" label="Foto" defaultUrl={initial?.foto_url} />
      <div>
        <Label htmlFor="video_url">Vídeo URL</Label>
        <Input id="video_url" name="video_url" defaultValue={initial?.video_url ?? ""} />
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="publicado" defaultChecked={initial?.publicado ?? false} /> Publicado
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="destaque" defaultChecked={initial?.destaque ?? false} /> Destaque
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
