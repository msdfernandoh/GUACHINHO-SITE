import type { ImobiliariaRow } from "@/lib/imoveis/types";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  masterFields?: boolean;
  imob?: ImobiliariaRow;
};

export function ImobiliariaForm({ action, masterFields, imob }: Props) {
  return (
    <form action={action} encType="multipart/form-data" className="max-w-2xl space-y-4 rounded-xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <Label>Nome da imobiliária</Label>
        <Input name="nome" defaultValue={imob?.nome} required />
      </div>
      {masterFields && (
        <>
          <div>
            <Label>Slug (URL)</Label>
            <Input name="slug" defaultValue={imob?.slug} placeholder="auto a partir do nome" />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ativo" defaultChecked={imob?.ativo ?? true} /> Ativa
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="exibir_home" defaultChecked={imob?.exibir_home} /> Exibir na home
            </label>
          </div>
          <div>
            <Label>Ordem</Label>
            <Input name="ordem" type="number" defaultValue={imob?.ordem ?? 0} />
          </div>
        </>
      )}
      <div>
        <Label>Responsável</Label>
        <Input name="responsavel" defaultValue={imob?.responsavel ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>E-mail</Label>
          <Input name="email" type="email" defaultValue={imob?.email ?? ""} />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input name="whatsapp" defaultValue={imob?.whatsapp ?? ""} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Telefone</Label>
          <Input name="telefone" defaultValue={imob?.telefone ?? ""} />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input name="cidade" defaultValue={imob?.cidade ?? ""} />
        </div>
      </div>
      <div>
        <Label>Endereço</Label>
        <Input name="endereco" defaultValue={imob?.endereco ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Site</Label>
          <Input name="site" defaultValue={imob?.site ?? ""} />
        </div>
        <div>
          <Label>Instagram</Label>
          <Input name="instagram" defaultValue={imob?.instagram ?? ""} />
        </div>
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea name="descricao" rows={4} defaultValue={imob?.descricao ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Logo (upload)</Label>
          <Input name="logo_file" type="file" accept="image/*" />
          {imob?.logo_url && <p className="mt-1 truncate text-xs text-zinc-500">{imob.logo_url}</p>}
        </div>
        <div>
          <Label>Banner (upload)</Label>
          <Input name="banner_file" type="file" accept="image/*" />
          {imob?.banner_url && <p className="mt-1 truncate text-xs text-zinc-500">{imob.banner_url}</p>}
        </div>
      </div>
      <input type="hidden" name="logo_url" value={imob?.logo_url ?? ""} />
      <input type="hidden" name="banner_url" value={imob?.banner_url ?? ""} />
      <Button type="submit">Salvar</Button>
    </form>
  );
}
