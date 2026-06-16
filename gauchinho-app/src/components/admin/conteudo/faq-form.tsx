import type { PerguntaFrequente } from "@/lib/conteudo/types";
import { FAQ_CATEGORIAS } from "@/lib/conteudo/types";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";

type Props = {
  action: (formData: FormData) => Promise<void>;
  initial?: Partial<PerguntaFrequente>;
  deleteAction?: (id: string) => Promise<void>;
};

export function FaqForm({ action, initial, deleteAction }: Props) {
  return (
    <form action={action} className="space-y-6 rounded-xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div>
        <Label htmlFor="pergunta">Pergunta *</Label>
        <Input id="pergunta" name="pergunta" defaultValue={initial?.pergunta ?? ""} required />
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
          {FAQ_CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="resposta">Resposta *</Label>
        <Textarea id="resposta" name="resposta" rows={6} defaultValue={initial?.resposta ?? ""} required />
      </div>
      <div>
        <Label htmlFor="ordem">Ordem</Label>
        <Input id="ordem" name="ordem" type="number" defaultValue={initial?.ordem ?? 0} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="publicado" defaultChecked={initial?.publicado ?? true} /> Publicado
      </label>
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
