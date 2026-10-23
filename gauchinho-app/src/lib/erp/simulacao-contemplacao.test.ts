import { describe, expect, it } from "vitest";
import { classificarSimulacoes, simularContemplacao, type BaseSimulacao } from "./simulacao-contemplacao";
import type { ResultadoCota } from "./contemplacoes";
const c = (cota: string, modalidade: string, situacao_cota = "ATIVA"): ResultadoCota => ({ cota, modalidade, situacao_cota, percentual_lance: 50 });
const base = (): BaseSimulacao => ({ ultimaAssembleia: 2, historicoCompleto: true, cotasAEntregar: 1000, assembleias: [
  { numero: 1, cotas: [c("1", "SORTEIO"), c("2", "LANCE_FIXO"), c("3", "SEGUNDO_LANCE_FIXO"), c("4", "LANCE_LIVRE"), c("5", "LANCE_LIVRE"), c("6", "SORTEIO", "CANCELADA"), c("7", "LANCE_LIVRE", "DESCLASSIFICADA")] },
  { numero: 2, cotas: [] },
] });
describe("chance média por cota elegível", () => {
  it("usa todas as assembleias, inclui os dois fixos e exclui canceladas e desclassificadas", () => {
    const r = simularContemplacao(base(), 30);
    expect(r).toMatchObject({ disponivel: true, elegiveis: 700, assembleias: 2, sorteios: 1, fixos: 1, segundosFixos: 1, livres: 2, mediaSemLivre: 1.5, mediaComLivre: 2.5 });
    if (r.disponivel) { expect(r.chanceSemLivre).toBeCloseTo(1.5 / 700 * 100); expect(r.chanceComLivre).toBeCloseTo(2.5 / 700 * 100); }
  });
  it("não soma probabilidades independentes nem conta cota repetida entre modalidades", () => {
    const b = base(); b.assembleias[0].cotas.push(c("1", "LANCE_LIVRE"), c("4", "LANCE_LIVRE"), c("8", "LANCE_FIDELIDADE"));
    expect(simularContemplacao(b, 30)).toMatchObject({ livres: 2, mediaComLivre: 2.5 });
  });
  it("atualiza ao mudar atraso e não inventa 100% quando o histórico supera o saldo", () => {
    const a = simularContemplacao(base(), 0), b = simularContemplacao(base(), 50);
    if (a.disponivel && b.disponivel && a.chanceComLivre != null) expect(b.chanceComLivre).toBeCloseTo(a.chanceComLivre * 2);
    expect(simularContemplacao({ ...base(), cotasAEntregar: 1 }, 0)).toMatchObject({ chanceComLivre: null, limitada: true });
  });
  it("recusa lacunas, duplicação de assembleia, saldo desconhecido e percentuais inválidos", () => {
    for (const atraso of [-1, 101, NaN]) expect(simularContemplacao(base(), atraso).disponivel).toBe(false);
    expect(simularContemplacao(base(), 100).disponivel).toBe(false);
    expect(simularContemplacao({ ...base(), historicoCompleto: false }, 30).disponivel).toBe(false);
    expect(simularContemplacao({ ...base(), assembleias: [base().assembleias[0]] }, 30).disponivel).toBe(false);
    expect(simularContemplacao({ ...base(), assembleias: [base().assembleias[0], base().assembleias[0]] }, 30).disponivel).toBe(false);
    expect(simularContemplacao({ ...base(), cotasAEntregar: null }, 30).disponivel).toBe(false);
    expect(simularContemplacao({ ...base(), ultimaAssembleia: 0, assembleias: [] }, 30).disponivel).toBe(false);
  });
  it("classifica chance por saldo elegível, volume separadamente e preserva empates", () => {
    const grupos = [{ ...base(), id: "grande", codigo: "Grande" }, { ...base(), id: "pequeno", codigo: "Pequeno", cotasAEntregar: 100 }, { ...base(), id: "empate", codigo: "Empate", cotasAEntregar: 100 }];
    const r = classificarSimulacoes(grupos, 30);
    expect(r.filter(g => g.posicaoChance === 1).map(g => g.id).sort()).toEqual(["empate", "pequeno"]);
    expect(r.find(g => g.id === "grande")?.posicaoChance).toBe(3);
    expect(r.every(g => g.posicaoVolume === 1)).toBe(true);
  });
  it("cenário saturado não recebe tag de maior probabilidade", () => {
    expect(classificarSimulacoes([{ ...base(), id: 'fim', codigo: 'Fim', cotasAEntregar: 1 }], 30)).toEqual([]);
  });
});
