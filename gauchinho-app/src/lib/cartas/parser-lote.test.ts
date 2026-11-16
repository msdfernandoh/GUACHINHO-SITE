import { describe, expect, it } from "vitest";
import { parseCartasWhatsAppLote, parseCartaWhatsAppText, separarMensagensWhatsApp } from "./parser";

const CONVERSA = `[10:41, 13/11/2026] +55 55 9966-5641: Contemplada RACON Veículo 🚘🚚🚜

Credito 131.000,00

Entrada 55.000,00

Prazo médio 84 x 1.712,25

Saldo devedor R$  144.000,00
Taxa de transferência 1.380
Vencimento 10 / 12
[12:58, 13/11/2026] +55 55 9966-5641: 🔥OPORTUNIDADE🔥

RACON CONSÓRCIOS - IMÓVEL 🏡🏠🏠

Crédito: R$ 370.000,00
Entrada: R$ 145.000,00
Prazo:
114 × R$ 3.721,20

Transferência: R$ 840
Saldo devedor: R$ 424.000,00
Vencimento: 10/12
[15:00, 13/11/2026] +55 55 9966-5641: 🔥OPORTUNIDADE IMPERDÍVEL🔥

RACON CONSÓRCIOS - IMÓVEL 🏡🏠🏠

Crédito: R$ 517.000,00
Entrada: *R$ 170.000,00*🤏🔥
Prazo:
124 × R$ 5.060

Transferência: R$ 2.520
Saldo devedor: R$ 628.000,00
Vencimento: 10/12`;

const HOJE = new Date(2026, 10, 15);

describe("importação de cartas do WhatsApp", () => {
  it("separa cada mensagem da conversa", () => {
    expect(separarMensagensWhatsApp(CONVERSA)).toHaveLength(3);
  });

  it("lê o formato de veículo com prazo na mesma linha", () => {
    const [veiculo] = parseCartasWhatsAppLote(CONVERSA, 10_000, HOJE);
    expect(veiculo.tipo_carta).toBe("automovel");
    expect(veiculo.administradora).toBe("RACON");
    expect(veiculo.credito).toBe(131_000);
    expect(veiculo.entrada_original).toBe(55_000);
    expect(veiculo.entrada).toBe(65_000);
    expect(veiculo.prazo_quantidade).toBe(84);
    expect(veiculo.valor_parcela).toBe(1_712.25);
    expect(veiculo.saldo_devedor).toBe(144_000);
    expect(veiculo.taxa_transferencia).toBe(1_380);
    expect(veiculo.proxima_parcela_data).toBe("2026-12-10");
    expect(veiculo.erro).toBeNull();
  });

  it("lê o formato OPORTUNIDADE com prazo na linha de baixo e ×", () => {
    const [, imovel, destaque] = parseCartasWhatsAppLote(CONVERSA, 10_000, HOJE);
    expect(imovel.tipo_carta).toBe("imovel");
    expect(imovel.administradora).toBe("RACON");
    expect(imovel.credito).toBe(370_000);
    expect(imovel.entrada).toBe(155_000);
    expect(imovel.prazo_quantidade).toBe(114);
    expect(imovel.valor_parcela).toBe(3_721.2);
    expect(imovel.saldo_devedor).toBe(424_000);
    expect(imovel.taxa_transferencia).toBe(840);
    expect(destaque.entrada_original).toBe(170_000);
    expect(destaque.valor_parcela).toBe(5_060);
  });

  it("vencimento já passado no ano vai para o ano seguinte", () => {
    const p = parseCartaWhatsAppText("IMÓVEL RACON\nCrédito: R$ 100.000,00\nVencimento: 10/01", HOJE);
    expect(p.proxima_parcela_data).toBe("2027-01-10");
  });

  it("aponta erro quando falta a entrada", () => {
    const [item] = parseCartasWhatsAppLote("IMÓVEL RACON\nCrédito: R$ 100.000,00", 10_000, HOJE);
    expect(item.erro).toBe("Entrada não encontrada.");
  });

  it("margem por tipo, tipo forçado e repetidas", () => {
    const itens = parseCartasWhatsAppLote(CONVERSA + "\n" + CONVERSA.split("[12:58")[0], { imovel: 10_000, automovel: 5_000 }, HOJE);
    expect(itens[0].entrada).toBe(60_000); // veículo: 55 mil + 5 mil
    expect(itens[1].entrada).toBe(155_000); // imóvel: 145 mil + 10 mil
    expect(itens.at(-1)?.repetida).toBe(true);
    const forcado = parseCartasWhatsAppLote("Crédito: R$ 100.000,00\nEntrada: R$ 30.000,00", { imovel: 10_000, automovel: 5_000 }, HOJE, "automovel");
    expect(forcado[0].tipo_carta).toBe("automovel");
    expect(forcado[0].erro).toBeNull();
  });
});
