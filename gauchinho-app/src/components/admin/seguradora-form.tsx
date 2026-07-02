import type { SeguradoraRow } from "@/lib/seguradoras/types";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  seguradora?: SeguradoraRow;
};

export function SeguradoraForm({ action, seguradora }: Props) {
  return (
    <form action={action} encType="multipart/form-data" className="max-w-2xl space-y-4 rounded-xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <Label>Nome</Label>
        <Input name="nome" defaultValue={seguradora?.nome} required />
      </div>
      <div>
        <Label>Slug (URL)</Label>
        <Input name="slug" defaultValue={seguradora?.slug ?? ""} placeholder="auto a partir do nome" />
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={seguradora?.ativo ?? true} /> Ativa
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="publicado" defaultChecked={seguradora?.publicado ?? true} /> Publicada
        </label>
      </div>
      <div>
        <Label>Ordem</Label>
        <Input name="ordem" type="number" defaultValue={seguradora?.ordem ?? 0} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Cidade</Label>
          <Input name="cidade" defaultValue={seguradora?.cidade ?? ""} />
        </div>
        <div>
          <Label>Estado (UF)</Label>
          <Input name="estado" defaultValue={seguradora?.estado ?? ""} maxLength={2} />
        </div>
      </div>
      <div>
        <Label>Endereço</Label>
        <Input name="endereco" defaultValue={seguradora?.endereco ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Número</Label>
          <Input name="numero" defaultValue={seguradora?.numero ?? ""} />
        </div>
        <div>
          <Label>Bairro</Label>
          <Input name="bairro" defaultValue={seguradora?.bairro ?? ""} />
        </div>
        <div>
          <Label>Complemento</Label>
          <Input name="complemento" defaultValue={seguradora?.complemento ?? ""} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Telefone</Label>
          <Input name="telefone" defaultValue={seguradora?.telefone ?? ""} />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input name="whatsapp" defaultValue={seguradora?.whatsapp ?? ""} />
        </div>
      </div>
      <div>
        <Label>Site (URL)</Label>
        <Input name="site_url" defaultValue={seguradora?.site_url ?? ""} placeholder="https://..." />
      </div>
      <div>
        <Label>Descrição (pública)</Label>
        <Textarea name="descricao" rows={4} defaultValue={seguradora?.descricao ?? ""} />
      </div>
      <div>
        <Label>Observações internas</Label>
        <Textarea name="observacoes" rows={2} defaultValue={seguradora?.observacoes ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Logo (upload)</Label>
          <Input name="logo_file" type="file" accept="image/*" />
          {seguradora?.logo_url ? (
            <p className="mt-1 truncate text-xs text-zinc-500">{seguradora.logo_url}</p>
          ) : null}
        </div>
        <div>
          <Label>Imagem / banner (upload)</Label>
          <Input name="imagem_file" type="file" accept="image/*" />
          {seguradora?.imagem_url ? (
            <p className="mt-1 truncate text-xs text-zinc-500">{seguradora.imagem_url}</p>
          ) : null}
        </div>
      </div>
      <input type="hidden" name="logo_url" value={seguradora?.logo_url ?? ""} />
      <input type="hidden" name="imagem_url" value={seguradora?.imagem_url ?? ""} />
      <Button type="submit">Salvar</Button>
    </form>
  );
}
