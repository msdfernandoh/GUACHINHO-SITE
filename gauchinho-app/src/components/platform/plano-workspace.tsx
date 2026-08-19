"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  salvarPlanoPlatformAction,
  statusPlanoPlatformAction,
  duplicarPlanoPlatformAction,
  type PlatformFormState,
} from "@/app/platform/planos-actions";

export type ModuloCatalogo = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  status: string;
  dependencias: string[];
};

export type AssinaturaEmpresa = {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  status: string;
  usuarios_contratados: number;
  sites_parceiros_contratados: number;
  sites_dominio_proprio_contratados: number;
  valor_total_estimado: number;
  created_at: string;
};

export type PlanoDetail = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  status: string;
  valor_mensal: number;
  taxa_implantacao: number;
  limite_usuarios: number;
  erp_incluido: boolean;
  site_principal_incluido: boolean;
  permite_sites_parceiros: boolean;
  max_parceiros: number;
  max_sites_parceiros: number;
  max_sites_dominio_proprio: number;
  valor_site_parceiro: number;
  valor_site_dominio_proprio: number;
  taxa_implantacao_site_parceiro: number;
  taxa_implantacao_dominio_proprio: number;
  disponivel_novas_assinaturas: boolean;
  categoria: string;
  modulos_habilitados: string[];
  updated_at: string;
};

const initial: PlatformFormState = { status: "IDLE", message: "" };

export function PlanoWorkspace({
  plano,
  modulosCatalogo = [],
  assinaturas = [],
  historico = [],
}: {
  plano: PlanoDetail;
  modulosCatalogo: ModuloCatalogo[];
  assinaturas?: AssinaturaEmpresa[];
  historico?: { id: string; acao: string; created_at: string; campos_alterados: unknown }[];
}) {
  const [tab, setTab] = useState<
    "geral" | "erp" | "usuarios" | "site_principal" | "parceiros" | "valores" | "assinaturas" | "historico"
  >("geral");

  const [stateSave, actionSave, isPendingSave] = useActionState(salvarPlanoPlatformAction, initial);
  const [stateStatus, actionStatus, isPendingStatus] = useActionState(statusPlanoPlatformAction, initial);
  const [stateDuplicar, actionDuplicar, isPendingDuplicar] = useActionState(duplicarPlanoPlatformAction, initial);

  // States
  const [nome, setNome] = useState(plano.nome);
  const [descricao, setDescricao] = useState(plano.descricao ?? "");
  const [categoria, setCategoria] = useState(plano.categoria || "PADRAO");
  const [disponivel, setDisponivel] = useState(plano.disponivel_novas_assinaturas);

  // ERP & Módulos
  const [erpIncluido, setErpIncluido] = useState(plano.erp_incluido);
  const [modulosSelecionados, setModulosSelecionados] = useState<string[]>(plano.modulos_habilitados ?? []);

  // Usuários
  const [limiteUsuarios, setLimiteUsuarios] = useState(plano.limite_usuarios || 10);

  // Site Principal
  const [sitePrincipalIncluido, setSitePrincipalIncluido] = useState(plano.site_principal_incluido);

  // Sites Parceiros
  const [permiteSitesParceiros, setPermiteSitesParceiros] = useState(plano.permite_sites_parceiros);
  const [maxParceiros, setMaxParceiros] = useState(plano.max_parceiros || 0);
  const [maxSitesParceiros, setMaxSitesParceiros] = useState(plano.max_sites_parceiros || 0);
  const [maxSitesDominioProprio, setMaxSitesDominioProprio] = useState(plano.max_sites_dominio_proprio || 0);

  // Valores
  const [valorMensal, setValorMensal] = useState(plano.valor_mensal || 0);
  const [taxaImplantacao, setTaxaImplantacao] = useState(plano.taxa_implantacao || 0);
  const [valorSiteParceiro, setValorSiteParceiro] = useState(plano.valor_site_parceiro || 0);
  const [valorSiteDominioProprio, setValorSiteDominioProprio] = useState(plano.valor_site_dominio_proprio || 0);
  const [taxaImplantacaoSiteParceiro, setTaxaImplantacaoSiteParceiro] = useState(plano.taxa_implantacao_site_parceiro || 0);
  const [taxaImplantacaoDominioProprio, setTaxaImplantacaoDominioProprio] = useState(plano.taxa_implantacao_dominio_proprio || 0);

  // Inclusão assistida com resolução de dependências
  const toggleModulo = (codigo: string) => {
    if (modulosSelecionados.includes(codigo)) {
      setModulosSelecionados((prev) => prev.filter((c) => c !== codigo));
    } else {
      // Adicionar módulo e todas as suas dependências
      const targetMod = modulosCatalogo.find((m) => m.codigo === codigo);
      const toAdd = new Set<string>([codigo]);

      if (targetMod?.dependencias) {
        targetMod.dependencias.forEach((dep) => {
          toAdd.add(dep);
          const parentDep = modulosCatalogo.find((m) => m.codigo === dep);
          parentDep?.dependencias?.forEach((d) => toAdd.add(d));
        });
      }

      setModulosSelecionados((prev) => Array.from(new Set([...prev, ...Array.from(toAdd)])));
    }
  };

  const isAtivo = plano.status === "ATIVO";
  const isRascunho = plano.status === "RASCUNHO";

  // Cálculo de MRR Contratado pelas assinaturas ativas
  const totalAssinantesAtivos = assinaturas.filter((a) => a.status === "ATIVA").length;
  const mrrEstimado = assinaturas
    .filter((a) => a.status === "ATIVA")
    .reduce((acc, a) => acc + Number(a.valor_total_estimado || valorMensal), 0);

  return (
    <div className="space-y-6">
      {/* Header Executivo */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <Link
            href="/platform/planos"
            className="text-xs font-bold uppercase tracking-wider text-cyan-700 hover:underline dark:text-cyan-400"
          >
            ← Planos SaaS
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">{plano.nome}</h1>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                isAtivo
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : isRascunho
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {plano.status}
            </span>
            <span className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-400">
              R$ {valorMensal.toFixed(2)}/mês
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 font-mono">Código: {plano.codigo}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Duplicar */}
          <form action={actionDuplicar}>
            <input type="hidden" name="plano_id" value={plano.id} />
            <input type="hidden" name="novo_nome" value={`${plano.nome} (Cópia)`} />
            <button
              type="submit"
              disabled={isPendingDuplicar}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {isPendingDuplicar ? "Duplicando..." : "📋 Duplicar Plano"}
            </button>
          </form>

          {/* Ativar / Inativar */}
          {isRascunho && (
            <form action={actionStatus}>
              <input type="hidden" name="id" value={plano.id} />
              <input type="hidden" name="status" value="ATIVO" />
              <button
                type="submit"
                disabled={isPendingStatus}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700"
              >
                {isPendingStatus ? "Ativando..." : "✓ Ativar Plano"}
              </button>
            </form>
          )}

          {isAtivo && (
            <form action={actionStatus}>
              <input type="hidden" name="id" value={plano.id} />
              <input type="hidden" name="status" value="INATIVO" />
              <button
                type="submit"
                disabled={isPendingStatus}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              >
                {isPendingStatus ? "Inativando..." : "Inativar"}
              </button>
            </form>
          )}
        </div>
      </header>

      {/* Cards de Métricas Operacionais do Plano */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-slate-500">Assinantes Ativos</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalAssinantesAtivos}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-emerald-600">MRR Estimado Contratual</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">R$ {mrrEstimado.toFixed(2)}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-cyan-600">Limite de Usuários Base</p>
          <p className="mt-2 text-2xl font-bold text-cyan-700">{limiteUsuarios}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-slate-400">Sites Parceiros Permitidos</p>
          <p className="mt-2 text-2xl font-bold text-slate-700 dark:text-slate-300">
            {permiteSitesParceiros ? `${maxSitesParceiros} (Até ${maxSitesDominioProprio} própr.)` : "Não"}
          </p>
        </article>
      </section>

      {/* Feedbacks */}
      {stateSave.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs font-bold ${
            stateSave.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {stateSave.message}
        </p>
      )}
      {stateStatus.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs font-bold ${
            stateStatus.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {stateStatus.message}
        </p>
      )}

      {/* Navegação de Abas */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        {[
          ["geral", "1. Geral"],
          ["erp", "2. ERP & Módulos"],
          ["usuarios", "3. Usuários"],
          ["site_principal", "4. Site Principal"],
          ["parceiros", "5. Sites de Parceiros"],
          ["valores", "6. Precificação"],
          ["assinaturas", "7. Assinaturas / Empresas"],
          ["historico", "8. Histórico"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key as never)}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
              tab === key
                ? "bg-cyan-700 text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Formulário Principal de Edição */}
      <form action={actionSave} className="space-y-6">
        <input type="hidden" name="id" value={plano.id} />
        <input type="hidden" name="nome" value={nome} />
        <input type="hidden" name="descricao" value={descricao} />
        <input type="hidden" name="categoria" value={categoria} />
        <input type="hidden" name="disponivel_novas_assinaturas" value={String(disponivel)} />
        <input type="hidden" name="erp_incluido" value={String(erpIncluido)} />
        <input type="hidden" name="modulos_codigos_json" value={JSON.stringify(modulosSelecionados)} />
        <input type="hidden" name="limite_usuarios" value={String(limiteUsuarios)} />
        <input type="hidden" name="site_principal_incluido" value={String(sitePrincipalIncluido)} />
        <input type="hidden" name="permite_sites_parceiros" value={String(permiteSitesParceiros)} />
        <input type="hidden" name="max_parceiros" value={String(maxParceiros)} />
        <input type="hidden" name="max_sites_parceiros" value={String(maxSitesParceiros)} />
        <input type="hidden" name="max_sites_dominio_proprio" value={String(maxSitesDominioProprio)} />
        <input type="hidden" name="valor_mensal" value={String(valorMensal)} />
        <input type="hidden" name="taxa_implantacao" value={String(taxaImplantacao)} />
        <input type="hidden" name="valor_site_parceiro" value={String(valorSiteParceiro)} />
        <input type="hidden" name="valor_site_dominio_proprio" value={String(valorSiteDominioProprio)} />
        <input type="hidden" name="taxa_implantacao_site_parceiro" value={String(taxaImplantacaoSiteParceiro)} />
        <input type="hidden" name="taxa_implantacao_dominio_proprio" value={String(taxaImplantacaoDominioProprio)} />

        {/* ABA 1: GERAL */}
        {tab === "geral" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Dados Gerais do Plano</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome do Plano *:</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Código Técnico:</label>
                <input
                  value={plano.codigo}
                  disabled
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 p-2.5 text-xs font-mono text-slate-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Descrição Comercial:</label>
                <textarea
                  rows={3}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Categoria:</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="PADRAO">Padrão</option>
                  <option value="ENTERPRISE">Enterprise / Franquia Master</option>
                  <option value="START">Start / Inicial</option>
                  <option value="ESPECIAL">Especial / Sob Medida</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Disponível para Novas Assinaturas:</label>
                <select
                  value={String(disponivel)}
                  onChange={(e) => setDisponivel(e.target.value === "true")}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="true">Sim (Disponível no Onboarding)</option>
                  <option value="false">Não (Oculto para novas assinaturas)</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {/* ABA 2: ERP & MÓDULOS */}
        {tab === "erp" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">ERP & Módulos Inclusos no Plano</h2>
                <p className="text-xs text-slate-500">
                  Defina os módulos do catálogo global que este plano concede. Dependências são incluídas automaticamente.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={erpIncluido}
                  onChange={(e) => setErpIncluido(e.target.checked)}
                  className="h-4 w-4 rounded text-cyan-600"
                />
                <span>ERP Incluído no Plano</span>
              </label>
            </div>

            {erpIncluido ? (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {modulosCatalogo.map((mod) => {
                  const isChecked = modulosSelecionados.includes(mod.codigo);
                  return (
                    <label
                      key={mod.id}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
                        isChecked
                          ? "border-cyan-300 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/30"
                          : "border-slate-200 bg-white opacity-60 dark:border-slate-800 dark:bg-slate-900"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleModulo(mod.codigo)}
                        className="mt-0.5 h-4 w-4 rounded text-cyan-600"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">{mod.nome}</h4>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500 dark:bg-slate-800">
                            {mod.categoria}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{mod.descricao || mod.codigo}</p>
                        {mod.dependencias?.length > 0 && (
                          <p className="text-[10px] text-cyan-700 dark:text-cyan-400 mt-1">
                            Depende de: {mod.dependencias.join(", ")}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                O ERP está desabilitado neste Plano. Tenants com este plano terão acesso apenas ao Portal Público.
              </div>
            )}
          </section>
        )}

        {/* ABA 3: USUÁRIOS */}
        {tab === "usuarios" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Limite Base de Usuários</h2>
            <p className="text-xs text-slate-500">
              Quantidade de acessos de usuários concedidos por padrão à Master Franquia.
            </p>
            <div className="max-w-xs">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Limite de Usuários:</label>
              <input
                type="number"
                min={1}
                value={limiteUsuarios}
                onChange={(e) => setLimiteUsuarios(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </section>
        )}

        {/* ABA 4: SITE PRINCIPAL */}
        {tab === "site_principal" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Site Institucional Principal</h2>
            <label className="flex items-center gap-3 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={sitePrincipalIncluido}
                onChange={(e) => setSitePrincipalIncluido(e.target.checked)}
                className="h-4 w-4 rounded text-cyan-600"
              />
              <span>Site Principal da Master Franquia Incluído no Plano</span>
            </label>
            <p className="text-xs text-slate-500">
              Permite à franquia utilizar um Modelo de Site publicado (ex: Racon Inspired ou Gauchinho Default) com domínio próprio ou subdomínio.
            </p>
          </section>
        )}

        {/* ABA 5: SITES DE PARCEIROS */}
        {tab === "parceiros" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Sites de Parceiros Comerciais</h2>
                <p className="text-xs text-slate-500">
                  Permita à Master Franquia criar e gerenciar landing pages/sites para seus parceiros comerciais (imobiliárias, consultores, etc.).
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={permiteSitesParceiros}
                  onChange={(e) => setPermiteSitesParceiros(e.target.checked)}
                  className="h-4 w-4 rounded text-cyan-600"
                />
                <span>Habilitar Sites de Parceiros</span>
              </label>
            </div>

            {permiteSitesParceiros && (
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Máximo de Parceiros Cadastrados:</label>
                  <input
                    type="number"
                    min={0}
                    value={maxParceiros}
                    onChange={(e) => setMaxParceiros(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Máximo de Sites de Parceiros:</label>
                  <input
                    type="number"
                    min={0}
                    value={maxSitesParceiros}
                    onChange={(e) => setMaxSitesParceiros(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Máximo com Domínio Próprio:</label>
                  <input
                    type="number"
                    min={0}
                    value={maxSitesDominioProprio}
                    onChange={(e) => setMaxSitesDominioProprio(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* ABA 6: VALORES & PRECIFICAÇÃO */}
        {tab === "valores" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Precificação do Plano SaaS</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Valor Mensal Base (R$):</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={valorMensal}
                  onChange={(e) => setValorMensal(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800 text-cyan-700"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Taxa de Implantação Opcional (R$):</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={taxaImplantacao}
                  onChange={(e) => setTaxaImplantacao(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mensalidade por Site de Parceiro (Sem Domínio Próprio):</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={valorSiteParceiro}
                  onChange={(e) => setValorSiteParceiro(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mensalidade por Site de Parceiro (Com Domínio Próprio):</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={valorSiteDominioProprio}
                  onChange={(e) => setValorSiteDominioProprio(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          </section>
        )}

        {/* ABA 7: ASSINATURAS / EMPRESAS */}
        {tab === "assinaturas" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Master Franquias com este Plano</h2>
            {assinaturas.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhuma empresa associada a este plano no momento.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="p-2.5">Master Franquia</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 text-center">Usuários</th>
                      <th className="p-2.5 text-center">Sites Parceiros</th>
                      <th className="p-2.5 text-center">Domínios Próprios</th>
                      <th className="p-2.5 text-right">Valor Total Estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {assinaturas.map((a) => (
                      <tr key={a.id}>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-white">{a.empresa_nome}</td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              a.status === "ATIVA"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                            }`}
                          >
                            {a.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">{a.usuarios_contratados}</td>
                        <td className="p-2.5 text-center">{a.sites_parceiros_contratados}</td>
                        <td className="p-2.5 text-center">{a.sites_dominio_proprio_contratados}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-cyan-700 dark:text-cyan-400">
                          R$ {Number(a.valor_total_estimado || 0).toFixed(2)}/mês
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ABA 8: HISTÓRICO */}
        {tab === "historico" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Histórico de Alterações</h2>
            {historico.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum evento registrado ainda.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {historico.map((h) => (
                  <div key={h.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <strong className="text-slate-800 dark:text-slate-200">{h.acao}</strong>
                      <p className="text-[11px] text-slate-400">{new Date(h.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Botão de Salvar Global */}
        {tab !== "assinaturas" && tab !== "historico" && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              disabled={isPendingSave}
              className="rounded-lg bg-cyan-700 px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-cyan-800 disabled:opacity-50"
            >
              {isPendingSave ? "Salvando Alterações..." : "💾 Salvar Configurações do Plano"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
