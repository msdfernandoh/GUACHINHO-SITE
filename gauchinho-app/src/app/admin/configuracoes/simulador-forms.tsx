"use client";

import type { FinanciamentoConfig, SimuladorTipoBemConfig } from "@/lib/config/defaults";
import { Button, Input, Label } from "@/components/ui/form-primitives";

type Props = {
  title: string;
  action: (formData: FormData) => Promise<void>;
  cfg: SimuladorTipoBemConfig;
};

export function SimuladorBemConfigForm({ title, action, cfg }: Props) {
  const prazos = (cfg.prazosDisponiveis ?? []).join(", ");
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
          <Label>Reajuste anual crédito (%)</Label>
          <Input name="reajusteAnualCredito" type="number" step="0.01" defaultValue={cfg.reajusteAnualCredito} />
        </div>
        <div>
          <Label>Correção anual parcela (%)</Label>
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
  cfg,
}: {
  action: (formData: FormData) => Promise<void>;
  cfg: FinanciamentoConfig;
}) {
  return (
    <form action={action} className="max-w-xl space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">Financiamento</h3>
      <Input name="taxaMensalPadrao" type="number" step="0.01" placeholder="Taxa mensal %" defaultValue={cfg.taxaMensalPadrao} />
      <Input name="entradaMinimaSugeridaPercentual" type="number" step="0.01" placeholder="Entrada mínima sugerida %" defaultValue={cfg.entradaMinimaSugeridaPercentual} />
      <Input name="prazoPadrao" type="number" placeholder="Prazo padrão (meses)" defaultValue={cfg.prazoPadrao} />
      <Input name="prazoMaximo" type="number" placeholder="Prazo máximo" defaultValue={cfg.prazoMaximo} />
      <Input name="indiceReajusteOpcional" type="number" step="0.01" placeholder="Índice reajuste opcional %" defaultValue={cfg.indiceReajusteOpcional} />
      <Input name="parceiroPadrao" placeholder="Parceiro padrão" defaultValue={cfg.parceiroPadrao} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="mostrarComparacaoConsorcio" defaultChecked={cfg.mostrarComparacaoConsorcio} />
        Mostrar comparação com consórcio
      </label>
      <Button type="submit">Salvar Financiamento</Button>
    </form>
  );
}
