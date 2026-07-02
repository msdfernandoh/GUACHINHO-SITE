"use client";

import type { OpcaoParcelaConsorcio } from "@/lib/config/simulador-parcela-opcoes";
import { normalizarOpcoesParcela } from "@/lib/config/simulador-parcela-opcoes";
import type { SimuladorTipoBemConfig } from "@/lib/config/defaults";
import { Button, Input, Label, Textarea } from "@/components/ui/form-primitives";

const MAX_OPCOES = 5;

function OpcaoParcelaFields({
  index,
  op,
}: {
  index: number;
  op: OpcaoParcelaConsorcio;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <p className="mb-2 text-xs font-semibold uppercase text-zinc-500">Opção {index + 1}</p>
      <input type="hidden" name={`opcao_${index}_id`} defaultValue={op.id} />
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label>Nome</Label>
          <Input name={`opcao_${index}_nome`} defaultValue={op.nome} placeholder="Ex.: 60% da parcela" />
        </div>
        <div>
          <Label>Percentual (%)</Label>
          <Input
            name={`opcao_${index}_percentual`}
            type="number"
            step="0.01"
            defaultValue={op.percentual}
          />
        </div>
        <div>
          <Label>Ordem</Label>
          <Input name={`opcao_${index}_ordem`} type="number" defaultValue={op.ordem} />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" name={`opcao_${index}_ativa`} defaultChecked={op.ativa} />
          Ativa
        </label>
        <div className="sm:col-span-2">
          <Label>Descrição curta</Label>
          <Textarea name={`opcao_${index}_descricao`} rows={2} defaultValue={op.descricao} />
        </div>
      </div>
    </div>
  );
}

export function SimuladorBemConfigForm({
  title,
  action,
  cfg,
}: {
  title: string;
  action: (formData: FormData) => Promise<void>;
  cfg: SimuladorTipoBemConfig;
}) {
  const prazos = (cfg.prazosDisponiveis ?? []).join(", ");
  const opcoes = normalizarOpcoesParcela(cfg);
  const slots: OpcaoParcelaConsorcio[] = [];
  for (let i = 0; i < MAX_OPCOES; i++) {
    slots.push(
      opcoes[i] ?? {
        id: `nova_${i}`,
        nome: "",
        percentual: 100,
        descricao: "",
        ativa: false,
        ordem: i + 1,
      },
    );
  }

  return (
    <form action={action} className="max-w-2xl space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Taxa administrativa padrão (%)</Label>
          <Input name="taxaAdministrativaPadrao" type="number" step="0.01" defaultValue={cfg.taxaAdministrativaPadrao} />
        </div>
        <div>
          <Label>Fundo de reserva padrão (%)</Label>
          <Input name="fundoReservaPadrao" type="number" step="0.01" defaultValue={cfg.fundoReservaPadrao} />
        </div>
        <div>
          <Label>Seguro prestamista padrão (% a.a.)</Label>
          <Input name="seguroPrestamistaPadrao" type="number" step="0.001" defaultValue={cfg.seguroPrestamistaPadrao} />
        </div>
        <div>
          <Label>Reajuste anual do crédito (%)</Label>
          <Input name="reajusteAnualCredito" type="number" step="0.01" defaultValue={cfg.reajusteAnualCredito} />
        </div>
        <div>
          <Label>Correção anual da parcela (%)</Label>
          <Input name="correcaoAnualParcela" type="number" step="0.01" defaultValue={cfg.correcaoAnualParcela} />
        </div>
        <div>
          <Label>Rentabilidade anual comparativa (%)</Label>
          <Input name="rentabilidadeAnualComparativa" type="number" step="0.01" defaultValue={cfg.rentabilidadeAnualComparativa} />
        </div>
        <div>
          <Label>Crédito mínimo (R$)</Label>
          <Input name="valorMinimoCredito" type="number" defaultValue={cfg.valorMinimoCredito} />
        </div>
        <div>
          <Label>Crédito máximo (R$)</Label>
          <Input name="valorMaximoCredito" type="number" defaultValue={cfg.valorMaximoCredito} />
        </div>
        <div>
          <Label>Valor padrão inicial (R$)</Label>
          <Input name="valorPadraoInicial" type="number" defaultValue={cfg.valorPadraoInicial} />
        </div>
        <div>
          <Label>Prazo padrão (meses)</Label>
          <Input name="prazoPadrao" type="number" defaultValue={cfg.prazoPadrao} />
        </div>
        <div className="sm:col-span-2">
          <Label>Prazos disponíveis (vírgula)</Label>
          <Input name="prazosDisponiveis" defaultValue={prazos} placeholder="60, 72, 80" />
        </div>
        <div>
          <Label>Qtd. prazos exibidos</Label>
          <Input name="quantidadePrazosExibidos" type="number" defaultValue={cfg.quantidadePrazosExibidos} />
        </div>
      </div>

      <div className="space-y-3 border-t pt-4">
        <h4 className="font-semibold">Opções de parcela inicial (consórcio)</h4>
        <p className="text-xs text-zinc-500">
          Deixe o nome vazio para ignorar a linha. Com uma opção ativa, o simulador usa automaticamente;
          com várias, o visitante escolhe.
        </p>
        {slots.map((op, i) => (
          <OpcaoParcelaFields key={op.id + i} index={i} op={op} />
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="mostrarComparacaoFinanciamento" defaultChecked={cfg.mostrarComparacaoFinanciamento} />
        Mostrar comparação com financiamento
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="mostrarTabelaAnoAno" defaultChecked={cfg.mostrarTabelaAnoAno} />
        Mostrar tabela ano a ano
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="exibirTabelaCompletaPorPadrao" defaultChecked={cfg.exibirTabelaCompletaPorPadrao} />
        Exibir tabela completa por padrão
      </label>
      <Button type="submit">Salvar {title}</Button>
    </form>
  );
}

export function FinanciamentoConfigForm({
  action,
  stored,
}: {
  action: (formData: FormData) => Promise<void>;
  stored: import("@/lib/config/financiamento-por-tipo").FinanciamentoConfigStored;
}) {
  function TipoFields({
    prefix,
    title,
    cfg,
  }: {
    prefix: "imovel" | "veiculo";
    title: string;
    cfg: import("@/lib/config/financiamento-por-tipo").FinanciamentoTipoConfig;
  }) {
    const prazos = (cfg.prazosDisponiveis ?? []).join(", ");
    return (
      <fieldset className="space-y-3 rounded-xl border p-4 dark:border-zinc-700">
        <legend className="px-1 text-sm font-bold">{title}</legend>
        <div>
          <Label>Taxa mensal de financiamento (% a.m.)</Label>
          <Input name={`${prefix}_taxaMensalPercentual`} type="number" step="0.01" defaultValue={cfg.taxaMensalPercentual} />
        </div>
        <div>
          <Label>Taxa anual (opcional, % a.a.)</Label>
          <Input name={`${prefix}_taxaAnualPercentual`} type="number" step="0.01" defaultValue={cfg.taxaAnualPercentual ?? 0} />
        </div>
        <div>
          <Label>Entrada padrão (% do valor do bem)</Label>
          <Input name={`${prefix}_entradaPercentualPadrao`} type="number" step="0.01" defaultValue={cfg.entradaPercentualPadrao} />
        </div>
        <div>
          <Label>Prazo padrão (meses)</Label>
          <Input name={`${prefix}_prazoPadrao`} type="number" defaultValue={cfg.prazoPadrao} />
        </div>
        <div>
          <Label>Prazo máximo (meses)</Label>
          <Input name={`${prefix}_prazoMaximo`} type="number" defaultValue={cfg.prazoMaximo} />
        </div>
        <div>
          <Label>Prazos disponíveis (vírgula)</Label>
          <Input name={`${prefix}_prazosDisponiveis`} defaultValue={prazos} />
        </div>
        <div>
          <Label>Parceiro padrão</Label>
          <Input name={`${prefix}_parceiroPadrao`} defaultValue={cfg.parceiroPadrao} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name={`${prefix}_mostrarComparacaoComConsorcio`} defaultChecked={cfg.mostrarComparacaoComConsorcio} />
          Mostrar comparação com consórcio
        </label>
      </fieldset>
    );
  }

  return (
    <form action={action} className="max-w-2xl space-y-6">
      <h3 className="font-semibold">Financiamento por tipo de bem</h3>
      <p className="text-sm text-zinc-500">Imóvel e veículo usam listas de prazo e taxas independentes no simulador e na Home.</p>
      <TipoFields prefix="imovel" title="Imóvel" cfg={stored.imovel} />
      <TipoFields prefix="veiculo" title="Veículo" cfg={stored.veiculo} />
      <Button type="submit">Salvar Financiamento</Button>
    </form>
  );
}
