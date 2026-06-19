"use client";

import { useState } from "react";
import {
  saveContatoConfigAction,
  saveLeadsConfigAction,
  savePropostasConfigAction,
  saveSiteConfigAction,
  saveWhatsappOrigemAction,
  deleteWhatsappOrigemAction,
  saveSimuladorImovelConfigAction,
  saveSimuladorAutomovelConfigAction,
  saveFinanciamentoConfigAction,
  saveHomeCartasConfigAction,
  saveCalculadorasConfigAction,
} from "./actions";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";
import {
  FinanciamentoConfigForm,
  SimuladorBemConfigForm,
} from "./simulador-forms";
import { IaConfigForm } from "./ia-config-form";
import {
  DEFAULT_FINANCIAMENTO_CONFIG,
  DEFAULT_HOME_CARTAS,
  DEFAULT_CALCULADORAS_FINANCEIRAS,
  DEFAULT_SIMULADOR_AUTOMOVEL,
  DEFAULT_SIMULADOR_IMOVEL,
  type FinanciamentoConfig,
  type HomeCartasConfig,
  type SimuladorTipoBemConfig,
  type CalculadorasFinanceirasConfig,
} from "@/lib/config/defaults";
import { DEFAULT_IA_CONFIG, type IaConfig } from "@/lib/config/ia-defaults";

const TABS: Array<{ id: string; label: string; future?: boolean }> = [
  { id: "site", label: "Site" },
  { id: "contato", label: "Contato" },
  { id: "propostas", label: "Propostas" },
  { id: "leads", label: "Leads" },
  { id: "whatsapp", label: "WhatsApp por Origem" },
  { id: "simulador", label: "Simulador" },
  { id: "financiamento", label: "Financiamento" },
  { id: "calculadoras", label: "Calculadoras" },
  { id: "ia", label: "IA" },
  { id: "cartas_home", label: "Cartas Home" },
  { id: "futuro1", label: "Identidade Visual", future: true },
  { id: "futuro2", label: "Menus", future: true },
] ;

type Props = {
  configs: Record<string, Record<string, unknown>>;
  whatsapp: Array<Record<string, unknown>>;
};

export function ConfigTabs({ configs, whatsapp }: Props) {
  const [tab, setTab] = useState<string>("site");
  const site = configs.site ?? {};
  const contato = configs.contato ?? {};
  const propostas = configs.propostas ?? {};
  const leads = configs.leads ?? {};
  const simImovel = { ...DEFAULT_SIMULADOR_IMOVEL, ...(configs.simulador_imovel as SimuladorTipoBemConfig | undefined) };
  const simAuto = { ...DEFAULT_SIMULADOR_AUTOMOVEL, ...(configs.simulador_automovel as SimuladorTipoBemConfig | undefined) };
  const finCfg = { ...DEFAULT_FINANCIAMENTO_CONFIG, ...(configs.financiamento_config as FinanciamentoConfig | undefined) };
  const homeCartas = { ...DEFAULT_HOME_CARTAS, ...(configs.home_cartas_contempladas as HomeCartasConfig | undefined) };
  const calcCfg = {
    ...DEFAULT_CALCULADORAS_FINANCEIRAS,
    ...(configs.calculadoras_financeiras as CalculadorasFinanceirasConfig | undefined),
  };
  const iaCfg = { ...DEFAULT_IA_CONFIG, ...(configs.ia_config as IaConfig | undefined) };

  const current = TABS.find((t) => t.id === tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              tab === t.id
                ? "bg-zinc-900 text-white dark:bg-amber-500 dark:text-zinc-950"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
              t.future && "opacity-60",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {current?.future ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-zinc-500">
          Fase futura — shell preparado para {current.label}.
        </p>
      ) : null}

      {tab === "site" ? (
        <form action={saveSiteConfigAction} className="max-w-xl space-y-3">
          <div>
            <Label>Marca no header (ex.: Gauchinho)</Label>
            <Input name="nomeEmpresa" defaultValue={String(site.nomeEmpresa ?? "")} />
          </div>
          <div>
            <Label>Linha abaixo da marca (ex.: Consórcios e soluções financeiras)</Label>
            <Input name="subtitulo" defaultValue={String(site.subtitulo ?? "")} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea name="descricaoInstitucional" rows={3} defaultValue={String(site.descricaoInstitucional ?? "")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="statusAtivo" defaultChecked={site.statusAtivo !== false} />
            Site ativo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="exibirBotaoGruposNoSite" defaultChecked={!!site.exibirBotaoGruposNoSite} />
            Exibir botão grupos no site
          </label>
          <Button type="submit">Salvar Site</Button>
        </form>
      ) : null}

      {tab === "contato" ? (
        <form action={saveContatoConfigAction} className="max-w-xl space-y-3">
          <Input name="whatsappPrincipal" placeholder="WhatsApp" defaultValue={String(contato.whatsappPrincipal ?? "")} />
          <Input name="telefone" placeholder="Telefone" defaultValue={String(contato.telefone ?? "")} />
          <Input name="email" placeholder="E-mail" defaultValue={String(contato.email ?? "")} />
          <Textarea name="endereco" placeholder="Endereço" defaultValue={String(contato.endereco ?? "")} />
          <Input name="instagram" placeholder="Instagram" defaultValue={String(contato.instagram ?? "")} />
          <Button type="submit">Salvar Contato</Button>
        </form>
      ) : null}

      {tab === "propostas" ? (
        <form action={savePropostasConfigAction} className="max-w-xl space-y-3">
          <div>
            <Label>Validade padrão (dias)</Label>
            <Input name="validadePadraoDias" type="number" defaultValue={String(propostas.validadePadraoDias ?? 7)} />
          </div>
          <Textarea name="textoResumoExecutivo" rows={3} defaultValue={String(propostas.textoResumoExecutivo ?? "")} />
          <Textarea name="avisoLegalPadrao" rows={3} defaultValue={String(propostas.avisoLegalPadrao ?? "")} />
          <Button type="submit">Salvar Propostas</Button>
        </form>
      ) : null}

      {tab === "leads" ? (
        <form action={saveLeadsConfigAction} className="max-w-xl space-y-3">
          <div>
            <Label>Status inicial</Label>
            <Input name="statusInicialPadrao" defaultValue={String(leads.statusInicialPadrao ?? "Novo")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="permitirCriarLeadManual" defaultChecked={leads.permitirCriarLeadManual !== false} />
            Permitir lead manual
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="permitirArquivarLead" defaultChecked={leads.permitirArquivarLead !== false} />
            Permitir arquivar
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="srdPodeEditarGrupos" defaultChecked={!!leads.srdPodeEditarGrupos} />
            SRD pode cadastrar/editar grupos
          </label>
          <Button type="submit">Salvar Leads</Button>
        </form>
      ) : null}

      {tab === "whatsapp" ? (
        <div className="space-y-6">
          <form action={saveWhatsappOrigemAction} className="max-w-xl space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">Nova origem</h3>
            <Input name="origem" placeholder="origem (ex: grupos)" required />
            <Input name="whatsapp_destino" placeholder="WhatsApp destino" />
            <Input name="nome_atendimento" placeholder="Nome atendimento" />
            <Textarea name="mensagem_padrao" placeholder="Mensagem padrão" rows={2} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ativo" defaultChecked />
              Ativo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="exibir_botao_apos_lead" />
              Botão após lead
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="usar_whatsapp_principal_fallback" defaultChecked />
              Fallback WhatsApp principal
            </label>
            <Button type="submit">Adicionar</Button>
          </form>
          {whatsapp.map((w) => (
            <form key={String(w.id)} action={saveWhatsappOrigemAction} className="max-w-xl space-y-2 rounded-xl border p-4">
              <input type="hidden" name="id" value={String(w.id)} />
              <Input name="origem" defaultValue={String(w.origem ?? "")} required />
              <Input name="whatsapp_destino" defaultValue={String(w.whatsapp_destino ?? "")} />
              <Input name="nome_atendimento" defaultValue={String(w.nome_atendimento ?? "")} />
              <Textarea name="mensagem_padrao" rows={2} defaultValue={String(w.mensagem_padrao ?? "")} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="ativo" defaultChecked={!!w.ativo} />
                Ativo
              </label>
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  Salvar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="danger"
                  formAction={deleteWhatsappOrigemAction.bind(null, String(w.id))}
                >
                  Excluir
                </Button>
              </div>
            </form>
          ))}
        </div>
      ) : null}

      {tab === "simulador" ? (
        <div className="space-y-8">
          <SimuladorBemConfigForm
            title="Imóvel"
            action={saveSimuladorImovelConfigAction}
            cfg={simImovel}
          />
          <SimuladorBemConfigForm
            title="Automóvel"
            action={saveSimuladorAutomovelConfigAction}
            cfg={simAuto}
          />
        </div>
      ) : null}

      {tab === "financiamento" ? (
        <FinanciamentoConfigForm action={saveFinanciamentoConfigAction} cfg={finCfg} />
      ) : null}

      {tab === "calculadoras" ? (
        <form action={saveCalculadorasConfigAction} className="max-w-xl space-y-3">
          <p className="text-sm text-zinc-500">Calculadoras financeiras públicas em /calculadoras</p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ativoAplicacaoMensal" defaultChecked={calcCfg.ativoAplicacaoMensal} />
            Ativar aplicação mensal
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ativoValorFuturo" defaultChecked={calcCfg.ativoValorFuturo} />
            Ativar valor futuro
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ativoFinanciamento" defaultChecked={calcCfg.ativoFinanciamento} />
            Ativar financiamento
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ativoCorrecao" defaultChecked={calcCfg.ativoCorrecao} />
            Ativar correção de valores
          </label>
          <div>
            <Label>Rentabilidade mensal padrão (%)</Label>
            <Input
              name="rentabilidadeMensalPadrao"
              type="number"
              step="0.01"
              defaultValue={String(calcCfg.rentabilidadeMensalPadrao)}
            />
          </div>
          <div>
            <Label>Taxa financiamento padrão (% a.m.)</Label>
            <Input
              name="taxaFinanciamentoPadrao"
              type="number"
              step="0.01"
              defaultValue={String(calcCfg.taxaFinanciamentoPadrao)}
            />
          </div>
          <div>
            <Label>Texto CTA após resultado</Label>
            <Textarea
              name="textoCtaAposResultado"
              rows={2}
              defaultValue={calcCfg.textoCtaAposResultado}
            />
          </div>
          <div>
            <Label>WhatsApp — chave de origem</Label>
            <Input name="whatsappOrigem" defaultValue={calcCfg.whatsappOrigem} placeholder="calculadora_financeira" />
          </div>
          <Button type="submit">Salvar Calculadoras</Button>
        </form>
      ) : null}

      {tab === "ia" ? <IaConfigForm cfg={iaCfg} /> : null}

      {tab === "cartas_home" ? (
        <form action={saveHomeCartasConfigAction} className="max-w-xl space-y-3">
          <p className="text-sm text-zinc-500">
            Configuração para exibir cartas na home (Fase 6). Campos prontos para uso futuro.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="exibirNaHome" defaultChecked={homeCartas.exibirNaHome} />
            Exibir na home
          </label>
          <div>
            <Label>Quantidade de cards</Label>
            <Input name="quantidade" type="number" min={1} max={12} defaultValue={String(homeCartas.quantidade)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mostrarBotaoVerCartas" defaultChecked={homeCartas.mostrarBotaoVerCartas} />
            Mostrar botão &quot;Ver cartas&quot;
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mostrarApenasDestaque" defaultChecked={homeCartas.mostrarApenasDestaque} />
            Mostrar apenas destaque
          </label>
          <Button type="submit">Salvar Cartas Home</Button>
        </form>
      ) : null}
    </div>
  );
}
