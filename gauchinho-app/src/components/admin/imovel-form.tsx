import type { ImovelRow } from "@/lib/imoveis/types";
import { IMOVEL_STATUS, IMOVEL_TIPOS } from "@/lib/imoveis/types";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";

type ImobOption = { id: string; nome: string };

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  imobiliarias?: ImobOption[];
  imovel?: ImovelRow & { imobiliarias?: { nome: string } };
  showImobiliariaSelect?: boolean;
  defaultImobiliariaId?: string;
};

export function ImovelForm({
  action,
  imobiliarias,
  imovel,
  showImobiliariaSelect,
  defaultImobiliariaId,
}: Props) {
  return (
    <form action={action} encType="multipart/form-data" className="max-w-2xl space-y-4 rounded-xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {showImobiliariaSelect && imobiliarias && (
        <div>
          <Label>Imobiliária</Label>
          <Select name="imobiliaria_id" defaultValue={imovel?.imobiliaria_id ?? defaultImobiliariaId} required>
            {imobiliarias.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome}
              </option>
            ))}
          </Select>
        </div>
      )}
      {!showImobiliariaSelect && defaultImobiliariaId && (
        <input type="hidden" name="imobiliaria_id" value={defaultImobiliariaId} />
      )}
      <div>
        <Label>Título</Label>
        <Input name="titulo" defaultValue={imovel?.titulo} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Tipo</Label>
          <Select name="tipo_imovel" defaultValue={imovel?.tipo_imovel ?? "casa"}>
            {IMOVEL_TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select name="status" defaultValue={imovel?.status ?? "ativo"}>
            {IMOVEL_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Cidade</Label>
          <Input name="cidade" defaultValue={imovel?.cidade ?? ""} />
        </div>
        <div>
          <Label>Bairro</Label>
          <Input name="bairro" defaultValue={imovel?.bairro ?? ""} />
        </div>
      </div>
      <div>
        <Label>Valor (R$)</Label>
        <Input name="valor" defaultValue={imovel?.valor != null ? String(imovel.valor) : ""} placeholder="550.000,00" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="exibir_valor_publico" defaultChecked={imovel?.exibir_valor_publico} />
        Exibir valor no site
      </label>
      <div>
        <Label>Foto principal</Label>
        <Input name="foto_file" type="file" accept="image/*" />
      </div>
      <div>
        <Label>Descrição curta</Label>
        <Textarea name="descricao_curta" rows={2} defaultValue={imovel?.descricao_curta ?? ""} />
      </div>
      <div>
        <Label>Descrição completa</Label>
        <Textarea name="descricao_completa" rows={5} defaultValue={imovel?.descricao_completa ?? ""} />
      </div>
      <div>
        <Label>Link externo</Label>
        <Input name="link_externo" defaultValue={imovel?.link_externo ?? ""} />
      </div>
      <div>
        <Label>WhatsApp específico (opcional)</Label>
        <Input name="whatsapp" defaultValue={imovel?.whatsapp ?? ""} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="usar_whatsapp_imobiliaria" defaultChecked={imovel?.usar_whatsapp_imobiliaria ?? true} />
        Usar WhatsApp da imobiliária
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="destaque" defaultChecked={imovel?.destaque} /> Destaque
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="ativo" defaultChecked={imovel?.ativo ?? true} /> Ativo
      </label>
      <Button type="submit">Salvar imóvel</Button>
    </form>
  );
}
