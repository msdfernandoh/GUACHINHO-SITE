"use client";

import { useActionState } from "react";
import {
  importarRelatorioRepasseRaconAction,
  vincularItemRepasseManualAction,
  confirmarConciliacaoRepasseAction,
  lancarItemRepasseLegadoAction,
  type ImportacaoRepasseState,
} from "@/app/erp/repasse-franquia/actions";

const initialState: ImportacaoRepasseState = { ok: false, message: "" };
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type RepassePdfItem = {
  id: string;
  linha: number;
  produto: string;
  data_alocacao: string;
  numero_grupo: string;
  numero_cota: string;
  cliente_nome: string;
  parcela_numero: number;
  parcela_total: number;
  valor_comissao: number;
  valor_base: number;
  status_conciliacao: "VINCULADO_AUTO" | "VINCULADO_MANUAL" | "ATENCAO" | "NAO_ENCONTRADO" | "LANCADO_LEGADO";
  previsao_franquia_id: string | null;
  previsao_sugerida_id: string | null;
  alertas: string[];
};

export type RepassePdfImportacao = {
  id: string;
  administradora_id: string;
  competencia: string;
  arquivo_nome: string;
  valor_total_bruto: number;
  ponto_venda: string | null;
  comissionado_nome: string | null;
  pedidos: { numero: string; data_aprovacao: string | null }[];
  status: string;
  recebimento_id: string | null;
  created_at: string;
  itens: RepassePdfItem[];
};

export type RepassePrevisaoAberta = {
  id: string;
  administradora_id: string;
  competencia: string;
  ordem_etapa: number;
  nome_etapa: string;
  valor_previsto: number;
  valor_liquidado: number;
  numero_grupo: string | null;
  numero_cota: string | null;
  cliente_nome: string;
};

export type RepasseParticipante = { id: string; nome: string };
export type RepasseRegraParticipante = { id: string; nome: string; percentual: number };
export type RepasseGrupo = { id: string; administradora_id: string; codigo: string; ativo: boolean; local: boolean };

const statusStyle: Record<string, string> = {
  VINCULADO_AUTO: "bg-emerald-100 text-emerald-800",
  VINCULADO_MANUAL: "bg-blue-100 text-blue-800",
  ATENCAO: "bg-amber-100 text-amber-900",
  NAO_ENCONTRADO: "bg-rose-100 text-rose-800",
  LANCADO_LEGADO: "bg-violet-100 text-violet-800",
};

export function RepassePdfConciliacao({
  administradoras,
  contas,
  importacoes,
  previsoes,
  participantes,
  regras,
  grupos,
}: {
  administradoras: { id: string; nome: string }[];
  contas: { id: string; nome: string }[];
  importacoes: RepassePdfImportacao[];
  previsoes: RepassePrevisaoAberta[];
  participantes: RepasseParticipante[];
  regras: RepasseRegraParticipante[];
  grupos: RepasseGrupo[];
}) {
  const [importState, importAction, importing] = useActionState(importarRelatorioRepasseRaconAction, initialState);
  const [linkState, linkAction, linking] = useActionState(vincularItemRepasseManualAction, initialState);
  const [confirmState, confirmAction, confirming] = useActionState(confirmarConciliacaoRepasseAction, initialState);
  const [legacyState, legacyAction, launchingLegacy] = useActionState(lancarItemRepasseLegadoAction, initialState);
  const atual = importacoes[0] ?? null;
  const usados = new Set((atual?.itens ?? []).map((item) => item.previsao_franquia_id).filter(Boolean));
  const sistemaSemRelatorio = atual
    ? previsoes.filter((p) => p.administradora_id === atual.administradora_id && p.competencia === atual.competencia && !usados.has(p.id))
    : [];
  const relatorioSemSistema = (atual?.itens ?? []).filter((item) => item.status_conciliacao === "NAO_ENCONTRADO");
  const atencoes = (atual?.itens ?? []).filter((item) => item.status_conciliacao === "ATENCAO");
  const vinculados = (atual?.itens ?? []).filter((item) => item.status_conciliacao.startsWith("VINCULADO") || item.status_conciliacao === "LANCADO_LEGADO");

  return (
    <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/30 p-4 shadow-sm dark:border-blue-900 dark:bg-blue-950/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">Conciliação do repasse</p>
          <h2 className="text-xl font-bold text-slate-950 dark:text-white">Importar relatório PDF da administradora</h2>
          <p className="text-xs text-slate-500">O total entra como repasse bruto. Impostos permanecem separados e são abatidos ao pagar consultores e sócios.</p>
        </div>
      </div>

      <form action={importAction} className="grid gap-3 rounded-xl border bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900 md:grid-cols-6">
        <label className="md:col-span-2 font-bold">PDF de Pedidos de Compras Racon
          <input name="arquivo_pdf" type="file" accept="application/pdf" required className="mt-1 block w-full rounded-lg border p-2 font-normal" />
        </label>
        <label className="font-bold">Competência
          <input name="competencia" type="month" required defaultValue="2026-08" className="mt-1 block w-full rounded-lg border p-2" />
        </label>
        <label className="font-bold">Administradora
          <select name="administradora_id" required className="mt-1 block w-full rounded-lg border p-2 dark:bg-slate-900">
            <option value="">Selecione</option>
            {administradoras.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </label>
        <label className="font-bold">Data da entrada
          <input name="data_recebimento" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 block w-full rounded-lg border p-2" />
        </label>
        <label className="font-bold">Conta bancária
          <select name="conta_bancaria_id" className="mt-1 block w-full rounded-lg border p-2 dark:bg-slate-900">
            <option value="">Caixa geral</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <input type="hidden" name="conta_entrada" value="Caixa geral" />
        </label>
        <div className="md:col-span-6 flex items-center justify-between gap-3">
          {importState.message ? <p role="status" className={importState.ok ? "font-bold text-emerald-700" : "font-bold text-rose-700"}>{importState.message}</p> : <span />}
          <button disabled={importing} className="rounded-xl bg-blue-700 px-5 py-2.5 font-bold text-white disabled:opacity-50">{importing ? "Lendo e conciliando..." : "Importar, registrar entrada e conciliar"}</button>
        </div>
      </form>

      {atual && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
            <Summary label="Entrada bruta do PDF" value={money(Number(atual.valor_total_bruto))} color="text-emerald-700" />
            <Summary label="Vinculados" value={String(vinculados.length)} color="text-blue-700" />
            <Summary label="Com atenção" value={String(atencoes.length)} color="text-amber-700" />
            <Summary label="Antigas no relatório" value={String(relatorioSemSistema.length)} color="text-rose-700" />
            <Summary label="Só no sistema" value={String(sistemaSemRelatorio.length)} color="text-violet-700" />
          </div>
          <div className="rounded-xl border bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-bold">{atual.arquivo_nome} · {atual.competencia} · {atual.comissionado_nome || "Comissionado não identificado"}</p>
              <p className="text-slate-500">Pedidos: {atual.pedidos.map((p) => p.numero).join(", ") || "não identificados"} · Ponto de venda: {atual.ponto_venda || "—"}</p></div>
              <form action={confirmAction}><input type="hidden" name="importacao_id" value={atual.id}/><button disabled={confirming || atencoes.length > 0 || relatorioSemSistema.length > 0 || atual.status === "CONFIRMADO"} className="rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{atual.status === "CONFIRMADO" ? "Recebimento confirmado" : confirming ? "Revalidando regras..." : "Revalidar regras e confirmar recebimento"}</button></form>
            </div>
            {confirmState.message && <p role="status" className={`mt-2 font-bold ${confirmState.ok ? "text-emerald-700" : "text-amber-700"}`}>{confirmState.message}</p>}
          </div>

          <ReconciliationTable title="Linhas com atenção — confirme o vínculo manual" items={atencoes} previsoes={previsoes.filter((p) => p.administradora_id === atual.administradora_id)} action={linkAction} disabled={linking} />
          {linkState.message && <p role="status" className={linkState.ok ? "text-xs font-bold text-emerald-700" : "text-xs font-bold text-rose-700"}>{linkState.message}</p>}
          <ReconciliationTable title="No relatório e ainda não encontradas no sistema (cotas antigas)" items={relatorioSemSistema} previsoes={previsoes.filter((p) => p.administradora_id === atual.administradora_id)} action={linkAction} disabled={linking} legacyAction={legacyAction} legacyDisabled={launchingLegacy} participantes={participantes} regras={regras} grupos={grupos.filter((g) => g.administradora_id === atual.administradora_id)} />
          {legacyState.message && <p role="status" className={legacyState.ok ? "text-xs font-bold text-emerald-700" : "text-xs font-bold text-rose-700"}>{legacyState.message}</p>}

          <div className="overflow-hidden rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900">
            <h3 className="border-b p-3 text-sm font-bold text-violet-800">Comissões do sistema não encontradas no relatório ({sistemaSemRelatorio.length})</h3>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-left"><tr><th className="p-2">Cliente</th><th>Grupo / Cota</th><th>Parcela</th><th className="text-right pr-3">Saldo</th></tr></thead><tbody className="divide-y">{sistemaSemRelatorio.map((p) => <tr key={p.id}><td className="p-2 font-bold">{p.cliente_nome}</td><td>{p.numero_grupo} / {p.numero_cota}</td><td>{p.ordem_etapa}ª · {p.nome_etapa}</td><td className="pr-3 text-right font-mono">{money(Number(p.valor_previsto)-Number(p.valor_liquidado))}</td></tr>)}</tbody></table></div>
          </div>
        </>
      )}
    </section>
  );
}

function Summary({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="rounded-xl border bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><p className="font-bold uppercase text-slate-500">{label}</p><p className={`mt-1 text-xl font-extrabold ${color}`}>{value}</p></div>;
}

function ReconciliationTable({ title, items, previsoes, action, disabled, legacyAction, legacyDisabled, participantes = [], regras = [], grupos = [] }: { title: string; items: RepassePdfItem[]; previsoes: RepassePrevisaoAberta[]; action: (payload: FormData) => void; disabled: boolean; legacyAction?: (payload: FormData) => void; legacyDisabled?: boolean; participantes?: RepasseParticipante[]; regras?: RepasseRegraParticipante[]; grupos?: RepasseGrupo[] }) {
  if (!items.length) return null;
  return <div className="overflow-hidden rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900"><h3 className="border-b p-3 text-sm font-bold">{title} ({items.length})</h3><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-left"><tr><th className="p-2">Linha</th><th>Cliente</th><th>Grupo / Cota</th><th>Parcela</th><th>Comissão</th><th>Atenção</th><th className="min-w-80">Vínculo manual</th></tr></thead><tbody className="divide-y">{items.map((item) => <tr key={item.id}><td className="p-2">{item.linha}</td><td className="font-bold">{item.cliente_nome}</td><td>{item.numero_grupo} / {item.numero_cota}</td><td>{item.parcela_numero}/{item.parcela_total}</td><td className="font-mono">{money(Number(item.valor_comissao))}</td><td><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusStyle[item.status_conciliacao]}`}>{item.status_conciliacao}</span><p className="mt-1 max-w-56 text-[10px] text-amber-700">{item.alertas.join(" · ")}</p></td><td className="space-y-2"><form action={action} className="flex gap-2"><input type="hidden" name="item_id" value={item.id}/><select name="previsao_franquia_id" required defaultValue={item.previsao_sugerida_id ?? ""} className="min-w-64 flex-1 rounded-lg border p-1.5 dark:bg-slate-900"><option value="">Selecione uma comissão aberta (qualquer competência)</option>{previsoes.map((p) => <option key={p.id} value={p.id}>{p.competencia} · {p.cliente_nome} · {p.numero_grupo}/{p.numero_cota} · {p.ordem_etapa}ª · {money(Number(p.valor_previsto)-Number(p.valor_liquidado))}</option>)}</select><button disabled={disabled} className="rounded-lg bg-slate-900 px-3 py-1.5 font-bold text-white">Vincular</button></form>{legacyAction && <MissingRegistrationForm item={item} action={legacyAction} disabled={Boolean(legacyDisabled)} participantes={participantes} regras={regras} grupos={grupos} />}</td></tr>)}</tbody></table></div></div>;
}

function MissingRegistrationForm({ item, action, disabled, participantes, grupos }: { item: RepassePdfItem; action: (payload: FormData) => void; disabled: boolean; participantes: RepasseParticipante[]; regras: RepasseRegraParticipante[]; grupos: RepasseGrupo[] }) {
  return <details className="rounded-lg border border-violet-200 bg-violet-50 p-2">
    <summary className="cursor-pointer font-bold text-violet-800">Cadastrar cliente, grupo/cota e comissão</summary>
    <form action={action} className="mt-2 grid grid-cols-2 gap-2">
      <input type="hidden" name="item_id" value={item.id}/>
      <label className="col-span-2 font-bold">Cliente <input name="cliente_nome" required defaultValue={item.cliente_nome} className="mt-1 w-full rounded border p-1.5 font-normal"/></label>
      <p className="col-span-2 rounded bg-amber-100 p-2 text-amber-900">Cadastro mínimo: ficará com a tag “Dados pendentes” até informar CPF/CNPJ e telefone.</p>
      <label className="font-bold">Grupo existente
        <select name="grupo_id" defaultValue="" className="mt-1 w-full rounded border p-1.5 font-normal"><option value="">Criar grupo ERP inativo</option>{grupos.map((g) => <option key={g.id} value={g.id}>{g.codigo}{g.ativo ? "" : " · inativo"}</option>)}</select>
      </label>
      <label className="font-bold">Número do grupo <input name="numero_grupo" required defaultValue={item.numero_grupo} className="mt-1 w-full rounded border p-1.5 font-normal"/></label>
      <label className="font-bold">Número da cota <input name="numero_cota" required defaultValue={item.numero_cota} className="mt-1 w-full rounded border p-1.5 font-normal"/></label>
      <label className="font-bold">Consultor <select name="participante_id" required className="mt-1 w-full rounded border p-1.5 font-normal"><option value="">Selecione</option>{participantes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <input type="hidden" name="sem_regra" value="true" />
      <p className="col-span-2 rounded border border-emerald-300 bg-emerald-50 p-2 font-bold text-emerald-900">Comissão direta: será usado exatamente o valor do relatório ({money(Number(item.valor_comissao))}), sem regra de comissão.</p>
      <button disabled={disabled} className="col-span-2 rounded bg-violet-700 px-3 py-2 font-bold text-white disabled:opacity-50">Cadastrar e vincular esta linha</button>
    </form>
  </details>;
}
