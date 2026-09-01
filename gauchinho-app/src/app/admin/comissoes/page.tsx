import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import {
  listPrevisoesFranquiaForEmpresa,
  listPrevisoesParticipantesForEmpresa,
  type PrevisaoFranquiaRow,
} from "@/lib/comissoes/comissoes-service";
import {
  confirmarPagamentoComissaoAction,
  confirmarRecebimentoComissaoAction,
  transferirPendenciaComissaoAction,
} from "./actions";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const relation = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;

type Situacao = "recebido" | "atencao" | "ausente" | "aguardando";
type LinhaFranquia = PrevisaoFranquiaRow & { saldo: number; situacao: Situacao; arquivoRelatorio?: string };

function etiqueta(situacao: Situacao) {
  if (situacao === "recebido") return { texto: "Recebido pelo relatório", classe: "bg-emerald-100 text-emerald-800" };
  if (situacao === "atencao") return { texto: "Divergência no relatório", classe: "bg-rose-100 text-rose-800" };
  if (situacao === "ausente") return { texto: "Não veio no relatório", classe: "bg-amber-100 text-amber-900" };
  return { texto: "Aguardando relatório", classe: "bg-slate-100 text-slate-700" };
}

function LinhaReceita({ item, permitirAjuste = false }: { item: LinhaFranquia; permitirAjuste?: boolean }) {
  const venda = relation(item.venda);
  const cota = relation(item.cota);
  const tag = etiqueta(item.situacao);
  return (
    <tr className="border-t border-slate-100 align-top hover:bg-slate-50/70">
      <td className="px-4 py-3 font-bold text-slate-900">{item.competencia}</td>
      <td className="px-4 py-3">
        <div className="font-bold text-slate-900">{venda?.cliente_nome || "Cliente não identificado"}</div>
        <div className="mt-0.5 text-xs text-slate-500">Grupo {cota?.numero_grupo || "—"} · Cota {cota?.numero_cota || "pendente"}</div>
      </td>
      <td className="px-4 py-3 text-slate-700">{item.tipo_gatilho === "CONTEMPLACAO" ? "Contemplação" : item.nome_etapa}</td>
      <td className="px-4 py-3 text-right font-bold text-slate-900">{brl(Number(item.valor_previsto))}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${tag.classe}`}>{tag.texto}</span>
        {item.arquivoRelatorio ? <div className="mt-1 max-w-48 truncate text-[10px] text-slate-500">{item.arquivoRelatorio}</div> : null}
      </td>
      <td className="px-4 py-3 text-right">
        {item.situacao === "recebido" ? (
          <span className="text-xs font-bold text-emerald-700">Baixa automática</span>
        ) : permitirAjuste ? (
          <details className="ml-auto w-64 rounded-xl border border-slate-200 bg-white text-left shadow-sm">
            <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold text-slate-700">Ajustar manualmente</summary>
            <div className="space-y-3 border-t border-slate-100 p-3">
              <form action={confirmarRecebimentoComissaoAction} className="space-y-2">
                <input type="hidden" name="previsao_id" value={item.id} />
                <input type="hidden" name="observacao" value="Ajuste manual após conferência do relatório" />
                <label className="block text-[11px] font-bold text-slate-600">Valor recebido</label>
                <input name="valor" defaultValue={item.saldo.toFixed(2)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input name="motivo" placeholder="Motivo da divergência, se houver" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
                <button className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white">Registrar recebimento</button>
              </form>
              <form action={transferirPendenciaComissaoAction} className="space-y-2 border-t border-slate-100 pt-3">
                <input type="hidden" name="previsao_id" value={item.id} />
                <input type="month" name="competencia_destino" required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
                <input name="motivo_transferencia" required placeholder="Motivo da transferência" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs" />
                <button className="w-full rounded-lg border border-amber-500 px-3 py-2 text-xs font-black text-amber-800">Transferir pendência</button>
              </form>
            </div>
          </details>
        ) : <span className="text-xs text-slate-400">Sem ação necessária</span>}
      </td>
    </tr>
  );
}

function TabelaReceita({ itens, permitirAjuste = false }: { itens: LinhaFranquia[]; permitirAjuste?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
          <tr><th className="px-4 py-3">Competência</th><th className="px-4 py-3">Cliente e cota</th><th className="px-4 py-3">Parcela</th><th className="px-4 py-3 text-right">Previsto</th><th className="px-4 py-3">Conferência</th><th className="px-4 py-3 text-right">Ação</th></tr>
        </thead>
        <tbody>{itens.map((item) => <LinhaReceita key={item.id} item={item} permitirAjuste={permitirAjuste} />)}</tbody>
      </table>
    </div>
  );
}

export default async function AdminComissoesPage() {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (!empresaAtiva) notFound();
  const empresaId = empresaAtiva.id;
  const empresaNome = empresaAtiva.nome_fantasia ?? empresaAtiva.razao_social ?? "Consórcios";
  const db = await createClient();
  const [prevFranquia, prevParticipantes, importacoesRes, itensRepasseRes] = await Promise.all([
    listPrevisoesFranquiaForEmpresa(empresaId),
    listPrevisoesParticipantesForEmpresa(empresaId),
    db.from("erp_repasse_importacoes").select("id,administradora_id,competencia,arquivo_nome,status,created_at").eq("empresa_id", empresaId).order("created_at", { ascending: false }).limit(100),
    db.from("erp_repasse_importacao_itens").select("previsao_franquia_id,previsao_sugerida_id,status_conciliacao,importacao:erp_repasse_importacoes!inner(arquivo_nome,created_at)").eq("empresa_id", empresaId).or("previsao_franquia_id.not.is.null,previsao_sugerida_id.not.is.null"),
  ]);

  if (importacoesRes.error || itensRepasseRes.error) {
    throw new Error(
      `Nao foi possivel carregar a conferencia dos relatorios: ${importacoesRes.error?.message ?? itensRepasseRes.error?.message}`,
    );
  }

  const importacoes = importacoesRes.data ?? [];
  const relatoriosPorCompetencia = new Set(importacoes.map((item) => `${item.administradora_id}:${item.competencia}`));
  const vinculos = new Map<string, { status: string; arquivo: string }>();
  for (const row of itensRepasseRes.data ?? []) {
    const imp = relation(row.importacao as unknown as { arquivo_nome: string; created_at: string } | Array<{ arquivo_nome: string; created_at: string }> | null);
    for (const id of [row.previsao_franquia_id, row.previsao_sugerida_id]) {
      if (id && !vinculos.has(id)) vinculos.set(id, { status: row.status_conciliacao, arquivo: imp?.arquivo_nome || "Relatório importado" });
    }
  }

  const competenciaAtual = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cuiaba", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const linhas: LinhaFranquia[] = prevFranquia.map((item) => {
    const saldo = Math.max(0, Number(item.valor_previsto) - Number(item.valor_liquidado));
    const vinculo = vinculos.get(item.id);
    const relatorioImportado = relatoriosPorCompetencia.has(`${item.administradora_id}:${item.competencia}`);
    let situacao: Situacao = "aguardando";
    if (saldo <= 0) situacao = "recebido";
    else if (vinculo) situacao = "atencao";
    else if (relatorioImportado && item.competencia <= competenciaAtual) situacao = "ausente";
    return { ...item, saldo, situacao, arquivoRelatorio: vinculo?.arquivo };
  });
  const pendencias = linhas.filter((item) => item.situacao === "ausente" || item.situacao === "atencao");
  const aguardando = linhas.filter((item) => item.situacao === "aguardando" && item.status !== "cancelada" && item.status !== "suspensa");
  const recebidos = linhas.filter((item) => item.situacao === "recebido").sort((a, b) => b.competencia.localeCompare(a.competencia));
  const totalRecebido = prevFranquia.reduce((acc, item) => acc + Number(item.valor_liquidado ?? 0), 0);
  const totalPendenteRelatorio = pendencias.reduce((acc, item) => acc + item.saldo, 0);
  const totalAguardando = aguardando.reduce((acc, item) => acc + item.saldo, 0);
  const totalElegivelParticipantes = prevParticipantes.reduce((acc, item) => acc + Math.max(0, Number(item.valor_elegivel) - Number(item.valor_pago)), 0);
  const participantesAPagar = prevParticipantes.filter((item) => Number(item.valor_elegivel) > Number(item.valor_pago));

  return (
    <div className="space-y-6 p-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Recebimentos e comissões</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">Conferência de comissões da empresa</h1>
        <p className="mt-1 text-sm text-slate-500">{empresaNome} · O relatório importado confirma automaticamente as linhas vinculadas.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Recebido e conciliado", brl(totalRecebido), `${recebidos.length} parcelas baixadas`, "border-emerald-200 bg-emerald-50 text-emerald-900"],
          ["Não veio no relatório", brl(totalPendenteRelatorio), `${pendencias.length} itens para conferir`, "border-amber-200 bg-amber-50 text-amber-950"],
          ["Aguardando relatório", brl(totalAguardando), `${aguardando.length} parcelas previstas`, "border-slate-200 bg-slate-50 text-slate-900"],
          ["Liberado aos participantes", brl(totalElegivelParticipantes), `${participantesAPagar.length} pagamentos disponíveis`, "border-blue-200 bg-blue-50 text-blue-950"],
        ].map(([titulo, valor, detalhe, classe]) => <div key={titulo} className={`rounded-2xl border p-5 ${classe}`}><div className="text-[11px] font-black uppercase tracking-wide">{titulo}</div><div className="mt-2 text-2xl font-black">{valor}</div><div className="mt-1 text-xs opacity-75">{detalhe}</div></div>)}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 className="text-lg font-black text-slate-950">Pendências para conferir</h2><p className="text-xs text-slate-500">Somente diferenças ou parcelas esperadas que não apareceram no relatório.</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">{pendencias.length} pendências</span></div>
        {pendencias.length ? <TabelaReceita itens={pendencias} permitirAjuste /> : <div className="p-10 text-center"><div className="text-base font-black text-emerald-800">Tudo conferido</div><p className="mt-1 text-sm text-slate-500">Nenhuma diferença pendente nos relatórios importados.</p></div>}
      </section>

      <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" open={!pendencias.length}>
        <summary className="cursor-pointer list-none px-5 py-4"><div className="flex items-center justify-between"><div><h2 className="font-black text-slate-950">Próximos recebimentos</h2><p className="text-xs text-slate-500">Previsões ainda sem relatório importado. Nenhuma ação é necessária agora.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{aguardando.length}</span></div></summary>
        {aguardando.length ? <TabelaReceita itens={aguardando} /> : <p className="border-t p-6 text-sm text-slate-500">Nenhum recebimento aguardando relatório.</p>}
      </details>
      <details className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4"><div className="flex items-center justify-between"><div><h2 className="font-black text-slate-950">Histórico recebido</h2><p className="text-xs text-slate-500">Linhas já baixadas e liberadas para o fluxo de pagamento.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{recebidos.length}</span></div></summary>
        {recebidos.length ? <TabelaReceita itens={recebidos} /> : <p className="border-t p-6 text-sm text-slate-500">Nenhum recebimento conciliado.</p>}
      </details>

      <details className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4"><div className="flex items-center justify-between"><div><h2 className="font-black text-slate-950">Pagamentos dos participantes</h2><p className="text-xs text-slate-500">Disponível somente depois da baixa do recebimento da empresa.</p></div><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-900">{participantesAPagar.length} a pagar</span></div></summary>
        <div className="overflow-x-auto border-t border-blue-100"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-blue-50 text-[11px] font-black uppercase text-blue-900"><tr><th className="px-4 py-3">Competência</th><th className="px-4 py-3">Etapa</th><th className="px-4 py-3 text-right">Previsto</th><th className="px-4 py-3 text-right">Disponível</th><th className="px-4 py-3 text-right">Ação</th></tr></thead>
          <tbody>{prevParticipantes.map((item) => { const saldo = Math.max(0, Number(item.valor_elegivel) - Number(item.valor_pago)); return <tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-3 font-bold">{item.competencia}</td><td className="px-4 py-3">{item.nome_etapa}</td><td className="px-4 py-3 text-right">{brl(Number(item.valor_previsto))}</td><td className="px-4 py-3 text-right font-bold text-blue-800">{brl(saldo)}</td><td className="px-4 py-3 text-right">{saldo > 0 ? <form action={confirmarPagamentoComissaoAction}><input type="hidden" name="previsao_id" value={item.id} /><input type="hidden" name="valor" value={saldo.toFixed(2)} /><button className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white">Pagar saldo</button></form> : <span className="text-xs text-slate-400">Sem saldo liberado</span>}</td></tr>; })}</tbody>
        </table></div>
      </details>
    </div>
  );
}
