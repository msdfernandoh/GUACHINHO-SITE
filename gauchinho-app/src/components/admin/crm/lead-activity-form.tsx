import { ATIVIDADE_TIPOS } from "@/lib/crm/constants";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";

type Props = {
  action: (formData: FormData) => Promise<void>;
};

export function LeadActivityForm({ action }: Props) {
  return (
    <form action={action} className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h3 className="font-semibold text-zinc-100">Nova atividade</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Tipo</Label>
          <Select name="tipo" defaultValue="Ligação">
            {ATIVIDADE_TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Agendar para</Label>
          <Input name="data_agendada" type="datetime-local" />
        </div>
      </div>
      <div>
        <Label>Título</Label>
        <Input name="titulo" placeholder="Ex.: Retornar ligação" />
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea name="descricao" rows={2} />
      </div>
      <Button type="submit" size="sm">
        Criar follow-up
      </Button>
    </form>
  );
}
