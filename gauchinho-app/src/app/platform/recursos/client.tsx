"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  salvarOverridePlatformAction,
  encerrarOverridePlatformAction,
  type PlatformFormState,
} from "@/app/platform/recursos-actions";

export type OverrideItem = {
  id: string;
  empresa_id: string;
  tipo: string;
  recurso_codigo: string;
  efeito: "LIBERAR" | "BLOQUEAR";
  valor_numerico: number | null;
  valor_booleano: boolean | null;
  motivo: string;
  observacao: string | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  status: "ATIVO" | "INATIVO" | "ENCERRADO" | "EXPIRADO" | "FUTURO";
  encerrado_em: string | null;
  motivo_encerramento: string | null;
  created_at: string;
  empresa?: { id: string; nome_fantasia: string; slug: string } | null;
  plano_valor_base?: string | number | null;
  contratado_valor?: string | number | null;
  valor_efetivo?: string | number | null;
};

export type EmpresaOption = {
  id: string;
  nome_fantasia: string;
  slug: string;
  plano_nome?: string;
  limite_usuarios_plano?: number;
  limite_sites_plano?: number;
  limite_dominios_plano?: number;
  modulos_plano?: string[];
  usuarios_contratados?: number;
  sites_contratados?: number;
  dominios_contratados?: number;
};

export type ModuloOption = { codigo: string; nome: string; categoria: string };

const initial: PlatformFormState = { status: "IDLE", message: "" };

const TIPOS_OVERRIDE = [
  { id: "MODULO_ERP", nome: "Módulo ERP (Liberar / Bloquear)" },
  { id: "LIMITE_USUARIOS", nome: "Limite de Usuários da Equipe" },
  { id: "LIMITE_SITES", nome: "Limite de Sites de Parceiros" },
  { id: "LIMITE_DOMINIOS_PROPRIOS", nome: "Limite de Domínios Próprios de Parceiros" },
  { id: "ERP_HABILITADO", nome: "ERP Habilitado / Desabilitado" },
  { id: "RECURSO_CATALOGO", nome: "Recurso de Catálogo Específico" },
];

const MOTIVOS_PADRAO = [
  "condição comercial",
  "cortesia",
  "negociação especial",
  "teste / degustação",
  "suporte e implantação",
  "ajuste contratual",
  "outro",
];

export function RecursosOverridesClient({
  overrides,
  empresas,
  modulos,
}: {
  overrides: OverrideItem[];
  empresas: EmpresaOption[];
  modulos: ModuloOption[];
}) {
  const [busca, setBusca] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("TODOS");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroVigencia, setFiltroVigencia] = useState("TODOS");

  // Modais
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEncerrar, setModalEncerrar] = useState<OverrideItem | null>(null);

  // Form State Novo
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id || "");
  const [tipo, setTipo] = useState("MODULO_ERP");
  const [recursoCodigo, setRecursoCodigo] = useState(modulos[0]?.codigo || "");
  const [efeito, setEfeito] = useState<"LIBERAR" | "BLOQUEAR">("LIBERAR");
  const [valorNumerico, setValorNumerico] = useState<number>(15);
  const [valorBooleano, setValorBooleano] = useState<boolean>(true);
  const [motivo, setMotivo] = useState("condição comercial");
  const [observacao, setObservacao] = useState("");
  const [vigenciaInicio, setVigenciaInicio] = useState(new Date().toISOString().split("T")[0]);
  const [vigenciaFim, setVigenciaFim] = useState("");

  // Motivo Encerramento
  const [motivoEncerramento, setMotivoEncerramento] = useState("Encerramento de condição especial");

  const [stateSave, actionSave, isPendingSave] = useActionState(salvarOverridePlatformAction, initial);
  const [stateClose, actionClose, isPendingClose] = useActionState(encerrarOverridePlatformAction, initial);

  const empresaSelecionada = empresas.find((e) => e.id === empresaId);

  // Resolver status de expiração em tempo de render
  const hojeStr = new Date().toISOString().split("T")[0];

  const processedOverrides = overrides.map((o) => {
    let statusEfetivo = o.status;
    if (o.status === "ATIVO") {
      if (o.vigencia_fim && o.vigencia_fim < hojeStr) {
        statusEfetivo = "EXPIRADO";
      } else if (o.vigencia_inicio > hojeStr) {
        statusEfetivo = "FUTURO";
      }
    }
    return { ...o, statusEfetivo };
  });

  const filtrados = processedOverrides.filter((o) => {
    const matchBusca =
      !busca ||
      o.recurso_codigo.toLowerCase().includes(busca.toLowerCase()) ||
      o.motivo.toLowerCase().includes(busca.toLowerCase()) ||
      (o.empresa?.nome_fantasia || "").toLowerCase().includes(busca.toLowerCase());

    const matchEmpresa = filtroEmpresa === "TODOS" || o.empresa_id === filtroEmpresa;
    const matchTipo = filtroTipo === "TODOS" || o.tipo === filtroTipo;
    const matchStatus = filtroStatus === "TODOS" || o.statusEfetivo === filtroStatus;
    const matchVigencia =
      filtroVigencia === "TODOS" ||
      (filtroVigencia === "TEMPORARIO" && o.vigencia_fim !== null) ||
      (filtroVigencia === "PERMANENTE" && o.vigencia_fim === null);

    return matchBusca && matchEmpresa && matchTipo && matchStatus && matchVigencia;
  });

  const totalAtivos = processedOverrides.filter((o) => o.statusEfetivo === "ATIVO").length;
  const totalExpirados = processedOverrides.filter((o) => o.statusEfetivo === "EXPIRADO").length;
  const totalTemporarios = processedOverrides.filter((o) => o.vigencia_fim !== null).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Plataforma SaaS</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">Liberações & Overrides</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestão operacional de exceções por Master Franquia sem alteração dos Planos globais.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setObservacao("");
            setVigenciaFim("");
            setModalNovo(true);
          }}
          className="rounded-lg bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-cyan-800 transition-colors"
        >
          + Novo Override
        </button>
      </div>

      {/* Feedbacks */}
      {[stateSave, stateClose].map((st, i) =>
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
          <p className="text-xs font-bold uppercase text-slate-500">Total de Overrides</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{overrides.length}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-emerald-600">Overrides Ativos</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{totalAtivos}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-amber-600">Temporários com Vigência</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{totalTemporarios}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-slate-400">Expirados / Encerrados</p>
          <p className="mt-2 text-2xl font-bold text-slate-600 dark:text-slate-400">
            {totalExpirados + processedOverrides.filter((o) => o.status === "ENCERRADO").length}
          </p>
        </article>
      </section>

      {/* Filtros */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Buscar:</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Recurso, motivo, empresa..."
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Master Franquia:</label>
            <select
              value={filtroEmpresa}
              onChange={(e) => setFiltroEmpresa(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todas as Franquias</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome_fantasia}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Tipo de Override:</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todos os Tipos</option>
              {TIPOS_OVERRIDE.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Status:</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="ATIVO">Ativo</option>
              <option value="EXPIRADO">Expirado</option>
              <option value="ENCERRADO">Encerrado</option>
              <option value="FUTURO">Futuro</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Vigência:</label>
            <select
              value={filtroVigencia}
              onChange={(e) => setFiltroVigencia(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todas</option>
              <option value="PERMANENTE">Permanente</option>
              <option value="TEMPORARIO">Com Data de Término</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Overrides */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="p-3">Master Franquia</th>
                <th className="p-3">Tipo & Recurso</th>
                <th className="p-3">Resolução de Valores</th>
                <th className="p-3">Motivo & Observação</th>
                <th className="p-3">Vigência</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    Nenhum override encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filtrados.map((o) => {
                  const isLimit = o.tipo.startsWith("LIMITE_");
                  return (
                    <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3">
                        <Link
                          href={`/platform/empresas/${o.empresa_id}`}
                          className="font-bold text-cyan-700 dark:text-cyan-400 hover:underline"
                        >
                          {o.empresa?.nome_fantasia || "Franquia"}
                        </Link>
                        <div className="font-mono text-[10px] text-slate-400">/{o.empresa?.slug}</div>
                      </td>

                      <td className="p-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {TIPOS_OVERRIDE.find((t) => t.id === o.tipo)?.nome || o.tipo}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">{o.recurso_codigo}</div>
                      </td>

                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                          {isLimit ? (
                            <>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                PLANO: {o.plano_valor_base ?? "—"}
                              </span>
                              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                OVERRIDE: {o.valor_numerico}
                              </span>
                              <span className="rounded bg-emerald-100 px-2 py-0.5 font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                EFETIVO: {o.statusEfetivo === "ATIVO" ? o.valor_numerico : o.plano_valor_base}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                PLANO: {o.plano_valor_base ?? "Não incluso"}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 font-bold ${
                                  o.efeito === "LIBERAR"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                }`}
                              >
                                OVERRIDE: {o.efeito}
                              </span>
                              <span className="rounded bg-cyan-100 px-2 py-0.5 font-black text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                                EFETIVO: {o.statusEfetivo === "ATIVO" ? (o.efeito === "LIBERAR" ? "ATIVO" : "BLOQUEADO") : "PADRÃO"}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="p-3 max-w-xs">
                        <div className="font-bold text-slate-800 dark:text-slate-200 capitalize">{o.motivo}</div>
                        {o.observacao && <div className="text-[11px] text-slate-500 truncate">{o.observacao}</div>}
                        {o.motivo_encerramento && (
                          <div className="text-[10px] text-rose-600 mt-0.5 font-semibold">
                            Encerramento: {o.motivo_encerramento}
                          </div>
                        )}
                      </td>

                      <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        <div>Início: {o.vigencia_inicio}</div>
                        <div>Fim: {o.vigencia_fim || "Permanente"}</div>
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                            o.statusEfetivo === "ATIVO"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : o.statusEfetivo === "EXPIRADO"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : o.statusEfetivo === "FUTURO"
                              ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {o.statusEfetivo}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        {o.status === "ATIVO" && (
                          <button
                            type="button"
                            onClick={() => setModalEncerrar(o)}
                            className="rounded bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 hover:bg-rose-100 border border-rose-200 transition-colors"
                          >
                            Encerrar
                          </button>
                        )}
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
          MODAL: NOVO OVERRIDE
      ─────────────────────────────────────────────────────────── */}
      {modalNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">+ Novo Override de Exceção</h3>
            <p className="text-slate-500">
              Conceda uma exceção para a Master Franquia sem alterar os planos globais da plataforma.
            </p>

            <form
              action={async (formData) => {
                await actionSave(formData);
                setModalNovo(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Master Franquia:</label>
                <select
                  name="empresa_id"
                  value={empresaId}
                  onChange={(e) => setEmpresaId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome_fantasia} (Plano: {e.plano_nome || "Básico"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Tipo de Override:</label>
                  <select
                    name="tipo"
                    value={tipo}
                    onChange={(e) => {
                      setTipo(e.target.value);
                      if (e.target.value === "MODULO_ERP") {
                        setRecursoCodigo(modulos[0]?.codigo || "");
                      } else if (e.target.value === "LIMITE_USUARIOS") {
                        setRecursoCodigo("limite_usuarios");
                        setValorNumerico(Number(empresaSelecionada?.limite_usuarios_plano || 10) + 5);
                      } else if (e.target.value === "LIMITE_SITES") {
                        setRecursoCodigo("limite_sites_parceiros");
                        setValorNumerico(Number(empresaSelecionada?.limite_sites_plano || 5) + 3);
                      } else if (e.target.value === "LIMITE_DOMINIOS_PROPRIOS") {
                        setRecursoCodigo("limite_dominios_proprios");
                        setValorNumerico(Number(empresaSelecionada?.limite_dominios_plano || 0) + 2);
                      } else if (e.target.value === "ERP_HABILITADO") {
                        setRecursoCodigo("erp_sistema_habilitado");
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {TIPOS_OVERRIDE.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Recurso / Entitlement:</label>
                  {tipo === "MODULO_ERP" ? (
                    <select
                      name="recurso_codigo"
                      value={recursoCodigo}
                      onChange={(e) => setRecursoCodigo(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                    >
                      {modulos.map((m) => (
                        <option key={m.codigo} value={m.codigo}>
                          {m.nome} ({m.categoria})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name="recurso_codigo"
                      value={recursoCodigo}
                      onChange={(e) => setRecursoCodigo(e.target.value)}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                  )}
                </div>
              </div>

              {/* Valores Herdados & Novo Valor */}
              <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-3 dark:border-cyan-900/50 dark:bg-cyan-950/20 space-y-2">
                <p className="text-[11px] font-bold text-cyan-900 dark:text-cyan-300 uppercase">
                  Valores Herdados do Plano / Assinatura:
                </p>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 grid grid-cols-3 gap-2 font-mono">
                  <div>
                    Plano: <strong>{empresaSelecionada?.plano_nome || "Standard"}</strong>
                  </div>
                  <div>
                    Usuários: <strong>{empresaSelecionada?.limite_usuarios_plano ?? 10}</strong>
                  </div>
                  <div>
                    Sites: <strong>{empresaSelecionada?.limite_sites_plano ?? 5}</strong>
                  </div>
                </div>
              </div>

              {tipo.startsWith("LIMITE_") ? (
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Novo Limite Numérico Efetivo:</label>
                  <input
                    name="valor_numerico"
                    type="number"
                    min={1}
                    value={valorNumerico}
                    onChange={(e) => setValorNumerico(Number(e.target.value))}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold text-base dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              ) : tipo === "ERP_HABILITADO" ? (
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Status ERP para a Empresa:</label>
                  <select
                    name="valor_booleano"
                    value={String(valorBooleano)}
                    onChange={(e) => setValorBooleano(e.target.value === "true")}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="true">Habilitado</option>
                    <option value="false">Desabilitado</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Efeito do Override:</label>
                  <select
                    name="efeito"
                    value={efeito}
                    onChange={(e) => setEfeito(e.target.value as "LIBERAR" | "BLOQUEAR")}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="LIBERAR">LIBERAR (Conceder Acesso)</option>
                    <option value="BLOQUEAR">BLOQUEAR (Restringir Acesso)</option>
                  </select>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Motivo (Obrigatório):</label>
                  <select
                    name="motivo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {MOTIVOS_PADRAO.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Início da Vigência:</label>
                  <input
                    name="vigencia_inicio"
                    type="date"
                    value={vigenciaInicio}
                    onChange={(e) => setVigenciaInicio(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Término da Vigência (Opcional — Deixe em branco se permanente):
                </label>
                <input
                  name="vigencia_fim"
                  type="date"
                  value={vigenciaFim}
                  onChange={(e) => setVigenciaFim(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Observação / Justificativa:</label>
                <textarea
                  name="observacao"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={2}
                  placeholder="Ex: Concedido 5 usuários adicionais pelo período de 3 meses conforme aditivo nº 12."
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalNovo(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingSave}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingSave ? "Salvando..." : "Aplicar Override"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          MODAL: ENCERRAR OVERRIDE
      ─────────────────────────────────────────────────────────── */}
      {modalEncerrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Encerrar Override: {modalEncerrar.recurso_codigo}
            </h3>
            <p className="text-slate-500">
              O override será marcado como encerrado e o recurso voltará ao valor herdado do plano/assinatura. O
              histórico será preservado.
            </p>

            <form
              action={async (formData) => {
                await actionClose(formData);
                setModalEncerrar(null);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="id" value={modalEncerrar.id} />

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Motivo do Encerramento:</label>
                <input
                  name="motivo_encerramento"
                  value={motivoEncerramento}
                  onChange={(e) => setMotivoEncerramento(e.target.value)}
                  required
                  placeholder="Ex: Fim do período de cortesia acordado."
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalEncerrar(null)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isPendingClose}
                  className="rounded-lg bg-rose-700 px-4 py-2 font-bold text-white hover:bg-rose-800"
                >
                  {isPendingClose ? "Encerrando..." : "Confirmar Encerramento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
