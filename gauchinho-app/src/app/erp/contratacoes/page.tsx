import Link from "next/link";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { canAccessErpRoute } from "@/lib/erp/erp-acesso";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import {
  listarContratacoesOperacionais,
  ordenarFilaContratacoes,
  tempoAguardando,
  type StatusOperacionalContratacao,
} from "@/lib/erp/contratacoes-operacionais";
import { notFound } from "next/navigation";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const statusNome: Record<StatusOperacionalContratacao, string> = {
  AGUARDANDO_ASSINATURA: "Aguardando assinatura",
  AGUARDANDO_FORMALIZACAO: "Assinado — aguardando formalização",
  EM_CONFERENCIA: "Em conferência",
  PRONTO_FORMALIZAR: "Pronto para criar venda",
  FORMALIZADA: "Formalizado",
  PENDENCIA: "Pendência",
  INVALIDADA: "Invalidado",
};
const statusCor: Record<StatusOperacionalContratacao, string> = {
  AGUARDANDO_ASSINATURA: "bg-slate-100 text-slate-700",
  AGUARDANDO_FORMALIZACAO: "bg-blue-100 text-blue-800",
  EM_CONFERENCIA: "bg-violet-100 text-violet-800",
  PRONTO_FORMALIZAR: "bg-emerald-100 text-emerald-800",
  FORMALIZADA: "bg-green-100 text-green-800",
  PENDENCIA: "bg-amber-100 text-amber-900",
  INVALIDADA: "bg-red-100 text-red-800",
};

export default async function ErpContratacoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filtros = await searchParams;
  const { empresaAtiva, vinculos } = await getCurrentTenantContext();
  if (!empresaAtiva) notFound();
  const config = getErpSistemaConfig(empresaAtiva.configuracoes);
  const vinculo = (vinculos ?? []).find((v) => v.empresa_id === empresaAtiva.id);
  if (!canAccessErpRoute(config, vinculo?.erp_modulos_visiveis, "contratacoes")) notFound();
  let rows = ordenarFilaContratacoes(await listarContratacoesOperacionais(empresaAtiva.id));
  if (filtros.busca) {
    const busca = filtros.busca.toLowerCase().replace(/\D/g, "") || filtros.busca.toLowerCase();
    rows = rows.filter((r) => [r.nome, r.documento, r.telefone, r.protocolo].some((v) => v?.toLowerCase().replace(/\D/g, "").includes(busca) || v?.toLowerCase().includes(filtros.busca!.toLowerCase())));
  }
  if (filtros.status) rows = rows.filter((r) => r.status === filtros.status);
  if (filtros.grupo) rows = rows.filter((r) => r.grupoId === filtros.grupo);
  if (filtros.formalizado === "sim") rows = rows.filter((r) => r.status === "FORMALIZADA");
  if (filtros.formalizado === "nao") rows = rows.filter((r) => r.status !== "FORMALIZADA");
  if (filtros.data_inicio) rows = rows.filter((r) => (r.contratoAssinadoEm ?? "") >= filtros.data_inicio!);
  if (filtros.data_fim) rows = rows.filter((r) => (r.contratoAssinadoEm ?? "").slice(0, 10) <= filtros.data_fim!);
  const todos = await listarContratacoesOperacionais(empresaAtiva.id);
  const mes = new Date().toISOString().slice(0, 7);
  const cards = {
    aguardando: todos.filter((r) => r.status === "AGUARDANDO_FORMALIZACAO" || r.status === "PRONTO_FORMALIZAR").length,
    conferencia: todos.filter((r) => r.status === "EM_CONFERENCIA").length,
    pendencias: todos.filter((r) => r.status === "PENDENCIA").length,
    formalizados: todos.filter((r) => r.status === "FORMALIZADA" && (r.contratoAssinadoEm ?? "").startsWith(mes)).length,
  };
  const grupos = Array.from(new Map(todos.filter((r) => r.grupoId).map((r) => [r.grupoId!, r.grupo || "Grupo"])).entries());

  return <div className="space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Operação comercial</p>
      <h1 className="mt-1 text-3xl font-bold text-slate-950">Contratações para formalizar</h1>
      <p className="mt-2 text-slate-600">Fila operacional de contratos: conferir, vincular cliente e criar venda/cota pelo motor canônico.</p>
    </header>
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {[["Assinados aguardando formalização",cards.aguardando,"text-blue-700"],["Em conferência",cards.conferencia,"text-violet-700"],["Pendências",cards.pendencias,"text-amber-700"],["Formalizados no mês",cards.formalizados,"text-emerald-700"]].map(([label,value,color]) =>
        <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">{label}</p><p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p></div>)}
    </section>
    <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 xl:grid-cols-6">
      <input name="busca" defaultValue={filtros.busca} placeholder="Nome, CPF/CNPJ, telefone, protocolo" className="rounded-lg border border-slate-300 px-3 py-2 xl:col-span-2" />
      <select name="status" defaultValue={filtros.status ?? ""} className="rounded-lg border border-slate-300 px-3 py-2"><option value="">Todos os status</option>{Object.entries(statusNome).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select name="grupo" defaultValue={filtros.grupo ?? ""} className="rounded-lg border border-slate-300 px-3 py-2"><option value="">Todos os grupos</option>{grupos.map(([id,nome]) => <option key={id} value={id}>{nome}</option>)}</select>
      <select name="formalizado" defaultValue={filtros.formalizado ?? ""} className="rounded-lg border border-slate-300 px-3 py-2"><option value="">Formalizados e não formalizados</option><option value="sim">Formalizados</option><option value="nao">Não formalizados</option></select>
      <button className="rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white">Filtrar</button>
      <input type="date" name="data_inicio" defaultValue={filtros.data_inicio} aria-label="Assinatura inicial" className="rounded-lg border border-slate-300 px-3 py-2" />
      <input type="date" name="data_fim" defaultValue={filtros.data_fim} aria-label="Assinatura final" className="rounded-lg border border-slate-300 px-3 py-2" />
    </form>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[1300px] w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Protocolo","Data assinatura","Cliente","CPF/CNPJ","Telefone","Administradora","Grupo","Crédito","Parcela","Consultor","Status","Ações"].map((h)=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map((r)=><tr key={r.id} className="align-top hover:bg-slate-50">
        <td className="px-4 py-4 font-mono text-xs">{r.protocolo}</td><td className="px-4 py-4"><div>{r.contratoAssinadoEm ? new Date(r.contratoAssinadoEm).toLocaleDateString("pt-BR") : "—"}</div><div className="mt-1 text-xs text-slate-500">{tempoAguardando(r.contratoAssinadoEm)}</div></td>
        <td className="px-4 py-4 font-semibold text-slate-900">{r.nome}</td><td className="px-4 py-4">{r.documento || "—"}</td><td className="px-4 py-4">{r.telefone || "—"}</td><td className="px-4 py-4">{r.administradora || "—"}</td><td className="px-4 py-4">{r.grupo || "Não mapeado"}</td><td className="px-4 py-4">{r.credito ? moeda.format(r.credito) : "—"}</td><td className="px-4 py-4">{r.parcela ? moeda.format(r.parcela) : "—"}</td><td className="px-4 py-4">{r.consultor || "Não atribuído"}</td>
        <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusCor[r.status]}`}>{statusNome[r.status]}</span>{r.pendencia && <p className="mt-2 max-w-48 text-xs text-amber-800">{r.pendencia}</p>}</td>
        <td className="px-4 py-4"><div className="flex flex-wrap gap-2">{r.status === "FORMALIZADA" ? <>{r.clienteId && <Link className="rounded-md border px-2 py-1" href={`/erp/clientes/${r.clienteId}`}>Ver cliente</Link>}<Link className="rounded-md border px-2 py-1" href={`/erp/vendas?venda=${r.vendaId}`}>Ver venda</Link><Link className="rounded-md border px-2 py-1" href={`/erp/vendas?cota=${r.cotaId}`}>Ver cota</Link></> : <Link className="rounded-md bg-blue-700 px-3 py-2 font-semibold text-white" href={`/erp/contratacoes/${r.id}`}>{r.status === "PENDENCIA" ? "Resolver pendência" : r.contratoAssinado ? "Conferir e formalizar" : "Ver contrato"}</Link>}</div></td>
      </tr>)}</tbody></table>
      {!rows.length && <p className="p-10 text-center text-slate-500">Nenhuma contratação encontrada para os filtros.</p>}
    </div>
  </div>;
}
