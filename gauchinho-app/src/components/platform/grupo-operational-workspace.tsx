"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  salvarGrupoPlatformAction,
  salvarEstatisticasGrupoAction,
  type GroupActionState,
} from "@/app/platform/grupos-actions";
import {
  salvarModalidadesGrupoPlatformAction,
  salvarCotasEmLoteAction,
  salvarCotaModalidadeAction,
  excluirCotaProdutoAction,
} from "@/app/platform/grupos-catalogo-actions";
import {
  type GrupoRecord,
  type AdministradoraModalidadeItem,
  type GrupoProntidaoResult,
  formatBRL,
  formatPercent,
  formatDateBR,
  validateGrupoProntidao,
  resolveModalidadeConfig,
} from "@/lib/platform/grupos-prontidao";

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
  empresaConfig,
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
  empresaConfig?: {
    usar_dados_globais?: boolean;
    dados_estatisticos_locais?: unknown;
    vagas_disponiveis_locais?: number | null;
  } | null;
}) {
  const [tab, setTab] = useState<"gerais" | "cotas" | "estatisticas" | "historico">("gerais");
  const [modoEstatisticas, setModoEstatisticas] = useState<"GLOBAL" | "LOCAL">("GLOBAL");

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

  const prontidao: GrupoProntidaoResult = validateGrupoProntidao(grupo);

  const modalidadesDisponiveis = grupo.modalidades ?? [];
  const modsAtivas = modalidadesDisponiveis.filter((m) => m.ativo);
  const cotas = (grupo.produtos ?? []).filter((p) => p.ativo).sort((a, b) => b.valor_credito - a.valor_credito);

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

      {/* Cards Resumo Operacional */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
                Seguro Prestamista (%)
              </label>
              <input name="seguro_percentual" defaultValue={grupo.seguro_percentual ?? ""} placeholder="Ex: 0.04" className={inputStyle} />
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
              <div className="mt-2 flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" name="permite_lance_embutido" defaultChecked={grupo.permite_lance_embutido} className="rounded" />
                  Permite lance embutido
                </label>
                <input name="percentual_lance_embutido" defaultValue={grupo.percentual_lance_embutido ?? ""} placeholder="%" className="w-20 rounded border p-1 text-sm" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Observações Operacionais
            </label>
            <textarea name="observacoes" defaultValue={grupo.observacoes || ""} rows={3} className={inputStyle} placeholder="Observações e regras específicas do grupo..." />
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
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Modalidades Disponíveis no Grupo</h2>
                <p className="text-xs text-slate-500">
                  Carrega automaticamente os valores padrão da Administradora. Personalize apenas se este Grupo possuir regra de exceção.
                </p>
              </div>
              <button type="submit" disabled={isPendingMods} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800 disabled:opacity-50">
                {isPendingMods ? "Salvando..." : "Salvar Modalidades do Grupo"}
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

          {/* Cadastro Rápido de Cotas em Lote */}
          <form action={formActionLote} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Adicionar Cotas / Produtos em Lote</h2>
                <p className="text-xs text-slate-500">
                  Cole os valores de crédito separados por linha ou vírgula (ex: 100.000,00 ou 80000). Moeda BRL normalizada automaticamente.
                </p>
              </div>
              <button type="submit" disabled={isPendingLote} className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-800 disabled:opacity-50">
                {isPendingLote ? "Adicionando..." : "Processar e Adicionar Cotas"}
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

          {/* Tabela Compacta de Cotas com Overrides */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Tabela de Cotas do Grupo ({cotas.length})</h2>
              <p className="text-xs text-slate-500">
                Crédito, modalidades habilitadas e parcelas oficiais. O desmarque individual aplica override por cota.
              </p>
            </div>

            {cotas.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Nenhuma cota cadastrada neste grupo.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
                    <tr>
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

                      return (
                        <tr key={cota.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                            {formatBRL(cota.valor_credito)}
                          </td>
                          {modalidadesAdministradora.map((mod) => {
                            const gm = modalidadesDisponiveis.find((x) => x.administradora_modalidade_id === mod.id);
                            const grupoHabilitou = gm?.ativo ?? false;
                            const mv = valoresMap.get(mod.id);
                            const cotaHabilitou = mv?.habilitado ?? true;

                            if (!grupoHabilitou) {
                              return (
                                <td key={mod.id} className="px-4 py-3 text-xs text-slate-400">
                                  — (Desab. no Grupo)
                                </td>
                              );
                            }

                            return (
                              <td key={mod.id} className="px-4 py-3">
                                <form
                                  action={salvarCotaModalidadeAction.bind(null, grupo.id, cota.id, mod.id)}
                                  className="flex items-center gap-2"
                                >
                                  <input
                                    type="checkbox"
                                    name="habilitado"
                                    defaultChecked={cotaHabilitou}
                                    onChange={(e) => e.target.form?.requestSubmit()}
                                    title="Habilitar/Desabilitar modalidade para esta cota"
                                    className="rounded"
                                  />
                                  <input
                                    type="text"
                                    name="valor_parcela"
                                    defaultValue={mv?.valor_parcela ? String(mv.valor_parcela) : ""}
                                    placeholder="R$ Parcela"
                                    onBlur={(e) => e.target.form?.requestSubmit()}
                                    className={`w-24 rounded border px-2 py-1 text-xs ${
                                      !cotaHabilitou ? "opacity-40" : ""
                                    }`}
                                  />
                                </form>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                              {cota.status || "Ativa"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={async () => {
                                if (confirm(`Deseja excluir ou inativar a cota de ${formatBRL(cota.valor_credito)}?`)) {
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

      {/* TAB 3: ESTATÍSTICAS E LANCES */}
      {tab === "estatisticas" ? (
        <form action={formActionStats} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <input type="hidden" name="grupo_id" value={grupo.id} />
          <input type="hidden" name="fonte" value={modoEstatisticas} />
          <Feedback state={formStateStats} />

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Informações Estatísticas e de Lances do Grupo
              </h2>
              <p className="text-xs text-slate-500">
                Dados informativos para suporte aos consultores durante a venda. Não executam contemplações automáticas.
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

          {/* Campos Estatísticos */}
          {(() => {
            const stats = (grupo.dados_estatisticos ?? {}) as Record<string, unknown>;
            return (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Contemplações por Sorteio (Qtd)
                  </label>
                  <input
                    name="contemplacoes_sorteio_qtd"
                    type="number"
                    defaultValue={Number(stats.contemplacoes_sorteio_qtd) || ""}
                    placeholder="Ex: 2"
                    className={inputStyle}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Contemplados no Mês Anterior (Qtd)
                  </label>
                  <input
                    name="contemplados_mes_anterior_qtd"
                    type="number"
                    defaultValue={Number(stats.contemplados_mes_anterior_qtd) || ""}
                    placeholder="Ex: 8"
                    className={inputStyle}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Média de Lance Livre (%)
                  </label>
                  <input
                    name="lance_livre_medio"
                    defaultValue={stats.lance_livre_medio != null ? String(stats.lance_livre_medio) : ""}
                    placeholder="Ex: 48.50"
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
                    placeholder="Ex: 65.00"
                    className={inputStyle}
                  />
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

                <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">
                    Regras de Lance Permitidas
                  </p>
                  <div className="flex flex-wrap gap-6 text-sm">
                    <label className="flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        name="lance_embutido_25_permitido"
                        defaultChecked={Boolean(stats.lance_embutido_25_permitido)}
                        className="rounded text-cyan-600"
                      />
                      Lance Embutido 25%
                    </label>
                    <label className="flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        name="lance_embutido_50_permitido"
                        defaultChecked={Boolean(stats.lance_embutido_50_permitido)}
                        className="rounded text-cyan-600"
                      />
                      Lance Embutido 50%
                    </label>
                    <label className="flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        name="lance_fidelidade_permitido"
                        defaultChecked={Boolean(stats.lance_fidelidade_permitido)}
                        className="rounded text-cyan-600"
                      />
                      Lance Fidelidade
                    </label>
                  </div>
                </div>

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
                    placeholder="Nome do analista"
                    className={inputStyle}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Observação de Análise
                  </label>
                  <input
                    name="observacao"
                    defaultValue={stats.observacao ? String(stats.observacao) : ""}
                    placeholder="Ex: Alta probabilidade de contemplação com 45%"
                    className={inputStyle}
                  />
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
      ) : null}
    </div>
  );
}

