import { describe, expect, it } from "vitest";
import { agruparPeriodos, buscarCombinacoes, cronogramaMensal, faixasMensais, gerarOportunidades, taxaJuncao, type CotaMotor } from "./motor";
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

  it("sem nada na entrada, traz a mais próxima acima e abaixo avisando", () => {
    const duas = [cota("x", 516000, 216320, 166, 3485), cota("y", 925000, 168500, 35, 34326)];
    const r = buscarCombinacoes(duas, { credito: 700000, entradaMax: 50000, preferencia: "MENOR_PARCELA" });
    expect(r.entradaExcedida).toBe(true);
    expect(r.abaixo?.credito).toBe(516000);
    expect(r.acima?.credito).toBe(925000);
  });

  it("sem limite de cotas junta quantas precisar", () => {
    const muitas = Array.from({ length: 30 }, (_, i) => cota(`m${i}`, 100000 + i * 1000, 20000, 60, 1500));
    const r = buscarCombinacoes(muitas, { credito: 3000000, entradaMax: null, preferencia: "MENOR_PARCELA", maxCotas: 0 });
    expect(r.acima!.cotas.length).toBeGreaterThan(20);
    expect(Math.abs(r.acima!.credito - 3000000)).toBeLessThan(150000);
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

  it("lê a lista do WhatsApp com rótulos (uma carta por bloco)", () => {
    const t = `🏡 RACON CONSÓRCIOS
🔥 CARTAS CONTEMPLADAS DE IMÓVEIS
📅 Vencimentos: dezembro ou janeiro, conforme a carta.
━━━━━━━━━━━━━━
🏠 CARTA 01
💰 Crédito: R$ 311.000,00
💵 Entrada: R$ 195.300,00
📆 Prazo: 113 parcelas
💳 Parcela: R$ 2.002,26
📊 Saldo devedor: R$ 226.255,38
🗓 Vencimento: Dezembro
🤝 Comissão parceiro: R$ 5.000,00
━━━━━━━━━━━━━━
🏠 CARTA 02
💰 Crédito: R$ 219.000,00
💵 Entrada: R$ 48.000,00
📆 Prazo: 40 parcelas
💳 Parcela: R$ 7.186,53
📊 Saldo devedor: R$ 287.461,20
🗓 Vencimento: Janeiro
🤝 Comissão parceiro: R$ 5.000,00`;
    const r = lerCotasTexto(t, { tipo: "FIXO", valor: 0 });
    expect(r.length).toBe(2);
    expect(r[0].cota).toMatchObject({ credito: 311000, entrada: 195300, prazo: 113, parcela: 2002.26, saldo_devedor: 226255.38, vencimento_mes: 12, comissao_parceiro: 5000, tipo: "imovel", administradora: "racon" });
    expect(r[1].cota).toMatchObject({ credito: 219000, prazo: 40, vencimento_mes: 1 });
  });

  it("calcula a taxa mensal da junção (entrada sai do crédito)", () => {
    const c = cota("t", 516000, 206000, 166, 3485);
    const t = taxaJuncao([c], 206000, new Date(2026, 10, 18))!;
    expect(t.mensal * 100).toBeGreaterThan(0.8);
    expect(t.mensal * 100).toBeLessThan(0.9);
    expect(t.anual).toBeCloseTo(Math.pow(1 + t.mensal, 12) - 1, 10);
  });

  it("gera oportunidades sem repetir demais a mesma cota", () => {
    const ops = gerarOportunidades(cotas, "MENOR_ENTRADA", 3, undefined, () => 0);
    expect(ops.length).toBeGreaterThan(0);
  });

  it("lê planilha colada com títulos (prazo em R$, vencimento 10.01, comissão fixa)", () => {
    const t = [
      "CONTEMPLADAS VEÍCULOS RACON E RANDON   🚘🚘🚘\t\t\t",
      "ADMINISTRADORA\tTIPO\tCRÉDITO\tENTRADA \tPRAZO\tPARCELA\tSALDO DEVEDOR\tVENCIMENTO PARCELA\tCOMISSÃO PARCEIRO",
      "racon\tveiculo\tR$ 74.500,00\tR$ 29.900,00\tR$ 75,00\tR$ 1.152,00\tR$ 86.400,00\t10.01\tR$ 2.500,00",
      "Randon\tveiculo\tR$ 503.400,00\tR$ 220.000,00\tR$ 116,00\tR$ 4.789,00\tR$ 555.524,00\t19.11\tR$ 10.000,00",
    ].join("\n");
    const r = lerCotasTexto(t, { tipo: "FIXO", valor: 0 });
    expect(r.length).toBe(2);
    expect(r[0].cota).toMatchObject({ administradora: "racon", tipo: "automovel", credito: 74500, entrada: 29900, prazo: 75, parcela: 1152, saldo_devedor: 86400, vencimento_mes: 1, comissao_parceiro: 2500, comissao_fixada: true });
    expect(r[1].cota).toMatchObject({ administradora: "randon", prazo: 116, vencimento_mes: 11 });
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
