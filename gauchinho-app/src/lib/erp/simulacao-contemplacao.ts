import { type ResultadoCota } from "./contemplacoes";

export type AssembleiaSimulacao = { numero: number; cotas: ResultadoCota[] };
export type BaseSimulacao = {
  assembleias: AssembleiaSimulacao[];
  ultimaAssembleia: number;
  historicoCompleto: boolean;
  cotasAEntregar: number | null;
};

export function percentualAtrasoValido(valor: number) {
  return Number.isFinite(valor) && valor >= 0 && valor <= 100;
}

/** Média por cota elegível, não probabilidade individual por posição na pedra.
 * Todas as assembleias, inclusive as sem vencedores, compõem o denominador.
 * O cenário com livre assume oferta no teto e participação de todas as elegíveis.
 */
export function simularContemplacao(base: BaseSimulacao, percentualAtraso: number) {
  if (!percentualAtrasoValido(percentualAtraso)) return { disponivel: false as const, motivo: "Informe um percentual de atraso entre 0 e 100%." };
  const numeros = new Set(base.assembleias.map(a => a.numero));
  if (!base.historicoCompleto || base.ultimaAssembleia < 0 || !Number.isInteger(base.ultimaAssembleia)
    || numeros.size !== base.assembleias.length || numeros.size !== base.ultimaAssembleia
    || Array.from({ length: base.ultimaAssembleia }, (_, i) => i + 1).some(n => !numeros.has(n))) {
    return { disponivel: false as const, motivo: "A estimativa precisa do histórico completo desde a assembleia 1." };
  }
  if (!base.ultimaAssembleia) return { disponivel: false as const, motivo: "Este grupo ainda não tem assembleias realizadas para estimar as contemplações." };
  if (base.cotasAEntregar == null || !Number.isSafeInteger(base.cotasAEntregar) || base.cotasAEntregar < 0) {
    return { disponivel: false as const, motivo: "Quantidade de cotas a entregar indisponível para simulação." };
  }
  if (base.cotasAEntregar === 0) return { disponivel: false as const, motivo: "Não há cotas a entregar neste grupo." };
  const elegiveis = base.cotasAEntregar * (1 - percentualAtraso / 100);
  if (elegiveis < 1) return { disponivel: false as const, motivo: "O cenário resulta em menos de uma cota elegível. Reduza o percentual de atraso." };
  let sorteios = 0, fixos = 0, segundosFixos = 0, livres = 0;
  for (const ass of base.assembleias) {
    const ativas = ass.cotas.filter(c => c.situacao_cota === "ATIVA");
    const porModalidade = (modalidade: string) => new Set(ativas.filter(c => c.modalidade === modalidade).map(c => c.cota));
    const s = porModalidade("SORTEIO"), f = porModalidade("LANCE_FIXO"), sf = porModalidade("SEGUNDO_LANCE_FIXO"), l = porModalidade("LANCE_LIVRE");
    // Uma mesma cota nunca representa duas contemplações na mesma assembleia.
    const contadas = new Set<string>();
    const novas = (cotas: Set<string>) => { let total = 0; for (const cota of cotas) if (!contadas.has(cota)) { contadas.add(cota); total++; } return total; };
    sorteios += novas(s); fixos += novas(f); segundosFixos += novas(sf); livres += novas(l);
  }
  const totalSemLivre = sorteios + fixos + segundosFixos;
  const mediaSemLivre = totalSemLivre / base.ultimaAssembleia;
  const mediaLivre = livres / base.ultimaAssembleia;
  const mediaComLivre = mediaSemLivre + mediaLivre;
  return {
    disponivel: true as const, percentualAtraso, elegiveis, cotasAEntregar: base.cotasAEntregar,
    assembleias: base.ultimaAssembleia, sorteios, fixos, segundosFixos, livres,
    mediaSemLivre, mediaLivre, mediaComLivre,
    // Uma média histórica maior que o saldo elegível não projeta uma chance válida.
    // Não transformar esse caso em uma promessa artificial de 100%.
    chanceSemLivre: mediaSemLivre >= elegiveis ? null : mediaSemLivre / elegiveis * 100,
    chanceComLivre: mediaComLivre >= elegiveis ? null : mediaComLivre / elegiveis * 100,
    limitada: mediaComLivre >= elegiveis,
  };
}

export type GrupoRankingSimulacao = BaseSimulacao & { id: string; codigo: string };
export function classificarSimulacoes(grupos: GrupoRankingSimulacao[], percentualAtraso: number) {
  const validos = grupos.flatMap(g => {
    const s = simularContemplacao(g, percentualAtraso);
    return s.disponivel && s.chanceSemLivre != null && s.chanceComLivre != null ? [{ id: g.id, codigo: g.codigo, chanceSemLivre: s.chanceSemLivre, chanceComLivre: s.chanceComLivre,
      mediaContemplacoes: s.mediaComLivre, assembleias: s.assembleias, elegiveis: s.elegiveis }] : [];
  });
  // Mesmo valor recebe a mesma posição; evita favorecer um grupo por ordem alfabética.
  return validos.map(g => ({ ...g,
    posicaoChance: 1 + validos.filter(o => o.chanceComLivre > g.chanceComLivre + 1e-10).length,
    posicaoVolume: 1 + validos.filter(o => o.mediaContemplacoes > g.mediaContemplacoes + 1e-10).length,
  })).sort((a, b) => b.chanceComLivre - a.chanceComLivre || a.codigo.localeCompare(b.codigo));
}
