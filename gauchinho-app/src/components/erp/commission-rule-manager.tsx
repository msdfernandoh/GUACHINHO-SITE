"use client";

import { useActionState, useMemo, useState } from "react";
import { createCommissionProgramAction, createFranchiseRuleAction, type CommissionActionState } from "@/app/erp/regras-comissao/actions";

type Program = { id: string; nome: string; administradora_id: string | null };
type Administrator = { id: string; nome: string };
type Quota = { id: string; label: string; administradoraId: string };
type Stage = { nome: string; mes_relativo: string; valor: string };

const initialState: CommissionActionState = { ok: false, message: "" };
const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const labelClass = "text-sm font-medium text-slate-700";

function Feedback({ state }: { state: CommissionActionState }) {
  if (!state.message) return null;
  return <p role="status" className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{state.message}</p>;
}

export function CommissionRuleManager({ empresaId, programas, administradoras, cotas }: { empresaId: string; programas: Program[]; administradoras: Administrator[]; cotas: Quota[] }) {
  const [programState, programAction, programPending] = useActionState(createCommissionProgramAction, initialState);
  const [ruleState, ruleAction, rulePending] = useActionState(createFranchiseRuleAction, initialState);
  const [programaId, setProgramaId] = useState(programas[0]?.id ?? "");
  const [base, setBase] = useState<"credito" | "valor_fixo">("credito");
  const [stages, setStages] = useState<Stage[]>([{ nome: "Parcela única", mes_relativo: "1", valor: "100" }]);
  const selectedAdmin = programas.find((programa) => programa.id === programaId)?.administradora_id;
  const quotas = useMemo(() => cotas.filter((cota) => !selectedAdmin || cota.administradoraId === selectedAdmin), [cotas, selectedAdmin]);
  const serializedStages = JSON.stringify(stages.map((stage, index) => ({ ordem: index + 1, nome: stage.nome, mes_relativo: stage.mes_relativo, [base === "credito" ? "percentual_etapa" : "valor_etapa"]: stage.valor })));

  function setStage(index: number, field: keyof Stage, value: string) {
    setStages((current) => current.map((stage, position) => position === index ? { ...stage, [field]: value } : stage));
  }

  function changeBase(next: "credito" | "valor_fixo") {
    setBase(next);
    setStages([{ nome: "Parcela única", mes_relativo: "1", valor: next === "credito" ? "100" : "" }]);
  }

  return <section className="space-y-5 rounded-xl border border-blue-200 bg-blue-50/40 p-5">
    <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Cadastro seguro</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Programas e múltiplas regras</h2><p className="mt-1 text-sm text-slate-600">Cada regra recebe uma nova versão. O percentual ou valor deve ser informado; nada é ativado no motor enquanto não houver homologação explícita.</p></div>
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.7fr]">
      <form action={programAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-slate-900">1. Criar programa</h3>
        <input type="hidden" name="empresa_id" value={empresaId} />
        <label className={labelClass}>Nome<input className={inputClass} name="nome" required placeholder="Ex.: Racon Imóveis 2026" /></label>
        <label className={labelClass}>Administradora<select className={inputClass} name="administradora_id" required defaultValue=""><option value="" disabled>Selecione</option>{administradoras.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
        <label className={labelClass}>Descrição<textarea className={inputClass} name="descricao" rows={2} placeholder="Finalidade e condições do programa" /></label>
        <Feedback state={programState} />
        <button disabled={programPending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{programPending ? "Salvando..." : "Criar programa"}</button>
      </form>

      <form action={ruleAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div><h3 className="font-semibold text-slate-900">2. Adicionar regra da franquia</h3><p className="text-xs text-slate-500">A versão é atribuída automaticamente e nasce não homologada.</p></div>
        <input type="hidden" name="empresa_id" value={empresaId} /><input type="hidden" name="etapas_cronograma" value={serializedStages} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className={labelClass}>Programa<select className={inputClass} name="programa_id" required value={programaId} onChange={(event) => setProgramaId(event.target.value)}><option value="" disabled>Selecione</option>{programas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <label className={labelClass}>Base de cálculo<select className={inputClass} name="base_calculo" value={base} onChange={(event) => changeBase(event.target.value as "credito" | "valor_fixo")}><option value="credito">Percentual sobre o crédito</option><option value="valor_fixo">Valor fixo</option></select></label>
          <label className={labelClass}>{base === "credito" ? "Percentual total da comissão" : "Valor fixo total"}<input className={inputClass} name="valor_comissao" inputMode="decimal" required placeholder={base === "credito" ? "Ex.: 2,75" : "Ex.: 1500,00"} /></label>
          <label className={labelClass}>Modalidade (opcional)<input className={inputClass} name="modalidade" placeholder="Ex.: imóvel" /></label>
          <label className={labelClass}>Início da vigência<input className={inputClass} type="date" name="vigencia_inicio" required /></label>
          <label className={labelClass}>Fim da vigência (opcional)<input className={inputClass} type="date" name="vigencia_fim" /></label>
          <label className={labelClass}>Opção de cota (opcional)<select className={inputClass} name="opcao_cota_id" defaultValue=""><option value="">Todas as cotas</option>{quotas.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className={labelClass}>Plano/condição (opcional)<input className={inputClass} name="plano_condicao" placeholder="Ex.: parcela reduzida" /></label>
        </div>
        <div className="space-y-2"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-800">Cronograma</p><p className="text-xs text-slate-500">{base === "credito" ? "Distribua exatamente 100% da comissão entre as etapas." : "A soma das etapas deve fechar no valor fixo total."}</p></div><button type="button" onClick={() => setStages((current) => [...current, { nome: `Parcela ${current.length + 1}`, mes_relativo: String(current.length + 1), valor: "" }])} className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700">Adicionar etapa</button></div>
          {stages.map((stage, index) => <div key={index} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1.5fr_0.7fr_0.8fr_auto]"><label className={labelClass}>Nome<input className={inputClass} value={stage.nome} onChange={(event) => setStage(index, "nome", event.target.value)} required /></label><label className={labelClass}>Mês relativo<input className={inputClass} type="number" min={1} value={stage.mes_relativo} onChange={(event) => setStage(index, "mes_relativo", event.target.value)} required /></label><label className={labelClass}>{base === "credito" ? "% da comissão" : "Valor da etapa"}<input className={inputClass} inputMode="decimal" value={stage.valor} onChange={(event) => setStage(index, "valor", event.target.value)} required /></label><button type="button" disabled={stages.length === 1} onClick={() => setStages((current) => current.filter((_, position) => position !== index))} className="self-end rounded-lg px-2 py-2 text-xs font-semibold text-red-600 disabled:opacity-30">Remover</button></div>)}
        </div>
        <Feedback state={ruleState} />
        <button disabled={rulePending || programas.length === 0} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{rulePending ? "Salvando..." : "Criar nova regra não homologada"}</button>
      </form>
    </div>
  </section>;
}
