"use client";

import { useEffect, useState } from "react";
import { fetchRankingContemplacaoAction } from "@/app/erp/assembleias/actions";
import { percentualAtrasoValido, simularContemplacao, projetarChanceCotas, type BaseSimulacao, type classificarSimulacoes } from "@/lib/erp/simulacao-contemplacao";

export type RankingContemplacao = ReturnType<typeof classificarSimulacoes>;
const numero = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const percentual = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + "%";

export function ErpEstatisticaContemplacao({ base, grupoId, onSelecionar, onRanking }: {
  base: BaseSimulacao | null;
  grupoId: string;
  onSelecionar: (id: string) => void;
  onRanking: (ranking: RankingContemplacao) => void;
}) {
  const [atraso, setAtraso] = useState("30");
  const [cotasPorGrupo, setCotasPorGrupo] = useState<Record<string, string>>({});
  const [ranking, setRanking] = useState<RankingContemplacao>([]);
  const [atrasoRanking, setAtrasoRanking] = useState<number | null>(null);
  const [semEstimativa, setSemEstimativa] = useState(0);
  const [erroRanking, setErroRanking] = useState<string | null>(null);
  const atrasoNumero = atraso.trim() ? Number(atraso) : NaN;
  const valido = percentualAtrasoValido(atrasoNumero);
  useEffect(() => {
    let cancelado = false;
    if (!valido) return;
    const timer = setTimeout(() => {
      fetchRankingContemplacaoAction(atrasoNumero).then(res => {
        if (cancelado) return;
        setRanking(res.ranking); setAtrasoRanking(res.percentualAtraso);
        setSemEstimativa(res.gruposSemEstimativa); onRanking(res.ranking);
      }).catch((error: unknown) => {
        if (!cancelado) setErroRanking(error instanceof Error ? error.message : "Não foi possível comparar os grupos.");
      });
    }, 300);
    return () => { cancelado = true; clearTimeout(timer); };
  }, [atrasoNumero, valido, onRanking]);

  const rankingAtual = valido && atrasoRanking === atrasoNumero;
  const destaques = rankingAtual ? ranking.filter(g => g.posicaoChance <= 3 && g.chanceComLivre > 0) : [];
  const simulacao = base && valido ? simularContemplacao(base, atrasoNumero) : null;
  const selecionado = rankingAtual ? ranking.find(g => g.id === grupoId) : null;
  const cotasTexto = cotasPorGrupo[grupoId] ?? "1";
  const quantidade = cotasTexto.trim() ? Number(cotasTexto) : NaN;
  const quantidadeValida = Number.isSafeInteger(quantidade) && quantidade >= 1
    && !(base?.cotasAEntregar != null && base.cotasAEntregar > 0 && quantidade > base.cotasAEntregar);
  const semLivre = simulacao?.disponivel ? projetarChanceCotas(simulacao.chanceSemLivre, quantidade, simulacao.cotasAEntregar) : null;
  const comLivre = simulacao?.disponivel ? projetarChanceCotas(simulacao.chanceComLivre, quantidade, simulacao.cotasAEntregar) : null;
  const projecao = (valor: typeof semLivre) => !quantidadeValida ? "—" : valor ? `${valor.limitada && quantidade > 1 ? "Até " : ""}${percentual(valor.percentual)}` : "Não estimável";
  return (
    <section aria-labelledby="titulo-estatistica" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 id="titulo-estatistica" className="text-base font-semibold text-slate-900">Chance média de contemplação</h3>
          <p className="text-sm text-slate-600">Estimativa por cota em dia na próxima assembleia. Usa todo o histórico verificado.</p>
        </div>
        <div className="contemplacoes-filtros grid grid-cols-1 gap-3 sm:grid-cols-2 md:shrink-0">
        <div>
          <label htmlFor="atraso-contemplacao" className="block text-sm font-medium mb-1">Cotas em atraso (%)</label>
          <input id="atraso-contemplacao" type="number" min="0" max="100" step="0.1" inputMode="decimal" value={atraso}
            aria-invalid={!valido} aria-describedby="hipotese-atraso"
            onChange={e => { setAtraso(e.target.value); setErroRanking(null); onRanking([]); }} className="w-32 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
          <p id="hipotese-atraso" className="mt-1 text-xs text-slate-600">Hipótese editável · atualização automática</p>
        </div>
        <div>
          <label htmlFor="cotas-cliente-contemplacao" className="block text-sm font-medium mb-1">Cotas do cliente no grupo</label>
          <input id="cotas-cliente-contemplacao" type="number" min="1" step="1" inputMode="numeric"
            max={base?.cotasAEntregar != null && base.cotasAEntregar > 0 ? base.cotasAEntregar : undefined}
            value={cotasTexto} disabled={!base} aria-invalid={!quantidadeValida} aria-describedby="hipotese-cotas-cliente"
            onChange={e => setCotasPorGrupo(anteriores => ({ ...anteriores, [grupoId]: e.target.value }))}
            className="w-32 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50" />
          <p id="hipotese-cotas-cliente" className="mt-1 text-xs text-slate-600">Em dia e ainda não contempladas</p>
        </div>
        </div>
      </div>
      {!valido && <p role="alert" className="text-sm text-red-700">Informe um percentual entre 0 e 100%.</p>}
      {base && !quantidadeValida && <p role="alert" className="text-sm text-red-700">Informe uma quantidade inteira positiva de cotas do cliente, até o total a entregar neste grupo.</p>}
      {valido && !rankingAtual && !erroRanking && <p role="status" className="text-sm text-slate-600">Atualizando comparação dos grupos…</p>}
      {erroRanking && <p role="alert" className="text-sm text-red-700">{erroRanking}</p>}
      {destaques.length > 0 && <div className="space-y-2">
        <p className="text-sm font-medium text-slate-800">Maiores chances estimadas por cota com lance livre no teto · três primeiras posições, incluindo empates</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {destaques.map(g => <button type="button" key={g.id} onClick={() => onSelecionar(g.id)} aria-pressed={grupoId === g.id}
            className="contemplacao-destaque rounded-xl border border-blue-200 bg-blue-50 p-3 text-left hover:border-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600">
            <div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{g.codigo}</strong><span className="contemplacao-tag">{g.posicaoChance}º em chance</span></div>
            <div className="mt-2 text-lg font-bold">{percentual(g.chanceComLivre)} <span className="text-xs font-normal">com livre</span></div>
            <div className="text-xs mt-1">{percentual(g.chanceSemLivre)} sem livre · {numero(g.mediaContemplacoes)} contemplações/assembleia</div>
          </button>)}
        </div>
      </div>}
      {rankingAtual && semEstimativa > 0 && <p className="text-xs text-slate-600">{semEstimativa} grupo(s) fora da comparação por ausência de histórico, saldo, cotas elegíveis ou cenário saturado.</p>}
      {selecionado && <div className="flex flex-wrap gap-2">
        {selecionado.posicaoChance <= 3 && selecionado.chanceComLivre > 0 && <span className="contemplacao-tag">Top 3 em chance com livre</span>}
        {selecionado.posicaoVolume <= 3 && selecionado.mediaContemplacoes > 0 && <span className="contemplacao-tag">Top 3 em contemplações por assembleia</span>}
      </div>}
      {simulacao && (simulacao.disponivel ? <div aria-live="polite" className="space-y-3">
        {quantidadeValida && <p className="text-sm font-medium text-slate-800">{quantidade === 1 ? "Chance média para uma cota" : `Projeção proporcional para ${numero(quantidade)} cotas do cliente`}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4"><div className="text-sm font-medium text-slate-700">Sem lance livre</div><div data-chance="sem-livre" className="mt-1 text-2xl font-bold text-slate-900">{projecao(semLivre)}</div><p className="mt-1 text-xs text-slate-600">Sorteio normal + fixo + segundo fixo</p><p data-chance-por-cota="sem-livre" className="mt-1 text-xs text-slate-600">{simulacao.chanceSemLivre == null ? "Base não estimável" : `${percentual(simulacao.chanceSemLivre)} por cota`}{quantidadeValida && quantidade > 1 ? ` × ${quantidade}` : ""}</p></div>
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4"><div className="text-sm font-medium text-slate-700">Com lance livre no teto</div><div data-chance="com-livre" className="mt-1 text-2xl font-bold text-blue-800">{projecao(comLivre)}</div><p className="mt-1 text-xs text-slate-600">Inclui as vagas de lance livre com empate no teto</p><p data-chance-por-cota="com-livre" className="mt-1 text-xs text-slate-600">{simulacao.chanceComLivre == null ? "Base não estimável" : `${percentual(simulacao.chanceComLivre)} por cota`}{quantidadeValida && quantidade > 1 ? ` × ${quantidade}` : ""}</p></div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4"><div className="text-sm font-medium text-slate-700">Cotas elegíveis estimadas</div><div data-elegiveis className="mt-1 text-2xl font-bold text-slate-900">{numero(simulacao.elegiveis)}</div><p className="mt-1 text-xs text-slate-600">{numero(simulacao.cotasAEntregar)} a entregar menos {numero(atrasoNumero)}% em atraso</p></div>
        </div>
        {quantidadeValida && quantidade > 1 && <p className="text-xs text-slate-600">Projeção proporcional: chance média por cota × quantidade informada, limitada a 100%. É uma soma estimada das chances, não a probabilidade exata de contemplar ao menos uma; a posição das cotas e o desempate em sequência influenciam o resultado conjunto.</p>}
        <p className="text-sm text-slate-700">Base: todas as {simulacao.assembleias} assembleias, da nº 1 à nº {simulacao.assembleias}. Contemplações ativas confirmadas: {simulacao.sorteios} por sorteio, {simulacao.fixos} por fixo, {simulacao.segundosFixos} por segundo fixo e {simulacao.livres} por livre. Assembleias sem contemplação também entram na média.</p>
        <p className="text-xs text-slate-600">Cálculo: média de contemplações por assembleia ÷ cotas elegíveis estimadas. Sem livre: {numero(simulacao.mediaSemLivre)} ÷ {numero(simulacao.elegiveis)}. Com livre: {numero(simulacao.mediaComLivre)} ÷ {numero(simulacao.elegiveis)}.</p>
        {simulacao.limitada && <p className="text-xs text-amber-800">Cenário saturado: a média histórica iguala ou supera as cotas elegíveis atuais. A chance afetada fica indisponível e o grupo não recebe classificação, em vez de apresentar 100% artificial.</p>}
      </div> : <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{simulacao.motivo}</p>)}
      <div className="border-t border-slate-200 pt-3 text-xs text-slate-600 space-y-1">
        <p>Hipótese de participação: todas as cotas elegíveis oferecem os lances fixos; no cenário com livre, também oferecem o teto e disputam o desempate. Não é utilizada uma taxa de abstenção.</p>
        <p>Regra informada: a próxima cota elegível acima da sorteada é chamada em ordem crescente. As modalidades não são tratadas como sorteios independentes; cada cota conta uma vez por assembleia.</p>
        <p>A estimativa é uma média do grupo. A chance individual depende da posição da cota e das ofertas efetivas, ainda não importadas. O histórico estima a quantidade de vagas; não confirma que os lances livres antigos estavam empatados nem garante a próxima contemplação.</p>
      </div>
    </section>
  );
}
