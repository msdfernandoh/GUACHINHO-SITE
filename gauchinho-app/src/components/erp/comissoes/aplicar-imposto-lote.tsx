"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { aplicarImpostoComissoesLoteAction } from "@/app/erp/regras-comissao/actions";

type PreviaFiscal = {
  confirmado: boolean;
  aliquota: number;
  participantes: number;
  franquia: number;
  vendas_protegidas: number;
  vendas_sem_base_segura: number;
  liquido_anterior: number;
  liquido_novo: number;
  imposto_participantes: number;
};

const brl = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function AplicarImpostoLote({ empresaId, configs }: {
  empresaId: string;
  configs: { id: string; percentual_imposto: number; vigencia_inicio: string; vigencia_fim: string | null; ativo: boolean }[];
}) {
  const router = useRouter();
  const [configId, setConfigId] = useState("");
  const [previa, setPrevia] = useState<PreviaFiscal | null>(null);
  const [pending, setPending] = useState(false);
  const [erro, setErro] = useState("");

  async function executar(confirmar: boolean) {
    setPending(true);
    setErro("");
    try {
      const form = new FormData();
      form.set("empresa_id", empresaId);
      form.set("configuracao_fiscal_id", configId);
      form.set("confirmar", String(confirmar));
      const result = await aplicarImpostoComissoesLoteAction({ ok: false, message: "" }, form);
      if (!result.ok) throw new Error(result.message);
      setPrevia(result.data as PreviaFiscal);
      if (confirmar) router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao aplicar imposto.");
      setPrevia(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/50 p-5 dark:border-blue-900 dark:bg-blue-950/20">
      <div>
        <h3 className="font-bold text-slate-900 dark:text-white">Aplicar imposto em todas as comissões pendentes</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Use a alíquota selecionada nas previsões de todos os participantes desta empresa, inclusive importadas
          e de datas anteriores à vigência. Esta aplicação é explícita e não altera as regras nem as vigências cadastradas.
        </p>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
          Vendas com recebimento, elegibilidade, pagamento, cancelamento ou origem fiscal indefinida são preservadas.
          Reaplicar não desconta imposto duas vezes. Primeiro confira a prévia.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
          Alíquota cadastrada
          <select value={configId} disabled={pending} onChange={(event) => {
            setConfigId(event.target.value); setPrevia(null); setErro("");
          }} className="mt-1 block rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
            <option value="">Selecione a configuração fiscal</option>
            {configs.filter((config) => config.ativo).map((config) => (
              <option key={config.id} value={config.id}>
                {Number(config.percentual_imposto).toLocaleString("pt-BR")}% · {config.vigencia_inicio} a {config.vigencia_fim || "vigência aberta"}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={pending || !configId} onClick={() => executar(false)}
          className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
          {pending ? "Processando…" : "Calcular prévia"}
        </button>
      </div>
      {erro && <p role="alert" className="text-sm font-semibold text-red-700 dark:text-red-300">{erro}</p>}
      {previa && (
        <div role="status" className="space-y-3 rounded-xl bg-white p-4 text-sm text-slate-800 dark:bg-slate-900 dark:text-slate-200">
          <p className="font-bold">{previa.confirmado ? "Aplicação concluída" : "Prévia — nenhum valor alterado"} · {previa.aliquota}%</p>
          <p>{previa.participantes} previsões de participantes e {previa.franquia} previsões da franquia.</p>
          <p>Líquido dos participantes: {brl(previa.liquido_anterior)} → <strong>{brl(previa.liquido_novo)}</strong>.
            Imposto total: {brl(previa.imposto_participantes)}.</p>
          <p className="text-xs">Vendas preservadas por movimentação/status: {previa.vendas_protegidas}.
            Vendas que exigem análise da base fiscal: {previa.vendas_sem_base_segura}.</p>
          {!previa.confirmado && (previa.participantes > 0 || previa.franquia > 0) && (
            <button type="button" disabled={pending} onClick={() => executar(true)}
              className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
              {pending ? "Aplicando…" : "Confirmar aplicação em todas as previsões elegíveis"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
