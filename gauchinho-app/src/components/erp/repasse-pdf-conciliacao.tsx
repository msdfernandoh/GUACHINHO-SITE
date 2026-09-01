"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import {
  importarRelatorioRepasseRaconAction,
  vincularItemRepasseManualAction,
  lancarItemRepasseLegadoAction,
  reprocessarRelatorioRepasseAction,
  resolverAtencaoRepasseAction,
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
  valor_vinculado?: number;
  previsao: {
    id: string;
    competencia: string;
    valor_previsto: number;
    valor_liquidado: number;
    ordem_etapa: number;
    nome_etapa: string;
  } | null;
  previsao_sugerida: {
    id: string;
    competencia: string;
    valor_previsto: number;
    valor_liquidado: number;
    ordem_etapa: number;
    nome_etapa: string;
  } | null;
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
  cota_definitiva_id: string | null;
  status: string;
};

export type RepasseAtencaoResolucao = {
  id: string;
  importacao_id: string | null;
  item_importacao_id: string | null;
  previsao_franquia_id: string;
  tipo: "SISTEMA_SEM_RELATORIO" | "VALOR_DIVERGENTE";
  decisao: "AGUARDAR_PROXIMO" | "GERAR_CREDITO" | "AJUSTAR_DIFERENCA" | "MANTER_COMO_ESTA" | "CANCELAR_COTA";
  valor_sistema: number;
  valor_relatorio: number | null;
  valor_diferenca: number;
  motivo: string | null;
  created_at: string;
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
  resolucoes,
}: {
  administradoras: { id: string; nome: string }[];
  contas: { id: string; nome: string }[];
  importacoes: RepassePdfImportacao[];
  previsoes: RepassePrevisaoAberta[];
  participantes: RepasseParticipante[];
  regras: RepasseRegraParticipante[];
  grupos: RepasseGrupo[];
  resolucoes: RepasseAtencaoResolucao[];
}) {
  const [importState, importAction, importing] = useActionState(importarRelatorioRepasseRaconAction, initialState);
  const [linkState, linkAction, linking] = useActionState(vincularItemRepasseManualAction, initialState);
  const [legacyState, legacyAction, launchingLegacy] = useActionState(lancarItemRepasseLegadoAction, initialState);
  const [refreshState, refreshAction, refreshing] = useActionState(reprocessarRelatorioRepasseAction, initialState);
  const [attentionState, attentionAction, resolvingAttention] = useActionState(resolverAtencaoRepasseAction, initialState);
  const [importacaoSelecionadaId, setImportacaoSelecionadaId] = useState(importacoes[0]?.id ?? "");
  const [mostrarVinculados, setMostrarVinculados] = useState(false);
  const [abaAtencao, setAbaAtencao] = useState<"SEM_VINCULO" | "SISTEMA_AUSENTE" | "DIVERGENTES">("SEM_VINCULO");
  const abrirImportacao = useCallback((id: string) => {
    if (!importacoes.some((item) => item.id === id)) return;
    setImportacaoSelecionadaId(id);
    setMostrarVinculados(false);
    window.requestAnimationFrame(() => {
      document.getElementById("conferencia-relatorio-repasse")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [importacoes]);
  useEffect(() => {
    const abrir = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      abrirImportacao(id);
    };
    window.addEventListener("abrir-conciliacao-repasse", abrir);
    return () => window.removeEventListener("abrir-conciliacao-repasse", abrir);
  }, [abrirImportacao]);
  useEffect(() => {
    if (!importState.ok || !importState.importacaoId) return;
    abrirImportacao(importState.importacaoId);
  }, [abrirImportacao, importState.importacaoId, importState.ok]);
  const atual = importacoes.find((item) => item.id === importacaoSelecionadaId) ?? importacoes[0] ?? null;
  const usados = new Set((atual?.itens ?? []).map((item) => item.previsao_franquia_id).filter(Boolean));
  const sugeridos = new Set((atual?.itens ?? []).map((item) => item.previsao_sugerida_id).filter(Boolean));
  const ultimaResolucaoPorPrevisao = new Map<string, RepasseAtencaoResolucao>();
  const ultimaResolucaoPorItem = new Map<string, RepasseAtencaoResolucao>();
  for (const resolucao of resolucoes) {
    if (!ultimaResolucaoPorPrevisao.has(resolucao.previsao_franquia_id)) ultimaResolucaoPorPrevisao.set(resolucao.previsao_franquia_id, resolucao);
    if (resolucao.item_importacao_id && !ultimaResolucaoPorItem.has(resolucao.item_importacao_id)) ultimaResolucaoPorItem.set(resolucao.item_importacao_id, resolucao);
  }
  const sistemaSemRelatorio = atual
    ? previsoes.filter((p) => {
        const resolucao = ultimaResolucaoPorPrevisao.get(p.id);
        return p.administradora_id === atual.administradora_id
          && p.competencia === atual.competencia
          && !usados.has(p.id)
          && !sugeridos.has(p.id)
          && resolucao?.decisao !== "AJUSTAR_DIFERENCA"
          && resolucao?.decisao !== "CANCELAR_COTA";
      })
    : [];
  const valorSistemaReferencia = (item: RepassePdfItem) => {
    const previsao = item.previsao ?? item.previsao_sugerida;
    if (!previsao) return null;
    return Math.max(Number(previsao.valor_previsto) - Number(previsao.valor_liquidado) + Number(item.valor_vinculado ?? 0), 0);
  };
  const relatorioSemSistema = (atual?.itens ?? []).filter((item) => {
    if (item.previsao_franquia_id) return false;
    const valorSistema = valorSistemaReferencia(item);
    return valorSistema === null || Math.abs(valorSistema - Number(item.valor_comissao)) <= 0.02;
  });
  const vinculados = (atual?.itens ?? []).filter((item) => item.status_conciliacao.startsWith("VINCULADO") || item.status_conciliacao === "LANCADO_LEGADO");
  const divergentes = (atual?.itens ?? []).filter((item) => {
    const resolucao = ultimaResolucaoPorItem.get(item.id);
    if (resolucao && ["GERAR_CREDITO", "AJUSTAR_DIFERENCA", "MANTER_COMO_ESTA", "CANCELAR_COTA"].includes(resolucao.decisao)) return false;
    const valorSistema = valorSistemaReferencia(item);
    return valorSistema !== null && Math.abs(valorSistema - Number(item.valor_comissao)) > 0.02;
  });

  return (
    <section id="conciliacao-repasse" className="scroll-mt-4 space-y-4 rounded-2xl border border-blue-200 bg-blue-50/30 p-4 shadow-sm dark:border-blue-900 dark:bg-blue-950/10">
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
          <span className="mt-1 block font-normal text-slate-500">Pode reenviar o mesmo PDF: a leitura será atualizada sem duplicar o recebimento.</span>
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

      <div className="rounded-xl border bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">Relatórios já importados</h3>
            <p className="text-slate-500">Abra qualquer PDF anterior na mesma tela usada logo após a importação.</p>
          </div>
          <span className="rounded-full bg-blue-100 px-3 py-1 font-bold text-blue-800">{importacoes.length} relatório(s)</span>
        </div>
        {!importacoes.length ? (
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-slate-500 dark:bg-slate-800">Nenhum relatório foi importado para esta empresa.</p>
        ) : (
          <div className="mt-3 max-h-72 overflow-auto rounded-lg border">
            <table className="min-w-full text-left">
              <thead className="sticky top-0 bg-slate-50 text-slate-600 dark:bg-slate-800">
                <tr><th className="p-2">Enviado em</th><th>Competência</th><th>Arquivo</th><th className="text-right">Valor</th><th className="pl-3">Situação</th><th className="px-3 text-right">Ação</th></tr>
              </thead>
              <tbody className="divide-y">
                {importacoes.map((item) => (
                  <tr key={item.id} className={item.id === atual?.id ? "bg-blue-50 dark:bg-blue-950/30" : ""}>
                    <td className="p-2 whitespace-nowrap">{new Date(item.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="whitespace-nowrap font-semibold">{item.competencia}</td>
                    <td className="max-w-64 truncate" title={item.arquivo_nome}>{item.arquivo_nome}</td>
                    <td className="whitespace-nowrap text-right font-mono">{money(Number(item.valor_total_bruto))}</td>
                    <td className="pl-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item.status === "PENDENTE" ? "RECEBIDO · ATENÇÕES ABERTAS" : item.status.replaceAll("_", " ")}</span></td>
                    <td className="px-3 py-2 text-right"><div className="flex justify-end gap-3"><button type="button" onClick={() => abrirImportacao(item.id)} className="whitespace-nowrap font-bold text-blue-700 hover:underline">{item.id === atual?.id ? "Em conferência" : "Abrir conferência"}</button><form action={refreshAction}><input type="hidden" name="importacao_id" value={item.id}/><button disabled={refreshing} className="whitespace-nowrap font-bold text-violet-700 hover:underline disabled:opacity-50">Atualizar leitura</button></form></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {refreshState.message && <p role="status" className={`mt-3 rounded-lg p-2 font-bold ${refreshState.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{refreshState.message}</p>}
      </div>

      {atual && (
        <div id="conferencia-relatorio-repasse" className="scroll-mt-4 space-y-4">
          <label className="block max-w-xl text-xs font-bold">Relatório em conferência
            <select value={atual.id} onChange={(event) => abrirImportacao(event.target.value)} className="mt-1 block w-full rounded-lg border bg-white p-2 font-normal dark:bg-slate-900">
              {importacoes.map((item) => <option key={item.id} value={item.id}>{item.competencia} · {item.arquivo_nome} · {money(Number(item.valor_total_bruto))} · {item.status}</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
            <Summary label="Entrada bruta do PDF" value={money(Number(atual.valor_total_bruto))} color="text-emerald-700" />
            <button type="button" onClick={() => setMostrarVinculados((value) => !value)} aria-expanded={mostrarVinculados} className="rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-blue-600">
              <Summary label="Vinculados · clique para conferir" value={String(vinculados.length)} color="text-blue-700" />
            </button>
            <Summary label="Valores divergentes" value={String(divergentes.length)} color="text-amber-700" />
            <Summary label="Aguardando vínculo/cadastro" value={String(relatorioSemSistema.length)} color="text-rose-700" />
            <Summary label="Sistema sem relatório" value={String(sistemaSemRelatorio.length)} color="text-violet-700" />
          </div>

          {mostrarVinculados && <LinkedItemsTable items={vinculados} previsoes={previsoes.filter((p) => p.administradora_id === atual.administradora_id)} action={linkAction} disabled={linking} />}
          <div className="rounded-xl border bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-bold">{atual.arquivo_nome} · {atual.competencia} · {atual.comissionado_nome || "Comissionado não identificado"}</p>
              <p className="text-slate-500">Pedidos: {atual.pedidos.map((p) => p.numero).join(", ") || "não identificados"} · Ponto de venda: {atual.ponto_venda || "—"}</p></div>
              <span className="rounded-xl bg-emerald-100 px-4 py-2 font-bold text-emerald-900">Recebimento registrado · atenções não bloqueiam</span>
            </div>
            <p className="mt-2 text-slate-500">Use as abas abaixo para conferir no seu ritmo. O relatório e a entrada financeira permanecem preservados.</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white dark:border-amber-900 dark:bg-slate-900">
            <div className="border-b p-3"><h3 className="font-bold">Central de atenção do repasse</h3><p className="text-xs text-slate-500">Pendências operacionais não bloqueiam o recebimento.</p></div>
            <div className="flex flex-wrap gap-2 border-b bg-slate-50 p-3 dark:bg-slate-950">
              <AttentionTab active={abaAtencao === "SEM_VINCULO"} onClick={() => setAbaAtencao("SEM_VINCULO")} label="Não vinculadas/cadastradas" count={relatorioSemSistema.length}/>
              <AttentionTab active={abaAtencao === "SISTEMA_AUSENTE"} onClick={() => setAbaAtencao("SISTEMA_AUSENTE")} label="No sistema, fora do relatório" count={sistemaSemRelatorio.length}/>
              <AttentionTab active={abaAtencao === "DIVERGENTES"} onClick={() => setAbaAtencao("DIVERGENTES")} label="Valores divergentes" count={divergentes.length}/>
            </div>
            <div className="p-3">
              {abaAtencao === "SEM_VINCULO" && <ReconciliationTable title="Linhas do relatório aguardando vínculo ou cadastro" items={relatorioSemSistema} previsoes={previsoes.filter((p) => p.administradora_id === atual.administradora_id)} action={linkAction} disabled={linking} legacyAction={legacyAction} legacyDisabled={launchingLegacy} participantes={participantes} regras={regras} grupos={grupos.filter((g) => g.administradora_id === atual.administradora_id)} />}
              {abaAtencao === "SISTEMA_AUSENTE" && <SystemMissingTable importacao={atual} items={sistemaSemRelatorio} resolutions={ultimaResolucaoPorPrevisao} action={attentionAction} disabled={resolvingAttention}/>}
              {abaAtencao === "DIVERGENTES" && <DivergenceTable importacao={atual} items={divergentes} previsoes={previsoes.filter((p) => p.administradora_id === atual.administradora_id)} action={attentionAction} correctionAction={linkAction} disabled={resolvingAttention || linking}/>}
            </div>
          </div>
          {linkState.message && <p role="alert" className={`sticky bottom-3 z-20 rounded-xl border p-3 text-sm font-bold shadow-lg ${linkState.ok ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-rose-300 bg-rose-50 text-rose-800"}`}>{linkState.message}</p>}
          {legacyState.message && <p role="status" className={legacyState.ok ? "text-xs font-bold text-emerald-700" : "text-xs font-bold text-rose-700"}>{legacyState.message}</p>}
          {attentionState.message && <p role="status" className={attentionState.ok ? "rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-800" : "rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-800"}>{attentionState.message}</p>}
        </div>
      )}
    </section>
  );
}

function AttentionTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return <button type="button" onClick={onClick} className={`rounded-xl px-3 py-2 text-xs font-bold transition ${active ? "bg-amber-600 text-white shadow-sm" : "border bg-white text-slate-700 hover:border-amber-400 dark:bg-slate-900 dark:text-slate-200"}`}>{label} <span className={`ml-1 rounded-full px-2 py-0.5 ${active ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}>{count}</span></button>;
}

function SystemMissingTable({ importacao, items, resolutions, action, disabled }: { importacao: RepassePdfImportacao; items: RepassePrevisaoAberta[]; resolutions: Map<string, RepasseAtencaoResolucao>; action: (payload: FormData) => void; disabled: boolean }) {
  if (!items.length) return <EmptyAttention text="Nenhuma comissão do sistema ficou fora deste relatório."/>;
  return <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left text-xs"><thead className="bg-violet-50 text-violet-900"><tr><th className="p-3">Cliente</th><th>Grupo / Cota</th><th>Parcela</th><th className="text-right">Saldo esperado</th><th className="pl-3">Situação</th><th className="p-3">Ações</th></tr></thead><tbody className="divide-y">{items.map((item) => {
    const resolution = resolutions.get(item.id);
    return <tr key={item.id}><td className="p-3 font-bold">{item.cliente_nome}</td><td>{item.numero_grupo} / {item.numero_cota}</td><td>{item.ordem_etapa}ª · {item.nome_etapa}</td><td className="text-right font-mono font-bold">{money(Number(item.valor_previsto)-Number(item.valor_liquidado))}</td><td className="pl-3">{resolution?.decisao === "AGUARDAR_PROXIMO" ? <span className="rounded-full bg-blue-100 px-2 py-1 font-bold text-blue-800">Aguardando próximo relatório</span> : <span className="rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-900">Conferir inadimplência/cancelamento</span>}</td><td className="p-3"><div className="flex flex-wrap gap-2"><form action={action}><input type="hidden" name="previsao_franquia_id" value={item.id}/><input type="hidden" name="importacao_id" value={importacao.id}/><input type="hidden" name="decisao" value="AGUARDAR_PROXIMO"/><input type="hidden" name="idempotency_key" value={`aguardar:${importacao.id}:${item.id}`}/><button disabled={disabled || resolution?.decisao === "AGUARDAR_PROXIMO"} className="rounded-lg bg-blue-700 px-3 py-2 font-bold text-white disabled:opacity-40">Manter para o próximo relatório</button></form><details className="rounded-lg border border-rose-200 bg-rose-50 p-2"><summary className="cursor-pointer font-bold text-rose-800">Cliente cancelou / dar baixa</summary><form action={action} className="mt-2 flex min-w-80 gap-2"><input type="hidden" name="previsao_franquia_id" value={item.id}/><input type="hidden" name="importacao_id" value={importacao.id}/><input type="hidden" name="decisao" value="CANCELAR_COTA"/><input type="hidden" name="idempotency_key" value={`cancelar:${importacao.id}:${item.id}`}/><input name="motivo" required minLength={5} placeholder="Motivo do cancelamento" className="min-w-56 rounded border bg-white p-2"/><button disabled={disabled} className="rounded bg-rose-700 px-3 py-2 font-bold text-white">Cancelar cota</button></form></details></div></td></tr>;
  })}</tbody></table></div>;
}

function DivergenceTable({ importacao, items, previsoes, action, correctionAction, disabled }: { importacao: RepassePdfImportacao; items: RepassePdfItem[]; previsoes: RepassePrevisaoAberta[]; action: (payload: FormData) => void; correctionAction: (payload: FormData) => void; disabled: boolean }) {
  if (!items.length) return <EmptyAttention text="Nenhuma diferença de valor entre o sistema e este relatório."/>;
  return <div className="space-y-3">{items.map((item) => {
    const previsao = item.previsao ?? item.previsao_sugerida;
    if (!previsao) return null;
    const valorSistema = Math.max(Number(previsao.valor_previsto)-Number(previsao.valor_liquidado)+Number(item.valor_vinculado ?? 0),0);
    const valorRelatorio = Number(item.valor_comissao);
    const diferenca = valorSistema-valorRelatorio;
    const previsaoId = item.previsao_franquia_id ?? item.previsao_sugerida_id;
    if (!previsaoId) return null;
    const hidden = <><input type="hidden" name="previsao_franquia_id" value={previsaoId}/><input type="hidden" name="importacao_id" value={importacao.id}/><input type="hidden" name="item_importacao_id" value={item.id}/></>;
    return <article key={item.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"><div className="grid gap-3 md:grid-cols-[1.3fr_repeat(3,0.7fr)]"><div><p className="font-bold">{item.cliente_nome}</p><p className="text-slate-500">Grupo {item.numero_grupo} · Cota {item.numero_cota} · {item.parcela_numero}ª parcela</p><p className="mt-1 text-amber-800">{item.alertas.join(" · ")}</p></div><ValueBox label="Sistema" value={valorSistema}/><ValueBox label="Relatório" value={valorRelatorio}/><ValueBox label={diferenca>0 ? "Crédito possível" : "Ajuste necessário"} value={Math.abs(diferenca)} danger={diferenca<0}/></div><details className="mt-3 rounded-lg border-2 border-violet-300 bg-violet-50 p-3" open><summary className="cursor-pointer font-extrabold text-violet-900">Substituir vínculo pela parcela correta</summary><p className="mt-1 text-xs text-violet-800">Escolha a mesma cota, competência e parcela do relatório. Ao salvar, a baixa é transferida e a divergência é recalculada.</p><form action={correctionAction} className="mt-2 flex flex-wrap gap-2"><input type="hidden" name="item_id" value={item.id}/><select name="previsao_franquia_id" required defaultValue={item.previsao_franquia_id ?? item.previsao_sugerida_id ?? ""} className="min-w-80 flex-1 rounded-lg border bg-white p-2"><option value="">Selecione a parcela correta</option>{previsoes.map((p) => <option key={p.id} value={p.id}>{p.competencia} · {p.cliente_nome} · {p.numero_grupo}/{p.numero_cota} · {p.ordem_etapa}ª · {money(Number(p.valor_previsto)-Number(p.valor_liquidado))}</option>)}</select><button disabled={disabled} className="rounded-lg bg-violet-700 px-4 py-2 font-bold text-white">Substituir vínculo e resolver</button></form></details><p className="mt-3 rounded-lg bg-white p-2 text-xs text-slate-600"><strong>Ajustar no sistema</strong> adota o valor do relatório nesta conciliação. <strong>Dar por ajustado</strong> encerra a divergência mantendo os valores atuais como estão.</p><div className="mt-3 flex flex-wrap items-start gap-2">{diferenca>0 && <form action={action}>{hidden}<input type="hidden" name="decisao" value="GERAR_CREDITO"/><input type="hidden" name="idempotency_key" value={`credito:${importacao.id}:${item.id}`}/><button disabled={disabled} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white">Manter sistema e gerar crédito</button></form>}<details className="rounded-lg border border-blue-200 bg-blue-50 p-2"><summary className="cursor-pointer font-bold text-blue-900">Ajustar no sistema</summary><form action={action} className="mt-2 flex min-w-[420px] gap-2">{hidden}<input type="hidden" name="decisao" value="AJUSTAR_DIFERENCA"/><input type="hidden" name="valor_ajuste" value={Math.abs(diferenca).toFixed(2)}/><input type="hidden" name="idempotency_key" value={`ajuste-sistema:${importacao.id}:${item.id}`}/><input name="motivo" required placeholder="Explique por que o relatório será adotado" className="min-w-56 flex-1 rounded border bg-white p-2"/><button disabled={disabled} className="rounded bg-blue-800 px-3 py-2 font-bold text-white">Usar valor do relatório</button></form></details><details className="rounded-lg border bg-white p-2"><summary className="cursor-pointer font-bold text-slate-800">Dar por ajustado · manter como está</summary><form action={action} className="mt-2 flex min-w-[420px] gap-2">{hidden}<input type="hidden" name="decisao" value="MANTER_COMO_ESTA"/><input type="hidden" name="idempotency_key" value={`manter-como-esta:${importacao.id}:${item.id}`}/><input name="motivo" required placeholder="Explique por que os valores serão mantidos" className="min-w-56 flex-1 rounded border p-2"/><button disabled={disabled} className="rounded bg-slate-800 px-3 py-2 font-bold text-white">Manter e encerrar divergência</button></form></details><details className="rounded-lg border border-rose-200 bg-rose-50 p-2"><summary className="cursor-pointer font-bold text-rose-800">Cliente cancelou</summary><form action={action} className="mt-2 flex min-w-[380px] gap-2">{hidden}<input type="hidden" name="decisao" value="CANCELAR_COTA"/><input type="hidden" name="idempotency_key" value={`cancelar-divergencia:${importacao.id}:${item.id}`}/><input name="motivo" required minLength={5} placeholder="Motivo do cancelamento" className="min-w-56 flex-1 rounded border bg-white p-2"/><button disabled={disabled} className="rounded bg-rose-700 px-3 py-2 font-bold text-white">Cancelar cota</button></form></details></div></article>;
  })}</div>;
}

function EmptyAttention({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">{text}</p>;
}

function ValueBox({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className="rounded-lg border bg-white p-3 text-right"><p className="text-[10px] font-bold uppercase text-slate-500">{label}</p><p className={`mt-1 font-mono text-base font-extrabold ${danger ? "text-rose-700" : "text-slate-900"}`}>{money(value)}</p></div>;
}

function Summary({ label, value, color }: { label: string; value: string; color: string }) {
  return <div className="rounded-xl border bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><p className="font-bold uppercase text-slate-500">{label}</p><p className={`mt-1 text-xl font-extrabold ${color}`}>{value}</p></div>;
}

function ReconciliationTable({ title, items, previsoes, action, disabled, legacyAction, legacyDisabled, participantes = [], regras = [], grupos = [] }: { title: string; items: RepassePdfItem[]; previsoes: RepassePrevisaoAberta[]; action: (payload: FormData) => void; disabled: boolean; legacyAction?: (payload: FormData) => void; legacyDisabled?: boolean; participantes?: RepasseParticipante[]; regras?: RepasseRegraParticipante[]; grupos?: RepasseGrupo[] }) {
  if (!items.length) return null;
  return <div className="overflow-hidden rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900"><h3 className="border-b p-3 text-sm font-bold">{title} ({items.length})</h3><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-left"><tr><th className="p-2">Linha</th><th>Cliente</th><th>Grupo / Cota</th><th>Parcela</th><th>Comissão</th><th>Atenção</th><th className="min-w-80">Vínculo manual</th></tr></thead><tbody className="divide-y">{items.map((item) => <tr key={item.id}><td className="p-2">{item.linha}</td><td className="font-bold">{item.cliente_nome}</td><td>{item.numero_grupo} / {item.numero_cota}</td><td>{item.parcela_numero}/{item.parcela_total}</td><td className="font-mono">{money(Number(item.valor_comissao))}</td><td><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusStyle[item.status_conciliacao]}`}>{item.status_conciliacao}</span><p className="mt-1 max-w-56 text-[10px] text-amber-700">{item.alertas.join(" · ")}</p></td><td className="space-y-2"><form action={action} className="flex gap-2"><input type="hidden" name="item_id" value={item.id}/><select name="previsao_franquia_id" required defaultValue={item.previsao_sugerida_id ?? ""} className="min-w-64 flex-1 rounded-lg border p-1.5 dark:bg-slate-900"><option value="">Selecione uma comissão aberta (qualquer competência)</option>{previsoes.map((p) => <option key={p.id} value={p.id}>{p.competencia} · {p.cliente_nome} · {p.numero_grupo}/{p.numero_cota} · {p.ordem_etapa}ª · {money(Number(p.valor_previsto)-Number(p.valor_liquidado))}</option>)}</select><button disabled={disabled} className="rounded-lg bg-slate-900 px-3 py-1.5 font-bold text-white">Vincular</button></form>{legacyAction && <MissingRegistrationForm item={item} action={legacyAction} disabled={Boolean(legacyDisabled)} participantes={participantes} regras={regras} grupos={grupos} />}</td></tr>)}</tbody></table></div></div>;
}

function LinkedItemsTable({ items, previsoes, action, disabled }: { items: RepassePdfItem[]; previsoes: RepassePrevisaoAberta[]; action: (payload: FormData) => void; disabled: boolean }) {
  return <div className="overflow-hidden rounded-xl border border-blue-200 bg-white dark:border-blue-900 dark:bg-slate-900">
    <h3 className="border-b p-3 text-sm font-bold text-blue-800">Vínculos do relatório ({items.length})</h3>
    {!items.length ? <p className="p-4 text-xs text-slate-500">Nenhuma linha vinculada neste relatório.</p> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50 text-left"><tr><th className="p-2">Linha</th><th>Cliente</th><th>Grupo / Cota</th><th>Parcela</th><th className="text-right">Valor do relatório</th><th className="text-right">Valor vinculado</th><th className="min-w-96 pl-3">Conferir ou alterar vínculo</th></tr></thead><tbody className="divide-y">{items.map((item) => {
      const current = item.previsao;
      const valorVinculado = Number(item.valor_vinculado ?? 0);
      const options = current && item.previsao_franquia_id && !previsoes.some((p) => p.id === item.previsao_franquia_id)
        ? [{ id: item.previsao_franquia_id, administradora_id: "", competencia: current.competencia, ordem_etapa: current.ordem_etapa, nome_etapa: current.nome_etapa, valor_previsto: current.valor_previsto, valor_liquidado: current.valor_liquidado, numero_grupo: item.numero_grupo, numero_cota: item.numero_cota, cliente_nome: item.cliente_nome, cota_definitiva_id: null, status: "liquidada" }, ...previsoes]
        : previsoes;
      return <tr key={item.id}><td className="p-2">{item.linha}</td><td className="font-bold">{item.cliente_nome}</td><td>{item.numero_grupo} / {item.numero_cota}</td><td>{item.parcela_numero}/{item.parcela_total}</td><td className="text-right font-mono">{money(Number(item.valor_comissao))}</td><td className="text-right font-mono font-bold text-blue-700">{money(valorVinculado)}</td><td className="pl-3"><form action={action} className="flex gap-2"><input type="hidden" name="item_id" value={item.id}/><select name="previsao_franquia_id" required defaultValue={item.previsao_franquia_id ?? ""} className="min-w-72 flex-1 rounded-lg border p-1.5 dark:bg-slate-900">{options.map((p) => <option key={p.id} value={p.id}>{p.competencia} · {p.cliente_nome} · {p.numero_grupo}/{p.numero_cota} · {p.ordem_etapa}ª · {money(Number(p.valor_previsto))}</option>)}</select><button disabled={disabled} className="rounded-lg bg-blue-700 px-3 py-1.5 font-bold text-white disabled:opacity-50">Salvar alteração</button></form></td></tr>;
    })}</tbody></table></div>}
  </div>;
}

function MissingRegistrationForm({ item, action, disabled, participantes, grupos }: { item: RepassePdfItem; action: (payload: FormData) => void; disabled: boolean; participantes: RepasseParticipante[]; regras: RepasseRegraParticipante[]; grupos: RepasseGrupo[] }) {
  return <details className="rounded-lg border border-violet-200 bg-violet-50 p-2">
    <summary className="cursor-pointer font-bold text-violet-800">Cadastrar cliente, grupo/cota e comissão</summary>
    <form action={action} className="mt-2 grid grid-cols-2 gap-2">
      <input type="hidden" name="item_id" value={item.id}/>
      <label className="col-span-2 font-bold">Cliente <input name="cliente_nome" required defaultValue={item.cliente_nome} className="mt-1 w-full rounded border p-1.5 font-normal"/></label>
      <p className="col-span-2 rounded bg-amber-100 p-2 text-amber-900"><strong>CPF/CNPJ e telefone são somente um aviso no cadastro do cliente.</strong> Não bloqueiam o vínculo nem a comissão; ao confirmar, cliente, cota, comissão e vínculo serão criados e esta linha ficará resolvida.</p>
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
