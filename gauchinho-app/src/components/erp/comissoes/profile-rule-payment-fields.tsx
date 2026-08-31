"use client";

import { useState } from "react";
import { distributeProfileSchedule } from "@/lib/erp/profile-rule-schedule";
import type { CommissionStage } from "@/lib/erp/commission-rule-input";

export function ProfileRulePaymentFields({ initial }: { initial?: {
  base_v2: string; percentual_comissao: number | null; valor_fixo_total: number | null;
  seguir_cronograma_franquia: boolean; etapas_cronograma: CommissionStage[];
  aplicar_desconto_impostos: boolean;
} | null }) {
  const [base, setBase] = useState(initial?.base_v2 ?? "COMISSAO_FRANQUEADORA_LIQUIDA");
  const [follow, setFollow] = useState(initial?.seguir_cronograma_franquia ?? true);
  const [fixedTotal, setFixedTotal] = useState(String(initial?.valor_fixo_total ?? ""));
  const [count, setCount] = useState(String(initial?.etapas_cronograma.length || 1));
  const [stages, setStages] = useState<CommissionStage[]>(initial?.etapas_cronograma ?? []);
  const [error, setError] = useState("");
  const fixed = base === "VALOR_FIXO";
  const inputClass = "mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white";
  const total = stages.reduce((sum, stage) => sum + (fixed ? stage.valor_etapa ?? 0 : stage.percentual_etapa ?? 0), 0);
  function generate(amount: number) {
    try {
      const rows = distributeProfileSchedule(amount, fixed ? Number(fixedTotal) : 100);
      setStages(fixed ? rows.map(({ percentual_etapa, ...row }) => ({ ...row, valor_etapa: percentual_etapa })) : rows);
      setCount(String(amount)); setError("");
    } catch (err) { setError((err as Error).message); }
  }
  return <div className="space-y-3">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="font-bold">Base de cálculo *
        <select name="base_v2" value={base} onChange={e => { setBase(e.target.value); setStages([]); }} className={inputClass}>
          <option value="COMISSAO_FRANQUEADORA_LIQUIDA">% da Comissão Líquida da Franquia</option>
          <option value="VALOR_VENDIDO">% do Valor do Crédito Vendido</option>
          <option value="VALOR_FIXO">Valor Fixo em R$</option>
        </select>
      </label>
      {fixed ? <label className="font-bold">Valor total da comissão (R$) *
        <input name="valor_fixo_total" type="number" min="0.01" step="0.01" required value={fixedTotal} onChange={e => setFixedTotal(e.target.value)} className={inputClass} />
      </label> : <label className="font-bold">Percentual de repasse (%) *
        <input name="percentual_comissao" type="number" min="0.01" max="100" step="0.01" required defaultValue={initial?.percentual_comissao ?? ""} className={inputClass} />
      </label>}
    </div>
    <input type="hidden" name="seguir_cronograma_franquia" value={String(follow)} />
    <label className="flex items-center gap-2 font-bold">
      <input type="checkbox" checked={follow} onChange={e => setFollow(e.target.checked)} />
      Seguir cronograma da Franqueadora
    </label>
    <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 font-bold dark:border-amber-900/50 dark:bg-amber-950/20">
      <input name="aplicar_desconto_impostos" type="checkbox" value="true" defaultChecked={initial?.aplicar_desconto_impostos ?? true} className="mt-0.5" />
      <span>Aplicar desconto de impostos
        <small className="mt-1 block font-normal text-slate-600 dark:text-slate-400">
          Marcado: calcula o perfil após deduzir o imposto da comissão. Desmarcado: usa o valor bruto antes dos impostos.
        </small>
      </span>
    </label>
    {!follow && <fieldset className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:bg-blue-950/20">
      <legend className="font-bold">Cronograma próprio do perfil</legend>
      <p>Defina quando pagar, independentemente das parcelas da franqueadora. Mês 1 é a primeira parcela da venda. O pagamento efetivo continua sujeito às regras financeiras de liberação.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label>Número de parcelas<input name="numero_parcelas" type="number" min="1" max="360" step="1" required value={count} onChange={e => setCount(e.target.value)} className={inputClass} /></label>
        <button type="button" onClick={() => generate(Number(count))} className="rounded-lg border bg-white p-2 text-slate-800">Distribuir igualmente</button>
        <button type="button" onClick={() => generate(6)} className="rounded-lg border bg-white p-2 text-slate-800">6 parcelas</button>
        <button type="button" onClick={() => generate(1)} className="rounded-lg border bg-white p-2 text-slate-800">À vista / pagamento único</button>
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <input type="hidden" name="etapas_cronograma" value={JSON.stringify(stages)} />
      {stages.map((stage, i) => <div key={i} className="grid grid-cols-3 gap-2">
        <label>Parcela<input aria-label={`Nome da parcela ${i + 1}`} value={stage.nome} onChange={e => setStages(rows => rows.map((r, j) => j === i ? { ...r, nome: e.target.value } : r))} className={inputClass} /></label>
        <label>Mês<input type="number" min="1" step="1" required value={stage.mes_relativo ?? ""} onChange={e => setStages(rows => rows.map((r, j) => j === i ? { ...r, mes_relativo: Number(e.target.value) } : r))} className={inputClass} /></label>
        <label>{fixed ? "Valor (R$)" : "% da comissão do perfil"}<input type="number" min="0.01" step="0.01" required value={(fixed ? stage.valor_etapa : stage.percentual_etapa) ?? ""} onChange={e => setStages(rows => rows.map((r, j) => j === i ? { ...r, [fixed ? "valor_etapa" : "percentual_etapa"]: Number(e.target.value) } : r))} className={inputClass} /></label>
      </div>)}
      <p className="font-bold">Total: {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}{fixed ? " reais" : "%"} — esperado: {fixed ? fixedTotal || "informe o valor total" : "100%"}</p>
      {!fixed && <p>Os percentuais das parcelas dividem a comissão do perfil; não são percentuais sobre o crédito vendido. O valor em reais depende da venda.</p>}
    </fieldset>}
  </div>;
}
