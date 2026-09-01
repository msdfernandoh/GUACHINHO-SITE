"use client";

import { useState, useMemo } from "react";
import { Calendar, CircleDollarSign, Clock, CheckCircle2, Layers3, Search, User, X } from "lucide-react";
import { conferirPagamentoAction, pagarComissoesAgrupadasAction } from "@/app/erp/minhas-comissoes/actions";
import type { ResumoVendasMes } from "@/lib/erp/minhas-comissoes-vendas";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type PrevisaoParticipanteItem = {
  id: string;
  nome_etapa: string;
  competencia: string;
  valor_previsto: number;
  valor_elegivel: number;
  valor_pago: number;
  valor_bruto_atribuido: number | null;
  valor_imposto_atribuido: number | null;
  valor_liquido: number;
  percentual_imposto: number | null;
  status: string;
  tipo_gatilho: string;
  conferido_por_participante: boolean;
  cliente_nome?: string;
  cota_numero?: string | null;
  grupo_codigo?: string;
  valor_credito?: number;
};

interface MinhasComissoesClientProps {
  participanteNome: string;
  previsoes: PrevisaoParticipanteItem[];
  mostrarDetalhesFiscais: boolean;
  resumoVendasMes: ResumoVendasMes;
  podeGerenciarFiscal: boolean;
  participantesEquipe: Array<{ id: string; nome: string; nome_exibicao: string | null }>;
  participanteSelecionadoId: string;
  participanteProprioId: string | null;
  podeGerenciarEquipe: boolean;
  podePagarEquipe: boolean;
  contasBancarias: Array<{ id: string; nome: string; banco: string | null; saldo_atual: number }>;
}

const brl = (val: number) =>
  val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function MinhasComissoesClient({
  participanteNome,
  previsoes,
  mostrarDetalhesFiscais,
  resumoVendasMes,
  podeGerenciarFiscal,
  participantesEquipe,
  participanteSelecionadoId,
  participanteProprioId,
  podeGerenciarEquipe,
  podePagarEquipe,
  contasBancarias,
}: MinhasComissoesClientProps) {
  const router = useRouter();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;

  const [filtroPeriodo, setFiltroPeriodo] = useState<string>("TODOS");
  const [mesEspecifico, setMesEspecifico] = useState<string>("");
  const [buscaCliente, setBuscaCliente] = useState<string>("");
  const [clienteSelecionado, setClienteSelecionado] = useState<string>("");
  const [selecionadasPagamento, setSelecionadasPagamento] = useState<Set<string>>(new Set());
  const [operacaoPagamento, setOperacaoPagamento] = useState(() => crypto.randomUUID());

  async function pagarSelecionadas(formData: FormData) {
    await pagarComissoesAgrupadasAction(formData);
    setSelecionadasPagamento(new Set());
    setOperacaoPagamento(crypto.randomUUID());
  }

  // Clientes únicos disponíveis
  const clientesDisponiveis = useMemo(() => {
    const list = previsoes.map((p) => p.cliente_nome).filter(Boolean) as string[];
    return Array.from(new Set(list)).sort();
  }, [previsoes]);

  // Competências únicas disponíveis
  const competenciasDisponiveis = useMemo(() => {
    const set = new Set(previsoes.map((p) => p.competencia).filter(Boolean));
    return Array.from(set).sort();
  }, [previsoes]);

  // Filtragem completa
  const previsoesFiltradas = useMemo(() => {
    return previsoes.filter((p) => {
      if (clienteSelecionado && p.cliente_nome !== clienteSelecionado) {
        return false;
      }
      if (buscaCliente.trim()) {
        const query = buscaCliente.trim().toLowerCase();
        const matchNome = p.cliente_nome?.toLowerCase().includes(query);
        const matchGrupo = p.grupo_codigo?.toLowerCase().includes(query);
        const matchCota = p.cota_numero?.toLowerCase().includes(query);
        if (!matchNome && !matchGrupo && !matchCota) return false;
      }
      if (mesEspecifico) {
        return p.competencia === mesEspecifico;
      }
      if (filtroPeriodo === "MES_ATUAL") {
        return p.competencia === currentMonth;
      }
      if (filtroPeriodo === "PROXIMO_MES") {
        return p.competencia === nextMonth;
      }
      if (filtroPeriodo === "PROXIMOS_3_MESES") {
        const m3 = new Date(now.getFullYear(), now.getMonth() + 3, 1);
        const m3Str = `${m3.getFullYear()}-${String(m3.getMonth() + 1).padStart(2, "0")}`;
        return p.competencia >= currentMonth && p.competencia <= m3Str;
      }
      if (filtroPeriodo === "PROXIMOS_6_MESES") {
        const m6 = new Date(now.getFullYear(), now.getMonth() + 6, 1);
        const m6Str = `${m6.getFullYear()}-${String(m6.getMonth() + 1).padStart(2, "0")}`;
        return p.competencia >= currentMonth && p.competencia <= m6Str;
      }
      if (filtroPeriodo === "FUTUROS") {
        return p.competencia >= currentMonth;
      }
      return true;
    });
  }, [previsoes, clienteSelecionado, buscaCliente, filtroPeriodo, mesEspecifico, currentMonth, nextMonth, now]);

  // Métricas do período filtrado
  const metricas = useMemo(() => {
    const totalLiquido = previsoesFiltradas.reduce((s, p) => s + Number(p.valor_liquido || 0), 0);
    const totalBruto = previsoesFiltradas.reduce(
      (s, p) => s + Number(p.valor_bruto_atribuido ?? p.valor_liquido ?? 0),
      0,
    );
    const totalImposto = previsoesFiltradas.reduce(
      (s, p) => s + Number(p.valor_imposto_atribuido ?? 0),
      0,
    );
    const totalElegivel = previsoesFiltradas.reduce((s, p) => s + Number(p.valor_elegivel || 0), 0);
    const totalPago = previsoesFiltradas.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
    const totalAReceber = totalLiquido - totalPago;

    // Métricas para o subconjunto de cliente (se filtrado) ou global
    const baseParaMeses = clienteSelecionado || buscaCliente.trim()
      ? previsoes.filter((p) => {
          if (clienteSelecionado && p.cliente_nome !== clienteSelecionado) return false;
          if (buscaCliente.trim()) {
            const query = buscaCliente.trim().toLowerCase();
            return p.cliente_nome?.toLowerCase().includes(query) || p.grupo_codigo?.toLowerCase().includes(query) || p.cota_numero?.toLowerCase().includes(query);
          }
          return true;
        })
      : previsoes;

    const ganhoMesAtual = baseParaMeses
      .filter((p) => p.competencia === currentMonth)
      .reduce((s, p) => s + Number(p.valor_previsto || 0), 0);

    const ganhoProximoMes = baseParaMeses
      .filter((p) => p.competencia === nextMonth)
      .reduce((s, p) => s + Number(p.valor_previsto || 0), 0);

    return {
      totalBruto,
      totalImposto,
      totalLiquido,
      totalElegivel,
      totalPago,
      totalAReceber,
      ganhoMesAtual,
      ganhoProximoMes,
    };
  }, [previsoesFiltradas, previsoes, clienteSelecionado, buscaCliente, currentMonth, nextMonth]);

  const temFiltroAtivo = Boolean(clienteSelecionado || buscaCliente || mesEspecifico || filtroPeriodo !== "TODOS");
  const elegiveisPagamento = previsoesFiltradas.filter((item) => Number(item.valor_elegivel) > Number(item.valor_pago));
  const totalSelecionado = elegiveisPagamento
    .filter((item) => selecionadasPagamento.has(item.id))
    .reduce((soma, item) => soma + Number(item.valor_elegivel) - Number(item.valor_pago), 0);

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <header className="rounded-3xl bg-slate-950 p-7 text-white shadow-xl">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Extrato &amp; Projeção de Comissões</p>
            <h1 className="mt-2 text-3xl font-black">{participanteNome}</h1>
          </div>
          {podeGerenciarEquipe ? (
            <label className="min-w-72 text-xs font-bold text-slate-200">
              Consultor da equipe
              <select
                value={participanteSelecionadoId}
                onChange={(event) => router.push(`/erp/minhas-comissoes?participante=${encodeURIComponent(event.target.value)}`)}
                className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm font-bold text-white"
              >
                {participantesEquipe.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome_exibicao || item.nome}{item.id === participanteProprioId ? " — Minhas comissões" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-slate-300">
          Acompanhe suas previsões mês a mês, valores elegíveis e repasses liberados por cliente e competência.
        </p>
      </header>

      {podeGerenciarFiscal && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          <p className="text-xs text-blue-900 dark:text-blue-200">Atualize o líquido das comissões pendentes de todos os participantes com uma única aplicação fiscal.</p>
          <Link href="/erp/regras-comissao?aba=fiscal" className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white">
            Aplicar imposto em lote
          </Link>
        </div>
      )}

      {podePagarEquipe && elegiveisPagamento.length ? (
        <form action={pagarSelecionadas} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <input type="hidden" name="participante_id" value={participanteSelecionadoId} />
          <input type="hidden" name="operacao_id" value={operacaoPagamento} />
          <input type="hidden" name="previsoes_ids" value={JSON.stringify([...selecionadasPagamento])} />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-emerald-900">Pagamento agrupado</p>
              <p className="mt-1 text-sm text-emerald-800">{selecionadasPagamento.size} parcela(s) · {brl(totalSelecionado)}</p>
            </div>
            <label className="min-w-72 text-xs font-bold text-emerald-950">Conta da empresa
              <select name="conta_origem_id" required className="mt-1 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm">
                <option value="">Selecione a conta de saída</option>
                {contasBancarias.map((conta) => <option key={conta.id} value={conta.id}>{conta.nome} · saldo {brl(conta.saldo_atual)}</option>)}
              </select>
            </label>
            <button disabled={!selecionadasPagamento.size} className="rounded-xl bg-emerald-800 px-5 py-2.5 text-xs font-black text-white disabled:opacity-40">Pagar selecionadas</button>
          </div>
        </form>
      ) : null}

      {/* Barra de Filtros: Cliente + Competência */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        {/* Linha 1: Filtro por Cliente */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Filtrar por Cliente:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl justify-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar cliente, grupo ou cota..."
                value={buscaCliente}
                onChange={(e) => {
                  setBuscaCliente(e.target.value);
                  if (e.target.value) setClienteSelecionado("");
                }}
                className="w-full rounded-xl border border-slate-300 bg-slate-50/50 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {buscaCliente && (
                <button
                  type="button"
                  onClick={() => setBuscaCliente("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {clientesDisponiveis.length > 0 && (
              <select
                value={clienteSelecionado}
                onChange={(e) => {
                  setClienteSelecionado(e.target.value);
                  if (e.target.value) setBuscaCliente("");
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Todos os clientes ({clientesDisponiveis.length})</option>
                {clientesDisponiveis.map((cli) => (
                  <option key={cli} value={cli}>
                    {cli}
                  </option>
                ))}
              </select>
            )}

            {temFiltroAtivo && (
              <button
                type="button"
                onClick={() => {
                  setFiltroPeriodo("TODOS");
                  setMesEspecifico("");
                  setBuscaCliente("");
                  setClienteSelecionado("");
                }}
                className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
              >
                <X className="h-3 w-3" />
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Linha 2: Filtro por Período / Competência */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Filtro de Recebimento:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              ["TODOS", "Todos os Meses"],
              ["MES_ATUAL", `Mês Atual (${currentMonth})`],
              ["PROXIMO_MES", `Próximo Mês (${nextMonth})`],
              ["PROXIMOS_3_MESES", "Próximos 3 Meses"],
              ["PROXIMOS_6_MESES", "Próximos 6 Meses"],
              ["FUTUROS", "Meses Futuros"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setFiltroPeriodo(key);
                  setMesEspecifico("");
                }}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  filtroPeriodo === key && !mesEspecifico
                    ? "bg-blue-700 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}

            {competenciasDisponiveis.length > 0 && (
              <select
                value={mesEspecifico}
                onChange={(e) => {
                  setMesEspecifico(e.target.value);
                  if (e.target.value) setFiltroPeriodo("");
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Selecione mês específico</option>
                {competenciasDisponiveis.map((comp) => (
                  <option key={comp} value={comp}>
                    {comp}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Indicadores comerciais fixos do mês da venda */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5 shadow-2xs dark:border-cyan-900/40 dark:bg-cyan-950/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-cyan-800 dark:text-cyan-300">
                Valor em cotas vendidas no mês ({resumoVendasMes.competencia})
              </p>
              <p className="mt-2 text-2xl font-black text-cyan-950 dark:text-cyan-100">
                {brl(resumoVendasMes.valorVendido)}
              </p>
              <p className="mt-1 text-[11px] text-cyan-700/80">
                Crédito total de {resumoVendasMes.quantidadeVendas} {resumoVendasMes.quantidadeVendas === 1 ? "venda confirmada" : "vendas confirmadas"}
              </p>
            </div>
            <CircleDollarSign className="h-8 w-8 shrink-0 text-cyan-700 dark:text-cyan-300" />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Cotas vendidas no mês ({resumoVendasMes.competencia})
              </p>
              <p className="mt-2 text-2xl font-black text-amber-950 dark:text-amber-100">
                {resumoVendasMes.quantidadeCotas.toLocaleString("pt-BR")} {resumoVendasMes.quantidadeCotas === 1 ? "cota" : "cotas"}
              </p>
              <p className="mt-1 text-[11px] text-amber-700/80">
                Soma da quantidade de cotas das vendas que afetam o faturamento
              </p>
            </div>
            <Layers3 className="h-8 w-8 shrink-0 text-amber-700 dark:text-amber-300" />
          </div>
        </div>
      </section>

      {/* Cards de Métricas */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500">
            Valor líquido previsto {clienteSelecionado ? `(${clienteSelecionado})` : "no período"}
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{brl(metricas.totalLiquido)}</p>
          {mostrarDetalhesFiscais ? (
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-[11px] dark:border-slate-800">
              <div className="flex justify-between text-slate-500"><span>Bruto proporcional</span><strong>{brl(metricas.totalBruto)}</strong></div>
              <div className="flex justify-between text-rose-600"><span>Imposto abatido</span><strong>- {brl(metricas.totalImposto)}</strong></div>
              <div className="flex justify-between text-emerald-700"><span>Líquido do participante</span><strong>{brl(metricas.totalLiquido)}</strong></div>
            </div>
          ) : (
            <p className="mt-1 text-[11px] text-slate-400">{previsoesFiltradas.length} parcelas · imposto já abatido</p>
          )}
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-2xs dark:border-blue-900/40 dark:bg-blue-950/20">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Recebimento do Mês Atual ({currentMonth})</p>
          <p className="mt-2 text-2xl font-black text-blue-900 dark:text-blue-100">{brl(metricas.ganhoMesAtual)}</p>
          <p className="mt-1 text-[11px] text-blue-700/80">Projetado para este mês</p>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-2xs dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">Próximo Mês ({nextMonth})</p>
          <p className="mt-2 text-2xl font-black text-indigo-900 dark:text-indigo-100">{brl(metricas.ganhoProximoMes)}</p>
          <p className="mt-1 text-[11px] text-indigo-700/80">Projetado para o mês seguinte</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Total Já Pago / Liquidado</p>
          <p className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-100">{brl(metricas.totalPago)}</p>
          <p className="mt-1 text-[11px] text-emerald-700/80">A receber: {brl(metricas.totalAReceber)}</p>
        </div>
      </section>

      {/* Tabela de Previsões */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">
            Detalhamento das Parcelas de Comissão ({previsoesFiltradas.length})
            {clienteSelecionado && <span className="ml-2 text-blue-700 font-bold">— Cliente: {clienteSelecionado}</span>}
          </h2>
        </div>

        {previsoesFiltradas.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 space-y-2">
            <Clock className="mx-auto h-8 w-8 text-slate-300" />
            <p className="font-bold text-slate-700 dark:text-slate-300">Nenhuma parcela prevista para o filtro selecionado.</p>
            <p>Tente ajustar o filtro de cliente ou período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  {podePagarEquipe ? <th className="p-3"><span className="sr-only">Selecionar</span></th> : null}
                  <th className="p-3">Competência</th>
                  <th className="p-3">Cliente / Cota</th>
                  <th className="p-3">Etapa / Parcela</th>
                  {mostrarDetalhesFiscais ? <th className="p-3">Bruto proporcional</th> : null}
                  {mostrarDetalhesFiscais ? <th className="p-3">Imposto</th> : null}
                  <th className="p-3">Líquido gerado</th>
                  <th className="p-3">Elegível</th>
                  <th className="p-3">Pago</th>
                  <th className="p-3 text-right">Conferência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previsoesFiltradas.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    {podePagarEquipe ? <td className="p-3">{Number(row.valor_elegivel) > Number(row.valor_pago) ? <input type="checkbox" aria-label={`Selecionar comissão de ${row.cliente_nome || row.id}`} checked={selecionadasPagamento.has(row.id)} onChange={(event) => setSelecionadasPagamento((atual) => { const proximo = new Set(atual); if (event.target.checked) proximo.add(row.id); else proximo.delete(row.id); return proximo; })} /> : null}</td> : null}
                    <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400">
                      {row.competencia}
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {row.cliente_nome || "Venda Consórcio"}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {row.grupo_codigo ? `Grupo ${row.grupo_codigo}` : ""} · {row.cota_numero ? `Cota #${row.cota_numero}` : "Pendente SIF"}
                        {row.valor_credito ? ` · Crédito: ${brl(row.valor_credito)}` : ""}
                      </div>
                    </td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                      {row.tipo_gatilho === "CONTEMPLACAO" ? "CONTEMPLAÇÃO" : row.nome_etapa}
                    </td>
                    {mostrarDetalhesFiscais ? (
                      <td className="p-3 font-mono text-slate-700 dark:text-slate-300">
                        {row.valor_bruto_atribuido == null ? "—" : brl(row.valor_bruto_atribuido)}
                      </td>
                    ) : null}
                    {mostrarDetalhesFiscais ? (
                      <td className="p-3 font-mono text-rose-700 dark:text-rose-400">
                        {row.valor_imposto_atribuido == null ? "—" : `- ${brl(row.valor_imposto_atribuido)}`}
                        {row.percentual_imposto != null ? <span className="ml-1 text-[9px]">({row.percentual_imposto}%)</span> : null}
                      </td>
                    ) : null}
                    <td className="p-3 font-mono font-bold text-slate-950 dark:text-white">{brl(Number(row.valor_liquido))}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{brl(Number(row.valor_elegivel))}</td>
                    <td className="p-3 font-mono text-emerald-700 dark:text-emerald-400 font-bold">{brl(Number(row.valor_pago))}</td>
                    <td className="p-3 text-right">
                      {podePagarEquipe && Number(row.valor_elegivel) > Number(row.valor_pago) ? (
                        <span className="text-[11px] font-bold text-emerald-700">Selecione para pagar</span>
                      ) : row.conferido_por_participante ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Conferido por mim
                        </span>
                      ) : Number(row.valor_pago) > 0 ? (
                        <form action={conferirPagamentoAction}>
                          <input type="hidden" name="previsao_id" value={row.id} />
                          <button className="rounded-xl bg-blue-700 px-3 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-blue-800 cursor-pointer">
                            Conferir / recebido
                          </button>
                        </form>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">
                          {row.status === "cancelada" ? "Cancelada (Estorno)" : "Aguardando liberação"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
