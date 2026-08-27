"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { EmpresaEnderecoFields, type EmpresaEnderecoState } from "@/components/platform/empresa-endereco-fields";
import { formatCnpjBrInput, formatWhatsappBrInput } from "@/lib/utils/format";
import {
  atualizarDadosEmpresaPlatformAction,
  ativarEmpresaPlatformAction,
  suspenderEmpresaPlatformAction,
  reativarEmpresaPlatformAction,
  alterarPlanoEmpresaPlatformAction,
  alterarModeloEmpresaPlatformAction,
  salvarQuadroSocietarioPlatformAction,
  concederAdministradoraEmpresaPlatformAction,
  revogarAdministradoraEmpresaPlatformAction,
  criarSiteParceiroEmpresaPlatformAction,
  salvarIdentidadeSiteParceiroPlatformAction,
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
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
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
  modelo_status: string | null;
  modelo_id: string | null;
  template_codigo: string | null;
  logo_url: string | null;
  menus: { id: string; label: string; rota: string; ativo_padrao?: boolean }[];
  modelo: {
    id: string;
    codigo: string;
    nome: string;
    descricao: string | null;
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
  status_dns: string;
  status_vercel: string;
  status_ssl: string;
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
  is_responsavel_principal?: boolean;
  status?: string;
  erp_modulos_visiveis?: string[];
  convite_enviado_em?: string | null;
  created_at: string;
  usuario: {
    id: string;
    nome: string;
    email: string;
    ativo: boolean;
    ultimo_acesso: string | null;
  } | null;
  papel: {
    id: string;
    nome: string;
  } | null;
};

export type SocioHubItem = {
  id: string;
  usuario_id: string;
  nome: string;
  percentual_participacao: number;
  vigencia_inicio: string;
  observacao: string | null;
  contas: Array<{
    id: string;
    banco_nome: string | null;
    agencia: string | null;
    conta: string | null;
    tipo_chave_pix: string | null;
    chave_pix: string | null;
    favorecido: string;
    principal: boolean;
    ativo: boolean;
  }>;
};

export type ParceiroSiteDetail = {
  id: string;
  slug: string;
  nome_site: string;
  canal_principal: string;
  status_publicacao: string;
  ativo: boolean;
  template_codigo?: string;
  whatsapp?: string | null;
  branding?: {
    identidade_visual_modo?: "HERDAR_MASTER" | "PERSONALIZADA";
    logo_url?: string | null;
    cor_primaria?: string | null;
    cor_secundaria?: string | null;
    cor_destaque?: string | null;
    foto_perfil_url?: string | null;
    banner_url?: string | null;
    telefone?: string | null;
    whatsapp?: string | null;
    instagram?: string | null;
    texto_hero?: string | null;
    texto_sobre?: string | null;
  } | Record<string, unknown>;
};

export type ParceiroHubItem = {
  id: string;
  nome: string;
  status: string;
  sites: ParceiroSiteDetail[];
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
  descricao: string | null;
  identidade_visual: Record<string, unknown>;
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
  socios = [],
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
  socios: SocioHubItem[];
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
    | "sociedade"
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

  // Modais de Parceiro
  const [siteParaEditar, setSiteParaEditar] = useState<{ parceiroNome: string; site: ParceiroSiteDetail } | null>(null);
  const [siteParaPreview, setSiteParaPreview] = useState<{ parceiroNome: string; site: ParceiroSiteDetail } | null>(null);

  // States do formulário de dados da empresa
  const [nomeFantasia, setNomeFantasia] = useState(empresa.nome_fantasia);
  const [razaoSocial, setRazaoSocial] = useState(empresa.razao_social);
  const [cnpj, setCnpj] = useState(formatCnpjBrInput(empresa.cnpj ?? ""));
  const [telefone, setTelefone] = useState(formatWhatsappBrInput(empresa.telefone ?? ""));
  const [whatsapp, setWhatsapp] = useState(formatWhatsappBrInput(empresa.whatsapp ?? ""));
  const [email, setEmail] = useState(empresa.email ?? "");
  const [enderecoEmpresa, setEnderecoEmpresa] = useState<EmpresaEnderecoState>({
    cep: empresa.cep ?? "",
    endereco: empresa.endereco ?? "",
    numero: empresa.numero ?? "",
    complemento: empresa.complemento ?? "",
    bairro: empresa.bairro ?? "",
    cidade: empresa.cidade ?? "",
    estado: empresa.estado ?? "",
  });

  const [sociosEdicao, setSociosEdicao] = useState(() =>
    socios.map((socio) => {
      const conta = socio.contas.find((item) => item.ativo && item.principal) ?? socio.contas[0];
      return {
        usuario_id: socio.usuario_id,
        nome: socio.nome,
        percentual: socio.percentual_participacao,
        observacao: socio.observacao ?? "",
        banco_nome: conta?.banco_nome ?? "",
        agencia: conta?.agencia ?? "",
        conta: conta?.conta ?? "",
        tipo_chave_pix: conta?.tipo_chave_pix ?? "",
        chave_pix: conta?.chave_pix ?? "",
        favorecido: conta?.favorecido ?? socio.nome,
      };
    }),
  );

  // State para troca de plano assistida
  const [novoPlanoId, setNovoPlanoId] = useState(assinatura?.plano_id || planosDisponiveis[0]?.id || "");
  const [novosUsuarios, setNovosUsuarios] = useState(assinatura?.usuarios_contratados || 10);
  const [novosSites, setNovosSites] = useState(assinatura?.sites_parceiros_contratados || 0);
  const [novosDominios, setNovosDominios] = useState(assinatura?.sites_dominio_proprio_contratados || 0);

  // State para troca de template
  const [novoModeloId, setNovoModeloId] = useState(branding?.modelo_id || modelosDisponiveis[0]?.id || "");

  // State para concessão de administradora
  const [novaAdminId, setNovaAdminId] = useState(adminsDisponiveis[0]?.id || "");

  // State para novo site de parceiro
  const [novoSiteModoIdentidade, setNovoSiteModoIdentidade] = useState<"HERDAR_MASTER" | "PERSONALIZADA">("HERDAR_MASTER");

  // Actions
  const [stateDados, actionDados, isPendingDados] = useActionState(atualizarDadosEmpresaPlatformAction, initial);
  const [stateAtivar, actionAtivar, isPendingAtivar] = useActionState(ativarEmpresaPlatformAction, initial);
  const [stateSuspender, actionSuspender, isPendingSuspender] = useActionState(suspenderEmpresaPlatformAction, initial);
  const [stateReativar, actionReativar, isPendingReativar] = useActionState(reativarEmpresaPlatformAction, initial);
  const [statePlano, actionPlano, isPendingPlano] = useActionState(alterarPlanoEmpresaPlatformAction, initial);
  const [stateModelo, actionModelo, isPendingModelo] = useActionState(alterarModeloEmpresaPlatformAction, initial);
  const [stateQuadro, actionQuadro, isPendingQuadro] = useActionState(salvarQuadroSocietarioPlatformAction, initial);
  const [stateConcederAdmin, actionConcederAdmin, isPendingConcederAdmin] = useActionState(concederAdministradoraEmpresaPlatformAction, initial);
  const [stateRevogarAdmin, actionRevogarAdmin, isPendingRevogarAdmin] = useActionState(revogarAdministradoraEmpresaPlatformAction, initial);
  const [stateSiteParceiro, actionSiteParceiro, isPendingSiteParceiro] = useActionState(criarSiteParceiroEmpresaPlatformAction, initial);
  const [stateIdentidadeSite, actionIdentidadeSite, isPendingIdentidadeSite] = useActionState(salvarIdentidadeSiteParceiroPlatformAction, initial);

  // Cálculos de Entitlements & Limites
  const planoAtual = assinatura?.plano;
  const configJson = (empresa.configuracoes as Record<string, unknown> | null) ?? {};
  const erpConfig = configJson.erp_sistema as { habilitado?: boolean } | undefined;
  const erpHabilitado = Boolean(erpConfig?.habilitado);
  const sitePublicoConfig = configJson.site_publico as { operacional_habilitado?: boolean } | undefined;
  const siteOperacionalHabilitado = Boolean(sitePublicoConfig?.operacional_habilitado);

  const totalUsuariosUsados = usuarios.filter((u) => u.ativo).length;
  const totalParticipacaoSocietaria = sociosEdicao.reduce((total, socio) => total + Number(socio.percentual || 0), 0);
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
      ok: Boolean(branding?.modelo),
      desc: branding?.modelo?.nome || "Nenhum modelo vinculado",
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
            {empresa.razao_social} • CNPJ: {empresa.cnpj ? formatCnpjBrInput(empresa.cnpj) : "Não informado"} • Slug:{" "}
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
          ["sociedade", `6. Sociedade (${socios.length})`],
          ["administradoras", `7. Administradoras (${adminsAtivas.length})`],
          ["site", "8. Site & Identidade"],
          ["dominios", `9. Domínios (${dominios.length})`],
          ["parceiros", `10. Parceiros & Sites (${totalParceirosCadastrados})`],
          ["historico", "11. Histórico"],
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
                <strong>{branding?.modelo?.nome || "Não configurado"}</strong>
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

          {/* Card Overrides & Exceções Ativas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3 text-xs md:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Overrides & Exceções Ativas ({overrides.length})
                </h3>
                <p className="text-slate-500">Concessões comerciais e limites específicos aplicados a esta Master Franquia.</p>
              </div>
              <Link
                href="/platform/overrides"
                className="rounded-lg bg-cyan-700 px-3.5 py-1.5 font-bold text-white shadow hover:bg-cyan-800 transition-colors"
              >
                Gerenciar Overrides →
              </Link>
            </div>
            {overrides.length === 0 ? (
              <p className="text-slate-400 font-medium">Nenhum override de exceção ativo para esta empresa (seguindo padrão do plano).</p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {overrides.map((o) => (
                  <span
                    key={o.id}
                    className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold ${
                      o.efeito === "LIBERAR"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-300"
                    }`}
                  >
                    {o.efeito === "LIBERAR" ? "✓" : "✕"} {o.recurso_codigo} ({o.motivo})
                  </span>
                ))}
              </div>
            )}
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
                onChange={(e) => setCnpj(formatCnpjBrInput(e.target.value))}
                inputMode="numeric"
                maxLength={18}
                placeholder="00.000.000/0001-00"
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
                onChange={(e) => setTelefone(formatWhatsappBrInput(e.target.value))}
                inputMode="tel"
                maxLength={15}
                placeholder="(65) 3333-4444"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">WhatsApp Comercial:</label>
              <input
                name="whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhatsappBrInput(e.target.value))}
                inputMode="tel"
                maxLength={15}
                placeholder="(65) 99999-9999"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

          </div>

          <EmpresaEnderecoFields values={enderecoEmpresa} onChange={(patch) => setEnderecoEmpresa((atual) => ({ ...atual, ...patch }))} />

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
            <Link
              href={`/platform/usuarios?empresa_id=${empresa.id}&novo=1&retorno=${encodeURIComponent(`/platform/empresas/${empresa.id}`)}`}
              className="rounded-lg bg-cyan-700 px-3.5 py-1.5 font-bold text-white shadow hover:bg-cyan-800 transition-colors"
            >
              + Cadastrar usuário nesta Master
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">E-mail</th>
                  <th className="p-3">Papel</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Responsável</th>
                  <th className="p-3">Módulos Efetivos</th>
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
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                          (u.status || (u.ativo ? "ATIVO" : "INATIVO")) === "ATIVO"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : (u.status || "") === "CONVIDADO"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {u.status || (u.ativo ? "ATIVO" : "INATIVO")}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {u.is_responsavel_principal ? (
                        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-black text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                          ⭐ Principal
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.erp_modulos_visiveis && u.erp_modulos_visiveis.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {u.erp_modulos_visiveis.map((m) => (
                            <span
                              key={m}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">Todos do Plano</span>
                      )}
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
          ABA 6: SOCIEDADE
      ─────────────────────────────────────────────────────────── */}
      {tab === "sociedade" && (
        <form action={actionQuadro} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <input type="hidden" name="empresa_id" value={empresa.id} />
          <input type="hidden" name="socios_json" value={JSON.stringify(sociosEdicao)} />
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Quadro societário da empresa</h3>
              <p className="mt-1 max-w-3xl text-xs text-slate-500">
                Esta configuração define quem participa da equalização financeira no ERP. Cada sócio precisa ser um usuário ativo desta empresa; alterações criam uma nova vigência e preservam os fechamentos anteriores.
              </p>
            </div>
            <div className={`rounded-xl px-4 py-2 text-center ${Math.abs(totalParticipacaoSocietaria - 100) < 0.0001 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
              <p className="text-[10px] font-bold uppercase">Participação total</p>
              <p className="text-xl font-black">{totalParticipacaoSocietaria.toFixed(2)}%</p>
            </div>
          </div>

          {stateQuadro.message && (
            <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${stateQuadro.status === "SUCCESS" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
              {stateQuadro.message}
            </div>
          )}

          <div className="space-y-4">
            {sociosEdicao.map((socio, index) => (
              <article key={`${socio.usuario_id}-${index}`} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
                  <label className="space-y-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                    Usuário / sócio
                    <select
                      value={socio.usuario_id}
                      onChange={(event) => {
                        const escolhido = usuarios.find((item) => item.usuario_id === event.target.value);
                        setSociosEdicao((atual) => atual.map((item, posicao) => posicao === index ? { ...item, usuario_id: event.target.value, nome: escolhido?.usuario?.nome ?? item.nome, favorecido: escolhido?.usuario?.nome ?? item.favorecido } : item));
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="">Selecione um usuário ativo</option>
                      {usuarios.filter((item) => item.ativo && item.usuario).map((item) => (
                        <option key={item.usuario_id} value={item.usuario_id}>{item.usuario?.nome} — {item.usuario?.email}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                    Participação (%)
                    <input
                      type="number" min="0.0001" max="100" step="0.0001"
                      value={socio.percentual}
                      onChange={(event) => setSociosEdicao((atual) => atual.map((item, posicao) => posicao === index ? { ...item, percentual: Number(event.target.value) } : item))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950"
                    />
                  </label>
                  <button type="button" onClick={() => setSociosEdicao((atual) => atual.filter((_, posicao) => posicao !== index))} className="self-end rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50">
                    Remover
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="space-y-1 text-xs font-bold text-slate-700 dark:text-slate-300">Banco
                    <input value={socio.banco_nome} onChange={(event) => setSociosEdicao((atual) => atual.map((item, posicao) => posicao === index ? { ...item, banco_nome: event.target.value } : item))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" placeholder="Ex.: Sicredi" />
                  </label>
                  <label className="space-y-1 text-xs font-bold text-slate-700 dark:text-slate-300">Agência
                    <input value={socio.agencia} onChange={(event) => setSociosEdicao((atual) => atual.map((item, posicao) => posicao === index ? { ...item, agencia: event.target.value } : item))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
                  </label>
                  <label className="space-y-1 text-xs font-bold text-slate-700 dark:text-slate-300">Conta
                    <input value={socio.conta} onChange={(event) => setSociosEdicao((atual) => atual.map((item, posicao) => posicao === index ? { ...item, conta: event.target.value } : item))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
                  </label>
                  <label className="space-y-1 text-xs font-bold text-slate-700 dark:text-slate-300">Tipo de chave Pix
                    <select value={socio.tipo_chave_pix} onChange={(event) => setSociosEdicao((atual) => atual.map((item, posicao) => posicao === index ? { ...item, tipo_chave_pix: event.target.value } : item))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950">
                      <option value="">Não informado</option><option value="CPF_CNPJ">CPF/CNPJ</option><option value="EMAIL">E-mail</option><option value="TELEFONE">Telefone</option><option value="ALEATORIA">Aleatória</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-bold text-slate-700 dark:text-slate-300">Chave Pix
                    <input value={socio.chave_pix} onChange={(event) => setSociosEdicao((atual) => atual.map((item, posicao) => posicao === index ? { ...item, chave_pix: event.target.value } : item))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
                  </label>
                  <label className="space-y-1 text-xs font-bold text-slate-700 dark:text-slate-300">Favorecido
                    <input value={socio.favorecido} onChange={(event) => setSociosEdicao((atual) => atual.map((item, posicao) => posicao === index ? { ...item, favorecido: event.target.value } : item))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950" />
                  </label>
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                const disponivel = usuarios.find((item) => item.ativo && item.usuario && !sociosEdicao.some((socio) => socio.usuario_id === item.usuario_id));
                if (!disponivel?.usuario) return;
                setSociosEdicao((atual) => [...atual, { usuario_id: disponivel.usuario_id, nome: disponivel.usuario!.nome, percentual: 0, observacao: "", banco_nome: "", agencia: "", conta: "", tipo_chave_pix: "", chave_pix: "", favorecido: disponivel.usuario!.nome }]);
              }}
              className="rounded-lg border border-cyan-200 px-4 py-2 text-xs font-bold text-cyan-800 hover:bg-cyan-50"
            >
              + Adicionar sócio
            </button>
            <button type="submit" disabled={isPendingQuadro || sociosEdicao.length === 0 || Math.abs(totalParticipacaoSocietaria - 100) >= 0.0001} className="rounded-lg bg-cyan-700 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50">
              {isPendingQuadro ? "Salvando nova vigência..." : "Salvar quadro societário"}
            </button>
          </div>
        </form>
      )}

      {/* ───────────────────────────────────────────────────────────
          ABA 7: ADMINISTRADORAS
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Template de Site & Identidade</h3>
              <p className="text-slate-500">Escolha explícita e isolada por empresa; não altera os sites das demais franquias.</p>
            </div>
            <button
              type="button"
              onClick={() => setModalTrocarModelo(true)}
              className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white shadow hover:bg-cyan-800"
            >
              🎨 Trocar Modelo de Site
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className={`rounded-xl border p-4 space-y-2 ${branding?.modelo ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20" : "border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20"}`}>
              <span className="font-bold uppercase tracking-wide text-slate-500">Modelo em uso</span>
              <p className="text-lg font-black text-slate-900 dark:text-white">
                {branding?.modelo?.nome || "Não configurado"}
              </p>
              <p className="font-mono text-[11px] text-slate-500">{branding?.template_codigo || "sem-vinculo"}</p>
              {branding?.modelo?.descricao ? <p className="text-slate-600 dark:text-slate-300">{branding.modelo.descricao}</p> : null}
            </div>

            <div className="rounded-xl border p-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
              <span className="font-bold uppercase tracking-wide text-slate-500">Publicação</span>
              <p className="text-lg font-black text-slate-900 dark:text-white">Site: {branding?.status_publicacao || "NÃO CONFIGURADO"}</p>
              <p className="text-slate-500">Vínculo do modelo: {branding?.modelo_status || "AUSENTE"}</p>
              <p className="text-slate-500">Versão: {branding?.modelo?.versao ? `v${branding.modelo.versao}` : "—"}</p>
            </div>

            <div className="rounded-xl border p-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
              <span className="font-bold uppercase tracking-wide text-slate-500">Runtime e domínio</span>
              <p className="text-lg font-black text-slate-900 dark:text-white">
                {siteOperacionalHabilitado ? "Site operacional" : "Site institucional"}
              </p>
              <p className="font-mono text-[11px] text-slate-500">{dominioPrincipal || "Domínio não configurado"}</p>
              {dominioPrincipal ? (
                <a href={`https://${dominioPrincipal}`} target="_blank" rel="noreferrer" className="inline-flex font-bold text-cyan-700 hover:underline">
                  Abrir site público ↗
                </a>
              ) : null}
            </div>
          </div>

          <p className="rounded-lg bg-sky-50 p-3 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
            A troca afeta somente esta empresa. O modelo define o layout; cores, logotipo e textos continuam no cadastro de identidade da franquia.
          </p>
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
                  <th className="p-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dominios.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
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
                      <td className="p-3 text-center">
                        <Link href={`/platform/dominios?empresa_id=${empresa.id}&dominio_id=${d.id}`} className="rounded bg-cyan-50 px-2.5 py-1 font-bold text-cyan-800 hover:bg-cyan-100">
                          Editar / configurar DNS
                        </Link>
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

          {stateIdentidadeSite.message && (
            <p
              role="status"
              className={`rounded-lg p-3 text-xs font-bold ${
                stateIdentidadeSite.status === "SUCCESS"
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
              }`}
            >
              {stateIdentidadeSite.message}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="p-3">Parceiro</th>
                  <th className="p-3">Modelo de Site</th>
                  <th className="p-3 text-center">Identidade Visual</th>
                  <th className="p-3">Domínio / Canal</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {parceiros.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400 font-medium">
                      Nenhum parceiro cadastrado para esta franquia.
                    </td>
                  </tr>
                ) : (
                  parceiros.map((p) =>
                    p.sites.map((s) => {
                      const brandingModo = (s.branding as Record<string, unknown> | undefined)?.identidade_visual_modo;
                      const isPersonalizada = brandingModo === "PERSONALIZADA";

                      return (
                        <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{p.nome}</td>
                          <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                            {branding?.modelo?.nome || "Racon Inspired"}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                                isPersonalizada
                                  ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                              }`}
                            >
                              {isPersonalizada ? "Personalizada" : "Herdada da Master"}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-500">
                            {s.canal_principal === "DOMINIO" ? "Domínio Próprio" : `/${s.slug}`}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                s.status_publicacao === "PUBLICADO"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                              }`}
                            >
                              {s.status_publicacao}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSiteParaPreview({ parceiroNome: p.nome, site: s })}
                                className="rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                              >
                                👁️ Visualizar Site
                              </button>
                              <button
                                type="button"
                                onClick={() => setSiteParaEditar({ parceiroNome: p.nome, site: s })}
                                className="rounded bg-cyan-700 px-2.5 py-1 text-xs font-bold text-white shadow hover:bg-cyan-800"
                              >
                                🎨 Identidade Visual
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }),
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
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Modelo do site de {empresa.nome_fantasia}</h3>
              <p className="mt-1 text-slate-500">Selecione um modelo publicado. Nenhuma outra franquia será alterada.</p>
            </div>
            <form
              action={async (formData) => {
                await actionModelo(formData);
                setModalTrocarModelo(false);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="empresa_id" value={empresa.id} />
              <input type="hidden" name="novo_modelo_id" value={novoModeloId} />
              <div className="grid gap-3 sm:grid-cols-2">
                {modelosDisponiveis.map((m) => {
                  const selecionado = novoModeloId === m.id;
                  const cores = m.identidade_visual;
                  return (
                    <button key={m.id} type="button" onClick={() => setNovoModeloId(m.id)} className={`rounded-xl border p-4 text-left transition ${selecionado ? "border-cyan-600 bg-cyan-50 ring-2 ring-cyan-200 dark:bg-cyan-950/30" : "border-slate-200 hover:border-cyan-300 dark:border-slate-700"}`}>
                      <div className="mb-3 flex gap-1.5">
                        {[cores.cor_primaria, cores.cor_secundaria, cores.cor_destaque].map((cor, idx) => (
                          <span key={idx} className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: typeof cor === "string" ? cor : "#e2e8f0" }} />
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm text-slate-900 dark:text-white">{m.nome}</strong>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] dark:bg-slate-800">v{m.versao}</span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-slate-500">{m.descricao || "Modelo publicado disponível para a franquia."}</p>
                      <p className="mt-2 font-mono text-[10px] text-slate-400">{m.codigo}</p>
                      {selecionado ? <p className="mt-2 font-bold text-cyan-700">✓ Selecionado</p> : null}
                    </button>
                  );
                })}
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
                  disabled={isPendingModelo || !novoModeloId || novoModeloId === branding?.modelo_id}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPendingModelo
                    ? "Trocando..."
                    : novoModeloId === branding?.modelo_id
                      ? "Modelo já está em uso"
                      : "Aplicar somente nesta empresa"}
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
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
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

              {/* Modo de Identidade Visual */}
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 space-y-2">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">Identidade Visual:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="identidade_visual_modo"
                      value="HERDAR_MASTER"
                      checked={novoSiteModoIdentidade === "HERDAR_MASTER"}
                      onChange={() => setNovoSiteModoIdentidade("HERDAR_MASTER")}
                      className="text-cyan-600"
                    />
                    <span>Herdar da Master Franquia</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="identidade_visual_modo"
                      value="PERSONALIZADA"
                      checked={novoSiteModoIdentidade === "PERSONALIZADA"}
                      onChange={() => setNovoSiteModoIdentidade("PERSONALIZADA")}
                      className="text-cyan-600"
                    />
                    <span>Personalizar este site</span>
                  </label>
                </div>

                {novoSiteModoIdentidade === "PERSONALIZADA" && (
                  <div className="pt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Logo Própria (URL):</label>
                      <input
                        name="logo_url"
                        placeholder="https://..."
                        className="mt-1 w-full rounded border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Cor Primária:</label>
                      <input
                        name="cor_primaria"
                        placeholder="#0A1628"
                        className="mt-1 w-full rounded border border-slate-300 p-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>
                )}
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

      {/* ───────────────────────────────────────────────────────────
          MODAL: EDITAR IDENTIDADE VISUAL DO SITE DE PARCEIRO
      ─────────────────────────────────────────────────────────── */}
      {siteParaEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Identidade Visual — {siteParaEditar.site.nome_site}
                </h3>
                <p className="text-xs text-slate-500 font-semibold">Parceiro: {siteParaEditar.parceiroNome}</p>
              </div>
              <button
                type="button"
                onClick={() => setSiteParaEditar(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form
              action={async (formData) => {
                await actionIdentidadeSite(formData);
                setSiteParaEditar(null);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="site_id" value={siteParaEditar.site.id} />
              <input type="hidden" name="empresa_id" value={empresa.id} />

              <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/40 space-y-2">
                <label className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                  Modo de Identidade Visual:
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="radio"
                      name="identidade_visual_modo"
                      value="HERDAR_MASTER"
                      defaultChecked={
                        ((siteParaEditar.site.branding as Record<string, unknown> | undefined)?.identidade_visual_modo ?? "HERDAR_MASTER") === "HERDAR_MASTER"
                      }
                      className="text-cyan-600"
                    />
                    <span>Herdar da Master Franquia (Usa logo e paleta de cores da Master)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="radio"
                      name="identidade_visual_modo"
                      value="PERSONALIZADA"
                      defaultChecked={
                        (siteParaEditar.site.branding as Record<string, unknown> | undefined)?.identidade_visual_modo === "PERSONALIZADA"
                      }
                      className="text-cyan-600"
                    />
                    <span>Personalizar este site (Overrides exclusivos para este parceiro)</span>
                  </label>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Logo do Parceiro (URL):</label>
                  <input
                    name="logo_url"
                    defaultValue={String((siteParaEditar.site.branding as Record<string, unknown> | undefined)?.logo_url ?? "")}
                    placeholder="https://..."
                    className="mt-1 w-full rounded border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Foto / Banner Hero (URL):</label>
                  <input
                    name="banner_url"
                    defaultValue={String((siteParaEditar.site.branding as Record<string, unknown> | undefined)?.banner_url ?? "")}
                    placeholder="https://..."
                    className="mt-1 w-full rounded border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Cor Primária (#HEX):</label>
                  <input
                    name="cor_primaria"
                    defaultValue={String((siteParaEditar.site.branding as Record<string, unknown> | undefined)?.cor_primaria ?? "")}
                    placeholder="#0A1628"
                    className="mt-1 w-full rounded border border-slate-300 p-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Cor Secundária (#HEX):</label>
                  <input
                    name="cor_secundaria"
                    defaultValue={String((siteParaEditar.site.branding as Record<string, unknown> | undefined)?.cor_secundaria ?? "")}
                    placeholder="#0D1F3C"
                    className="mt-1 w-full rounded border border-slate-300 p-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Cor de Destaque (#HEX):</label>
                  <input
                    name="cor_destaque"
                    defaultValue={String((siteParaEditar.site.branding as Record<string, unknown> | undefined)?.cor_destaque ?? "")}
                    placeholder="#C9A84C"
                    className="mt-1 w-full rounded border border-slate-300 p-2 font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">WhatsApp de Contato:</label>
                  <input
                    name="whatsapp"
                    defaultValue={String((siteParaEditar.site.branding as Record<string, unknown> | undefined)?.whatsapp ?? siteParaEditar.site.whatsapp ?? "")}
                    placeholder="Ex: 51999999999"
                    className="mt-1 w-full rounded border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Texto de Apresentação / Hero:</label>
                <input
                  name="texto_hero"
                  defaultValue={String((siteParaEditar.site.branding as Record<string, unknown> | undefined)?.texto_hero ?? "")}
                  placeholder="Ex: Consultor Especialista em Consórcios Imobiliários"
                  className="mt-1 w-full rounded border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSiteParaEditar(null)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingIdentidadeSite}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingIdentidadeSite ? "Salvando..." : "Salvar Identidade Visual"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          MODAL: PREVIEW DO SITE DE PARCEIRO
      ─────────────────────────────────────────────────────────── */}
      {siteParaPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Preview — {siteParaPreview.site.nome_site}
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Modelo: {branding?.modelo?.nome || "Racon Inspired"} | Franquia: {empresa.nome_fantasia}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSiteParaPreview(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Resumo da Herança Efetiva */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-700 dark:text-slate-300">Modo de Identidade:</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                    (siteParaPreview.site.branding as Record<string, unknown> | undefined)?.identidade_visual_modo === "PERSONALIZADA"
                      ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {(siteParaPreview.site.branding as Record<string, unknown> | undefined)?.identidade_visual_modo === "PERSONALIZADA"
                    ? "Personalizada (Overrides Ativos)"
                    : "Herdada da Master Franquia"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                <div className="p-2 rounded bg-white dark:bg-slate-800">
                  <span className="text-slate-500 block text-[10px]">Cor Primária:</span>
                  <strong>
                    {String(
                      (siteParaPreview.site.branding as Record<string, unknown> | undefined)?.cor_primaria ||
                        "Herdada (#0A1628)",
                    )}
                  </strong>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-800">
                  <span className="text-slate-500 block text-[10px]">Cor Secundária:</span>
                  <strong>
                    {String(
                      (siteParaPreview.site.branding as Record<string, unknown> | undefined)?.cor_secundaria ||
                        "Herdada (#0D1F3C)",
                    )}
                  </strong>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-800">
                  <span className="text-slate-500 block text-[10px]">Cor de Destaque:</span>
                  <strong>
                    {String(
                      (siteParaPreview.site.branding as Record<string, unknown> | undefined)?.cor_destaque ||
                        "Herdada (#C9A84C)",
                    )}
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-dashed border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 text-center space-y-1">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  Estrutura Visual: {branding?.modelo?.nome || "Racon Inspired"}
                </p>
                <p className="text-slate-500 text-[11px]">
                  O layout estrutural permanece íntegro do template global da Master Franquia, aplicando apenas os tokens de marca deste parceiro.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSiteParaPreview(null)}
                className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
              >
                Fechar Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
