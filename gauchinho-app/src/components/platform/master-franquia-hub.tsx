"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  atualizarDadosEmpresaPlatformAction,
  ativarEmpresaPlatformAction,
  suspenderEmpresaPlatformAction,
  reativarEmpresaPlatformAction,
  alterarPlanoEmpresaPlatformAction,
  alterarModeloEmpresaPlatformAction,
  concederAdministradoraEmpresaPlatformAction,
  revogarAdministradoraEmpresaPlatformAction,
  criarSiteParceiroEmpresaPlatformAction,
  type PlatformFormState,
} from "@/app/platform/empresas/actions";

export type EmpresaHubDetail = {
  id: string;
  nome_fantasia: string;
  razao_social: string;
  slug: string;
  cnpj: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  status: string;
  ativo: boolean;
  configuracoes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AssinaturaHubDetail = {
  id: string;
  status: string;
  valor_mensal: number;
  valor_total_estimado: number;
  taxa_implantacao: number;
  usuarios_contratados: number;
  sites_parceiros_contratados: number;
  sites_dominio_proprio_contratados: number;
  data_inicio: string | null;
  plano_id: string;
  plano: {
    id: string;
    codigo: string;
    nome: string;
    descricao: string | null;
    valor_mensal: number;
    limite_usuarios: number;
    erp_incluido: boolean;
    site_principal_incluido: boolean;
    permite_sites_parceiros: boolean;
    max_parceiros: number;
    max_sites_parceiros: number;
    max_sites_dominio_proprio: number;
    valor_site_parceiro: number;
    valor_site_dominio_proprio: number;
    modulos_habilitados: string[];
  } | null;
};

export type BrandingHubDetail = {
  id: string;
  nome_site: string;
  status_publicacao: string;
  modelo_id: string | null;
  template_codigo: string | null;
  logo_url: string | null;
  menus: { id: string; label: string; rota: string; ativo_padrao?: boolean }[];
  modelo: {
    id: string;
    codigo: string;
    nome: string;
    status: string;
    versao: number;
    identidade_visual: Record<string, unknown>;
  } | null;
};

export type DominioHubItem = {
  id: string;
  valor: string;
  tipo: string;
  principal: boolean;
  ativo: boolean;
  verificado: boolean;
};

export type AdminHubItem = {
  id: string;
  administradora_id: string;
  status: string;
  administradora: {
    id: string;
    nome: string;
    nome_fantasia: string | null;
    slug: string;
  } | null;
};

export type UsuarioHubItem = {
  id: string;
  usuario_id: string;
  ativo: boolean;
  created_at: string;
  usuario: {
    id: string;
    nome: string;
    email: string;
    status: string;
    ultimo_acesso: string | null;
  } | null;
  papel: {
    id: string;
    nome: string;
  } | null;
};

export type ParceiroHubItem = {
  id: string;
  nome: string;
  status: string;
  sites: {
    id: string;
    slug: string;
    nome_site: string;
    canal_principal: string;
    status_publicacao: string;
    ativo: boolean;
  }[];
};

export type ModuloCatalogoHub = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  status: string;
};

export type OverrideHubItem = {
  id: string;
  recurso_codigo: string;
  efeito: string;
  motivo: string | null;
};

export type PlanoOptionHub = {
  id: string;
  codigo: string;
  nome: string;
  valor_mensal: number;
  limite_usuarios: number;
  permite_sites_parceiros: boolean;
  max_sites_parceiros: number;
  max_sites_dominio_proprio: number;
  valor_site_parceiro: number;
  valor_site_dominio_proprio: number;
  erp_incluido: boolean;
  modulos_habilitados: string[];
};

export type ModeloOptionHub = {
  id: string;
  codigo: string;
  nome: string;
  status: string;
  versao: number;
};

export type AdminOptionHub = {
  id: string;
  nome: string;
};

export type AuditoriaHubItem = {
  id: string;
  acao: string;
  entidade_tipo: string;
  campos_alterados: unknown;
  created_at: string;
};

const initial: PlatformFormState = { status: "IDLE", message: "" };

export function MasterFranquiaHub({
  empresa,
  assinatura,
  branding,
  dominios = [],
  administradoras = [],
  usuarios = [],
  parceiros = [],
  modulosCatalogo = [],
  overrides = [],
  planosDisponiveis = [],
  modelosDisponiveis = [],
  adminsDisponiveis = [],
  historico = [],
}: {
  empresa: EmpresaHubDetail;
  assinatura: AssinaturaHubDetail | null;
  branding: BrandingHubDetail | null;
  dominios: DominioHubItem[];
  administradoras: AdminHubItem[];
  usuarios: UsuarioHubItem[];
  parceiros: ParceiroHubItem[];
  modulosCatalogo: ModuloCatalogoHub[];
  overrides: OverrideHubItem[];
  planosDisponiveis: PlanoOptionHub[];
  modelosDisponiveis: ModeloOptionHub[];
  adminsDisponiveis: AdminOptionHub[];
  historico: AuditoriaHubItem[];
}) {
  const [tab, setTab] = useState<
    | "geral"
    | "empresa"
    | "plano"
    | "erp"
    | "usuarios"
    | "administradoras"
    | "site"
    | "dominios"
    | "parceiros"
    | "historico"
  >("geral");

  // Modais
  const [modalSuspender, setModalSuspender] = useState(false);
  const [modalTrocarPlano, setModalTrocarPlano] = useState(false);
  const [modalTrocarModelo, setModalTrocarModelo] = useState(false);
  const [modalConcederAdmin, setModalConcederAdmin] = useState(false);
  const [modalNovoSiteParceiro, setModalNovoSiteParceiro] = useState(false);

  // States do formulário de dados da empresa
  const [nomeFantasia, setNomeFantasia] = useState(empresa.nome_fantasia);
  const [razaoSocial, setRazaoSocial] = useState(empresa.razao_social);
  const [cnpj, setCnpj] = useState(empresa.cnpj ?? "");
  const [telefone, setTelefone] = useState(empresa.telefone ?? "");
  const [whatsapp, setWhatsapp] = useState(empresa.whatsapp ?? "");
  const [email, setEmail] = useState(empresa.email ?? "");
  const [cidade, setCidade] = useState(empresa.cidade ?? "");
  const [estado, setEstado] = useState(empresa.estado ?? "");

  // State para troca de plano assistida
  const [novoPlanoId, setNovoPlanoId] = useState(assinatura?.plano_id || planosDisponiveis[0]?.id || "");
  const [novosUsuarios, setNovosUsuarios] = useState(assinatura?.usuarios_contratados || 10);
  const [novosSites, setNovosSites] = useState(assinatura?.sites_parceiros_contratados || 0);
  const [novosDominios, setNovosDominios] = useState(assinatura?.sites_dominio_proprio_contratados || 0);

  // State para troca de template
  const [novoModeloId, setNovoModeloId] = useState(branding?.modelo_id || modelosDisponiveis[0]?.id || "");

  // State para concessão de administradora
  const [novaAdminId, setNovaAdminId] = useState(adminsDisponiveis[0]?.id || "");

  // Actions
  const [stateDados, actionDados, isPendingDados] = useActionState(atualizarDadosEmpresaPlatformAction, initial);
  const [stateAtivar, actionAtivar, isPendingAtivar] = useActionState(ativarEmpresaPlatformAction, initial);
  const [stateSuspender, actionSuspender, isPendingSuspender] = useActionState(suspenderEmpresaPlatformAction, initial);
  const [stateReativar, actionReativar, isPendingReativar] = useActionState(reativarEmpresaPlatformAction, initial);
  const [statePlano, actionPlano, isPendingPlano] = useActionState(alterarPlanoEmpresaPlatformAction, initial);
  const [stateModelo, actionModelo, isPendingModelo] = useActionState(alterarModeloEmpresaPlatformAction, initial);
  const [stateConcederAdmin, actionConcederAdmin, isPendingConcederAdmin] = useActionState(concederAdministradoraEmpresaPlatformAction, initial);
  const [stateRevogarAdmin, actionRevogarAdmin, isPendingRevogarAdmin] = useActionState(revogarAdministradoraEmpresaPlatformAction, initial);
  const [stateSiteParceiro, actionSiteParceiro, isPendingSiteParceiro] = useActionState(criarSiteParceiroEmpresaPlatformAction, initial);

  // Cálculos de Entitlements & Limites
  const planoAtual = assinatura?.plano;
  const configJson = (empresa.configuracoes as Record<string, unknown> | null) ?? {};
  const erpConfig = configJson.erp_sistema as { habilitado?: boolean } | undefined;
  const erpHabilitado = Boolean(erpConfig?.habilitado);

  const totalUsuariosUsados = usuarios.filter((u) => u.ativo).length;
  const limiteUsuariosContratados = assinatura?.usuarios_contratados || 10;
  const maxUsuariosPlano = planoAtual?.limite_usuarios ?? 10;

  const totalParceirosCadastrados = parceiros.length;
  const maxParceirosPlano = planoAtual?.max_parceiros ?? 0;

  const todosSitesParceiros = parceiros.flatMap((p) => p.sites.filter((s) => s.ativo));
  const totalSitesUsados = todosSitesParceiros.length;
  const totalSitesContratados = assinatura?.sites_parceiros_contratados ?? 0;
  const maxSitesPlano = planoAtual?.max_sites_parceiros ?? 0;

  const totalDominiosPropriosUsados = todosSitesParceiros.filter((s) => s.canal_principal === "DOMINIO").length;
  const totalDominiosPropriosContratados = assinatura?.sites_dominio_proprio_contratados ?? 0;
  const maxDominiosPropriosPlano = planoAtual?.max_sites_dominio_proprio ?? 0;

  const adminsAtivas = administradoras.filter((a) => a.status === "ATIVA");
  const dominioPrincipal = dominios.find((d) => d.principal)?.valor || null;

  // Checklist de Prontidão da Master
  const checklist = [
    {
      titulo: "1. Dados da Empresa",
      ok: Boolean(empresa.nome_fantasia && empresa.cnpj && (empresa.email || empresa.telefone)),
      desc: empresa.nome_fantasia && empresa.cnpj ? `${empresa.nome_fantasia} (${empresa.cnpj})` : "Nome ou CNPJ pendente",
    },
    {
      titulo: "2. Plano SaaS & Assinatura",
      ok: Boolean(assinatura && assinatura.plano),
      desc: assinatura?.plano?.nome ? `Plano ${assinatura.plano.nome}` : "Sem plano SaaS vinculado",
    },
    {
      titulo: "3. Administradora Homologada",
      ok: adminsAtivas.length > 0,
      desc: adminsAtivas.length > 0 ? `${adminsAtivas.length} Administradora(s) concedida(s)` : "Nenhuma Administradora ativa vinculada",
    },
    {
      titulo: "4. Usuário Responsável",
      ok: totalUsuariosUsados > 0,
      desc: totalUsuariosUsados > 0 ? `${totalUsuariosUsados} usuário(s) ativos` : "Nenhum usuário cadastrado",
    },
    {
      titulo: "5. Quotas e Limites",
      ok: limiteUsuariosContratados > 0,
      desc: `${limiteUsuariosContratados} usuários contratados`,
    },
    {
      titulo: "6. Modelo de Site",
      ok: Boolean(branding?.modelo || branding?.template_codigo),
      desc: branding?.modelo?.nome || "Modelo padrão configurado",
    },
    {
      titulo: "7. Domínio / Endereço",
      ok: Boolean(dominioPrincipal || empresa.slug),
      desc: dominioPrincipal ? dominioPrincipal : `Subdomínio /${empresa.slug}`,
    },
  ];

  const pendencias = checklist.filter((c) => !c.ok);
  const prontaParaAtivacao = pendencias.length === 0;

  const statusNorm = (empresa.status || "").toLowerCase();

  return (
    <div className="space-y-6">
      {/* ───────────────────────────────────────────────────────────
          1. HEADER PRINCIPAL DA MASTER FRANQUIA
      ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-cyan-600">
              Master Franquia SaaS
            </span>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-black uppercase ${
                statusNorm === "ativa"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : statusNorm === "em_treinamento"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : statusNorm === "suspensa"
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {statusNorm === "em_treinamento" ? "EM TREINAMENTO" : empresa.status}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {empresa.nome_fantasia}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {empresa.razao_social} • CNPJ: {empresa.cnpj || "Não informado"} • Slug:{" "}
            <span className="font-mono text-slate-700 dark:text-slate-300">/{empresa.slug}</span>
          </p>
        </div>

        {/* Botões de Ação de Status */}
        <div className="flex flex-wrap items-center gap-2">
          {statusNorm !== "ativa" ? (
            <form action={actionAtivar}>
              <input type="hidden" name="id" value={empresa.id} />
              <button
                type="submit"
                disabled={isPendingAtivar || !prontaParaAtivacao}
                title={!prontaParaAtivacao ? "Resolva as pendências do checklist antes de ativar." : ""}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-40 transition-colors"
              >
                {isPendingAtivar ? "Ativando..." : "✓ Ativar Master Franquia"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setModalSuspender(true)}
              className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300 transition-colors"
            >
              ⚠️ Suspender Franquia
            </button>
          )}

          {statusNorm === "inativa" && (
            <form action={actionReativar}>
              <input type="hidden" name="id" value={empresa.id} />
              <button
                type="submit"
                disabled={isPendingReativar}
                className="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold text-white shadow hover:bg-cyan-800"
              >
                Reativar Franquia
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Feedbacks de Ações */}
      {[
        stateDados,
        stateAtivar,
        stateSuspender,
        stateReativar,
        statePlano,
        stateModelo,
        stateConcederAdmin,
        stateRevogarAdmin,
        stateSiteParceiro,
      ].map((st, idx) =>
        st.message ? (
          <p
            key={idx}
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

      {/* ───────────────────────────────────────────────────────────
          2. CARD DE PRONTIDÃO DA MASTER & CHECKLIST DE ATIVAÇÃO
      ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Prontidão Operacional da Master Franquia
            </h2>
            <p className="text-xs text-slate-500">
              Checklist de governança para ativação e funcionamento seguro em Produção.
            </p>
          </div>
          <div>
            {prontaParaAtivacao ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ✓ PRONTA PARA ATIVAÇÃO
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                ⚠️ {pendencias.length} PENDÊNCIA(S)
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {checklist.map((item, i) => (
            <div
              key={i}
              className={`rounded-xl border p-3 text-xs space-y-1 ${
                item.ok
                  ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
                  : "border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20"
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span>{item.titulo}</span>
                <span>{item.ok ? "✓" : "⚠️"}</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────
          3. KPIS & INDICADORES DE QUOTAS (UTILIZADO / CONTRATADO / MÁXIMO)
      ─────────────────────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Usuários */}
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-1">
          <p className="text-[11px] font-bold uppercase text-slate-500">Usuários da Equipe</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalUsuariosUsados}</span>
            <span className="text-xs text-slate-500 font-semibold">
              / {limiteUsuariosContratados} contratados ({maxUsuariosPlano} máx plano)
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-cyan-600 rounded-full"
              style={{ width: `${Math.min(100, (totalUsuariosUsados / (limiteUsuariosContratados || 1)) * 100)}%` }}
            />
          </div>
        </article>

        {/* Sites Parceiros */}
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-1">
          <p className="text-[11px] font-bold uppercase text-slate-500">Sites de Parceiros</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalSitesUsados}</span>
            <span className="text-xs text-slate-500 font-semibold">
              / {totalSitesContratados} contratados ({maxSitesPlano} máx plano)
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full"
              style={{ width: `${Math.min(100, (totalSitesUsados / (totalSitesContratados || 1)) * 100)}%` }}
            />
          </div>
        </article>

        {/* Domínios Próprios */}
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-1">
          <p className="text-[11px] font-bold uppercase text-slate-500">Domínios Próprios Parceiros</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{totalDominiosPropriosUsados}</span>
            <span className="text-xs text-slate-500 font-semibold">
              / {totalDominiosPropriosContratados} contratados ({maxDominiosPropriosPlano} máx plano)
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-sky-600 rounded-full"
              style={{ width: `${Math.min(100, (totalDominiosPropriosUsados / (totalDominiosPropriosContratados || 1)) * 100)}%` }}
            />
          </div>
        </article>

        {/* MRR Estimado */}
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-1">
          <p className="text-[11px] font-bold uppercase text-cyan-600">MRR Contratual Estimado</p>
          <p className="text-2xl font-black text-cyan-700 dark:text-cyan-400">
            R$ {(assinatura?.valor_total_estimado || assinatura?.valor_mensal || 0).toFixed(2)}
          </p>
          <p className="text-[10px] text-slate-400">Plano + Sites extras contratados</p>
        </article>
      </section>

      {/* ───────────────────────────────────────────────────────────
          4. NAVEGAÇÃO DAS 10 ABAS
      ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2 dark:border-slate-800">
        {[
          ["geral", "1. Visão Geral"],
          ["empresa", "2. Empresa & Dados"],
          ["plano", "3. Plano & Assinatura"],
          ["erp", "4. ERP & Módulos"],
          ["usuarios", `5. Usuários (${totalUsuariosUsados})`],
          ["administradoras", `6. Administradoras (${adminsAtivas.length})`],
          ["site", "7. Site & Identidade"],
          ["dominios", `8. Domínios (${dominios.length})`],
          ["parceiros", `9. Parceiros & Sites (${totalParceirosCadastrados})`],
          ["historico", "10. Histórico"],
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

      {/* ───────────────────────────────────────────────────────────
          ABA 1: VISÃO GERAL
      ─────────────────────────────────────────────────────────── */}
      {tab === "geral" && (
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Card Resumo do Contrato */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Resumo Contratual & Comercial</h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Plano Contratado:</span>
                <strong>{planoAtual?.nome || "Sem Plano Vinculado"}</strong>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Status da Assinatura:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{assinatura?.status || "PENDENTE"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Mensalidade Base do Plano:</span>
                <span>R$ {(planoAtual?.valor_mensal || 0).toFixed(2)}/mês</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Total Mensal Estimado:</span>
                <strong className="text-cyan-700 dark:text-cyan-400 font-mono text-sm">
                  R$ {(assinatura?.valor_total_estimado || assinatura?.valor_mensal || 0).toFixed(2)}/mês
                </strong>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Overrides Ativos:</span>
                <span>{overrides.length} recurso(s) customizados</span>
              </div>
            </div>
          </div>

          {/* Card Resumo de Infraestrutura */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Infraestrutura & Canais</h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Modelo de Site:</span>
                <strong>{branding?.modelo?.nome || "Gauchinho Default"}</strong>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Publicação do Site:</span>
                <span>{branding?.status_publicacao || "Não publicado"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Domínio Principal:</span>
                <span className="font-mono">{dominioPrincipal || "Não configurado"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">ERP Sistema:</span>
                <strong>{erpHabilitado ? "Habilitado" : "Desabilitado"}</strong>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Administradoras Concedidas:</span>
                <strong>{adminsAtivas.map((a) => a.administradora?.nome).join(", ") || "Nenhuma"}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          ABA 2: EMPRESA & DADOS CADASTRAIS
      ─────────────────────────────────────────────────────────── */}
      {tab === "empresa" && (
        <form
          action={actionDados}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 text-xs"
        >
          <input type="hidden" name="id" value={empresa.id} />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Dados Cadastrais da Master Franquia</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Nome Fantasia:</label>
              <input
                name="nome_fantasia"
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Razão Social:</label>
              <input
                name="razao_social"
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">CNPJ:</label>
              <input
                name="cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-mono dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Slug da Plataforma:</label>
              <input
                disabled
                value={empresa.slug}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 p-2.5 font-mono text-slate-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">E-mail Comercial:</label>
              <input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Telefone:</label>
              <input
                name="telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">WhatsApp Comercial:</label>
              <input
                name="whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Cidade:</label>
                <input
                  name="cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Estado (UF):</label>
                <input
                  name="estado"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 uppercase dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={isPendingDados}
              className="rounded-lg bg-cyan-700 px-6 py-2.5 font-bold text-white shadow hover:bg-cyan-800 transition-colors"
            >
              {isPendingDados ? "Salvando..." : "Salvar Alterações Cadastrais"}
            </button>
          </div>
        </form>
      )}

      {/* ───────────────────────────────────────────────────────────
          ABA 3: PLANO & ASSINATURA (COM TROCA DE PLANO ASSISTIDA)
      ─────────────────────────────────────────────────────────── */}
      {tab === "plano" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Plano SaaS & Assinatura Contratual</h3>
              <p className="text-slate-500">Governança comercial de limites, usuários contratados e valores mensais.</p>
            </div>
            <button
              type="button"
              onClick={() => setModalTrocarPlano(true)}
              className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white shadow hover:bg-cyan-800"
            >
              🔄 Alterar Plano SaaS
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border p-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-slate-500">Plano Atual:</span>
              <p className="text-base font-black text-slate-900 dark:text-white">{planoAtual?.nome || "Sem Plano"}</p>
              <p className="text-slate-500 mt-1">{planoAtual?.descricao || "—"}</p>
            </div>

            <div className="rounded-xl border p-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-slate-500">Usuários Contratados:</span>
              <p className="text-base font-black text-slate-900 dark:text-white">
                {assinatura?.usuarios_contratados || 10} usuários
              </p>
              <p className="text-slate-500 mt-1">Limite máximo do plano: {planoAtual?.limite_usuarios ?? 10}</p>
            </div>

            <div className="rounded-xl border p-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-slate-500">Sites de Parceiros:</span>
              <p className="text-base font-black text-slate-900 dark:text-white">
                {assinatura?.sites_parceiros_contratados || 0} sites contratados
              </p>
              <p className="text-slate-500 mt-1">Capacidade do plano: {planoAtual?.max_sites_parceiros ?? 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          ABA 4: ERP & MÓDULOS (MATRIZ EFETIVA)
      ─────────────────────────────────────────────────────────── */}
      {tab === "erp" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 text-xs">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Matriz de Módulos ERP Efetivos</h3>
            <p className="text-slate-500">
              Módulos liberados pelo Plano SaaS e por Overrides individuais para esta empresa.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Módulo</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3 text-center">Incluso no Plano</th>
                  <th className="p-3 text-center">Override Empresa</th>
                  <th className="p-3 text-center">Acesso Efetivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {modulosCatalogo.map((mod) => {
                  const noPlano = Boolean(planoAtual?.modulos_habilitados?.includes(mod.codigo));
                  const temOverride = overrides.some((o) => o.recurso_codigo === mod.codigo && o.efeito === "LIBERAR");
                  const efetivo = noPlano || temOverride;

                  return (
                    <tr key={mod.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{mod.nome}</td>
                      <td className="p-3 text-slate-500">{mod.categoria}</td>
                      <td className="p-3 text-center">{noPlano ? "✓ Sim" : "—"}</td>
                      <td className="p-3 text-center">{temOverride ? "Liberado" : "—"}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            efetivo
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                          }`}
                        >
                          {efetivo ? "ATIVO" : "BLOQUEADO"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          ABA 5: USUÁRIOS
      ─────────────────────────────────────────────────────────── */}
      {tab === "usuarios" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Usuários da Master Franquia ({totalUsuariosUsados} de {limiteUsuariosContratados} utilizados)
              </h3>
              <p className="text-slate-500">Equipe autorizada a acessar o painel operacional e ERP desta empresa.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">E-mail</th>
                  <th className="p-3">Papel</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3">Último Acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {usuarios.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{u.usuario?.nome || "—"}</td>
                    <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{u.usuario?.email || "—"}</td>
                    <td className="p-3 font-semibold text-cyan-700 dark:text-cyan-400">{u.papel?.nome || "Consultor"}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          u.ativo
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-700"
                        }`}
                      >
                        {u.ativo ? "ATIVO" : "INATIVO"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {u.usuario?.ultimo_acesso ? new Date(u.usuario.ultimo_acesso).toLocaleDateString("pt-BR") : "Nunca"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          ABA 6: ADMINISTRADORAS
      ─────────────────────────────────────────────────────────── */}
      {tab === "administradoras" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Administradoras Concedidas</h3>
              <p className="text-slate-500">
                Catálogo de administradoras e grupos de consórcio que esta franquia está homologada a comercializar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalConcederAdmin(true)}
              className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white shadow hover:bg-cyan-800"
            >
              + Conceder Administradora
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {administradoras.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border p-4 bg-slate-50 flex items-center justify-between dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">
                    {a.administradora?.nome_fantasia || a.administradora?.nome}
                  </h4>
                  <span
                    className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      a.status === "ATIVA" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                {a.status === "ATIVA" && (
                  <form action={actionRevogarAdmin}>
                    <input type="hidden" name="empresa_id" value={empresa.id} />
                    <input type="hidden" name="administradora_id" value={a.administradora_id} />
                    <button
                      type="submit"
                      disabled={isPendingRevogarAdmin}
                      className="rounded bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 border border-rose-200"
                    >
                      Revogar
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          ABA 7: SITE & IDENTIDADE
      ─────────────────────────────────────────────────────────── */}
      {tab === "site" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Template de Site & Identidade</h3>
              <p className="text-slate-500">Modelo visual aplicado no portal público desta Master Franquia.</p>
            </div>
            <button
              type="button"
              onClick={() => setModalTrocarModelo(true)}
              className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white shadow hover:bg-cyan-800"
            >
              🎨 Trocar Modelo de Site
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border p-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
              <span className="text-slate-500">Modelo Selecionado:</span>
              <p className="text-lg font-black text-slate-900 dark:text-white">
                {branding?.modelo?.nome || "Gauchinho Default"}
              </p>
              <p className="text-slate-500">Código Técnico: {branding?.template_codigo || "gauchinho_default"}</p>
            </div>

            <div className="rounded-xl border p-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
              <span className="text-slate-500">Status de Publicação:</span>
              <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                {branding?.status_publicacao || "PUBLICADO"}
              </p>
              <p className="text-slate-500">Menus Habilitados: {branding?.menus?.length || 7} áreas</p>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          ABA 8: DOMÍNIOS
      ─────────────────────────────────────────────────────────── */}
      {tab === "dominios" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Domínios & DNS da Franquia</h3>
              <p className="text-slate-500">Domínios próprios e subdomínios apontados para esta Master Franquia.</p>
            </div>
            <Link
              href="/platform/dominios"
              className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white shadow hover:bg-cyan-800"
            >
              + Gerenciar no Módulo de Domínios
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Domínio</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3 text-center">Principal</th>
                  <th className="p-3 text-center">Ativo</th>
                  <th className="p-3 text-center">DNS Verificado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dominios.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400">
                      Nenhum domínio configurado. A franquia está acessível via subdomínio padrão.
                    </td>
                  </tr>
                ) : (
                  dominios.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{d.valor}</td>
                      <td className="p-3 text-slate-500">{d.tipo}</td>
                      <td className="p-3 text-center">{d.principal ? "✓ Sim" : "—"}</td>
                      <td className="p-3 text-center">{d.ativo ? "✓ Ativo" : "Inativo"}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            d.verificado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {d.verificado ? "VERIFICADO" : "PENDENTE"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          ABA 9: PARCEIROS & SITES
      ─────────────────────────────────────────────────────────── */}
      {tab === "parceiros" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Organizações Parceiras & Sites Comerciais
              </h3>
              <p className="text-slate-500">
                Parceiros pertencentes a esta Master Franquia ({totalSitesUsados} de {totalSitesContratados} sites utilizados).
              </p>
            </div>
            {planoAtual?.permite_sites_parceiros && (
              <button
                type="button"
                onClick={() => setModalNovoSiteParceiro(true)}
                className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white shadow hover:bg-cyan-800"
              >
                + Novo Site de Parceiro
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Parceiro</th>
                  <th className="p-3">Site / Nome</th>
                  <th className="p-3">Canal / Endereço</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {parceiros.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400">
                      Nenhum parceiro cadastrado para esta franquia.
                    </td>
                  </tr>
                ) : (
                  parceiros.map((p) =>
                    p.sites.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{p.nome}</td>
                        <td className="p-3">{s.nome_site}</td>
                        <td className="p-3 font-mono text-slate-500">
                          {s.canal_principal === "DOMINIO" ? "Domínio Próprio" : `/${s.slug}`}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              s.status_publicacao === "PUBLICADO"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {s.status_publicacao}
                          </span>
                        </td>
                      </tr>
                    )),
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          ABA 10: HISTÓRICO & AUDITORIA
      ─────────────────────────────────────────────────────────── */}
      {tab === "historico" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4 text-xs">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Linha do Tempo & Histórico Auditável</h3>
            <p className="text-slate-500">Registro cronológico de eventos e alterações nesta Master Franquia.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Data/Hora</th>
                  <th className="p-3">Ação</th>
                  <th className="p-3">Entidade</th>
                  <th className="p-3">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {historico.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400">
                      Nenhum evento registrado no histórico recente.
                    </td>
                  </tr>
                ) : (
                  historico.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400 font-mono">
                        {new Date(h.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">{h.acao}</td>
                      <td className="p-3 text-slate-500">{h.entidade_tipo}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 max-w-md truncate">
                        {JSON.stringify(h.campos_alterados)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          MODAIS DE SUPORTE
      ─────────────────────────────────────────────────────────── */}
      {/* Modal: Suspender Empresa */}
      {modalSuspender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <h3 className="text-base font-bold text-rose-700 dark:text-rose-400">⚠️ Suspender Master Franquia</h3>
            <p className="text-slate-600 dark:text-slate-300">
              A suspensão bloqueia o acesso dos usuários ao painel e ao ERP, mas <strong>preserva todos os dados</strong> intactos.
            </p>
            <form
              action={async (formData) => {
                await actionSuspender(formData);
                setModalSuspender(false);
              }}
              className="space-y-3"
            >
              <input type="hidden" name="id" value={empresa.id} />
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Motivo da Suspensão:</label>
                <input
                  name="motivo"
                  required
                  placeholder="Ex: Inadimplência ou solicitação da diretoria"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Observações adicionais:</label>
                <textarea
                  name="observacao"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalSuspender(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingSuspender}
                  className="rounded-lg bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700"
                >
                  {isPendingSuspender ? "Suspendendo..." : "Confirmar Suspensão"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Trocar Plano SaaS */}
      {modalTrocarPlano && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Alterar Plano SaaS da Franquia</h3>
            <form
              action={async (formData) => {
                await actionPlano(formData);
                setModalTrocarPlano(false);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="empresa_id" value={empresa.id} />
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Selecione o Novo Plano:</label>
                <select
                  name="novo_plano_id"
                  value={novoPlanoId}
                  onChange={(e) => setNovoPlanoId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  {planosDisponiveis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} — R$ {p.valor_mensal.toFixed(2)}/mês (Até {p.limite_usuarios} usuários)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Usuários Contratados:</label>
                  <input
                    name="usuarios_contratados"
                    type="number"
                    value={novosUsuarios}
                    onChange={(e) => setNovosUsuarios(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Sites Parceiros:</label>
                  <input
                    name="sites_parceiros_contratados"
                    type="number"
                    value={novosSites}
                    onChange={(e) => setNovosSites(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Domínios Próprios:</label>
                  <input
                    name="sites_dominio_proprio_contratados"
                    type="number"
                    value={novosDominios}
                    onChange={(e) => setNovosDominios(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalTrocarPlano(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingPlano}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingPlano ? "Alterando..." : "Confirmar Alteração de Plano"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Trocar Modelo de Site */}
      {modalTrocarModelo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Trocar Modelo de Site</h3>
            <form
              action={async (formData) => {
                await actionModelo(formData);
                setModalTrocarModelo(false);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="empresa_id" value={empresa.id} />
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Selecione o Modelo Publicado:</label>
                <select
                  name="novo_modelo_id"
                  value={novoModeloId}
                  onChange={(e) => setNovoModeloId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  {modelosDisponiveis.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} (v{m.versao})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalTrocarModelo(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingModelo}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingModelo ? "Trocando..." : "Confirmar Troca de Modelo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Conceder Administradora */}
      {modalConcederAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Conceder Administradora</h3>
            <form
              action={async (formData) => {
                await actionConcederAdmin(formData);
                setModalConcederAdmin(false);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="empresa_id" value={empresa.id} />
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Selecione a Administradora:</label>
                <select
                  name="administradora_id"
                  value={novaAdminId}
                  onChange={(e) => setNovaAdminId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  {adminsDisponiveis.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalConcederAdmin(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingConcederAdmin}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingConcederAdmin ? "Concedendo..." : "Conceder Administradora"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Novo Site de Parceiro */}
      {modalNovoSiteParceiro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">+ Novo Site de Parceiro</h3>
            <form
              action={async (formData) => {
                await actionSiteParceiro(formData);
                setModalNovoSiteParceiro(false);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="empresa_id" value={empresa.id} />
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Organização Parceira:</label>
                <select
                  name="organizacao_parceira_id"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  {parceiros.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Nome de Exibição do Site:</label>
                <input
                  name="nome_site"
                  required
                  placeholder="Ex: João Consórcios"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Endereço / Slug:</label>
                <input
                  name="slug"
                  required
                  placeholder="Ex: joao-consorcios"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-mono dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Canal de Acesso:</label>
                <select
                  name="canal"
                  defaultValue="SUBDOMINIO"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="SUBDOMINIO">Subdomínio da Plataforma (joao.gauchinhoconsorcios.com.br)</option>
                  <option value="DOMINIO">Domínio Próprio do Parceiro</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalNovoSiteParceiro(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingSiteParceiro}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingSiteParceiro ? "Criando..." : "Criar Site de Parceiro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
