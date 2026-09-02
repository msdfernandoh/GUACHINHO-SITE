import Link from "next/link";
import Leads from "@/app/admin/leads/page";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { CommissionRuleManager } from "@/components/erp/commission-rule-manager";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { listAdministradoraIdsAutorizadasForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";
import { notFound } from "next/navigation";
import {
  deleteCommissionProgramAction,
  deleteCommissionRuleAction,
  homologateFranchiseRuleAction,
  homologateParticipantRuleAction,
  homologarRegraPadraoOficialAction,
  newCommissionProgramVersionAction,
  newCommissionRuleVersionAction,
  toggleCommissionProgramAction,
  toggleCommissionRuleAction,
} from "@/app/erp/regras-comissao/actions";
import { FiscalCommissionConfig } from "@/components/erp/fiscal-commission-config";
import { ConfirmSubmitButton } from "@/components/erp/confirm-submit-button";
import { ReceiptManager } from "@/components/erp/receipt-manager";
import { RepasseFranquiaView, type SolicitacaoRepasseItem } from "@/components/erp/repasse-franquia-view";
import { RepassePdfConciliacao, type RepassePdfImportacao, type RepassePrevisaoAberta, type RepasseParticipante, type RepasseRegraParticipante, type RepasseGrupo, type RepasseAtencaoResolucao } from "@/components/erp/repasse-pdf-conciliacao";
import {
  BidStrategyTable,
  type BidRow,
} from "@/components/erp/bid-strategy-table";

const cardClass =
  "rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow";

function HubLinks({
  links,
}: {
  links: Array<{ href: string; title: string; description: string }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className={cardClass}>
          <p className="font-semibold text-slate-900">{link.title}</p>
          <p className="mt-1 text-sm text-slate-500">{link.description}</p>
        </Link>
      ))}
    </div>
  );
}

export async function ErpClientesPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
          Comercial
        </p>
        <h1 className="text-3xl font-bold">Clientes e carteira</h1>
        <p className="mt-1 text-slate-500">
          Visao unica do relacionamento, da oportunidade ate a cota efetivada.
        </p>
      </header>
      <HubLinks
        links={[
          {
            href: "/erp/leads",
            title: "Leads e CRM",
            description: "Prospeccao, responsavel e proximo contato.",
          },
          {
            href: "/erp/propostas",
            title: "Propostas",
            description: "Propostas em andamento e enviadas.",
          },
          {
            href: "/erp/contratacoes",
            title: "Contratacoes",
            description: "Solicitacoes formalizadas pelo cliente.",
          },
          {
            href: "/erp/vendas",
            title: "Cotas do cliente",
            description: "Vendas, cotas e situacao comercial.",
          },
        ]}
      />
      <div className="border-t border-slate-200 pt-6">
        <Leads searchParams={Promise.resolve({})} />
      </div>
    </div>
  );
}

import {
  fetchCotasComLancesOperacional,
} from "@/app/erp/lances/actions";
import { ErpLancesView } from "@/components/erp/erp-lances-view";

export async function ErpLancesPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  let stats = {
    totalCotas: 0,
    comLanceAtivo: 0,
    semEstrategia: 0,
    vencendoTrintaDias: 0,
    vencidos: 0,
    contempladas: 0,
  };
  let rows: any[] = [];
  let empresaId = "";

  try {
    const filters = await searchParams;
    const res = await fetchCotasComLancesOperacional({
      busca: filters.busca,
      administradora: filters.administradora,
      tipo: filters.tipo,
      statusCota: filters.status,
      situacaoLance: filters.estrategia,
    });
    stats = res.stats;
    rows = res.rows;
    empresaId = res.empresaId;
  } catch (error) {
    console.error("Erro ao carregar lances no ERP:", error);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
          Consórcio &amp; Operação
        </p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Lances e Estratégias</h1>
        <p className="mt-1 text-slate-500">
          Controle operacional de todas as cotas definitivas vendidas da Master Franquia.
        </p>
      </header>

      <ErpLancesView
        empresaId={empresaId}
        initialStats={stats}
        initialRows={rows}
      />
    </div>
  );
}

type ProgramaRow = {
  id: string;
  nome: string;
  ativo: boolean;
  administradora_id: string | null;
  versao: number;
  status: string;
};
type RegraFranquiaRow = {
  id: string;
  programa_id: string;
  versao: number;
  base_calculo: string | null;
  percentual_total_comissao: number | null;
  valor_fixo_total: number | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  modalidade: string | null;
  ativa: boolean;
  configuracao_homologada: boolean;
  etapas_cronograma: unknown;
  tipo_administradora_id: string | null;
  modalidade_comissao_id: string | null;
};
type RegraParticipanteRow = {
  id: string;
  programa_id: string;
  versao: number;
  base_calculo: string | null;
  percentual_comissao: number | null;
  valor_fixo_total: number | null;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  tipo_participante: string | null;
  ativa: boolean;
  configuracao_homologada: boolean;
  etapas_cronograma: unknown;
  base_v2: string | null;
  tipo_administradora_id: string | null;
  modalidade_comissao_id: string | null;
  participante_comercial_id: string | null;
  modo_regra: string;
  fonte_comissao: string;
  participante: { nome: string; nome_exibicao: string | null }[] | null;
};
type GrupoRegraRow = {
  id: string;
  codigo_grupo: string;
  administradora: string | null;
  administradora_id: string | null;
};
type CotaRegraRow = { id: string; grupo_id: string; valor_credito: number };

function money(value: number | null) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
}
function ruleValue(
  base: string | null,
  percent: number | null,
  fixed: number | null,
) {
  return base === "valor_fixo"
    ? money(fixed)
    : percent == null
      ? "—"
      : `${Number(percent).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`;
}
function stages(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export async function ErpRegrasComissaoPage() {
  const { empresaAtiva } = await getCurrentTenantContext();
  const supabase = await createClient();
  if (!empresaAtiva) notFound();
  const empresaId = empresaAtiva.id;
  const administradoraIdsAutorizadas = empresaId
    ? await listAdministradoraIdsAutorizadasForEmpresa(empresaId)
    : [];
  const administradoraIdsConsulta = administradoraIdsAutorizadas.length
    ? administradoraIdsAutorizadas
    : ["00000000-0000-0000-0000-000000000000"];
  const [
    programasResult,
    franquiaResult,
    participantesResult,
    gruposResult,
    cotasResult,
    tiposResult,
    modalidadesResult,
    participantesCatalogoResult,
    fiscaisResult,
    canWriteResult,
    platformSuperadmin,
  ] = await Promise.all([
    supabase
      .from("comissao_programas")
      .select("id,nome,ativo,administradora_id,versao,status")
      .eq("empresa_id", empresaId)
      .order("nome"),
    supabase
      .from("comissao_regras_franquia")
      .select(
        "id,programa_id,versao,base_calculo,percentual_total_comissao,valor_fixo_total,vigencia_inicio,vigencia_fim,modalidade,ativa,configuracao_homologada,etapas_cronograma,tipo_administradora_id,modalidade_comissao_id",
      )
      .eq("empresa_id", empresaId)
      .order("vigencia_inicio", { ascending: false }),
    supabase
      .from("comissao_regras_participantes")
      .select(
        "id,programa_id,versao,base_calculo,percentual_comissao,valor_fixo_total,vigencia_inicio,vigencia_fim,tipo_participante,ativa,configuracao_homologada,etapas_cronograma,base_v2,tipo_administradora_id,modalidade_comissao_id,participante_comercial_id,modo_regra,fonte_comissao,participante:participantes_comerciais(nome,nome_exibicao)",
      )
      .eq("empresa_id", empresaId)
      .order("vigencia_inicio", { ascending: false }),
    supabase
      .from("grupos_consorcio")
      .select("id,codigo_grupo,administradora,administradora_id")
      .in("administradora_id", administradoraIdsConsulta)
      .eq("ativo", true)
      .not("administradora_id", "is", null)
      .order("codigo_grupo"),
    supabase
      .from("grupos_cotas")
      .select("id,grupo_id,valor_credito")
      .eq("ativo", true)
      .order("valor_credito"),
    supabase
      .from("administradora_tipos")
      .select("id,nome,administradora_id")
      .in("administradora_id", administradoraIdsConsulta)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("administradora_modalidades_comissao")
      .select("id,nome,administradora_id")
      .in("administradora_id", administradoraIdsConsulta)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("participantes_comerciais")
      .select("id,nome,nome_exibicao")
      .eq("empresa_id", empresaId)
      .ilike("status", "ativo")
      .order("nome"),
    supabase
      .from("empresa_configuracoes_fiscais")
      .select(
        "id,percentual_imposto,vigencia_inicio,vigencia_fim,participante_exibe_detalhes_fiscais,ativo",
      )
      .eq("empresa_id", empresaId)
      .order("vigencia_inicio", { ascending: false }),
    supabase.rpc("can_write_tenant_internal", { p_empresa_id: empresaId }),
    isPlatformSuperadmin(),
  ]);
  const programas = (programasResult.data ?? []) as ProgramaRow[];
  const franquia = (franquiaResult.data ?? []) as RegraFranquiaRow[];
  const participantes = (participantesResult.data ??
    []) as RegraParticipanteRow[];
  const grupos = (gruposResult.data ?? []) as GrupoRegraRow[];
  const cotas = (cotasResult.data ?? []) as CotaRegraRow[];
  const nomes = new Map(programas.map((item) => [item.id, item.nome]));
  const tiposNomes = new Map(
    (tiposResult.data ?? []).map((item) => [item.id, item.nome]),
  );
  const modalidadesNomes = new Map(
    (modalidadesResult.data ?? []).map((item) => [item.id, item.nome]),
  );
  const franquiaPercentuais = new Map(
    franquia
      .filter((row) => row.percentual_total_comissao)
      .map((row) => [
        `${row.programa_id}:${row.tipo_administradora_id ?? "*"}:${row.modalidade_comissao_id ?? "*"}`,
        Number(row.percentual_total_comissao),
      ]),
  );
  const grupoById = new Map(grupos.map((grupo) => [grupo.id, grupo]));
  const administradoras = Array.from(
    new Map(
      grupos
        .filter((grupo) => grupo.administradora_id)
        .map((grupo) => [
          grupo.administradora_id!,
          {
            id: grupo.administradora_id!,
            nome:
              grupo.administradora ||
              `Administradora ${grupo.administradora_id!.slice(0, 8)}`,
          },
        ]),
    ).values(),
  );
  const cotaOptions = cotas.flatMap((cota) => {
    const grupo = grupoById.get(cota.grupo_id);
    if (!grupo?.administradora_id) return [];
    return [
      {
        id: cota.id,
        administradoraId: grupo.administradora_id,
        label: `Grupo ${grupo.codigo_grupo} · ${money(Number(cota.valor_credito))}`,
      },
    ];
  });
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
          Motor canonico 060-063 + extensão V2
        </p>
        <h1 className="text-3xl font-bold">Programas de comissão</h1>
        <p className="mt-1 text-slate-500">
          Programas → Franqueadora → Participantes → Histórico. Percentuais da
          Franqueadora são informados diretamente sobre o valor vendido.
        </p>
      </header>
      {canWriteResult.data ? (
        <>
          <FiscalCommissionConfig
            empresaId={empresaId}
            configs={fiscaisResult.data ?? []}
          />
          <CommissionRuleManager
            empresaId={empresaId}
            programas={programas.map(({ id, nome, administradora_id }) => ({
              id,
              nome,
              administradora_id,
            }))}
            administradoras={administradoras}
            cotas={cotaOptions}
            tipos={(tiposResult.data ?? []).map((item) => ({
              id: item.id,
              nome: item.nome,
              administradoraId: item.administradora_id,
            }))}
            modalidades={(modalidadesResult.data ?? []).map((item) => ({
              id: item.id,
              nome: item.nome,
              administradoraId: item.administradora_id,
            }))}
            participantes={(participantesCatalogoResult.data ?? []).map(
              (item) => ({
                id: item.id,
                nome: item.nome_exibicao || item.nome,
              }),
            )}
            officialSetup={false}
          />
        </>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Você pode consultar as regras, mas somente o administrador da empresa
          ou o Platform Superadmin pode cadastrar novas versões.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={cardClass}>
          <p className="text-sm text-slate-500">Programas</p>
          <p className="text-3xl font-bold">{programas.length}</p>
        </div>
        <div className={cardClass}>
          <p className="text-sm text-slate-500">Regras da Franqueadora</p>
          <p className="text-3xl font-bold">{franquia.length}</p>
        </div>
        <div className={cardClass}>
          <p className="text-sm text-slate-500">Regras de participantes</p>
          <p className="text-3xl font-bold">{participantes.length}</p>
        </div>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Programas criados</h2>
        </div>
        <div className="divide-y">
          {programas.map((programa) => (
            <div
              key={programa.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="font-bold">
                  {programa.nome}{" "}
                  <span className="text-xs text-slate-400">
                    v{programa.versao}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  {programa.status} · histórico preservado
                </p>
              </div>
              <div className="flex gap-2">
                <form action={newCommissionProgramVersionAction}>
                  <input type="hidden" name="empresa_id" value={empresaId} />
                  <input type="hidden" name="programa_id" value={programa.id} />
                  <button className="rounded-lg border px-3 py-1.5 text-xs font-bold">
                    Nova versão
                  </button>
                </form>
                <form action={toggleCommissionProgramAction}>
                  <input type="hidden" name="empresa_id" value={empresaId} />
                  <input type="hidden" name="programa_id" value={programa.id} />
                  <input
                    type="hidden"
                    name="ativo"
                    value={programa.ativo ? "false" : "true"}
                  />
                  <button className="rounded-lg border px-3 py-1.5 text-xs font-bold">
                    {programa.ativo ? "Inativar" : "Ativar"}
                  </button>
                </form>
                <form action={deleteCommissionProgramAction}>
                  <input type="hidden" name="empresa_id" value={empresaId} />
                  <input type="hidden" name="programa_id" value={programa.id} />
                  <ConfirmSubmitButton
                    message={`Excluir definitivamente o programa ${programa.nome}? Esta ação só será aceita se nunca houve uso.`}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700"
                  >
                    Excluir
                  </ConfirmSubmitButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* BANNER DE HOMOLOGAÇÃO RÁPIDA */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-300 bg-emerald-50/80 p-5 dark:border-emerald-800 dark:bg-emerald-950/40">
        <div>
          <h3 className="font-bold text-emerald-950 dark:text-emerald-100">
            ⚡ Homologação Rápida da Regra Oficial (4%)
          </h3>
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            Garante que todas as contratações e cotas reais possuam regra de comissão oficial ativa sem pendências.
          </p>
        </div>
        <form action={homologarRegraPadraoOficialAction}>
          <input type="hidden" name="empresa_id" value={empresaId} />
          <button className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition">
            Ativar e Homologar Regra Padrão (4%)
          </button>
        </form>
      </div>

      <RuleTable
        title="Comissão da Franqueadora"
        empresaId={empresaId}
        canHomologate={Boolean(canWriteResult.data) || platformSuperadmin}
        rows={franquia.map((row) => ({
          id: row.id,
          programa: nomes.get(row.programa_id) ?? "Programa",
          versao: row.versao,
          escopo: row.modalidade ?? "Todos os tipos",
          valor: ruleValue(
            row.base_calculo,
            row.percentual_total_comissao,
            row.valor_fixo_total,
          ),
          vigencia: `${row.vigencia_inicio} → ${row.vigencia_fim ?? "aberta"}`,
          etapas: stages(row.etapas_cronograma),
          homologada: row.configuracao_homologada,
          ativa: row.ativa,
          tipo: tiposNomes.get(row.tipo_administradora_id ?? "") ?? "Todos",
          modalidade:
            modalidadesNomes.get(row.modalidade_comissao_id ?? "") ?? "Todas",
          modo: "Oficial",
          fonte: "Franqueadora",
        }))}
      />
      <RuleTable
        title="Comissão dos participantes"
        empresaId={empresaId}
        canHomologate={Boolean(canWriteResult.data) || platformSuperadmin}
        participantRules
        rows={participantes.map((row) => ({
          id: row.id,
          programa: nomes.get(row.programa_id) ?? "Programa",
          versao: row.versao,
          escopo: row.participante_comercial_id
            ? `${row.participante?.[0]?.nome_exibicao || row.participante?.[0]?.nome || "Participante"} — ${row.tipo_participante || "Participante"}`
            : `REGRA GERAL — ${row.tipo_participante || "QUALQUER PAPEL"}`,
          valor: (() => {
            const valor = ruleValue(
              row.base_calculo,
              row.percentual_comissao,
              row.valor_fixo_total,
            );
            const total = franquiaPercentuais.get(
              `${row.programa_id}:${row.tipo_administradora_id ?? "*"}:${row.modalidade_comissao_id ?? "*"}`,
            );
            return row.base_v2 === "VALOR_VENDIDO" &&
              total &&
              row.percentual_comissao
              ? `${valor} · equivalente a ${Number(((Number(row.percentual_comissao) / total) * 100).toFixed(2))}% da comissão da Franqueadora`
              : valor;
          })(),
          vigencia: `${row.vigencia_inicio} → ${row.vigencia_fim ?? "aberta"}`,
          etapas: stages(row.etapas_cronograma),
          homologada: row.configuracao_homologada,
          ativa: row.ativa,
          tipo: tiposNomes.get(row.tipo_administradora_id ?? "") ?? "Todos",
          modalidade:
            modalidadesNomes.get(row.modalidade_comissao_id ?? "") ?? "Todas",
          modo: row.modo_regra,
          fonte: row.fonte_comissao,
        }))}
      />
    </div>
  );
}

type RuleView = {
  id: string;
  programa: string;
  versao: number;
  escopo: string;
  valor: string;
  vigencia: string;
  etapas: number;
  homologada: boolean;
  ativa: boolean;
  tipo: string;
  modalidade: string;
  modo: string;
  fonte: string;
};
function RuleTable({
  title,
  rows,
  empresaId,
  canHomologate = false,
  participantRules = false,
}: {
  title: string;
  rows: RuleView[];
  empresaId?: string;
  canHomologate?: boolean;
  participantRules?: boolean;
}) {
  const showAction = Boolean(empresaId);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Programa</th>
              <th className="px-4 py-3">Escopo</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Modo / Fonte</th>
              <th className="px-4 py-3">Tipo / Modalidade</th>
              <th className="px-4 py-3">Vigencia</th>
              <th className="px-4 py-3">Cronograma</th>
              <th className="px-4 py-3">Estado</th>
              {showAction && <th className="px-4 py-3">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={showAction ? 9 : 8}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Nenhuma regra cadastrada.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">
                    {row.programa}
                    <span className="ml-2 text-xs text-slate-400">
                      v{row.versao}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.escopo}</td>
                  <td className="px-4 py-3 font-semibold">{row.valor}</td>
                  <td className="px-4 py-3">
                    {row.modo}
                    <br />
                    <span className="text-xs text-slate-500">{row.fonte}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.tipo}
                    <br />
                    <span className="text-xs text-slate-500">
                      {row.modalidade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.vigencia}</td>
                  <td className="px-4 py-3">{row.etapas} etapa(s)</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${row.ativa && row.homologada ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}
                    >
                      {row.ativa && row.homologada
                        ? "Ativa e homologada"
                        : row.ativa
                          ? "Nao homologada"
                          : "Inativa"}
                    </span>
                  </td>
                  {showAction && (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canHomologate && row.ativa && !row.homologada ? (
                          <form
                            action={
                              participantRules
                                ? homologateParticipantRuleAction
                                : homologateFranchiseRuleAction
                            }
                          >
                            <input
                              type="hidden"
                              name="empresa_id"
                              value={empresaId}
                            />
                            <input
                              type="hidden"
                              name="regra_id"
                              value={row.id}
                            />
                            <button className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                              Homologar
                            </button>
                          </form>
                        ) : null}
                        <form action={newCommissionRuleVersionAction}>
                          <input
                            type="hidden"
                            name="empresa_id"
                            value={empresaId}
                          />
                          <input type="hidden" name="regra_id" value={row.id} />
                          <input
                            type="hidden"
                            name="tipo_regra"
                            value={
                              participantRules ? "PARTICIPANTE" : "FRANQUEADORA"
                            }
                          />
                          <button className="rounded-lg border px-2 py-1 text-xs">
                            Nova versão
                          </button>
                        </form>
                        <form action={toggleCommissionRuleAction}>
                          <input
                            type="hidden"
                            name="empresa_id"
                            value={empresaId}
                          />
                          <input type="hidden" name="regra_id" value={row.id} />
                          <input
                            type="hidden"
                            name="tipo_regra"
                            value={
                              participantRules ? "PARTICIPANTE" : "FRANQUEADORA"
                            }
                          />
                          <input
                            type="hidden"
                            name="ativo"
                            value={row.ativa ? "false" : "true"}
                          />
                          <button className="rounded-lg border px-2 py-1 text-xs">
                            {row.ativa ? "Inativar" : "Ativar"}
                          </button>
                        </form>
                        <form action={deleteCommissionRuleAction}>
                          <input
                            type="hidden"
                            name="empresa_id"
                            value={empresaId}
                          />
                          <input type="hidden" name="regra_id" value={row.id} />
                          <input
                            type="hidden"
                            name="tipo_regra"
                            value={
                              participantRules ? "PARTICIPANTE" : "FRANQUEADORA"
                            }
                          />
                          <ConfirmSubmitButton
                            message={`Excluir definitivamente ${row.programa}, ${row.tipo}/${row.modalidade}, vigência ${row.vigencia}? O servidor bloqueará se houver homologação ou uso.`}
                            className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700"
                          >
                            Excluir
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export async function ErpRepasseFranquiaPage() {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) notFound();
  const empresaId = empresaAtiva.id;
  const db = await createClient();
  const [grants, contas, recebimentos, previsoes, solicitacoesRes, importacoesRes, participantesRes, regrasRes, gruposRes, resolucoesRes] = await Promise.all([
    db
      .from("empresa_administradoras")
      .select("administradora:administradoras(id,nome)")
      .eq("empresa_id", empresaId)
      .eq("status", "ATIVA"),
    db
      .from("financeiro_contas_bancarias")
      .select("id,nome")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .order("nome"),
    db
      .from("financeiro_recebimentos")
      .select(
        "id,data_recebimento,competencia,valor_total,valor_classificado,conciliacao_status,numero_nota_fiscal,administradora:administradoras(nome)",
      )
      .eq("empresa_id", empresaId)
      .order("data_recebimento", { ascending: false })
      .limit(100),
    db
      .from("comissao_previsoes_franquia")
      .select(
        "id,administradora_id,competencia,ordem_etapa,nome_etapa,valor_previsto,valor_liquidado,status,administradora:administradoras(nome),cota:cotas_definitivas(id,numero_grupo,numero_cota),venda:vendas(cliente_nome)",
      )
      .eq("empresa_id", empresaId)
      .in("status", ["prevista", "parcialmente_liquidada"])
      .order("competencia"),
    db
      .from("erp_solicitacoes_repasse")
      .select(
        "id,empresa_id,codigo_solicitacao,administradora_id,mes_referencia,data_solicitacao,valor_solicitado,numero_nota_fiscal,data_nota_fiscal,valor_nota_fiscal,arquivo_nf_url,arquivo_nf_nome,arquivo_pedidos_url,arquivo_pedidos_nome,observacao,status,recebimento_id,created_at,administradora:administradoras(id,nome),pedidos:erp_solicitacao_repasse_pedidos(id,numero_pedido,arquivo_url,arquivo_nome),historico:erp_solicitacao_repasse_historico(id,acao,estado_anterior,estado_novo,motivo,created_at),recebimento:financeiro_recebimentos(id,data_recebimento,valor_total,conta_entrada,numero_nota_fiscal)",
      )
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("erp_repasse_importacoes")
      .select("id,administradora_id,competencia,arquivo_nome,valor_total_bruto,ponto_venda,comissionado_nome,pedidos,status,recebimento_id,created_at,itens:erp_repasse_importacao_itens(id,linha,produto,data_alocacao,numero_grupo,numero_cota,cliente_nome,parcela_numero,parcela_total,valor_comissao,valor_base,valor_participante_referencia,venda_excluida_id,status_conciliacao,previsao_franquia_id,previsao_sugerida_id,alertas,previsao:comissao_previsoes_franquia!erp_repasse_importacao_itens_previsao_franquia_id_fkey(id,competencia,valor_previsto,valor_liquidado,ordem_etapa,nome_etapa),previsao_sugerida:comissao_previsoes_franquia!erp_repasse_importacao_itens_previsao_sugerida_id_fkey(id,competencia,valor_previsto,valor_liquidado,ordem_etapa,nome_etapa))")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("participantes_comerciais")
      .select("id,nome,nome_exibicao")
      .eq("empresa_id", empresaId)
      .eq("status", "ATIVO")
      .order("nome"),
    db
      .from("comissao_regras_participantes")
      .select("id,percentual_comissao,perfil:comissao_perfis(nome)")
      .eq("empresa_id", empresaId)
      .eq("ativa", true)
      .eq("configuracao_homologada", true)
      .eq("status", "HOMOLOGADA")
      .order("versao", { ascending: false }),
    db
      .from("grupos_consorcio")
      .select("id,administradora_id,codigo_grupo,ativo,origem_governanca,empresa_origem_id")
      .or(`origem_governanca.in.(GLOBAL,LEGADO),empresa_origem_id.eq.${empresaId}`)
      .order("codigo_grupo"),
    db
      .from("erp_repasse_atencao_resolucoes")
      .select("id,importacao_id,item_importacao_id,previsao_franquia_id,tipo,decisao,valor_sistema,valor_relatorio,valor_diferenca,motivo,created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const administradoras = (grants.data ?? []).flatMap((x) => {
    const a = x.administradora as unknown as {
      id: string;
      nome: string;
    } | null;
    return a ? [a] : [];
  });

  const solicitacoes = (solicitacoesRes.data ?? []) as unknown as SolicitacaoRepasseItem[];
  const recebimentosBase = recebimentos.data ?? [];
  const recebimentoIds = recebimentosBase.map((row) => row.id);
  const [itensRecebidosRes, classificacoesRecebidasRes] = recebimentoIds.length
    ? await Promise.all([
        db
          .from("financeiro_recebimento_itens")
          .select("recebimento_id,previsao_franquia_id,valor_liquidado")
          .in("recebimento_id", recebimentoIds),
        db
          .from("financeiro_recebimento_classificacoes")
          .select("recebimento_id,valor")
          .in("recebimento_id", recebimentoIds),
      ])
    : [{ data: [] }, { data: [] }];
  const classificadosPorRecebimento = new Map<string, number>();
  for (const item of itensRecebidosRes.data ?? []) {
    classificadosPorRecebimento.set(
      item.recebimento_id,
      (classificadosPorRecebimento.get(item.recebimento_id) ?? 0) + Number(item.valor_liquidado),
    );
  }
  for (const item of classificacoesRecebidasRes.data ?? []) {
    classificadosPorRecebimento.set(
      item.recebimento_id,
      (classificadosPorRecebimento.get(item.recebimento_id) ?? 0) + Number(item.valor),
    );
  }
  const importacaoPorRecebimento = new Map((importacoesRes.data ?? []).filter((item) => item.recebimento_id).map((item) => [item.recebimento_id as string, item.id]));
  const valorVinculadoPorRecebimentoPrevisao = new Map<string, number>();
  for (const item of itensRecebidosRes.data ?? []) {
    const key = `${item.recebimento_id}:${item.previsao_franquia_id}`;
    valorVinculadoPorRecebimentoPrevisao.set(key, (valorVinculadoPorRecebimentoPrevisao.get(key) ?? 0) + Number(item.valor_liquidado));
  }
  const importacoesComValores = (importacoesRes.data ?? []).map((importacao) => ({
    ...importacao,
    itens: (importacao.itens ?? []).map((item) => ({
      ...item,
      valor_vinculado: importacao.recebimento_id && item.previsao_franquia_id
        ? valorVinculadoPorRecebimentoPrevisao.get(`${importacao.recebimento_id}:${item.previsao_franquia_id}`) ?? 0
        : 0,
    })),
  }));
  const recebimentosCalculados = recebimentosBase.map((row) => {
    const valorClassificado = classificadosPorRecebimento.get(row.id) ?? 0;
    return {
      ...row,
      repasse_importacao_id: importacaoPorRecebimento.get(row.id) ?? null,
      valor_classificado: valorClassificado,
      conciliacao_status:
        valorClassificado >= Number(row.valor_total)
          ? "CONCILIADO"
          : valorClassificado > 0
            ? "PARCIALMENTE_CONCILIADO"
            : "PENDENTE_CLASSIFICACAO",
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
          Comissoes e financeiro
        </p>
        <h1 className="text-3xl font-bold">Repasse da franquia</h1>
        <p className="mt-1 text-slate-500">
          Solicitações formais de repasse às administradoras, recebimentos diretos e liquidações financeiras.
        </p>
      </header>
      <HubLinks
        links={[
          {
            href: "/erp/regras-comissao",
            title: "Regras e cronogramas",
            description: "Confira vigencia, versao, escopo e homologacao.",
          },
          {
            href: "/erp/financeiro",
            title: "Recebimentos e caixa",
            description: "Livro razao e liquidacoes financeiras.",
          },
          {
            href: "/erp/consultores",
            title: "Consultores",
            description: "Participantes comerciais vinculados ao tenant.",
          },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <div className={cardClass}>
          <p className="text-sm text-slate-500">Previsto</p>
          <p className="text-xl font-bold">
            {money(
              (previsoes.data ?? []).reduce(
                (s, p) =>
                  s + Number(p.valor_previsto) - Number(p.valor_liquidado),
                0,
              ),
            )}
          </p>
        </div>
        <div className={cardClass}>
          <p className="text-sm text-slate-500">Recebido</p>
          <p className="text-xl font-bold">
            {money(
              recebimentosCalculados.reduce(
                (s, r) => s + Number(r.valor_total),
                0,
              ),
            )}
          </p>
        </div>
        <div className={cardClass}>
          <p className="text-sm text-slate-500">Classificado</p>
          <p className="text-xl font-bold">
            {money(
              recebimentosCalculados.reduce(
                (s, r) => s + Number(r.valor_classificado),
                0,
              ),
            )}
          </p>
        </div>
        <div className={cardClass}>
          <p className="text-sm text-slate-500">Não classificado</p>
          <p className="text-xl font-bold">
            {money(
              recebimentosCalculados.reduce(
                (s, r) =>
                  s + Number(r.valor_total) - Number(r.valor_classificado),
                0,
              ),
            )}
          </p>
        </div>
      </div>

      <RepassePdfConciliacao
        administradoras={administradoras}
        contas={contas.data ?? []}
        importacoes={importacoesComValores as unknown as RepassePdfImportacao[]}
        previsoes={(previsoes.data ?? []).map((row: any) => {
          const cota = Array.isArray(row.cota) ? row.cota[0] : row.cota;
          const venda = Array.isArray(row.venda) ? row.venda[0] : row.venda;
          return {
            id: row.id,
            administradora_id: row.administradora_id,
            competencia: row.competencia,
            ordem_etapa: Number(row.ordem_etapa),
            nome_etapa: row.nome_etapa,
            valor_previsto: Number(row.valor_previsto),
            valor_liquidado: Number(row.valor_liquidado),
            numero_grupo: cota?.numero_grupo ?? null,
            numero_cota: cota?.numero_cota ?? null,
            cliente_nome: venda?.cliente_nome ?? "Cliente não identificado",
            cota_definitiva_id: cota?.id ?? null,
            status: row.status,
          } satisfies RepassePrevisaoAberta;
        })}
        participantes={(participantesRes.data ?? []).map((row) => ({
          id: row.id,
          nome: row.nome_exibicao || row.nome,
        } satisfies RepasseParticipante))}
        regras={(regrasRes.data ?? []).map((row: any) => {
          const perfil = Array.isArray(row.perfil) ? row.perfil[0] : row.perfil;
          return {
            id: row.id,
            nome: perfil?.nome || "Regra homologada",
            percentual: Number(row.percentual_comissao),
          } satisfies RepasseRegraParticipante;
        })}
        grupos={(gruposRes.data ?? []).map((row) => ({
          id: row.id,
          administradora_id: row.administradora_id,
          codigo: row.codigo_grupo,
          ativo: row.ativo,
          local: row.origem_governanca === "LOCAL",
        } satisfies RepasseGrupo))}
        resolucoes={(resolucoesRes.data ?? []) as RepasseAtencaoResolucao[]}
      />

      <RepasseFranquiaView
        administradoras={administradoras}
        contas={contas.data ?? []}
        solicitacoes={solicitacoes}
        recebimentos={
          recebimentosCalculados as unknown as Parameters<
            typeof ReceiptManager
          >[0]["recebimentos"]
        }
        previsoes={
          (previsoes.data ?? []) as unknown as Parameters<
            typeof ReceiptManager
          >[0]["previsoes"]
        }
      />

    </div>
  );
}

