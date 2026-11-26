import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { requireTenantPermission } from "@/lib/tenant/context";
import NovoClientePage from "../../clientes/novo/page";
import { IniciarContratacaoForm } from "./iniciar-form";

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export default async function NovaContratacaoPage({ searchParams }: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { empresaAtiva } = await requireErpRouteAccess("contratacoes");
  await requireErpRouteAccess("clientes");
  await requireTenantPermission("formalizar_vendas");
  const filtros = await searchParams;
  if (filtros.modo === "novo") {
    return <NovoClientePage searchParams={Promise.resolve({ origem: "contratacao" })} />;
  }

  const db = await createClient();
  const clienteId = UUID.test(filtros.cliente || "") ? filtros.cliente! : "";
  const selecionado = clienteId ? await db.from("clientes").select("id,nome,cpf_cnpj,telefone,email,status")
    .eq("empresa_id", empresaAtiva.id).eq("id", clienteId).eq("status", "ativo").maybeSingle() : null;
  if (selecionado?.error) throw new Error("Não foi possível consultar o cliente selecionado.");
  const cliente = selecionado?.data;
  const busca = (filtros.busca || "").trim().slice(0, 100);
  const pagina = Math.max(1, Math.min(100000, Math.floor(Number(filtros.pagina) || 1)));
  let query = db.from("clientes").select("id,nome,cpf_cnpj,telefone", { count: "exact" })
    .eq("empresa_id", empresaAtiva.id).eq("status", "ativo");
  if (busca) {
    // Remove caracteres de sintaxe do filtro PostgREST; mantém espaços e acentos do nome.
    const termo = busca.replace(/[^\p{L}\p{N}\s@+.-]/gu, " ").trim().replace(/[%_]/g, "");
    const documento = busca.replace(/\D/g, "");
    query = documento && !/[\p{L}]/u.test(busca)
      ? query.ilike("documento_normalizado", `%${documento}%`)
      : query.ilike("nome", `%${termo}%`);
  }
  const { data: clientes, count, error } = await query.order("nome").order("id").range((pagina - 1) * 20, pagina * 20 - 1);
  if (error) throw new Error("Não foi possível buscar os clientes desta empresa.");
  const hrefPagina = (numero: number) => `/erp/contratacoes/nova?${new URLSearchParams({ busca, pagina: String(numero) })}`;

  return <main className="mx-auto max-w-5xl space-y-6 pb-12">
    <Link href="/erp/contratacoes" className="text-sm font-bold text-blue-700">← Voltar para contratações</Link>
    <header className="rounded-2xl bg-slate-950 p-6 text-white">
      <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Operação comercial</p>
      <h1 className="mt-2 text-3xl font-black">Nova contratação</h1>
      <p className="mt-2 text-sm text-slate-300">Escolha o cliente. Depois, preencha grupo, crédito, modalidade, cota, consultor e condições de pagamento.</p>
      <ol className="mt-4 flex flex-wrap gap-4 text-sm"><li className="font-bold text-cyan-300">1. Cliente</li><li>2. Grupo, cota e condições</li><li>3. Documentos e formalização</li></ol>
    </header>
    {clienteId && !cliente && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">Cliente indisponível. Selecione um cadastro ativo desta empresa.</p>}
    {cliente && <section className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50 p-6">
      <div><p className="text-xs font-bold uppercase text-blue-700">Cliente selecionado</p><h2 className="mt-1 text-xl font-bold text-slate-950">{cliente.nome}</h2><p className="mt-1 text-sm text-slate-700">{[cliente.cpf_cnpj, cliente.telefone, cliente.email].filter(Boolean).join(" · ") || "Dados adicionais podem ser completados na ficha do cliente."}</p></div>
      <IniciarContratacaoForm clienteId={cliente.id} requestId={crypto.randomUUID()} />
      <p className="text-xs text-slate-600">A contratação começa sem assinatura. Confirme a assinatura e anexe o documento antes de formalizar a venda.</p>
    </section>}
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-950">Selecionar cliente cadastrado</h2><Link href="/erp/contratacoes/nova?modo=novo" className="rounded-xl border border-blue-300 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50">+ Cadastrar novo cliente</Link></div>
      <form className="flex flex-wrap gap-2"><label className="min-w-48 flex-1"><span className="sr-only">Buscar por nome ou CPF/CNPJ</span><input name="busca" defaultValue={busca} placeholder="Buscar por nome ou CPF/CNPJ" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm" /></label><button className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">Buscar</button></form>
      <ul className="divide-y divide-slate-100">{(clientes || []).map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-bold text-slate-900">{item.nome}</p><p className="text-sm text-slate-600">{[item.cpf_cnpj, item.telefone].filter(Boolean).join(" · ") || "Documento e telefone não informados"}</p></div><Link href={`/erp/contratacoes/nova?cliente=${item.id}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-blue-700">Selecionar<span className="sr-only"> {item.nome}</span></Link></li>)}</ul>
      {!clientes?.length && <p className="py-6 text-center text-sm text-slate-600">Nenhum cliente ativo encontrado. Você pode cadastrar um novo cliente acima.</p>}
      <nav aria-label="Páginas de clientes" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600"><span>{count || 0} clientes · página {pagina}</span><div className="flex gap-4">{pagina > 1 && <Link href={hrefPagina(pagina - 1)} className="font-bold text-blue-700">← Anterior</Link>}{pagina * 20 < (count || 0) && <Link href={hrefPagina(pagina + 1)} className="font-bold text-blue-700">Próxima →</Link>}</div></nav>
    </section>
  </main>;
}
