import Link from "next/link";
import Leads from "@/app/admin/leads/page";
import Grupos from "@/app/admin/grupos/page";
import Comissoes from "@/app/admin/comissoes/page";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { CommissionRuleManager } from "@/components/erp/commission-rule-manager";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import {
  homologateFranchiseRuleAction,
  homologateParticipantRuleAction,
  newCommissionProgramVersionAction,
  saveFiscalCommissionConfigAction,
  toggleCommissionProgramAction,
} from "@/app/erp/regras-comissao/actions";

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

export async function ErpLancesPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
          Consorcio
        </p>
        <h1 className="text-3xl font-bold">Lances e estrategias</h1>
        <p className="mt-1 text-slate-500">
          Use os grupos e cotas atuais. Cada grupo concentra lance embutido,
          recurso proprio, parcela reduzida e parametros de contemplacao.
        </p>
      </header>
      <HubLinks
        links={[
          {
            href: "/erp/grupos",
            title: "Catalogo de grupos",
            description:
              "Abra um grupo para editar estrategias de lance e parcela.",
          },
          {
            href: "/erp/assembleias",
            title: "Assembleias / Pedras",
            description:
              "Registre a pedra e acompanhe cotas reais próximas, sem alterar contemplação.",
          },
        ]}
      />
      <div className="border-t border-slate-200 pt-6">
        <Grupos searchParams={Promise.resolve({})} />
      </div>
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
  const empresaId = empresaAtiva?.id ?? "";
  const [
    programasResult,
    franquiaResult,
    participantesResult,
    gruposResult,
    cotasResult,
    tiposResult,
    modalidadesResult,
    participantesCatalogoResult,
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
        "id,programa_id,versao,base_calculo,percentual_comissao,valor_fixo_total,vigencia_inicio,vigencia_fim,tipo_participante,ativa,configuracao_homologada,etapas_cronograma,base_v2,tipo_administradora_id,modalidade_comissao_id",
      )
      .eq("empresa_id", empresaId)
      .order("vigencia_inicio", { ascending: false }),
    supabase
      .from("grupos_consorcio")
      .select("id,codigo_grupo,administradora,administradora_id")
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
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("administradora_modalidades_comissao")
      .select("id,nome,administradora_id")
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("participantes_comerciais")
      .select("id,nome,nome_exibicao")
      .eq("empresa_id", empresaId)
      .ilike("status", "ativo")
      .order("nome"),
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
          <form
            action={saveFiscalCommissionConfigAction}
            className="grid gap-3 rounded-xl border border-emerald-200 bg-white p-4 md:grid-cols-5"
          >
            <input type="hidden" name="empresa_id" value={empresaId} />
            <label className="text-sm font-medium">
              Imposto sobre comissão (%)
              <input
                name="percentual_imposto"
                inputMode="decimal"
                required
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label className="text-sm font-medium">
              Início da vigência
              <input
                type="date"
                name="vigencia_inicio"
                required
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label className="text-sm font-medium">
              Fim da vigência
              <input
                type="date"
                name="vigencia_fim"
                className="mt-1 w-full rounded border p-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="participante_exibe_detalhes_fiscais"
              />{" "}
              Participante vê bruto + imposto + líquido
            </label>
            <button className="self-end rounded bg-emerald-700 px-3 py-2 text-sm font-bold text-white">
              Salvar configuração fiscal
            </button>
          </form>
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
              </div>
            </div>
          ))}
        </div>
      </section>
      <RuleTable
        title="Comissão da Franqueadora"
        empresaId={empresaId}
        canHomologate={platformSuperadmin}
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
        }))}
      />
      <RuleTable
        title="Comissão dos participantes"
        empresaId={empresaId}
        canHomologate={platformSuperadmin}
        participantRules
        rows={participantes.map((row) => ({
          id: row.id,
          programa: nomes.get(row.programa_id) ?? "Programa",
          versao: row.versao,
          escopo: row.tipo_participante ?? "Regra geral",
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
  const showAction = Boolean(canHomologate && empresaId);
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
              <th className="px-4 py-3">Vigencia</th>
              <th className="px-4 py-3">Cronograma</th>
              <th className="px-4 py-3">Estado</th>
              {showAction && <th className="px-4 py-3">Ação Platform</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={showAction ? 7 : 6}
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
                      {row.ativa && !row.homologada ? (
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
                          <input type="hidden" name="regra_id" value={row.id} />
                          <button className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                            Homologar
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
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
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
          Comissoes e financeiro
        </p>
        <h1 className="text-3xl font-bold">Repasse da franquia</h1>
        <p className="mt-1 text-slate-500">
          Cronograma previsto, liquidacao recebida e elegibilidade dos
          participantes no motor transacional atual.
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
      <div className="border-t border-slate-200 pt-6">
        <Comissoes />
      </div>
    </div>
  );
}
