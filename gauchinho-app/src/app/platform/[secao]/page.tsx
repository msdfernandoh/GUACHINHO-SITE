import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformSection } from "@/lib/platform/catalog";
import { decidirGovernancaGrupoAction } from "../grupos-actions";

type Row = Record<string, unknown>;
type SectionConfig = {
  title: string;
  description: string;
  table?: string;
  select?: string;
};

const config: Record<string, SectionConfig> = {
  empresas: {
    title: "Master Franquias",
    description: "Tenants, status, site, ERP e governança comercial.",
    table: "empresas",
    select:
      "id,nome_fantasia,razao_social,slug,status,ativo,configuracoes,created_at",
  },
  usuarios: {
    title: "Usuários / Responsáveis",
    description:
      "Identidades e vínculos N:N. Papel tenant nunca promove para Platform.",
    table: "empresa_usuarios",
    select:
      "id,ativo,created_at,empresa:empresas(nome_fantasia),usuario:usuarios!empresa_usuarios_usuario_id_fkey(nome)",
  },
  dominios: {
    title: "Domínios",
    description:
      "Domínios tenant; o PLATFORM_HOST não é cadastrado como empresa.",
    table: "empresa_dominios",
    select:
      "id,valor,tipo,principal,ativo,verificado,updated_at,empresa:empresas(nome_fantasia)",
  },
  administradoras: {
    title: "Administradoras globais",
    description: "Catálogo mantido exclusivamente pela Plataforma.",
    table: "administradoras",
    select: "id,nome,nome_fantasia,slug,status,updated_at",
  },
  grupos: {
    title: "Grupos e fila de governança",
    description:
      "Grupos locais pendentes podem ser promovidos para Global ou mantidos somente no tenant de origem.",
    table: "grupos_consorcio",
    select:
      "id,codigo_grupo,modalidade,status,ativo,origem_governanca,status_governanca,empresa_origem_id,updated_at,administradora:administradoras(nome),tipo:administradora_tipos(nome),modalidade_comissao:administradora_modalidades_comissao(nome)",
  },
  produtos: {
    title: "Produtos comerciais",
    description:
      "Opções comerciais de grupos_cotas; não são cotas definitivas do cliente.",
    table: "grupos_cotas",
    select:
      "id,valor_credito,valor_parcela,parcela_integral,parcela_com_seguro,status,ativo,grupo:grupos_consorcio(id,codigo_grupo,administradora:administradoras(nome))",
  },
  "produtos-comerciais": {
    title: "Produtos comerciais",
    description: "Visão global; a edição canônica ocorre dentro do Grupo.",
    table: "grupos_cotas",
    select:
      "id,valor_credito,status,ativo,grupo:grupos_consorcio(id,codigo_grupo,modalidade,administradora:administradoras(nome))",
  },
  sites: {
    title: "Sites / Portais",
    description: "Publicação, domínio e branding por empresa.",
    table: "empresa_branding",
    select:
      "id,nome_site,status_publicacao,updated_at,empresa:empresas(nome_fantasia)",
  },
  templates: {
    title: "Modelos de Site",
    description: "Catálogo global escolhido somente pelo Platform Superadmin.",
    table: "site_modelos",
    select: "id,codigo,nome,status,versao,updated_at",
  },
  "erp-modulos": {
    title: "Catálogo global ERP",
    description: "Módulos do produto, dependências e estado global.",
    table: "erp_modulos_catalogo",
    select:
      "id,codigo,nome,descricao,status,estado_produto,ordem_padrao,dependencias",
  },
  recursos: {
    title: "Liberações e overrides",
    description: "Plano → empresa → override explícito e auditável.",
    table: "saas_empresa_overrides",
    select:
      "id,recurso_codigo,efeito,motivo,vigencia_inicio,vigencia_fim,empresa:empresas(nome_fantasia)",
  },
  planos: {
    title: "Planos SaaS",
    description: "Estrutura comercial sem preços presumidos.",
    table: "saas_planos",
    select:
      "id,codigo,nome,descricao,status,valor_mensal,taxa_implantacao,limite_usuarios",
  },
  assinaturas: {
    title: "Assinaturas SaaS",
    description:
      "Financeiro SaaS separado do Financeiro ERP e das contratações de consórcio.",
    table: "saas_assinaturas",
    select:
      "id,status,data_inicio,valor_mensal,taxa_implantacao,proximo_vencimento,empresa:empresas(nome_fantasia),plano:saas_planos(nome)",
  },
  auditoria: {
    title: "Auditoria Platform",
    description: "Trilha de ações críticas sem segredos.",
    table: "plataforma_auditoria",
    select:
      "id,acao,entidade_tipo,campos_alterados,created_at,usuario:usuarios(nome)",
  },
  configuracoes: {
    title: "Configurações da Plataforma",
    description: "Parâmetros globais versionados e sem segredos.",
    table: "plataforma_configuracoes",
    select: "id,chave,descricao,ativo,updated_at",
  },
};

const labels: Record<string, string> = {
  nome_fantasia: "Empresa",
  razao_social: "Razão social",
  created_at: "Criado em",
  updated_at: "Atualizado em",
  valor: "Domínio",
  principal: "Principal",
  verificado: "Verificado",
  valor_credito: "Crédito",
  valor_parcela: "Parcela",
  parcela_integral: "Parcela integral",
  parcela_com_seguro: "Parcela com seguro",
  estado_produto: "Disponibilidade",
  ordem_padrao: "Ordem",
  recurso_codigo: "Recurso",
  vigencia_inicio: "Início",
  vigencia_fim: "Fim",
  valor_mensal: "Mensalidade",
  taxa_implantacao: "Taxa de implantação",
  proximo_vencimento: "Próximo vencimento",
  limite_usuarios: "Limite de usuários",
  campos_alterados: "Alterações",
};
const technical = new Set([
  "id",
  "empresa_id",
  "usuario_id",
  "grupo_id",
  "administradora_id",
  "plano_id",
  "entidade_id",
  "configuracoes",
]);

function display(value: unknown, key: string): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (key === "configuracoes" && typeof value === "object") {
    const erp = (
      value as { erp_sistema?: { habilitado?: boolean; modulos?: string[] } }
    ).erp_sistema;
    return erp?.habilitado
      ? `ERP ativo · ${erp.modulos?.length ?? 0} módulos`
      : "Sem ERP configurado";
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const headline =
      record.nome_fantasia ??
      record.nome ??
      record.codigo_grupo ??
      record.codigo;
    const parent = record.administradora;
    const parentLabel =
      parent && typeof parent === "object"
        ? display(parent, "administradora")
        : "";
    return (
      [headline, parentLabel].filter(Boolean).join(" · ") ||
      "Detalhes disponíveis"
    );
  }
  return String(value);
}

export default async function PlatformSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ secao: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { secao } = await params;
  const filters = await searchParams;
  if (!isPlatformSection(secao)) notFound();
  const section = config[secao];
  const db = await createClient();
  let rows: Row[] = [];
  let error = "";
  if (section.table) {
    let query = db.from(section.table).select(section.select ?? "*");
    if (secao === "grupos" && filters.status)
      query = query.eq("status_governanca", filters.status);
    if (secao === "grupos" && filters.busca)
      query = query.ilike("codigo_grupo", `%${filters.busca}%`);
    const result = await query.limit(100);
    rows = (result.data ?? []) as unknown as Row[];
    error = result.error?.message ?? "";
  }
  const columns = rows.length
    ? Object.keys(rows[0]).filter((key) => !technical.has(key))
    : [];
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">
            Platform
          </p>
          <h1 className="mt-1 text-3xl font-bold">{section.title}</h1>
          <p className="mt-2 text-slate-500">{section.description}</p>
        </div>
        {secao === "empresas" ? (
          <Link
            href="/platform/empresas/nova"
            className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white"
          >
            Nova Master Franquia
          </Link>
        ) : secao === "grupos" ? (
          <Link
            href="/platform/grupos/novo"
            className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white"
          >
            Novo Grupo Global
          </Link>
        ) : null}
      </div>
      {error ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Estrutura disponível após migration 070 no ambiente isolado.
        </div>
      ) : null}
      {secao === "grupos" ? (
        <form className="flex flex-wrap gap-2 rounded-xl border bg-white p-3">
          <input
            name="busca"
            defaultValue={filters.busca}
            placeholder="Buscar número do grupo"
            className="rounded-lg border px-3 py-2"
          />
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded-lg border px-3 py-2"
          >
            <option value="">Todos os status</option>
            <option>CONFIGURACAO_PENDENTE</option>
            <option>PENDENTE_PLATFORM</option>
            <option>LOCAL</option>
            <option>GLOBAL</option>
          </select>
          <button className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">
            Filtrar
          </button>
        </form>
      ) : null}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                {columns.map((key) => (
                  <th key={key} className="px-4 py-3">
                    {labels[key] ?? key.replaceAll("_", " ")}
                  </th>
                ))}
                {secao === "empresas" ||
                secao === "grupos" ||
                secao === "administradoras" ||
                secao === "produtos" ||
                secao === "produtos-comerciais" ? (
                  <th className="px-4 py-3">Ação</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(1, columns.length)}
                    className="p-8 text-center text-slate-500"
                  >
                    Nenhum registro real disponível.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={String(row.id ?? index)}
                    className="border-b dark:border-slate-800"
                  >
                    {columns.map((key) => (
                      <td
                        key={key}
                        className="max-w-[15rem] px-4 py-3 align-top"
                      >
                        {display(row[key], key)}
                      </td>
                    ))}
                    {secao === "empresas" ? (
                      <td className="px-4 py-3">
                        <Link
                          className="font-medium text-cyan-600"
                          href={`/platform/empresas/${row.id}`}
                        >
                          Gerenciar
                        </Link>
                      </td>
                    ) : secao === "administradoras" ? (
                      <td className="px-4 py-3">
                        <Link
                          className="font-semibold text-cyan-700"
                          href={`/platform/administradoras/${row.id}`}
                        >
                          Gerenciar
                        </Link>
                      </td>
                    ) : secao === "grupos" ? (
                      <td className="px-4 py-3">
                        <div className="mb-2 flex gap-3">
                          <Link
                            className="font-semibold text-cyan-700"
                            href={`/platform/grupos/${row.id}`}
                          >
                            {row.status_governanca === "CONFIGURACAO_PENDENTE"
                              ? "Editar configuração"
                              : "Editar"}
                          </Link>
                          <Link
                            className="text-slate-600"
                            href={`/platform/grupos/${row.id}?modo=visualizar`}
                          >
                            Visualizar
                          </Link>
                        </div>
                        {row.status_governanca === "PENDENTE_PLATFORM" ? (
                          <div className="flex gap-2">
                            <form action={decidirGovernancaGrupoAction}>
                              <input
                                type="hidden"
                                name="grupo_id"
                                value={String(row.id)}
                              />
                              <input
                                type="hidden"
                                name="decisao"
                                value="PROMOVER_GLOBAL"
                              />
                              <button className="rounded-lg bg-cyan-600 px-2 py-1 text-xs font-bold text-white">
                                Promover Global
                              </button>
                            </form>
                            <form action={decidirGovernancaGrupoAction}>
                              <input
                                type="hidden"
                                name="grupo_id"
                                value={String(row.id)}
                              />
                              <input
                                type="hidden"
                                name="decisao"
                                value="MANTER_LOCAL"
                              />
                              <button className="rounded-lg border px-2 py-1 text-xs font-bold">
                                Manter Local
                              </button>
                            </form>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Decidido
                          </span>
                        )}
                      </td>
                    ) : secao === "produtos" ||
                      secao === "produtos-comerciais" ? (
                      <td className="px-4 py-3">
                        <Link
                          className="font-semibold text-cyan-700"
                          href={`/platform/grupos/${(row.grupo as Row)?.id}`}
                        >
                          Editar no Grupo
                        </Link>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
