import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformSection } from "@/lib/platform/catalog";

type Row = Record<string, unknown>;
const config: Record<string,{title:string;description:string;table?:string;select?:string}> = {
 empresas:{title:"Master Franquias",description:"Tenants, status, site, ERP e governança comercial.",table:"empresas",select:"id,nome_fantasia,razao_social,slug,status,ativo,configuracoes,created_at"},
 usuarios:{title:"Usuários / Responsáveis",description:"Identidades e vínculos N:N. Papel tenant nunca promove para Platform.",table:"empresa_usuarios",select:"id,empresa_id,usuario_id,ativo,created_at"},
 dominios:{title:"Domínios",description:"Domínios tenant; o PLATFORM_HOST não é cadastrado como empresa.",table:"empresa_dominios",select:"id,empresa_id,valor,tipo,principal,ativo,verificado,updated_at"},
 administradoras:{title:"Administradoras globais",description:"Catálogo mantido exclusivamente pela Plataforma.",table:"administradoras",select:"id,nome,nome_fantasia,slug,status,updated_at"},
 grupos:{title:"Grupos globais",description:"Grupos vinculados à administradora global.",table:"grupos_consorcio",select:"id,administradora_id,codigo_grupo,modalidade,status,ativo,updated_at"},
 produtos:{title:"Cotas / Produtos comerciais",description:"Opções comerciais de grupos_cotas; não são cotas definitivas do cliente.",table:"grupos_cotas",select:"id,grupo_id,valor_credito,prazo,parcela,status,ativo,updated_at"},
 sites:{title:"Sites / Portais",description:"Publicação, domínio e branding por empresa.",table:"empresa_branding",select:"id,empresa_id,nome_site,status_publicacao,updated_at"},
 templates:{title:"Modelos de Site",description:"Catálogo global escolhido somente pelo Platform Superadmin.",table:"site_modelos",select:"id,codigo,nome,status,versao,updated_at"},
 "erp-modulos":{title:"Catálogo global ERP",description:"Módulos do produto, dependências e estado global.",table:"erp_modulos_catalogo",select:"id,codigo,nome,status,estado_produto,ordem_padrao,dependencias"},
 recursos:{title:"Liberações e overrides",description:"Plano → empresa → override explícito e auditável.",table:"saas_empresa_overrides",select:"id,empresa_id,recurso_codigo,efeito,motivo,vigencia_inicio,vigencia_fim"},
 planos:{title:"Planos SaaS",description:"Estrutura comercial sem preços presumidos.",table:"saas_planos",select:"id,codigo,nome,descricao,status,valor_mensal,taxa_implantacao,limite_usuarios"},
 assinaturas:{title:"Assinaturas / Contratações",description:"Financeiro SaaS separado do Financeiro ERP.",table:"saas_assinaturas",select:"id,empresa_id,plano_id,status,data_inicio,valor_mensal,taxa_implantacao,proximo_vencimento"},
 auditoria:{title:"Auditoria Platform",description:"Trilha de ações críticas sem segredos.",table:"plataforma_auditoria",select:"id,acao,entidade_tipo,entidade_id,campos_alterados,created_at"},
 configuracoes:{title:"Configurações da Plataforma",description:"Parâmetros globais versionados e sem segredos.",table:"plataforma_configuracoes",select:"id,chave,descricao,ativo,updated_at"},
 };

function display(value: unknown) { if (value == null || value === "") return "—"; if (typeof value === "boolean") return value ? "Sim" : "Não"; if (typeof value === "object") return JSON.stringify(value); return String(value); }
export default async function PlatformSectionPage({params}:{params:Promise<{secao:string}>}) {
 const {secao}=await params; if(!isPlatformSection(secao)) notFound(); const c=config[secao]; const db=await createClient(); let rows:Row[]=[]; let error="";
 if(c.table){const result=await db.from(c.table).select(c.select ?? "*").limit(100); rows=(result.data ?? []) as unknown as Row[]; error=result.error?.message ?? "";}
 const columns=rows.length ? Object.keys(rows[0]) : [];
 return <div className="space-y-6"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Platform</p><h1 className="mt-1 text-3xl font-bold">{c.title}</h1><p className="mt-2 text-slate-500">{c.description}</p></div>{secao==="empresas"?<Link href="/platform/empresas/nova" className="rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white">Nova Master Franquia</Link>:null}</div>{error?<div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Estrutura disponível após migration 070 no ambiente isolado.</div>:null}<div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-sm"><thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{columns.map(x=><th key={x} className="px-4 py-3">{x.replaceAll("_"," ")}</th>)}{secao==="empresas"?<th/>:null}</tr></thead><tbody>{rows.length===0?<tr><td colSpan={Math.max(1,columns.length)} className="p-8 text-center text-slate-500">Nenhum registro real disponível.</td></tr>:rows.map((row,i)=><tr key={String(row.id ?? i)} className="border-b dark:border-slate-800">{columns.map(x=><td key={x} className="max-w-xs truncate px-4 py-3">{display(row[x])}</td>)}{secao==="empresas"?<td className="px-4"><Link className="text-cyan-600" href={`/platform/empresas/${row.id}`}>Gerenciar</Link></td>:null}</tr>)}</tbody></table></div></div>;
}
