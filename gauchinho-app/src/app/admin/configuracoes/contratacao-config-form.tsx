"use client";

import { saveContratacaoOnlineConfigAction } from "./actions";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Input, Label, Textarea } from "@/components/ui/form-primitives";
import {
  DEFAULT_CONTRATACAO_ONLINE_CONFIG,
  type ContratacaoOnlineConfig,
} from "@/lib/contratacoes-online/pagamento";

export function ContratacaoConfigForm({ initial }: { initial: Partial<ContratacaoOnlineConfig> }) {
  const cfg = { ...DEFAULT_CONTRATACAO_ONLINE_CONFIG, ...initial };
  return (
    <form action={saveContratacaoOnlineConfigAction} className="max-w-xl space-y-4">
      <h2 className="text-lg font-semibold">Contratação online</h2>
      <p className="text-sm text-zinc-500">Pix na primeira parcela — fechamento da proposta</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="pix_primeira_parcela_ativo" defaultChecked={cfg.pix_primeira_parcela_ativo} />
        Ativar Pix como opção de pagamento
      </label>
      <div>
        <Label>Chave Pix</Label>
        <Input name="pix_chave" defaultValue={cfg.pix_chave} className="mt-1" />
      </div>
      <div>
        <Label>Nome do recebedor</Label>
        <Input name="pix_recebedor" defaultValue={cfg.pix_recebedor} className="mt-1" />
      </div>
      <div>
        <Label>Texto de instrução Pix</Label>
        <Textarea name="pix_instrucoes" defaultValue={cfg.pix_instrucoes} rows={3} className="mt-1" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="comprovante_pix_obrigatorio"
          defaultChecked={cfg.comprovante_pix_obrigatorio}
        />
        Comprovante Pix obrigatório
      </label>
      <AdminFormSubmitButton>Salvar contratação</AdminFormSubmitButton>
    </form>
  );
}
