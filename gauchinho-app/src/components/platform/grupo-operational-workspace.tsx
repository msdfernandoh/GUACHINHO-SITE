"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  salvarGrupoPlatformAction,
  salvarEstatisticasGrupoAction,
  salvarCategoriasGrupoAction,
  salvarLancesEmbutidosGrupoAction,
  type GroupActionState,
} from "@/app/platform/grupos-actions";
import {
  salvarModalidadesGrupoPlatformAction,
  salvarCotasEmLoteAction,
  salvarCotaModalidadeAction,
  salvarCotaModalidadeEmMassaAction,
  excluirCotaProdutoAction,
} from "@/app/platform/grupos-catalogo-actions";
import {
  type GrupoRecord,
  type AdministradoraModalidadeItem,
  type GrupoModalidadeItem,
  type GrupoCotaModalidadeValor,
  type GrupoProntidaoResult,
  type CaracteristicaContemplacaoItem,
  type TipoContemplacao,
  formatBRL,
  formatPercent,
  formatDateBR,
  validateGrupoProntidao,
  resolveModalidadeConfig,
  resolveCotaModalidadeEfetiva,
  calcularResumoContemplacoes,
  DEFAULT_TIPOS_CONTEMPLACAO,
} from "@/lib/platform/grupos-prontidao";
import { GrupoReajusteCreditosDialog } from "@/components/platform/grupo-reajuste-creditos-dialog";
import { calcularAssembleiaMetade } from "@/lib/grupos/regra-integralizacao";

const initial: GroupActionState = { status: "IDLE", message: "" };
const inputStyle =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

function Feedback({ state }: { state: GroupActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={`rounded-lg p-3 text-sm font-medium ${
        state.status === "SUCCESS"
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
      }`}
    >
      {state.message}
    </p>
  );
}

export function GrupoOperationalWorkspace({
  grupo,
  administradoras,
  tiposAdministradora,
  modalidadesAdministradora,
  historico,
  reajustesCredito,
  empresaConfig,
  categoriasDisponiveis,
}: {
  grupo: GrupoRecord;
  administradoras: Array<{ id: string; nome: string }>;
  tiposAdministradora: Array<{ id: string; nome: string; codigo: string }>;
  modalidadesAdministradora: AdministradoraModalidadeItem[];
  historico: Array<{
    id: string;
    fonte: string;
    campo: string;
    valor_anterior: unknown;
    valor_novo: unknown;
    observacao: string | null;
    created_at: string;
    usuario?: { nome?: string } | null;
    empresa?: { nome_fantasia?: string } | null;
  }>;
  reajustesCredito: Array<{
    id: string;
    marco_meses: number;
    percentual_referencia: number | null;
    valores_anteriores: Array<{ id: string; valor_credito: number }>;
    valores_novos: Array<{ id: string; valor_credito: number }>;
    observacao: string | null;
    created_at: string;
    usuario?: { nome?: string } | null;
  }>;
  empresaConfig?: {
    usar_dados_globais?: boolean;
    dados_estatisticos_locais?: unknown;
    vagas_disponiveis_locais?: number | null;
  } | null;
  categoriasDisponiveis: Array<{ codigo: string; nome: string }>;
}) {
  const [tab, setTab] = useState<"gerais" | "cotas" | "estatisticas" | "historico">("gerais");
  const [modoEstatisticas, setModoEstatisticas] = useState<"GLOBAL" | "LOCAL">("GLOBAL");
  const [reajusteAberto, setReajusteAberto] = useState(false);

  const [caracteristicas, setCaracteristicas] = useState<CaracteristicaContemplacaoItem[]>(() => {
    const existing = (grupo.dados_estatisticos as Record<string, unknown> | null)?.caracteristicas_contemplacao;
    if (Array.isArray(existing) && existing.length > 0) {
      return existing.map((item: Partial<CaracteristicaContemplacaoItem>, index: number) => ({
        id: item.id || `c-${index}-${Date.now()}`,
        ordem: Number(item.ordem) || index + 1,
        tipo: (item.tipo as TipoContemplacao) || "SORTEIO",
        condicao_percentual: item.condicao_percentual ?? "",
        observacao: item.observacao ?? "",
        ativa: item.ativa !== false,
      }));
    }
    return [];
  });

  const resumoContemplacoes = calcularResumoContemplacoes(caracteristicas);

  function adicionarLinhaContemplacao() {
    setCaracteristicas((prev) => {
      const nextOrdem = prev.length > 0 ? Math.max(...prev.map((p) => p.ordem)) + 1 : 1;
      return [
        ...prev,
        {
          id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ordem: nextOrdem,
          tipo: "LANCE_LIVRE",
          condicao_percentual: "",
          observacao: "",
          ativa: true,
        },
      ];
    });
  }

  function removerLinhaContemplacao(id: string) {
    setCaracteristicas((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      return updated.map((item, idx) => ({ ...item, ordem: idx + 1 }));
    });
  }

  function atualizarLinhaContemplacao(id: string, updates: Partial<CaracteristicaContemplacaoItem>) {
    setCaracteristicas((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }

  function moverLinhaContemplacao(index: number, direcao: "up" | "down") {
    setCaracteristicas((prev) => {
      const targetIndex = direcao === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const items = [...prev];
      const temp = items[index];
      items[index] = items[targetIndex];
      items[targetIndex] = temp;
      return items.map((item, idx) => ({ ...item, ordem: idx + 1 }));
    });
  }

  const [editingCotaModalidade, setEditingCotaModalidade] = useState<{
    cotaId: string;
    cotaCredito: number;
    modalidade: AdministradoraModalidadeItem;
    cotaValor?: GrupoCotaModalidadeValor;
    grupoMod?: GrupoModalidadeItem;
  } | null>(null);
  const [selectedCotas, setSelectedCotas] = useState<Set<string>>(new Set());
  const [batchModalidadeId, setBatchModalidadeId] = useState("");
  const [batchModo, setBatchModo] = useState<"HERDAR" | "PERSONALIZADO" | "DESABILITADO">("HERDAR");
  const [batchPercentual, setBatchPercentual] = useState("");
  const [isPendingBatch, setIsPendingBatch] = useState(false);

  const [formStateGrupo, formActionGrupo, isPendingGrupo] = useActionState(
    salvarGrupoPlatformAction,
    initial,
  );
  const [formStateStats, formActionStats, isPendingStats] = useActionState(
    salvarEstatisticasGrupoAction,
    initial,
  );
  const [formStateMods, formActionMods, isPendingMods] = useActionState(
    salvarModalidadesGrupoPlatformAction.bind(null, grupo.id),
    initial,
  );
  const [formStateLote, formActionLote, isPendingLote] = useActionState(
    salvarCotasEmLoteAction.bind(null, grupo.id),
    initial,
  );
  const [formStateCategorias, formActionCategorias, isPendingCategorias] = useActionState(
    salvarCategoriasGrupoAction,
    initial,
  );
  const [formStateLances, formActionLances, isPendingLances] = useActionState(
    salvarLancesEmbutidosGrupoAction,
    initial,
  );
  const [lancesEmbutidos, setLancesEmbutidos] = useState(() =>
    (grupo.lances ?? []).map((item) => ({
      id: item.id,
      nome: item.nome,
      percentual_lance_embutido: String(item.percentual_lance_embutido ?? ""),
      percentual_recurso_proprio_minimo: String(item.percentual_recurso_proprio_minimo ?? 0),
      base_referencia: item.base_referencia ?? "SALDO_DEVEDOR",
      descricao: item.descricao ?? "",
      ativo: item.ativo !== false,
    })),
  );
  const [regraIntegralizacao, setRegraIntegralizacao] = useState<"" | "CONTEMPLACAO" | "ASSEMBLEIA">(
    grupo.regra_integralizacao_parcela_reduzida ?? "",
  );
  const [assembleiaLimite, setAssembleiaLimite] = useState(
    grupo.assembleia_limite_parcela_reduzida ? String(grupo.assembleia_limite_parcela_reduzida) : "",
  );

  const prontidao: GrupoProntidaoResult = validateGrupoProntidao(grupo);

  const modalidadesDisponiveis = grupo.modalidades ?? [];
  const cotas = (grupo.produtos ?? []).filter((p) => p.ativo).sort((a, b) => b.valor_credito - a.valor_credito);
  const marcoReajuste = Math.floor(prontidao.temporal.realizadas / 12) * 12;
  const reajustePendente = marcoReajuste >= 12 && marcoReajuste > Number(grupo.credito_reajustado_ate_meses ?? 0);

  function handleToggleSelectCota(cotaId: string) {
    setSelectedCotas((prev) => {
      const next = new Set(prev);
      if (next.has(cotaId)) next.delete(cotaId);
      else next.add(cotaId);
      return next;
    });
  }

  function handleToggleSelectAll() {
    setSelectedCotas(selectedCotas.size === cotas.length ? new Set() : new Set(cotas.map((c) => c.id)));
  }

  async function handleApplyBatchAction() {
    if (!batchModalidadeId || selectedCotas.size === 0) return;
    setIsPendingBatch(true);
    try {
      const pct = batchModo === "PERSONALIZADO" ? Number(batchPercentual.replace(",", ".")) : null;
      await salvarCotaModalidadeEmMassaAction(grupo.id, Array.from(selectedCotas), batchModalidadeId, batchModo, pct);
      setSelectedCotas(new Set());
    } finally {
      setIsPendingBatch(false);
    }
  }

  const adminNome = typeof grupo.administradora === "object" ? grupo.administradora?.nome : grupo.administradora || "—";
  const tipoNome = grupo.tipo?.nome || grupo.modalidade || "—";

  return (
    <div className="space-y-6">
      {/* Navegação e Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/platform/grupos"
              className="text-xs font-bold uppercase tracking-wider text-cyan-600 hover:underline"
            >
              Platform · Grupos
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold text-slate-500">{adminNome}</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">
            Grupo {grupo.codigo_grupo}
          </h1>
          <p className="text-sm text-slate-500">
            {adminNome} · {tipoNome} · Prazo {prontidao.temporal.resumoPrazo} ({prontidao.temporal.legenda})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {reajustePendente ? (
            <button
              type="button"
              onClick={() => setReajusteAberto(true)}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-extrabold text-slate-950 shadow hover:bg-amber-400"
            >
              Ajustar créditos · {marcoReajuste} meses
            </button>
          ) : null}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              prontidao.ready
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            {prontidao.ready ? "✓ Pronto para Venda" : `⚠ ${prontidao.issues.length} Pendência(s)`}
          </span>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
              prontidao.temporal.encerrado
                ? "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                : grupo.ativo
                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {prontidao.temporal.encerrado
              ? "Encerrado (Prazo finalizado)"
              : grupo.status || (grupo.ativo ? "Disponível" : "Inativo")}
          </span>
        </div>
      </div>

      {reajusteAberto ? (
        <GrupoReajusteCreditosDialog
          grupoId={grupo.id}
          codigoGrupo={grupo.codigo_grupo}
          marcoMeses={marcoReajuste}
          cotas={cotas.map((cota) => ({ id: cota.id, valor_credito: Number(cota.valor_credito) }))}
          onClose={() => setReajusteAberto(false)}
        />
      ) : null}

      {/* Cards Resumo Operacional */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tipo Oficial</p>
          <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{tipoNome}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Faixa de Crédito</p>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
            {prontidao.cotaMinima && prontidao.cotaMaxima
              ? `${formatBRL(prontidao.cotaMinima)} ~ ${formatBRL(prontidao.cotaMaxima)}`
              : "Sem cotas ativas"}
          </p>
          <p className="text-xs text-slate-400">{cotas.length} cota(s) ativa(s)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Assembleias / Prazo</p>
          <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white" title={prontidao.temporal.legenda}>
            {prontidao.temporal.resumoPrazo}
          </p>
          <p className="text-xs text-slate-400">
            {grupo.data_primeira_assembleia ? `1ª: ${formatDateBR(grupo.data_primeira_assembleia)}` : "1ª Ass. não informada"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Próxima Assembleia</p>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
            {prontidao.temporal.proximaAssembleiaFormatada}
          </p>
          <p className="text-xs text-slate-400">
            {prontidao.temporal.encerrado ? "Prazo esgotado" : `${prontidao.temporal.restantes} restante(s)`}
          </p>
        </div>
        <div
          onClick={() => setTab("estatisticas")}
          className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-cyan-500 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          title="Clique para editar Características de Contemplação e Lances"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-cyan-700 dark:group-hover:text-cyan-400">
              Contemplações
            </p>
            <span className="text-[10px] font-bold text-cyan-600 group-hover:underline">Ver →</span>
          </div>
          <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
            {resumoContemplacoes.textoPotencial}
          </p>
          <p className="text-xs text-slate-400 truncate" title={resumoContemplacoes.resumoCurto}>
            {resumoContemplacoes.resumoCurto}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Taxa Total</p>
          <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
            {formatPercent(prontidao.taxaTotal)}
          </p>
          <p className="text-xs text-slate-400">
            Adm: {formatPercent(grupo.taxa_administrativa_percentual)} | FR: {formatPercent(grupo.fundo_reserva_percentual)}
          </p>
        </div>
      </div>

      {/* Banner de Pendências de Prontidão */}
      {!prontidao.ready && prontidao.issues.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-bold">Pendências para Homologação e Venda do Grupo:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {prontidao.issues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form action={formActionCategorias} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input type="hidden" name="grupo_id" value={grupo.id} />
        <Feedback state={formStateCategorias} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Categorias de publicação</h2>
            <p className="text-xs text-slate-500">Um único grupo pode aparecer em Automóvel e Moto sem duplicar cadastro, taxas ou créditos.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {categoriasDisponiveis.map((categoria) => {
                const marcada = (grupo.categorias ?? []).some((item) => item.categoria?.codigo === categoria.codigo);
                return <label key={categoria.codigo} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700">
                  <input type="checkbox" name="categoria_codigo" value={categoria.codigo} defaultChecked={marcada} className="mr-2" />
                  {categoria.nome}
                </label>;
              })}
            </div>
          </div>
          <button type="submit" disabled={isPendingCategorias} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800 disabled:opacity-50">{isPendingCategorias ? "Salvando..." : "Salvar categorias"}</button>
        </div>
      </form>

      <form action={formActionLances} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input type="hidden" name="grupo_id" value={grupo.id} />
        <input type="hidden" name="lances_json" value={JSON.stringify(lancesEmbutidos)} />
        <Feedback state={formStateLances} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Tipos de lance embutido</h2>
            <p className="text-xs text-slate-500">Coleção canônica exibida no site e no ERP para este grupo.</p>
          </div>
          <button
            type="button"
            onClick={() => setLancesEmbutidos((current) => [...current, { id: `novo-${Date.now()}`, nome: "", percentual_lance_embutido: "", percentual_recurso_proprio_minimo: "0", base_referencia: "SALDO_DEVEDOR" as const, descricao: "", ativo: true }])}
            className="rounded-lg border border-cyan-600 px-3 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300"
          >
            + Adicionar tipo
          </button>
        </div>
        {lancesEmbutidos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700">Nenhum lance embutido cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {lancesEmbutidos.map((lance, index) => (
              <div key={lance.id} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-2 lg:grid-cols-5 dark:border-slate-700">
                <label className="text-xs font-bold text-slate-600">Nome da modalidade<input
                  aria-label={`Nome do lance ${index + 1}`}
                  value={lance.nome}
                  onChange={(event) => setLancesEmbutidos((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, nome: event.target.value } : row))}
                  placeholder="Ex.: Lance embutido 25%"
                  className={inputStyle}
                /></label>
                <label className="text-xs font-bold text-slate-600">Máximo embutido (%)<input
                  aria-label={`Percentual do lance ${index + 1}`}
                  value={lance.percentual_lance_embutido}
                  onChange={(event) => setLancesEmbutidos((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, percentual_lance_embutido: event.target.value } : row))}
                  placeholder="Ex.: 40"
                  className={inputStyle}
                /></label>
                <label className="text-xs font-bold text-slate-600">Recurso próprio mínimo (%)<input
                  aria-label={`Recurso próprio mínimo do lance ${index + 1}`}
                  value={lance.percentual_recurso_proprio_minimo}
                  onChange={(event) => setLancesEmbutidos((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, percentual_recurso_proprio_minimo: event.target.value } : row))}
                  placeholder="Recurso próprio mín. %"
                  className={inputStyle}
                /></label>
                <label className="text-xs font-bold text-slate-600">Base de referência<select
                  aria-label={`Base de referência do lance ${index + 1}`}
                  value={lance.base_referencia}
                  onChange={(event) => setLancesEmbutidos((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, base_referencia: event.target.value as "SALDO_DEVEDOR" | "CREDITO" } : row))}
                  className={inputStyle}
                ><option value="SALDO_DEVEDOR">Saldo devedor</option><option value="CREDITO">Crédito contratado</option></select></label>
                <label className="text-xs font-bold text-slate-600">Descrição opcional<input
                  aria-label={`Descrição do lance ${index + 1}`}
                  value={lance.descricao}
                  onChange={(event) => setLancesEmbutidos((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, descricao: event.target.value } : row))}
                  placeholder="Descrição opcional"
                  className={inputStyle}
                /></label>
                <div className="flex items-center justify-between md:col-span-2 lg:col-span-5"><span className="text-xs text-slate-500">Composição mínima informada: {Number(lance.percentual_lance_embutido || 0) + Number(lance.percentual_recurso_proprio_minimo || 0)}%</span><button type="button" onClick={() => setLancesEmbutidos((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="text-xs font-bold text-red-600 hover:underline">Remover</button></div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <button type="submit" disabled={isPendingLances} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800 disabled:opacity-50">
            {isPendingLances ? "Salvando..." : "Salvar tipos de lance"}
          </button>
        </div>
      </form>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6 text-sm font-medium">
          <button
            onClick={() => setTab("gerais")}
            className={`border-b-2 pb-3 transition-colors ${
              tab === "gerais"
                ? "border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            1. Dados Gerais & Taxas
          </button>
          <button
            onClick={() => setTab("cotas")}
            className={`border-b-2 pb-3 transition-colors ${
              tab === "cotas"
                ? "border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            2. Cotas & Modalidades ({cotas.length})
          </button>
          <button
            onClick={() => setTab("estatisticas")}
            className={`border-b-2 pb-3 transition-colors ${
              tab === "estatisticas"
                ? "border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            3. Estatísticas & Lances (Informativo)
          </button>
          <button
            onClick={() => setTab("historico")}
            className={`border-b-2 pb-3 transition-colors ${
              tab === "historico"
                ? "border-cyan-600 text-cyan-600 dark:border-cyan-400 dark:text-cyan-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            4. Histórico & Auditoria ({historico.length})
          </button>
        </nav>
      </div>

      {/* TAB 1: DADOS GERAIS */}
      {tab === "gerais" ? (
        <form action={formActionGrupo} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <input type="hidden" name="id" value={grupo.id} />
          <Feedback state={formStateGrupo} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Administradora *
              </label>
              <select name="administradora_id" defaultValue={grupo.administradora_id || ""} className={inputStyle} required>
                <option value="">Selecione a Administradora</option>
                {administradoras.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Tipo Oficial *
              </label>
              <select name="tipo_administradora_id" defaultValue={grupo.tipo_administradora_id || ""} className={inputStyle} required>
                <option value="">Selecione o Tipo</option>
                {tiposAdministradora.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Número / Código do Grupo *
              </label>
              <input name="codigo_grupo" defaultValue={grupo.codigo_grupo} placeholder="Ex: 1045" className={inputStyle} required />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Status Operacional
              </label>
              <select name="status" defaultValue={grupo.status || "Disponível"} className={inputStyle}>
                <option value="Disponível">Disponível</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Encerrado">Encerrado</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Data da 1ª Assembleia *
              </label>
              <input
                name="data_primeira_assembleia"
                type="date"
                defaultValue={grupo.data_primeira_assembleia ? grupo.data_primeira_assembleia.split("T")[0] : ""}
                className={inputStyle}
                required
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Define o aniversário mensal para o cálculo automático de assembleias realizadas.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Prazo Total (Meses) *
              </label>
              <input name="prazo_total" type="number" defaultValue={grupo.prazo_total || ""} placeholder="Ex: 100" className={inputStyle} required />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Opções fixas de parcela reduzida (%)
              </label>
              <input name="percentuais_parcela_reduzida_csv" inputMode="decimal" defaultValue={(grupo.percentuais_parcela_reduzida?.length ? grupo.percentuais_parcela_reduzida : grupo.percentual_parcela_reduzida != null ? [grupo.percentual_parcela_reduzida] : []).join("; ")} placeholder="Ex.: 60; 70" className={inputStyle} />
              <p className="mt-1 text-[11px] text-slate-500">Separe por ponto e vírgula. A primeira opção é o padrão do site; a comissão é identificada automaticamente.</p>
            </div>

            <fieldset className="space-y-2 rounded-lg border border-slate-200 p-3 sm:col-span-2 lg:col-span-3 dark:border-slate-700">
              <legend className="px-1 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Vigência informativa da parcela reduzida</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {!grupo.regra_integralizacao_parcela_reduzida ? <label><input type="radio" name="regra_integralizacao_parcela_reduzida" value="" checked={regraIntegralizacao === ""} onChange={() => setRegraIntegralizacao("")} className="mr-2" />Grupo legado — sem regra nova</label> : null}
                <label><input type="radio" name="regra_integralizacao_parcela_reduzida" value="CONTEMPLACAO" checked={regraIntegralizacao === "CONTEMPLACAO"} onChange={() => setRegraIntegralizacao("CONTEMPLACAO")} className="mr-2" />Até a contemplação</label>
                <label><input type="radio" name="regra_integralizacao_parcela_reduzida" value="ASSEMBLEIA" checked={regraIntegralizacao === "ASSEMBLEIA"} onChange={() => setRegraIntegralizacao("ASSEMBLEIA")} className="mr-2" />Até a assembleia X; integral em X+1</label>
              </div>
              {regraIntegralizacao === "ASSEMBLEIA" ? <div className="flex max-w-xl items-end gap-2">
                <label className="flex-1 text-xs font-bold">Última assembleia reduzida<input name="assembleia_limite_parcela_reduzida" type="number" min="1" max={Math.max(1, Number(grupo.prazo_total ?? 1) - 1)} value={assembleiaLimite} onChange={(event) => setAssembleiaLimite(event.target.value)} className={inputStyle} required /></label>
                <button type="button" onClick={() => setAssembleiaLimite(String(calcularAssembleiaMetade(Number(grupo.prazo_total ?? 0))))} className="rounded-lg border border-cyan-500 px-3 py-2 text-xs font-bold text-cyan-700">Usar 50% do prazo</button>
              </div> : null}
            </fieldset>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Status Operacional
              </label>
              <select name="status" defaultValue={grupo.status || "Disponível"} className={inputStyle}>
                <option value="Disponível">Disponível</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Encerrado">Encerrado</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Taxa de Administração (%) *
              </label>
              <input name="taxa_administrativa_percentual" defaultValue={grupo.taxa_administrativa_percentual ?? ""} placeholder="Ex: 17.00" className={inputStyle} required />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Fundo de Reserva (%)
              </label>
              <input name="fundo_reserva_percentual" defaultValue={grupo.fundo_reserva_percentual ?? ""} placeholder="Ex: 2.00" className={inputStyle} />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Seguro Prestamista (taxa decimal)
              </label>
              <input name="seguro_percentual" defaultValue={grupo.seguro_percentual ?? ""} placeholder="Ex.: 0,0004" className={inputStyle} />
              <p className="mt-1 text-[11px] text-slate-500">0,0004 equivale a 0,04% do saldo.</p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Capacidade Total de Cotas (Fixa) *
              </label>
              <input name="capacidade_total" type="number" defaultValue={grupo.capacidade_total ?? 0} placeholder="Ex: 1000" className={inputStyle} required />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Vagas Disponíveis (Manual)
              </label>
              <input name="vagas_disponiveis" type="number" defaultValue={grupo.vagas_disponiveis ?? 0} placeholder="Ex: 120" className={inputStyle} />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Lance Embutido Geral
              </label>
              <input type="hidden" name="permite_lance_embutido" value={lancesEmbutidos.length > 0 ? "on" : "false"} />
              <input type="hidden" name="percentual_lance_embutido" value={lancesEmbutidos[0]?.percentual_lance_embutido ?? ""} />
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {lancesEmbutidos.length > 0 ? `${lancesEmbutidos.length} tipo(s) configurado(s) no bloco acima.` : "Nenhum tipo configurado."}
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Observações Operacionais
            </label>
            <textarea name="observacoes" defaultValue={grupo.observacoes || ""} rows={3} className={inputStyle} placeholder="Observações e regras específicas do grupo..." />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Tabela comercial do grupo
            </label>
            <input name="tabela_arquivo" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className={inputStyle} />
            <p className="mt-1 text-[11px] text-slate-500">Opcional. Substitui a tabela atual no Storage compartilhado com o ERP. Máximo de 15 MB.</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button type="submit" disabled={isPendingGrupo} className="rounded-lg bg-cyan-700 px-6 py-2.5 font-bold text-white shadow hover:bg-cyan-800 disabled:opacity-50">
              {isPendingGrupo ? "Salvando..." : "Salvar Dados Gerais"}
            </button>
          </div>
        </form>
      ) : null}

      {/* TAB 2: COTAS E MODALIDADES */}
      {tab === "cotas" ? (
        <div className="space-y-6">
          {/* Configuração de Modalidades do Grupo */}
          <form action={formActionMods} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Faixas de comissão herdadas</h2>
                <p className="text-xs text-slate-500">
                  Integral 100%, reduzida de 60% a 99% e reduzida até 59% são classificações automáticas da comissão. O percentual efetivo da parcela do grupo é cadastrado em Dados Gerais e não exige selecionar uma faixa aqui.
                </p>
              </div>
              <button type="submit" disabled={isPendingMods} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800 disabled:opacity-50">
                {isPendingMods ? "Salvando..." : "Salvar exceções de comissão"}
              </button>
            </div>
            <Feedback state={formStateMods} />

            <div className="grid gap-4 md:grid-cols-3">
              {modalidadesAdministradora.map((mod) => {
                const gm = modalidadesDisponiveis.find((x) => x.administradora_modalidade_id === mod.id);
                const resolved = resolveModalidadeConfig(gm, mod);

                return (
                  <div
                    key={mod.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      resolved.ativo
                        ? "border-cyan-300 bg-cyan-50/40 dark:border-cyan-800 dark:bg-cyan-950/20"
                        : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                        <input type="checkbox" name={`mod_ativa_${mod.id}`} defaultChecked={resolved.ativo} className="h-4 w-4 rounded text-cyan-600" />
                        <span>{mod.nome}</span>
                      </label>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          resolved.isOverride
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {resolved.labelOrigem}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs">
                      <div>
                        <label className="text-slate-500">Comportamento da parcela:</label>
                        <select name={`mod_modo_${mod.id}`} defaultValue={resolved.modo_reduzido} className="mt-1 w-full rounded border p-1.5 text-xs">
                          <option value="fixo">Percentual Fixo</option>
                          <option value="personalizado">Personalizável / Faixa</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-slate-500">Padrão (%):</label>
                          <input
                            name={`mod_pct_padrao_${mod.id}`}
                            defaultValue={resolved.percentual_padrao ?? ""}
                            placeholder="Ex: 60"
                            className="mt-1 w-full rounded border p-1.5 text-xs font-semibold"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-slate-500">Mín (%):</label>
                          <input
                            name={`mod_pct_min_${mod.id}`}
                            defaultValue={resolved.percentual_minimo ?? ""}
                            placeholder="Ex: 60"
                            className="mt-1 w-full rounded border p-1.5 text-xs"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-slate-500">Máx (%):</label>
                          <input
                            name={`mod_pct_max_${mod.id}`}
                            defaultValue={resolved.percentual_maximo ?? ""}
                            placeholder="Ex: 99"
                            className="mt-1 w-full rounded border p-1.5 text-xs"
                          />
                        </div>
                      </div>
                      <div className="pt-2">
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
                          <input
                            type="checkbox"
                            name={`mod_usar_padrao_${mod.id}`}
                            defaultChecked={!resolved.isOverride}
                            className="rounded"
                          />
                          <span>Usar padrão da Administradora (sem override)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </form>

          {/* Cadastro rápido de créditos em lote */}
          <form action={formActionLote} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Adicionar Créditos em Lote</h2>
                <p className="text-xs text-slate-500">
                  Cadastre somente os créditos. O site calcula as parcelas com prazo, taxas e modalidades oficiais do grupo.
                </p>
              </div>
              <button type="submit" disabled={isPendingLote} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800 disabled:opacity-50">
                {isPendingLote ? "Adicionando..." : "Processar e Adicionar Créditos"}
              </button>
            </div>
            <Feedback state={formStateLote} />

            <div>
              <textarea
                name="valores_credito_lote"
                rows={4}
                placeholder={"100000\n80000\n70000\n60.000,00\n50.000,00"}
                className={`${inputStyle} font-mono`}
              />
            </div>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Créditos disponíveis ({cotas.length})</h2>
              <p className="text-xs text-slate-500">Não há valor de parcela no catálogo central; a proposta calcula e preserva o resultado aceito pelo cliente.</p>
            </div>
            {cotas.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Nenhum crédito cadastrado neste grupo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
                    <tr><th className="px-4 py-3">Crédito</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cotas.map((cota) => (
                      <tr key={cota.id}>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{formatBRL(cota.valor_credito)}</td>
                        <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{cota.status || "Ativo"}</span></td>
                        <td className="px-4 py-3 text-right"><button type="button" onClick={async () => { if (confirm(`Deseja excluir o crédito de ${formatBRL(cota.valor_credito)}?`)) await excluirCotaProdutoAction(grupo.id, cota.id); }} className="text-xs font-semibold text-red-600 hover:underline">Excluir</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Compatibilidade histórica: controles de parcela não são mais exibidos nem usados no fluxo oficial. */}
          <div className="hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4" aria-hidden="true">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Tabela de Cotas do Grupo ({cotas.length})</h2>
                <p className="text-xs text-slate-500">
                  Crédito e modalidades configuradas. Clique no percentual de qualquer cota para personalizar ou desabilitar.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Grupo X% = Herdando
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                  Cota X% = Personalizado
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 font-semibold text-red-600 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
                  Desabilitada
                </span>
              </div>
            </div>

            {/* Barra de Ações em Massa */}
            {selectedCotas.size > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300 bg-cyan-50/80 p-3 dark:border-cyan-800 dark:bg-cyan-950/50">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-900 dark:text-cyan-200">
                  <span>{selectedCotas.size} cota(s) selecionada(s).</span>
                  <span>Aplicar para a modalidade:</span>
                  <select
                    value={batchModalidadeId}
                    onChange={(e) => setBatchModalidadeId(e.target.value)}
                    className="rounded border border-cyan-300 bg-white px-2 py-1 text-xs dark:border-cyan-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Selecione uma modalidade</option>
                    {modalidadesAdministradora.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                  <select
                    value={batchModo}
                    onChange={(e) => setBatchModo(e.target.value as "HERDAR" | "PERSONALIZADO" | "DESABILITADO")}
                    className="rounded border border-cyan-300 bg-white px-2 py-1 text-xs dark:border-cyan-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="HERDAR">Herdar Padrão do Grupo</option>
                    <option value="PERSONALIZADO">Personalizar Percentual</option>
                    <option value="DESABILITADO">Desabilitar nesta Cota</option>
                  </select>
                  {batchModo === "PERSONALIZADO" ? (
                    <input
                      type="text"
                      value={batchPercentual}
                      onChange={(e) => setBatchPercentual(e.target.value)}
                      placeholder="Ex: 40"
                      className="w-20 rounded border border-cyan-300 bg-white px-2 py-1 text-xs dark:border-cyan-700 dark:bg-slate-800 dark:text-white"
                    />
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!batchModalidadeId || isPendingBatch}
                    onClick={handleApplyBatchAction}
                    className="rounded bg-cyan-700 px-3 py-1 text-xs font-bold text-white hover:bg-cyan-800 disabled:opacity-50"
                  >
                    {isPendingBatch ? "Aplicando..." : "Aplicar em Massa"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCotas(new Set())}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            ) : null}

            {cotas.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Nenhuma cota cadastrada neste grupo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="w-10 px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCotas.size === cotas.length && cotas.length > 0}
                          onChange={handleToggleSelectAll}
                          title="Selecionar todas as cotas"
                          className="rounded text-cyan-600"
                        />
                      </th>
                      <th className="px-4 py-3">Crédito</th>
                      {modalidadesAdministradora.map((mod) => (
                        <th key={mod.id} className="px-4 py-3">
                          {mod.nome}
                        </th>
                      ))}
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cotas.map((cota) => {
                      const valoresMap = new Map(
                        (cota.grupo_cota_modalidade_valores ?? []).map((v) => [v.administradora_modalidade_id, v])
                      );
                      const isSelected = selectedCotas.has(cota.id);

                      return (
                        <tr key={cota.id} className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 ${isSelected ? "bg-cyan-50/30 dark:bg-cyan-950/20" : ""}`}>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectCota(cota.id)}
                              className="rounded text-cyan-600"
                            />
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            {formatBRL(cota.valor_credito)}
                          </td>
                          {modalidadesAdministradora.map((mod) => {
                            const gm = modalidadesDisponiveis.find((x) => x.administradora_modalidade_id === mod.id);
                            const mv = valoresMap.get(mod.id);
                            const efetivo = resolveCotaModalidadeEfetiva(mv, gm, mod);

                            if (efetivo.status === "DESABILITADO_GRUPO") {
                              return (
                                <td key={mod.id} className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
                                  — (Desab. no Grupo)
                                </td>
                              );
                            }

                            return (
                              <td key={mod.id} className="px-4 py-3">
                                <div className="space-y-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingCotaModalidade({
                                        cotaId: cota.id,
                                        cotaCredito: cota.valor_credito,
                                        modalidade: mod,
                                        cotaValor: mv,
                                        grupoMod: gm,
                                      })
                                    }
                                    className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-all ${
                                      efetivo.status === "PERSONALIZADO"
                                        ? "border border-indigo-300 bg-indigo-50 font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
                                        : efetivo.status === "DESABILITADO_COTA"
                                        ? "border border-red-200 bg-red-50 font-semibold text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300"
                                        : "bg-slate-100 font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                                    }`}
                                    title="Clique para configurar override desta cota"
                                  >
                                    <span>{efetivo.labelBadge}</span>
                                    <span className="text-[10px] opacity-60">✎</span>
                                  </button>
                                  {mv?.valor_parcela ? (
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {formatBRL(mv.valor_parcela)}
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              {cota.status || "Ativa"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={async () => {
                                if (confirm(`Deseja excluir a cota de ${formatBRL(cota.valor_credito)}?`)) {
                                  await excluirCotaProdutoAction(grupo.id, cota.id);
                                }
                              }}
                              className="text-xs font-semibold text-red-600 hover:underline"
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* MODAL / POPOVER DE OVERRIDE POR COTA */}
      {editingCotaModalidade ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Modalidade: {editingCotaModalidade.modalidade.nome}
                </h3>
                <p className="text-xs text-slate-500">
                  Cota {formatBRL(editingCotaModalidade.cotaCredito)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCotaModalidade(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {(() => {
              const gm = editingCotaModalidade.grupoMod;
              const mod = editingCotaModalidade.modalidade;
              const mv = editingCotaModalidade.cotaValor;
              const grupoResolved = resolveModalidadeConfig(gm, mod);
              const cotaResolved = resolveCotaModalidadeEfetiva(mv, gm, mod);

              return (
                <form
                  action={async (formData) => {
                    await salvarCotaModalidadeAction(
                      grupo.id,
                      editingCotaModalidade.cotaId,
                      editingCotaModalidade.modalidade.id,
                      formData,
                    );
                    setEditingCotaModalidade(null);
                  }}
                  className="space-y-4 text-xs"
                >
                  <div className="space-y-2">
                    <p className="font-bold text-slate-700 dark:text-slate-300">Modo de Configuração:</p>

                    <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 cursor-pointer dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <input
                        type="radio"
                        name="modo_override"
                        value="HERDAR"
                        defaultChecked={cotaResolved.status === "HERDADO"}
                        className="mt-0.5 text-cyan-600"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Herdar do Grupo ({grupoResolved.percentual_padrao != null ? `${grupoResolved.percentual_padrao}%` : "Padrão"})
                        </span>
                        <p className="text-slate-500">
                          Utiliza dinamicamente a configuração do Grupo ({grupoResolved.labelOrigem}).
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 cursor-pointer dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <input
                        type="radio"
                        name="modo_override"
                        value="PERSONALIZADO"
                        defaultChecked={cotaResolved.status === "PERSONALIZADO"}
                        className="mt-0.5 text-cyan-600"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Personalizar nesta Cota
                        </span>
                        <p className="text-slate-500">
                          Define um percentual exclusivo para esta cota de {formatBRL(editingCotaModalidade.cotaCredito)}.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-2.5 cursor-pointer dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <input
                        type="radio"
                        name="modo_override"
                        value="DESABILITADO"
                        defaultChecked={cotaResolved.status === "DESABILITADO_COTA"}
                        className="mt-0.5 text-cyan-600"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Desabilitar nesta Cota
                        </span>
                        <p className="text-slate-500">
                          A modalidade não estará disponível para venda nesta cota específica.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                    <p className="font-bold text-slate-700 dark:text-slate-300">Valores de Exceção (Se Personalizado):</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-500">Percentual Cota (%):</label>
                        <input
                          name="percentual_override"
                          defaultValue={mv?.percentual_override != null ? String(mv.percentual_override) : String(grupoResolved.percentual_padrao ?? "")}
                          placeholder="Ex: 40"
                          className="mt-1 w-full rounded border p-2 text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500">R$ Parcela (Opcional):</label>
                        <input
                          name="valor_parcela"
                          defaultValue={mv?.valor_parcela ? String(mv.valor_parcela) : ""}
                          placeholder="Ex: 1250.00"
                          className="mt-1 w-full rounded border p-2 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditingCotaModalidade(null)}
                      className="rounded-lg border px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-800"
                    >
                      Salvar Configuração
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      ) : null}

      {/* TAB 3: ESTATÍSTICAS E LANCES */}
      {tab === "estatisticas" ? (
        <form action={formActionStats} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <input type="hidden" name="grupo_id" value={grupo.id} />
          <input type="hidden" name="fonte" value={modoEstatisticas} />
          <Feedback state={formStateStats} />

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Estatísticas & Lances do Grupo
              </h2>
              <p className="text-xs text-slate-500">
                Informações comerciais e estatísticas para consultores. Não geram contemplações nem alteram cotas definitivas.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-slate-50 p-1 text-xs font-bold dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setModoEstatisticas("GLOBAL")}
                className={`rounded px-3 py-1.5 transition-colors ${
                  modoEstatisticas === "GLOBAL" ? "bg-white text-cyan-700 shadow dark:bg-slate-700 dark:text-cyan-300" : "text-slate-500"
                }`}
              >
                Oficial SaaS (GLOBAL)
              </button>
              <button
                type="button"
                onClick={() => setModoEstatisticas("LOCAL")}
                className={`rounded px-3 py-1.5 transition-colors ${
                  modoEstatisticas === "LOCAL" ? "bg-white text-cyan-700 shadow dark:bg-slate-700 dark:text-cyan-300" : "text-slate-500"
                }`}
              >
                Análise Própria (LOCAL ERP)
              </button>
            </div>
          </div>

          {modoEstatisticas === "LOCAL" ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200 flex items-center justify-between">
              <span>Editando dados locais da empresa. Alterações não sobrescrevem a base Global SaaS.</span>
              <label className="flex items-center gap-2 font-bold">
                <input type="checkbox" name="usar_dados_globais" defaultChecked={empresaConfig?.usar_dados_globais ?? true} />
                Usar dados globais como padrão no ERP
              </label>
            </div>
          ) : null}

          {/* BLOCO 1: CARACTERÍSTICAS DE CONTEMPLAÇÃO */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  1. Características de Contemplação
                </h3>
                <p className="text-xs text-slate-500">
                  Estrutura e possibilidades normais de contemplação por assembleia mensal.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                  {resumoContemplacoes.textoPotencial}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {resumoContemplacoes.resumoModalidades}
                </span>
              </div>
            </div>

            <input
              type="hidden"
              name="caracteristicas_contemplacao_json"
              value={JSON.stringify(caracteristicas)}
            />

            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-xs">
                <thead className="border-b bg-white text-left uppercase text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="w-16 px-3 py-2 text-center">Ordem</th>
                    <th className="px-3 py-2">Modalidade de Contemplação</th>
                    <th className="px-3 py-2">Condição / Percentual</th>
                    <th className="px-3 py-2">Observação</th>
                    <th className="w-20 px-3 py-2 text-center">Ativa</th>
                    <th className="w-24 px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                  {caracteristicas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">
                        Nenhuma característica de contemplação cadastrada. Clique no botão abaixo para adicionar.
                      </td>
                    </tr>
                  ) : (
                    caracteristicas.map((item, idx) => (
                      <tr key={item.id} className={!item.ativa ? "opacity-40" : ""}>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1 font-bold">
                            <span>{item.ordem}º</span>
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moverLinhaContemplacao(idx, "up")}
                                className="text-[10px] text-slate-400 hover:text-cyan-700 disabled:opacity-20"
                                title="Subir ordem"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={idx === caracteristicas.length - 1}
                                onClick={() => moverLinhaContemplacao(idx, "down")}
                                className="text-[10px] text-slate-400 hover:text-cyan-700 disabled:opacity-20"
                                title="Descer ordem"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={item.tipo}
                            onChange={(e) =>
                              atualizarLinhaContemplacao(item.id!, {
                                tipo: e.target.value as TipoContemplacao,
                              })
                            }
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                          >
                            {DEFAULT_TIPOS_CONTEMPLACAO.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.condicao_percentual ?? ""}
                            onChange={(e) =>
                              atualizarLinhaContemplacao(item.id!, {
                                condicao_percentual: e.target.value,
                              })
                            }
                            placeholder={
                              item.tipo === "LANCE_FIXO"
                                ? "Ex: 25% ou 50%"
                                : item.tipo === "SORTEIO"
                                ? "Ex: Ativas"
                                : item.tipo === "SORTEIO_CANCELADAS"
                                ? "Ex: Canceladas"
                                : "Ex: Condição específica"
                            }
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.observacao ?? ""}
                            onChange={(e) =>
                              atualizarLinhaContemplacao(item.id!, {
                                observacao: e.target.value,
                              })
                            }
                            placeholder="Observação da modalidade"
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={item.ativa}
                            onChange={(e) =>
                              atualizarLinhaContemplacao(item.id!, {
                                ativa: e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded text-cyan-600 focus:ring-cyan-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removerLinhaContemplacao(item.id!)}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-start">
              <button
                type="button"
                onClick={adicionarLinhaContemplacao}
                className="rounded-lg border border-dashed border-cyan-400 bg-cyan-50/50 px-3 py-1.5 text-xs font-bold text-cyan-800 hover:bg-cyan-100 dark:border-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300"
              >
                + Adicionar Linha de Contemplação
              </button>
            </div>
          </div>

          {/* BLOCO 2: INDICADORES RECENTES */}
          {(() => {
            const stats = (grupo.dados_estatisticos ?? {}) as Record<string, unknown>;
            return (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/30">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    2. Indicadores Recentes & Lances
                  </h3>
                  <p className="text-xs text-slate-500">
                    Estatísticas de apuração e limites operacionais de lance.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Média de Lance Livre (%)
                    </label>
                    <input
                      name="lance_livre_medio"
                      defaultValue={stats.lance_livre_medio != null ? String(stats.lance_livre_medio) : ""}
                      placeholder="Ex: 67.80"
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Lance Livre Mínimo (%)
                    </label>
                    <input
                      name="lance_livre_minimo"
                      defaultValue={stats.lance_livre_minimo != null ? String(stats.lance_livre_minimo) : ""}
                      placeholder="Ex: 35.00"
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Lance Livre Máximo (%)
                    </label>
                    <input
                      name="lance_livre_maximo"
                      defaultValue={stats.lance_livre_maximo != null ? String(stats.lance_livre_maximo) : ""}
                      placeholder="Ex: 85.00"
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Contemplados no Mês Anterior (Qtd Real)
                    </label>
                    <input
                      name="contemplados_mes_anterior_qtd"
                      type="number"
                      defaultValue={Number(stats.contemplados_mes_anterior_qtd) || ""}
                      placeholder="Ex: 7"
                      className={inputStyle}
                    />
                    <span className="text-[11px] text-slate-400">Dado real apurado da última assembleia</span>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Limite de Lance Embutido (%)
                    </label>
                    <input
                      name="limite_lance_embutido_percentual"
                      defaultValue={
                        stats.limite_lance_embutido_percentual != null
                          ? String(stats.limite_lance_embutido_percentual)
                          : stats.percentual_lance_embutido != null
                          ? String(stats.percentual_lance_embutido)
                          : ""
                      }
                      placeholder="Ex: 40.00"
                      className={inputStyle}
                    />
                    <span className="text-[11px] text-slate-400">Limite de lance embutido (% do crédito)</span>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Vagas Disponíveis Atualizadas
                    </label>
                    <input
                      name="vagas_disponiveis"
                      type="number"
                      defaultValue={grupo.vagas_disponiveis ?? 0}
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Data de Referência da Análise
                    </label>
                    <input
                      type="date"
                      name="data_referencia"
                      defaultValue={stats.data_referencia ? String(stats.data_referencia) : ""}
                      className={inputStyle}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* BLOCO 3: INFORMAÇÕES & AUDITORIA */}
          {(() => {
            const stats = (grupo.dados_estatisticos ?? {}) as Record<string, unknown>;
            return (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/30">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    3. Informações & Auditoria
                  </h3>
                  <p className="text-xs text-slate-500">
                    Rastreabilidade de origem, analista e data de atualização.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Origem da Informação
                    </label>
                    <input
                      name="origem_informacao"
                      defaultValue={stats.origem_informacao ? String(stats.origem_informacao) : ""}
                      placeholder="Ex: Assembleia Racon 08/2026"
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Responsável pela Atualização
                    </label>
                    <input
                      name="responsavel_nome"
                      defaultValue={stats.responsavel_nome ? String(stats.responsavel_nome) : ""}
                      placeholder="Nome do analista / consultor"
                      className={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Última Atualização
                    </label>
                    <input
                      type="text"
                      disabled
                      value={
                        grupo.dados_estatisticos_atualizado_em
                          ? new Date(grupo.dados_estatisticos_atualizado_em).toLocaleString("pt-BR")
                          : "Ainda não atualizado"
                      }
                      className={`${inputStyle} bg-slate-100 dark:bg-slate-800 cursor-not-allowed`}
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Observação de Análise
                    </label>
                    <textarea
                      name="observacao"
                      defaultValue={stats.observacao ? String(stats.observacao) : ""}
                      placeholder="Observações complementares sobre lances, contemplações e histórico do grupo..."
                      rows={2}
                      className={inputStyle}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              disabled={isPendingStats}
              className="rounded-lg bg-cyan-700 px-6 py-2.5 font-bold text-white shadow hover:bg-cyan-800 disabled:opacity-50"
            >
              {isPendingStats ? "Salvando..." : "Salvar Dados Estatísticos"}
            </button>
          </div>
        </form>
      ) : null}

      {/* TAB 4: HISTÓRICO E AUDITORIA */}
      {tab === "historico" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-900 dark:bg-amber-950/30">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Reajustes anuais de crédito</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Histórico imutável dos créditos oficiais alterados no SaaS. Valores de parcela continuam calculados pelo site.</p>
            {reajustesCredito.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nenhum reajuste anual registrado.</p> : (
              <div className="mt-4 divide-y divide-amber-200 dark:divide-amber-900">
                {reajustesCredito.map((r) => (
                  <div key={r.id} className="py-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2"><strong>Marco {r.marco_meses} meses · {r.valores_novos.length} crédito(s)</strong><span>{new Date(r.created_at).toLocaleString("pt-BR")}</span></div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">Referência: {r.percentual_referencia == null ? "ajuste individual" : `${formatPercent(r.percentual_referencia)}`} · Por: {r.usuario?.nome || "Sistema"}</p>
                    {r.observacao ? <p className="mt-1 text-slate-600 dark:text-slate-300">{r.observacao}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Linha do Tempo de Alterações</h2>
          {historico.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Nenhum evento registrado ainda.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {historico.map((h) => (
                <div key={h.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {h.campo.toUpperCase()} · <span className="text-xs font-semibold text-cyan-700">{h.fonte}</span>
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(h.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">
                    {h.observacao || "Alteração registrada"}
                  </p>
                  <p className="text-xs text-slate-400">
                    Por: {h.usuario?.nome || "Sistema"} {h.empresa ? `(${h.empresa.nome_fantasia})` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

