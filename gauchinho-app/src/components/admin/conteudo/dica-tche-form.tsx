import type { DicaTche } from "@/lib/conteudo/types";
import { DICA_CATEGORIAS } from "@/lib/conteudo/types";
import { ConteudoImageField } from "./conteudo-image-field";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";
import { slugify } from "@/lib/utils/slug";

type Props = {
  action: (formData: FormData) => Promise<void>;
  initial?: Partial<DicaTche>;
  deleteAction?: (id: string) => Promise<void>;
};

export function DicaTcheForm({ action, initial, deleteAction }: Props) {
  const previewSlug = initial?.slug || slugify(initial?.titulo ?? "nova-dica");

  return (
    <form action={action} className="space-y-6 rounded-xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div>
        <Label htmlFor="titulo">Título *</Label>
        <Input id="titulo" name="titulo" defaultValue={initial?.titulo ?? ""} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" defaultValue={initial?.slug ?? ""} placeholder={previewSlug} />
        </div>
        <div>
          <Label htmlFor="categoria">Categoria</Label>
          <select
            id="categoria"
            name="categoria"
            defaultValue={initial?.categoria ?? ""}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">—</option>
            {DICA_CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="ordem">Ordem</Label>
          <Input id="ordem" name="ordem" type="number" defaultValue={initial?.ordem ?? 0} />
        </div>
      </div>
      <div>
        <Label htmlFor="descricao_curta">Descrição curta</Label>
        <Textarea id="descricao_curta" name="descricao_curta" rows={2} defaultValue={initial?.descricao_curta ?? ""} />
      </div>
      <div>
        <Label htmlFor="conteudo">Conteúdo</Label>
        <Textarea id="conteudo" name="conteudo" rows={10} defaultValue={initial?.conteudo ?? ""} />
      </div>
      <ConteudoImageField bucket="conteudo" name="imagem_url" label="Imagem" defaultUrl={initial?.imagem_url} />
      <div>
        <Label htmlFor="video_url">Vídeo URL</Label>
        <Input id="video_url" name="video_url" defaultValue={initial?.video_url ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="seo_title">SEO title</Label>
          <Input id="seo_title" name="seo_title" defaultValue={initial?.seo_title ?? ""} />
        </div>
        <div>
          <Label htmlFor="seo_description">SEO description</Label>
          <Input id="seo_description" name="seo_description" defaultValue={initial?.seo_description ?? ""} />
        </div>
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
