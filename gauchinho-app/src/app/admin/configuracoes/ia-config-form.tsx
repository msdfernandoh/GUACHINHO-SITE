"use client";

import type { IaConfig } from "@/lib/config/ia-defaults";
import { saveIaConfigAction } from "./actions";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";

type Props = { cfg: IaConfig };

export function IaConfigForm({ cfg }: Props) {
  return (
    <form action={saveIaConfigAction} className="max-w-2xl space-y-6">
      <section className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">Ativação</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={cfg.ativo} />
          Ativar chat
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="capturaLeadAtiva" defaultChecked={cfg.capturaLeadAtiva} />
          Ativar captura de lead
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="exigirWhatsappAnalise" defaultChecked={cfg.exigirWhatsappAnalise} />
          Exigir WhatsApp para análise completa
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="mostrarWhatsappPosLead" defaultChecked={cfg.mostrarWhatsappPosLead} />
          Mostrar botão WhatsApp pós-lead
        </label>
        <div>
          <Label>WhatsApp — chave de origem</Label>
          <Input name="whatsappOrigem" defaultValue={cfg.whatsappOrigem} placeholder="ia_chat" />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">Identidade</h3>
        <div>
          <Label>Nome da IA</Label>
          <Input name="nomeIa" defaultValue={cfg.identidade.nomeIa} />
        </div>
        <div>
          <Label>Nome da empresa</Label>
          <Input name="nomeEmpresa" defaultValue={cfg.identidade.nomeEmpresa} />
        </div>
        <div>
          <Label>Tom de atendimento</Label>
          <Input name="tomAtendimento" defaultValue={cfg.identidade.tomAtendimento} />
        </div>
        <div>
          <Label>Mensagem inicial</Label>
          <Textarea name="mensagemInicial" rows={4} defaultValue={cfg.identidade.mensagemInicial} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">Informações da empresa</h3>
        <Textarea name="empresaDescricao" rows={2} defaultValue={cfg.empresa.descricao} placeholder="Descrição" />
        <Textarea name="empresaCidades" rows={2} defaultValue={cfg.empresa.cidadesAtendidas} placeholder="Cidades" />
        <Textarea name="empresaDiferenciais" rows={2} defaultValue={cfg.empresa.diferenciais} placeholder="Diferenciais" />
        <Textarea name="empresaParceiros" rows={2} defaultValue={cfg.empresa.parceiros} placeholder="Parceiros" />
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">Conteúdo comercial</h3>
        <Label>Consórcio</Label>
        <Textarea name="conteudoConsorcio" rows={2} defaultValue={cfg.conteudo.consorcio} />
        <Label>Financiamento</Label>
        <Textarea name="conteudoFinanciamento" rows={2} defaultValue={cfg.conteudo.financiamento} />
        <Label>Cartas contempladas</Label>
        <Textarea name="conteudoCartas" rows={2} defaultValue={cfg.conteudo.cartas} />
        <Label>Grupos</Label>
        <Textarea name="conteudoGrupos" rows={2} defaultValue={cfg.conteudo.grupos} />
        <Label>Oportunidades imobiliárias</Label>
        <Textarea name="conteudoOportunidades" rows={2} defaultValue={cfg.conteudo.oportunidades} />
        <Label>Planejamento financeiro</Label>
        <Textarea name="conteudoPlanejamento" rows={2} defaultValue={cfg.conteudo.planejamento} />
        <Label>Calculadoras</Label>
        <Textarea name="conteudoCalculadoras" rows={2} defaultValue={cfg.conteudo.calculadoras} />
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h3 className="font-semibold">Regras</h3>
        <Label>O que a IA pode falar</Label>
        <Textarea name="regrasPodeFalar" rows={2} defaultValue={cfg.regras.podeFalar} />
        <Label>O que não pode prometer</Label>
        <Textarea name="regrasNaoPrometer" rows={2} defaultValue={cfg.regras.naoPrometer} />
        <Label>Mensagem de captura de lead</Label>
        <Textarea name="regrasCapturaLead" rows={2} defaultValue={cfg.regras.mensagemCapturaLead} />
        <Label>Mensagem pós-cadastro</Label>
        <Textarea name="regrasPosCadastro" rows={2} defaultValue={cfg.regras.mensagemPosCadastro} />
      </section>

      <Button type="submit">Salvar IA</Button>
    </form>
  );
}
