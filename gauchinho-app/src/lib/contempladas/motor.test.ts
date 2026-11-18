import { describe, expect, it } from "vitest";
import { agruparPeriodos, buscarCombinacoes, cronogramaMensal, faixasMensais, type CotaMotor } from "./motor";
import { lerCotasTexto } from "./parser";

const cota = (id: string, credito: number, entrada: number, prazo: number, parcela: number, venc = 12): CotaMotor => ({
  id, codigo: id, administradora: "racon", tipo: "imovel", credito, entrada, prazo, parcela,
  saldo_devedor: parcela * prazo, vencimento_mes: venc, comissao_parceiro: 1000,
});

describe("contempladas motor", () => {
  const cotas = [cota("a", 100000, 30000, 50, 2000), cota("b", 150000, 40000, 100, 1500), cota("c", 60000, 20000, 30, 2100, 1)];

  it("junta cotas e traz uma opção acima e outra abaixo", () => {
    const r = buscarCombinacoes(cotas, { credito: 240000, entradaMax: 80000, preferencia: "MENOR_PARCELA" });
    expect(r.acima?.credito).toBe(250000);
    expect(r.acima?.entrada).toBe(70000);
    expect(r.abaixo?.credito).toBe(210000);
    expect(r.proximas.length).toBe(3);
  });

  it("respeita a entrada máxima", () => {
    const r = buscarCombinacoes(cotas, { credito: 300000, entradaMax: 50000, preferencia: "MENOR_PRAZO" });
    expect(r.acima).toBeNull();
    expect(r.abaixo!.entrada).toBeLessThanOrEqual(50000);
  });

  it("monta cronograma, faixas e períodos", () => {
    const meses = cronogramaMensal([cotas[0], cotas[2]], new Date(2026, 10, 18));
    expect(meses[0].mes).toBe("2026-12");
    expect(meses[0].total).toBe(2000);
    expect(meses[1].total).toBe(4100);
    const faixas = faixasMensais(meses);
    expect(faixas[0].meses).toBe(1);
    expect(faixas[1].valor).toBe(4100);
    expect(agruparPeriodos(meses, "ANUAL")[0].rotulo).toBe("2026");
  });

  it("lê linhas da planilha e aplica acréscimo", () => {
    const t = "racon\tIMÓVEL\tR$ 311.000,00\tR$ 195.300,00\t113\tR$ 2.002,26\tR$ 226.255,38\tdezembro\tR$ 5.000,00";
    const [l] = lerCotasTexto(t, { tipo: "PERCENTUAL", valor: 1 });
    expect(l.cota?.credito).toBe(311000);
    expect(l.cota?.entrada).toBe(198410);
    expect(l.cota?.vencimento_mes).toBe(12);
    expect(l.cota?.comissao_parceiro).toBe(5000);
  });
});
