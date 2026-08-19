"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  salvarAssinaturaPlatformAction,
  alterarStatusAssinaturaPlatformAction,
  criarAssinaturaPlatformAction,
  type PlatformFormState,
} from "@/app/platform/assinaturas-actions";

export type EmpresaOption = {
  id: string;
  nome_fantasia: string;
  razao_social?: string;
  slug: string;
  cnpj?: string;
  status?: string;
  ativo?: boolean;
};

export type AssinaturaItem = {
  id: string;
  empresa_id: string;
  plano_id: string;
  status: string;
  usuarios_contratados: number;
  sites_parceiros_contratados: number;
  sites_dominio_proprio_contratados: number;
  valor_mensal: number | null;
  taxa_implantacao: number | null;
  valor_total_estimado: number;
  data_inicio: string | null;
  observacao: string | null;
  created_at: string;
  empresa?: { id: string; nome_fantasia: string; slug: string } | null;
  plano?: {
    id: string;
    nome: string;
    codigo: string;
    valor_mensal: number;
    limite_usuarios?: number;
    max_sites_parceiros: number;
    max_sites_dominio_proprio: number;
    valor_site_parceiro?: number;
    valor_site_dominio_proprio?: number;
    modulos_habilitados?: string[];
  } | null;
  overrides_ativos?: {
    id: string;
    tipo: string;
    recurso_codigo: string;
    efeito: string;
    valor_numerico: number | null;
  }[];
  quota_efetiva?: {
    limite_usuarios: number;
    limite_sites: number;
    limite_dominios: number;
  };
};

export type PlanoOption = {
  id: string;
  nome: string;
  codigo: string;
  status: string;
  valor_mensal: number;
  limite_usuarios: number;
  max_sites_parceiros: number;
  max_sites_dominio_proprio: number;
  valor_site_parceiro: number;
  valor_site_dominio_proprio: number;
  modulos_habilitados: string[];
};

const initial: PlatformFormState = { status: "IDLE", message: "" };

export function AssinaturasListingClient({
  assinaturas,
  planosDisponiveis,
  empresasDisponiveis = [],
}: {
  assinaturas: AssinaturaItem[];
  planosDisponiveis: PlanoOption[];
  empresasDisponiveis?: EmpresaOption[];
}) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroPlano, setFiltroPlano] = useState("TODOS");

  // Modal Novo
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createEmpresaId, setCreateEmpresaId] = useState("");
  const [createPlanoId, setCreatePlanoId] = useState("");
  const [createUsuarios, setCreateUsuarios] = useState(10);
  const [createSites, setCreateSites] = useState(0);
  const [createDominios, setCreateDominios] = useState(0);
  const [createValorMensal, setCreateValorMensal] = useState<number | string>("");
  const [createTaxaImplantacao, setCreateTaxaImplantacao] = useState<number | string>("");
  const [createDataInicio, setCreateDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [createStatus, setCreateStatus] = useState("ATIVA");

  // Modal Editar
  const [editItem, setEditItem] = useState<AssinaturaItem | null>(null);
  const [novoPlanoId, setNovoPlanoId] = useState("");
  const [usuariosContratados, setUsuariosContratados] = useState(10);
  const [sitesContratados, setSitesContratados] = useState(0);
  const [dominiosContratados, setDominiosContratados] = useState(0);

  const [stateCreate, actionCreate, isPendingCreate] = useActionState(criarAssinaturaPlatformAction, initial);
  const [stateSave, actionSave, isPendingSave] = useActionState(salvarAssinaturaPlatformAction, initial);
  const [stateStatus, actionStatus, isPendingStatus] = useActionState(alterarStatusAssinaturaPlatformAction, initial);

  const handleOpenCreate = () => {
    const defaultPlano = planosDisponiveis[0];
    const defaultEmpresa = empresasDisponiveis[0];
    setCreateEmpresaId(defaultEmpresa?.id || "");
    setCreatePlanoId(defaultPlano?.id || "");
    if (defaultPlano) {
      setCreateUsuarios(defaultPlano.limite_usuarios || 10);
      setCreateSites(defaultPlano.max_sites_parceiros || 0);
      setCreateDominios(defaultPlano.max_sites_dominio_proprio || 0);
      setCreateValorMensal(defaultPlano.valor_mensal || 0);
    }
    setCreateTaxaImplantacao(0);
    setCreateDataInicio(new Date().toISOString().slice(0, 10));
    setCreateStatus("ATIVA");
    setIsCreateOpen(true);
  };

  const handlePlanoChangeInCreate = (planoId: string) => {
    setCreatePlanoId(planoId);
    const sel = planosDisponiveis.find((p) => p.id === planoId);
    if (sel) {
      setCreateUsuarios(sel.limite_usuarios || 10);
      setCreateSites(sel.max_sites_parceiros || 0);
      setCreateDominios(sel.max_sites_dominio_proprio || 0);
      setCreateValorMensal(sel.valor_mensal || 0);
    }
  };

  const createPlanoSelecionado = planosDisponiveis.find((p) => p.id === createPlanoId);

  const filtradas = assinaturas.filter((a) => {
    const matchBusca =
      !busca ||
      (a.empresa?.nome_fantasia || "").toLowerCase().includes(busca.toLowerCase()) ||
      (a.plano?.nome || "").toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "TODOS" || a.status === filtroStatus;
    const matchPlano = filtroPlano === "TODOS" || a.plano_id === filtroPlano;
    return matchBusca && matchStatus && matchPlano;
  });

  const totalAtivas = assinaturas.filter((a) => a.status === "ATIVA").length;
  const totalPendentes = assinaturas.filter((a) => ["PENDENTE", "TREINAMENTO"].includes(a.status)).length;
  const totalMrr = assinaturas
    .filter((a) => a.status === "ATIVA")
    .reduce((acc, a) => acc + Number(a.valor_total_estimado || a.valor_mensal || 0), 0);

  const planoAtual = editItem?.plano;
  const planoSelecionado = planosDisponiveis.find((p) => p.id === (novoPlanoId || editItem?.plano_id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Plataforma SaaS</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">Assinaturas SaaS</h1>
          <p className="mt-1 text-sm text-slate-500">
            Contratos operacionais das Master Franquias, com plano vinculado, quotas contratadas e vigência.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition"
        >
          <span>+</span>
          <span>Nova Assinatura</span>
        </button>
      </div>

      {/* Feedbacks */}
      {[stateCreate, stateSave, stateStatus].map((st, i) =>
        st.message ? (
          <p
            key={i}
            role="status"
            className={`rounded-lg p-3 text-xs font-bold ${
              st.status === "SUCCESS"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
            }`}
          >
            {st.message}
          </p>
        ) : null,
      )}

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-slate-500">Total de Assinaturas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{assinaturas.length}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-emerald-600">Assinaturas Ativas</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{totalAtivas}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-amber-600">Em Treinamento / Pendentes</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{totalPendentes}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-cyan-600">MRR Contratual Total</p>
          <p className="mt-2 text-2xl font-bold text-cyan-700">R$ {totalMrr.toFixed(2)}</p>
        </article>
      </section>

      {/* Filtros */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Buscar Assinatura:</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Franquia ou plano..."
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Status:</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="ATIVA">Ativa</option>
              <option value="TREINAMENTO">Em Treinamento</option>
              <option value="PENDENTE">Pendente</option>
              <option value="SUSPENSA">Suspensa</option>
              <option value="INATIVA">Inativa</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Plano SaaS:</label>
            <select
              value={filtroPlano}
              onChange={(e) => setFiltroPlano(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todos os Planos</option>
              {planosDisponiveis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Assinaturas */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="p-3">Master Franquia</th>
                <th className="p-3">Plano SaaS</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Usuários</th>
                <th className="p-3 text-center">Sites Parceiros</th>
                <th className="p-3 text-center">Domínios Próprios</th>
                <th className="p-3">Overrides Ativos</th>
                <th className="p-3 text-right">Mensalidade Total</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500">
                    <div className="mx-auto max-w-sm space-y-3">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        Nenhuma assinatura encontrada com os filtros informados.
                      </p>
                      <p className="text-xs text-slate-400">
                        Vincule uma Master Franquia cadastrada a um Plano SaaS para ativar seus recursos e quotas operacionais.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition"
                      >
                        <span>+</span>
                        <span>Nova Assinatura</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtradas.map((a) => {
                  const isAtiva = a.status === "ATIVA";
                  const isTreinamento = a.status === "TREINAMENTO";
                  const isSuspensa = a.status === "SUSPENSA";

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3">
                        <Link
                          href={`/platform/empresas/${a.empresa_id}`}
                          className="font-bold text-cyan-700 dark:text-cyan-400 hover:underline"
                        >
                          {a.empresa?.nome_fantasia || "Empresa não informada"}
                        </Link>
                        <div className="font-mono text-[10px] text-slate-400">/{a.empresa?.slug}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {a.plano?.nome || "Sem plano"}
                        </span>
                        <div className="font-mono text-[10px] text-slate-400">{a.plano?.codigo}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                            isAtiva
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : isTreinamento
                              ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                              : isSuspensa
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {a.usuarios_contratados}
                        </span>
                        {a.quota_efetiva && a.quota_efetiva.limite_usuarios !== a.usuarios_contratados && (
                          <span className="text-[10px] text-cyan-600 block">
                            (Efetivo: {a.quota_efetiva.limite_usuarios})
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center font-mono">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {a.sites_parceiros_contratados}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {a.sites_dominio_proprio_contratados}
                        </span>
                      </td>
                      <td className="p-3">
                        {a.overrides_ativos && a.overrides_ativos.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {a.overrides_ativos.map((o) => (
                              <span
                                key={o.id}
                                className="rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              >
                                {o.recurso_codigo}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-cyan-700 dark:text-cyan-400">
                        R$ {Number(a.valor_total_estimado || a.valor_mensal || 0).toFixed(2)}/mês
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditItem(a);
                              setNovoPlanoId(a.plano_id);
                              setUsuariosContratados(a.usuarios_contratados);
                              setSitesContratados(a.sites_parceiros_contratados);
                              setDominiosContratados(a.sites_dominio_proprio_contratados);
                            }}
                            className="rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors"
                          >
                            Editar Quotas / Trocar Plano
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────
          MODAL: NOVA ASSINATURA SAAS
      ─────────────────────────────────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Nova Assinatura SaaS
                </h3>
                <p className="text-xs text-slate-500">
                  Vincule um plano contratual e defina as quotas operacionais da Master Franquia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form
              action={async (formData) => {
                await actionCreate(formData);
                setIsCreateOpen(false);
              }}
              className="space-y-4"
            >
              {/* Seleção de Empresa e Plano */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Master Franquia / Empresa *
                  </label>
                  <select
                    name="empresa_id"
                    value={createEmpresaId}
                    onChange={(e) => setCreateEmpresaId(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Selecione uma empresa...</option>
                    {empresasDisponiveis.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nome_fantasia} ({emp.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Plano SaaS *
                  </label>
                  <select
                    name="plano_id"
                    value={createPlanoId}
                    onChange={(e) => handlePlanoChangeInCreate(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Selecione um plano...</option>
                    {planosDisponiveis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} — R$ {Number(p.valor_mensal).toFixed(2)}/mês
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Card de Detalhes do Plano Selecionado */}
              {createPlanoSelecionado && (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-3.5 dark:border-cyan-900/50 dark:bg-cyan-950/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-900 dark:text-cyan-300 uppercase tracking-wide text-[11px]">
                      Configuração Padrão do {createPlanoSelecionado.nome}:
                    </span>
                    <span className="font-bold font-mono text-cyan-800 dark:text-cyan-200">
                      R$ {Number(createPlanoSelecionado.valor_mensal).toFixed(2)}/mês
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                    <div className="p-2 rounded bg-white dark:bg-slate-800">
                      <span className="text-slate-500 block text-[10px]">Usuários Inclusos:</span>
                      <strong>{createPlanoSelecionado.limite_usuarios}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-800">
                      <span className="text-slate-500 block text-[10px]">Sites Parceiros:</span>
                      <strong>Até {createPlanoSelecionado.max_sites_parceiros}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-800">
                      <span className="text-slate-500 block text-[10px]">Domínios Próprios:</span>
                      <strong>Até {createPlanoSelecionado.max_sites_dominio_proprio}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-800">
                      <span className="text-slate-500 block text-[10px]">Módulos Liberados:</span>
                      <strong>{createPlanoSelecionado.modulos_habilitados.length}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Quotas Contratadas */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Usuários Contratados:
                  </label>
                  <input
                    name="usuarios_contratados"
                    type="number"
                    min={1}
                    value={createUsuarios}
                    onChange={(e) => setCreateUsuarios(Number(e.target.value))}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Sites Parceiros Contratados:
                  </label>
                  <input
                    name="sites_parceiros_contratados"
                    type="number"
                    min={0}
                    value={createSites}
                    onChange={(e) => setCreateSites(Number(e.target.value))}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Domínios Próprios Contratados:
                  </label>
                  <input
                    name="sites_dominio_proprio_contratados"
                    type="number"
                    min={0}
                    value={createDominios}
                    onChange={(e) => setCreateDominios(Number(e.target.value))}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Valores e Vigência */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Valor Mensal Base (R$):
                  </label>
                  <input
                    name="valor_mensal"
                    type="number"
                    step="0.01"
                    min={0}
                    value={createValorMensal}
                    onChange={(e) => setCreateValorMensal(e.target.value)}
                    placeholder="Deixe em branco para usar o plano"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Taxa de Implantação (R$):
                  </label>
                  <input
                    name="taxa_implantacao"
                    type="number"
                    step="0.01"
                    min={0}
                    value={createTaxaImplantacao}
                    onChange={(e) => setCreateTaxaImplantacao(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Status Inicial:
                  </label>
                  <select
                    name="status"
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="ATIVA">Ativa</option>
                    <option value="TREINAMENTO">Em Treinamento</option>
                    <option value="PENDENTE">Pendente</option>
                    <option value="SUSPENSA">Suspensa</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Data de Início / Vigência:
                  </label>
                  <input
                    name="data_inicio"
                    type="date"
                    value={createDataInicio}
                    onChange={(e) => setCreateDataInicio(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Observações Contratuais:
                  </label>
                  <input
                    name="observacao"
                    placeholder="Ex: Contrato assinado via plataforma digital"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Total Estimado */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">
                    Mensalidade Contratada Estimada:
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Base do plano + adicionais contratados
                  </span>
                </div>
                <div className="text-right font-mono font-extrabold text-sm text-cyan-700 dark:text-cyan-400">
                  R$ {
                    (
                      Number(createValorMensal || createPlanoSelecionado?.valor_mensal || 0) +
                      createSites * Number(createPlanoSelecionado?.valor_site_parceiro || 0) +
                      createDominios * Number(createPlanoSelecionado?.valor_site_dominio_proprio || 0)
                    ).toFixed(2)
                  }/mês
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingCreate}
                  className="rounded-xl bg-cyan-600 px-5 py-2 font-bold text-white hover:bg-cyan-700 disabled:opacity-50"
                >
                  {isPendingCreate ? "Criando Assinatura..." : "Criar Assinatura"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          MODAL: EDITAR ASSINATURA & TROCA ASSISTIDA DE PLANO
      ─────────────────────────────────────────────────────────── */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Gerenciar Assinatura & Quotas
                </h3>
                <p className="text-xs text-slate-500 font-semibold">{editItem.empresa?.nome_fantasia}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form
              action={async (formData) => {
                await actionSave(formData);
                setEditItem(null);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="id" value={editItem.id} />
              <input type="hidden" name="empresa_id" value={editItem.empresa_id} />

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Plano SaaS Contratado:</label>
                <select
                  name="plano_id"
                  value={novoPlanoId || editItem.plano_id}
                  onChange={(e) => {
                    setNovoPlanoId(e.target.value);
                    const selected = planosDisponiveis.find((p) => p.id === e.target.value);
                    if (selected) {
                      setUsuariosContratados(selected.limite_usuarios);
                      setSitesContratados(Math.min(sitesContratados, selected.max_sites_parceiros));
                      setDominiosContratados(Math.min(dominiosContratados, selected.max_sites_dominio_proprio));
                    }
                  }}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  {planosDisponiveis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (R$ {Number(p.valor_mensal).toFixed(2)}/mês — {p.limite_usuarios} usuários, até {p.max_sites_parceiros} sites)
                    </option>
                  ))}
                </select>
              </div>

              {/* Quadro Comparativo de Troca de Plano */}
              {planoSelecionado && planoAtual && planoSelecionado.id !== planoAtual.id && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20 space-y-2">
                  <p className="font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide text-[11px]">
                    Impactos da Troca de Plano ({planoAtual.nome} → {planoSelecionado.nome}):
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                    <div className="p-2 rounded bg-white dark:bg-slate-800">
                      <span className="text-slate-500 block text-[10px]">Mensalidade:</span>
                      <strong>R$ {Number(planoSelecionado.valor_mensal).toFixed(2)}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-800">
                      <span className="text-slate-500 block text-[10px]">Usuários Base:</span>
                      <strong>{planoSelecionado.limite_usuarios}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-800">
                      <span className="text-slate-500 block text-[10px]">Máx Sites:</span>
                      <strong>{planoSelecionado.max_sites_parceiros}</strong>
                    </div>
                    <div className="p-2 rounded bg-white dark:bg-slate-800">
                      <span className="text-slate-500 block text-[10px]">Módulos ERP:</span>
                      <strong>{planoSelecionado.modulos_habilitados.length} módulos</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Quotas Contratadas vs Limites do Plano */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Usuários Contratados (Máx {planoSelecionado?.limite_usuarios || 10}):
                  </label>
                  <input
                    name="usuarios_contratados"
                    type="number"
                    min={1}
                    max={planoSelecionado?.limite_usuarios || 10}
                    value={usuariosContratados}
                    onChange={(e) => setUsuariosContratados(Number(e.target.value))}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Sites Parceiros (Máx {planoSelecionado?.max_sites_parceiros || 0}):
                  </label>
                  <input
                    name="sites_parceiros_contratados"
                    type="number"
                    min={0}
                    max={planoSelecionado?.max_sites_parceiros || 0}
                    value={sitesContratados}
                    onChange={(e) => setSitesContratados(Number(e.target.value))}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Domínios Próprios (Máx {planoSelecionado?.max_sites_dominio_proprio || 0}):
                  </label>
                  <input
                    name="sites_dominio_proprio_contratados"
                    type="number"
                    min={0}
                    max={planoSelecionado?.max_sites_dominio_proprio || 0}
                    value={dominiosContratados}
                    onChange={(e) => setDominiosContratados(Number(e.target.value))}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Quadro de Resolução Efetiva */}
              <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-3.5 dark:border-cyan-900/50 dark:bg-cyan-950/20 space-y-2">
                <p className="font-bold text-cyan-900 dark:text-cyan-300 uppercase tracking-wide text-[11px]">
                  Resolução de Valores Efetivos:
                </p>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="p-2 rounded bg-white dark:bg-slate-800">
                    <span className="text-slate-500 block text-[10px]">PLANO BASE:</span>
                    <strong>R$ {Number(planoSelecionado?.valor_mensal || 0).toFixed(2)}</strong>
                  </div>
                  <div className="p-2 rounded bg-white dark:bg-slate-800">
                    <span className="text-slate-500 block text-[10px]">SITES EXTRAS:</span>
                    <strong>R$ {(sitesContratados * Number(planoSelecionado?.valor_site_parceiro || 0)).toFixed(2)}</strong>
                  </div>
                  <div className="p-2 rounded bg-cyan-100 dark:bg-cyan-900 text-cyan-950 dark:text-white">
                    <span className="text-cyan-800 dark:text-cyan-200 block text-[10px] font-bold">TOTAL EFETIVO:</span>
                    <strong>
                      R$ {
                        (
                          Number(planoSelecionado?.valor_mensal || 0) +
                          sitesContratados * Number(planoSelecionado?.valor_site_parceiro || 0)
                        ).toFixed(2)
                      }/mês
                    </strong>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditItem(null)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingSave}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingSave ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
