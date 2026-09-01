import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { registrarMovimentoBancarioAction, registrarTransferenciaSociosAction, transferirEntreContasAction } from "./actions";

const brl = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (data: string) => data.split("-").reverse().join("/");
const operacao = () => crypto.randomUUID();
const campo = "rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900";

export default async function FinanceiroCaixaPage({ searchParams }: { searchParams?: Promise<{ mes?: string; conta?: string }> }) {
  const { empresaAtiva } = await requireErpRouteAccess("financeiro");
  const db = await createClient();
  const competenciaAtual = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const params = await searchParams;
  const mes = params?.mes === "todos" || /^\d{4}-(0[1-9]|1[0-2])$/.test(params?.mes ?? "") ? params!.mes! : competenciaAtual;
  const contaSolicitada = /^[0-9a-f-]{36}$/i.test(params?.conta ?? "") ? params!.conta! : "todas";
  const inicio = mes === "todos" ? null : `${mes}-01`;
  const fim = mes === "todos" ? null : new Date(Date.UTC(Number(mes.slice(0,4)),Number(mes.slice(5,7)),0)).toISOString().slice(0,10);
  const movimentosQuery = db.from("financeiro_conta_movimentos").select("id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,comprovante_referencia,created_at").eq("empresa_id", empresaAtiva.id).order("created_at", { ascending: false });
  if (fim) movimentosQuery.lte("data_movimento", fim);
  const extratoQuery = db.from("financeiro_socios_extrato").select("*").eq("empresa_id", empresaAtiva.id).order("created_at", { ascending: false }).limit(100);
  if (inicio && fim) extratoQuery.gte("data_movimento", inicio).lte("data_movimento", fim);
  const impostosQuery = db.from("comissao_previsoes_franquia").select("competencia,valor_imposto").eq("empresa_id", empresaAtiva.id).neq("status", "cancelada");
  if (mes !== "todos") impostosQuery.eq("competencia", mes);
  const [contasRes, movimentosRes, sociosRes, extratoRes, instrucoesRes, transferenciasRes, impostosRes] = await Promise.all([
    db.from("financeiro_contas_bancarias").select("id,nome,banco,conta_mascarada,tipo_conta,saldo_inicial,ativo").eq("empresa_id", empresaAtiva.id).eq("ativo", true).order("nome"),
    movimentosQuery,
    db.from("financeiro_socios_saldos").select("*").eq("empresa_id", empresaAtiva.id).order("nome"),
    extratoQuery,
    db.from("financeiro_fechamento_socios_instrucoes").select("id,fechamento_id,devedor_socio_id,credor_socio_id,valor_transferencia,descricao,conta_destino_snapshot,fechamento:financeiro_fechamentos_socios(periodo_inicio,periodo_fim)").eq("empresa_id", empresaAtiva.id).order("created_at", { ascending: false }).limit(50),
    db.from("financeiro_transferencias_socios").select("instrucao_id,valor").eq("empresa_id", empresaAtiva.id),
    impostosQuery,
  ]);
  for (const resposta of [contasRes, movimentosRes, sociosRes, extratoRes, instrucoesRes, transferenciasRes, impostosRes]) {
    if (resposta.error) throw new Error(resposta.error.message);
  }
  const movimentosAteFim = movimentosRes.data ?? [];
  const movimentos = inicio ? movimentosAteFim.filter((item) => item.data_movimento >= inicio) : movimentosAteFim;
  const contas = (contasRes.data ?? []).map((conta) => {
    const daContaAteFim = movimentosAteFim.filter((item) => item.conta_bancaria_id === conta.id);
    const daContaPeriodo = movimentos.filter((item) => item.conta_bancaria_id === conta.id);
    const totalEntradas = daContaPeriodo.filter((item) => item.tipo === "ENTRADA").reduce((soma,item)=>soma+Number(item.valor),0);
    const totalSaidas = daContaPeriodo.filter((item) => item.tipo === "SAIDA").reduce((soma,item)=>soma+Number(item.valor),0);
    const saldoAtual = Number(conta.saldo_inicial ?? 0)+daContaAteFim.reduce((soma,item)=>soma+(item.tipo === "ENTRADA" ? Number(item.valor) : -Number(item.valor)),0);
    return { ...conta, saldo_atual: saldoAtual, total_entradas: totalEntradas, total_saidas: totalSaidas };
  });
  const contaSelecionadaId = contas.some((conta) => conta.id === contaSolicitada) ? contaSolicitada : "todas";
  const movimentosExibidos = contaSelecionadaId === "todas"
    ? movimentos
    : movimentos.filter((item) => item.conta_bancaria_id === contaSelecionadaId);
  const contaSelecionada = contas.find((conta) => conta.id === contaSelecionadaId) ?? null;
  const socios = sociosRes.data ?? [];
  const extrato = extratoRes.data ?? [];
  const contasMap = new Map(contas.map((conta) => [conta.id, conta]));
  const sociosMap = new Map(socios.map((socio) => [socio.socio_id, socio]));
  const pagoPorInstrucao = new Map<string, number>();
  for (const transferencia of transferenciasRes.data ?? []) if (transferencia.instrucao_id) pagoPorInstrucao.set(transferencia.instrucao_id, (pagoPorInstrucao.get(transferencia.instrucao_id) ?? 0) + Number(transferencia.valor));
  const instrucoes = (instrucoesRes.data ?? []).map((instrucao) => ({ ...instrucao, saldo: Math.max(0, Number(instrucao.valor_transferencia) - (pagoPorInstrucao.get(instrucao.id) ?? 0)) })).filter((instrucao) => instrucao.saldo > 0);
  const saldoEmpresa = contas.reduce((soma, conta) => soma + Number(conta.saldo_atual), 0);
  const entradas = movimentos.filter((item) => item.tipo === "ENTRADA").reduce((soma, item) => soma + Number(item.valor), 0);
  const saidas = movimentos.filter((item) => item.tipo === "SAIDA").reduce((soma, item) => soma + Number(item.valor), 0);
  const creditoFiscalMes = (impostosRes.data ?? []).reduce((soma, item) => soma + Number(item.valor_imposto ?? 0), 0);

  return <main className="space-y-6 p-6">
    <header className="rounded-3xl bg-slate-950 p-7 text-white shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Financeiro da empresa</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black">Financeiro &amp; Caixa</h1><p className="mt-1 text-sm text-slate-300">Saldos bancários, entradas, comissões e equalização dos sócios.</p></div><div className="flex gap-2"><Link href="/erp/contas-pagar" className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold">Contas a pagar</Link><Link href="/erp/minhas-comissoes" className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold">Comissões</Link></div></div>
    </header>

    <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4 shadow-sm"><label className="text-xs font-black uppercase text-slate-600">Mês de referência<input type="month" name="mes" defaultValue={mes === "todos" ? competenciaAtual : mes} className={`${campo} mt-1 block`} /></label><label className="min-w-64 text-xs font-black uppercase text-slate-600">Conta para extrato<select name="conta" defaultValue={contaSelecionadaId} className={`${campo} mt-1 block w-full`}><option value="todas">Todas as contas</option>{contas.map((conta) => <option key={conta.id} value={conta.id}>{conta.nome}</option>)}</select></label><button className="rounded-xl bg-blue-800 px-5 py-2.5 text-sm font-black text-white">Consultar extrato</button><Link href="/erp/financeiro?mes=todos&conta=todas#extrato-contas" className={`rounded-xl border px-5 py-2.5 text-sm font-black ${mes === "todos" ? "border-blue-700 bg-blue-50 text-blue-800" : "text-slate-700"}`}>Todo o histórico</Link><p className="ml-auto text-xs font-bold text-slate-500">Exibindo: {mes === "todos" ? "todo o histórico" : mes}</p></form>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[['Saldo nas contas',saldoEmpresa,'bg-blue-50 border-blue-200 text-blue-950',mes === "todos" ? 'Saldo bancário atual' : `Saldo ao fim de ${mes}`],['Entradas registradas',entradas,'bg-emerald-50 border-emerald-200 text-emerald-950','Movimentos do período'],['Saídas registradas',saidas,'bg-rose-50 border-rose-200 text-rose-950','Movimentos do período'],['Crédito para impostos',creditoFiscalMes,'bg-amber-50 border-amber-200 text-amber-950',`Descontado das comissões · ${mes === "todos" ? "todos" : mes}`]].map(([titulo,valor,classe,detalhe]) => <div key={String(titulo)} className={`rounded-2xl border p-5 ${classe}`}><p className="text-xs font-black uppercase">{titulo}</p><p className="mt-2 text-3xl font-black">{brl(Number(valor))}</p><p className="mt-1 text-[11px] opacity-70">{detalhe}</p></div>)}
    </section>

    <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {contas.map((conta) => <article key={conta.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${contaSelecionadaId === conta.id ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200'}`}><div className="flex justify-between gap-3"><div><p className="font-black text-slate-950">{conta.nome}</p><p className="text-xs text-slate-500">{conta.banco || 'Banco não informado'} · {conta.conta_mascarada || 'Conta não informada'}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold">{conta.tipo_conta || 'CONTA'}</span></div><p className={`mt-5 text-3xl font-black ${Number(conta.saldo_atual) >= 0 ? 'text-blue-800' : 'text-rose-700'}`}>{brl(Number(conta.saldo_atual))}</p><div className="mt-3 flex justify-between text-xs"><span className="text-emerald-700">Entradas {brl(Number(conta.total_entradas))}</span><span className="text-rose-700">Saídas {brl(Number(conta.total_saidas))}</span></div><Link href={`/erp/financeiro?mes=${encodeURIComponent(mes)}&conta=${conta.id}#extrato-contas`} className="mt-4 block rounded-lg border border-blue-200 px-3 py-2 text-center text-xs font-black text-blue-800">Ver extrato desta conta</Link></article>)}
      {!contas.length ? <div className="rounded-2xl border border-dashed p-8 text-sm text-slate-500">Cadastre uma conta bancária em Contas a pagar para iniciar o controle por banco.</div> : null}
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <form action={registrarMovimentoBancarioAction} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <input type="hidden" name="operacao_id" value={operacao()} /><div className="sm:col-span-2"><h2 className="font-black">Dar entrada ou registrar saída</h2><p className="text-xs text-slate-500">Aportes, empréstimos e movimentos avulsos entram no caixa e na conta selecionada.</p></div>
        <select name="conta_id" required className={campo}><option value="">Conta bancária</option>{contas.map((conta) => <option key={conta.id} value={conta.id}>{conta.nome}</option>)}</select>
        <select name="tipo" required className={campo}><option value="ENTRADA">Entrada</option><option value="SAIDA">Saída</option></select>
        <select name="categoria" required className={campo}><option value="APORTE_SOCIO">Aporte de sócio</option><option value="EMPRESTIMO">Empréstimo</option><option value="RECEITA_DIVERSA">Outra receita</option><option value="DESPESA">Despesa</option><option value="AJUSTE">Ajuste</option></select>
        <input name="valor" required placeholder="Valor" className={campo} /><input type="date" name="data" required defaultValue={new Date().toISOString().slice(0,10)} className={campo} /><input name="descricao" required placeholder="Descrição" className={campo} /><input name="comprovante" placeholder="Referência do comprovante (opcional)" className={`${campo} sm:col-span-2`} /><button className="rounded-xl bg-blue-800 px-4 py-3 text-sm font-black text-white sm:col-span-2">Registrar movimento</button>
      </form>
      <form action={transferirEntreContasAction} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
        <input type="hidden" name="operacao_id" value={operacao()} /><div className="sm:col-span-2"><h2 className="font-black">Transferir entre contas da empresa</h2><p className="text-xs text-slate-500">Move saldo entre bancos sem alterar o caixa consolidado.</p></div>
        <select name="conta_origem_id" required className={campo}><option value="">Conta de origem</option>{contas.map((conta) => <option key={conta.id} value={conta.id}>{conta.nome}</option>)}</select><select name="conta_destino_id" required className={campo}><option value="">Conta de destino</option>{contas.map((conta) => <option key={conta.id} value={conta.id}>{conta.nome}</option>)}</select><input name="valor" required placeholder="Valor" className={campo} /><input type="date" name="data" required defaultValue={new Date().toISOString().slice(0,10)} className={campo} /><input name="descricao" defaultValue="Transferência entre contas da empresa" className={campo} /><input name="comprovante" placeholder="Referência do comprovante" className={campo} /><button className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white sm:col-span-2">Registrar transferência</button>
      </form>
    </section>

    <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">Contas internas dos sócios</h2><p className="text-xs text-slate-500">Comissões, despesas pagas pessoalmente e transferências de equalização.</p></div><Link href="/erp/contas-pagar" className="text-xs font-bold text-indigo-700">Abrir fechamento completo →</Link></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{socios.map((socio) => <div key={socio.socio_id} className="rounded-xl bg-indigo-50 p-4"><p className="text-xs font-black uppercase text-indigo-800">{socio.nome} · {Number(socio.percentual_participacao).toFixed(2)}%</p><p className="mt-2 text-2xl font-black text-indigo-950">{brl(Number(socio.saldo_interno))}</p><p className="text-[10px] text-indigo-700">Saldo interno, não saldo bancário pessoal</p></div>)}</div></section>

    {instrucoes.length ? <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div><h2 className="font-black text-amber-950">Transferências pendentes entre sócios</h2><p className="text-xs text-amber-800">Registre aqui depois que o PIX/TED for realizado.</p></div>{instrucoes.map((instrucao) => <form key={instrucao.id} action={registrarTransferenciaSociosAction} className="grid gap-3 rounded-xl border border-amber-200 bg-white p-4 lg:grid-cols-[1fr_12rem_11rem_1fr_auto]"><input type="hidden" name="operacao_id" value={operacao()} /><input type="hidden" name="instrucao_id" value={instrucao.id} /><input type="hidden" name="socio_origem_id" value={instrucao.devedor_socio_id} /><input type="hidden" name="socio_destino_id" value={instrucao.credor_socio_id} /><div><p className="text-sm font-bold">{sociosMap.get(instrucao.devedor_socio_id)?.nome} → {sociosMap.get(instrucao.credor_socio_id)?.nome}</p><p className="text-xs text-slate-500">{instrucao.descricao}</p></div><input name="valor" required defaultValue={instrucao.saldo.toFixed(2)} className={campo} /><input type="date" name="data" required defaultValue={new Date().toISOString().slice(0,10)} className={campo} /><input name="comprovante" placeholder="Comprovante / referência" className={campo} /><button className="rounded-xl bg-amber-700 px-4 py-2 text-xs font-black text-white">Confirmar transferência</button></form>)}</section> : null}

    <section className="grid gap-5 xl:grid-cols-2"><div id="extrato-contas" className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><h2 className="font-black">Extrato de entradas e saídas</h2><p className="text-xs text-slate-500">{contaSelecionada ? contaSelecionada.nome : 'Todas as contas'} · {mes === 'todos' ? 'todo o histórico' : mes}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">{movimentosExibidos.length} movimento(s)</span></div><div className="max-h-[32rem] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="p-3">Data</th><th className="p-3">Conta</th><th className="p-3">Tipo</th><th className="p-3">Descrição / origem</th><th className="p-3 text-right">Valor</th></tr></thead><tbody>{movimentosExibidos.map((item) => <tr key={item.id} className="border-t"><td className="p-3">{dataBr(item.data_movimento)}</td><td className="p-3 font-bold">{contasMap.get(item.conta_bancaria_id)?.nome || 'Conta'}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.tipo === 'ENTRADA' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{item.tipo}</span></td><td className="p-3"><div>{item.descricao}</div><div className="text-[10px] text-slate-400">{item.categoria}{item.comprovante_referencia ? ` · ${item.comprovante_referencia}` : ''}</div></td><td className={`p-3 text-right font-black ${item.tipo === 'ENTRADA' ? 'text-emerald-700' : 'text-rose-700'}`}>{item.tipo === 'ENTRADA' ? '+' : '-'} {brl(Number(item.valor))}</td></tr>)}{!movimentosExibidos.length ? <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Nenhuma movimentação encontrada para este filtro.</td></tr> : null}</tbody></table></div></div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-black">Extrato interno dos sócios</h2></div><div className="max-h-[32rem] overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-slate-500"><tr><th className="p-3">Data</th><th className="p-3">Sócio</th><th className="p-3">Descrição</th><th className="p-3 text-right">Movimento</th></tr></thead><tbody>{extrato.map((item) => <tr key={item.chave} className="border-t"><td className="p-3">{dataBr(item.data_movimento)}</td><td className="p-3 font-bold">{sociosMap.get(item.socio_id)?.nome || 'Sócio'}</td><td className="p-3">{item.descricao}</td><td className={`p-3 text-right font-black ${Number(item.credito) > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{Number(item.credito) > 0 ? '+' : '-'} {brl(Number(item.credito) || Number(item.debito))}</td></tr>)}</tbody></table></div></div></section>
  </main>;
}
