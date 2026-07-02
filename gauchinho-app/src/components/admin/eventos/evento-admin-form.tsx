import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";
import type { EventoRow } from "@/lib/comercial-eventos/types";

type Props = {
  evento?: EventoRow;
  action: (formData: FormData) => Promise<void>;
};

export function EventoAdminForm({ evento, action }: Props) {
  const dataLocal = evento?.data_evento
    ? new Date(evento.data_evento).toISOString().slice(0, 16)
    : "";

  return (
    <form action={action} className="max-w-2xl space-y-4">
      <div>
        <Label>Nome *</Label>
        <Input name="nome" defaultValue={evento?.nome ?? ""} required />
      </div>
      <div>
        <Label>Slug</Label>
        <Input name="slug" defaultValue={evento?.slug ?? ""} placeholder="gerado-do-nome" />
      </div>
      <div>
        <Label>Data do evento</Label>
        <Input name="data_evento" type="datetime-local" defaultValue={dataLocal} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Local</Label>
          <Input name="local" defaultValue={evento?.local ?? ""} />
        </div>
        <div>
          <Label>Cidade</Label>
          <Input name="cidade" defaultValue={evento?.cidade ?? ""} />
        </div>
      </div>
      <div>
        <Label>Endereço</Label>
        <Input name="endereco" defaultValue={evento?.endereco ?? ""} />
      </div>
      <div>
        <Label>Estado (UF)</Label>
        <Input name="estado" maxLength={2} defaultValue={evento?.estado ?? ""} />
      </div>
      <div>
        <Label>Descrição curta</Label>
        <Input name="descricao_curta" defaultValue={evento?.descricao_curta ?? ""} />
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea name="descricao" rows={5} defaultValue={evento?.descricao ?? ""} />
      </div>
      <div>
        <Label>URL imagem capa</Label>
        <Input name="imagem_capa_url" defaultValue={evento?.imagem_capa_url ?? ""} />
      </div>
      <div>
        <Label>URL banner</Label>
        <Input name="banner_url" defaultValue={evento?.banner_url ?? ""} />
      </div>
      <div>
        <Label>Limite de participantes (vagas)</Label>
        <Input name="limite_participantes" type="number" min={1} defaultValue={evento?.limite_participantes ?? ""} />
      </div>
      <div>
        <Label>Mensagem de confirmação</Label>
        <Textarea name="mensagem_confirmacao" rows={2} defaultValue={evento?.mensagem_confirmacao ?? ""} />
      </div>
      <div>
        <Label>Observações internas</Label>
        <Textarea name="observacoes_internas" rows={2} defaultValue={evento?.observacoes_internas ?? ""} />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="ativo" defaultChecked={evento?.ativo !== false} /> Ativo
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="publicado" defaultChecked={!!evento?.publicado} /> Publicado
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="somente_por_link" defaultChecked={evento?.somente_por_link !== false} /> Somente por link
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="evento_destaque" defaultChecked={!!evento?.evento_destaque} /> Destaque (Especialista)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="permitir_acompanhante" defaultChecked={!!evento?.permitir_acompanhante} /> Permitir acompanhante
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="exigir_convidou" defaultChecked={!!evento?.exigir_convidou} /> Exigir quem convidou
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="mostrar_vagas" defaultChecked={evento?.mostrar_vagas !== false} /> Mostrar vagas
        </label>
      </div>
      <Button type="submit">{evento ? "Salvar evento" : "Criar evento"}</Button>
    </form>
  );
}
