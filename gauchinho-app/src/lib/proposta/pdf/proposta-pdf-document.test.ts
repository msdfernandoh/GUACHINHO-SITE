import { describe, expect, it } from "vitest";
import { renderPropostaPdfBuffer } from "./proposta-pdf-document";
import type { PropostaPdfData, GrupoPdfBlock, SegmentoPdf } from "./types";

function grupo(seg: "imovel" | "veiculo", codigo: string): GrupoPdfBlock {
  return {
    segmento: seg,
    codigoGrupo: codigo,
    cotaLabel: "R$ 250.000,00",
    quantidadeCotas: 1,
    administradora: "Racon",
    inicioGrupo: "15/08/2025",
    prazoTotal: seg === "imovel" ? 220 : 80,
    prazoRestante: seg === "imovel" ? 207 : 70,
    assembleiasDecorridas: 13,
    taxaAdmPercentual: seg === "imovel" ? 20 : 15,
    fundoReservaPercentual: seg === "imovel" ? 2 : 1,
    seguroLabel: "0,0400% / mês",
    reajusteLabel: seg === "imovel" ? "INCC · anual" : "pré-fixado 3% a.a.",
    contemplacaoLabel: "Sorteio e lance",
    custoBasePercentual: seg === "imovel" ? 22 : 16,
    custoMesLabel: seg === "imovel" ? "0,10%" : "0,20%",
    custoAnoLabel: seg === "imovel" ? "1,20%" : "2,40%",
    credito: seg === "imovel" ? 250000 : 120000,
    saldoDevedor: seg === "imovel" ? 305000 : 139200,
    primeiraParcela: seg === "imovel" ? 1508.36 : 932.64,
    parcelaTipoLabel: seg === "imovel" ? "parcela integral" : "parcela reduzida 50%",
    lanceEmbutido: seg === "imovel" ? 76250 : 27840,
    recursoProprio: seg === "imovel" ? 0 : 10000,
    lanceTotal: seg === "imovel" ? 76250 : 37840,
    creditoLiquido: seg === "imovel" ? 173750 : 92160,
    parcelaPosContemplacao: seg === "imovel" ? 1040 : 3150,
    modalidadeEscolhidaNome: "Lance Fixo 25%",
    modalidades: [
      { nome: "Lance Livre", embutidoLabel: "livre", recProprioLabel: "livre", baseLabel: "Saldo devedor", lanceTotalLabel: "variável", escolhida: false },
      { nome: "Lance Fixo 25%", embutidoLabel: "25%", recProprioLabel: "livre", baseLabel: "Saldo devedor", lanceTotalLabel: "R$ 76.250,00", escolhida: true },
    ],
    evolucao: [
      { periodo: "Contemplação", linhas: ["Saldo após lance R$ 228.750"] },
      { periodo: "Mês seguinte", linhas: ["Parcela ≈ R$ 1.040"] },
    ],
  };
}

function segmento(tipo: "imovel" | "veiculo", label: string): SegmentoPdf {
  const g = grupo(tipo, tipo === "imovel" ? "001453" : "005288");
  return {
    tipo,
    label,
    grupos: [g],
    totais: {
      credito: g.credito,
      primeiraParcela: g.primeiraParcela,
      lanceEmbutido: g.lanceEmbutido,
      recursoProprio: g.recursoProprio,
      lanceTotal: g.lanceTotal,
      creditoLiquido: g.creditoLiquido,
      parcelaPosContemplacao: g.parcelaPosContemplacao,
    },
  };
}

function baseData(overrides: Partial<PropostaPdfData>): PropostaPdfData {
  return {
    propostaId: "abcdef12-3456-7890-abcd-ef1234567890",
    dataEmissao: "01/09/2026",
    validadeTexto: "08/09/2026",
    cliente: { nome: "Joana Ribeiro Mendes", whatsapp: null, email: null, cidade: null },
    tipoProposta: "Consórcio — Grupos",
    tipoBem: null,
    parceiroNome: "Racon",
    consultor: { nome: "Carlos Eduardo Menezes", telefone: "(66) 99961-0000", email: null, usarConsultor: true },
    contatoGauchinho: { nomeEmpresa: "Gauchinho Consórcios", whatsapp: null, email: null, site: null, endereco: null },
    resumo: { valorCredito: 250000, prazo: 220, parcela: 1508, entrada: 0, lanceEmbutido: null, valorTotal: null, creditoLiquido: null },
    detalhesLinhas: [],
    gruposCotas: [],
    gruposTotais: null,
    comparativo: null,
    marcosProjecao: [],
    mostrarProjecao: false,
    capaEstilo: "padrao",
    observacaoConsultor: "Priorizei a compra do imóvel com Lance Fixo 25%.",
    segmentos: [],
    consolidado: null,
    blocos: { custoPlano: true, tiposLance: true, evolucao: true, comparativo: false, observacao: true },
    linhasGrupo: {
      administradora: true,
      taxaAdm: true,
      fundoReserva: true,
      seguro: true,
      reajuste: true,
      contemplacao: true,
      assembleiasDecorridas: false,
      prazoRestante: true,
    },
    ...overrides,
  };
}

describe("PDF de proposta — nova geração", () => {
  it("renderiza proposta só de imóvel (capa padrão)", async () => {
    const seg = segmento("imovel", "Imóvel");
    const buf = await renderPropostaPdfBuffer(baseData({ segmentos: [seg], consolidado: consolidadoDe([seg]) }));
    expect(buf.length).toBeGreaterThan(3000);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30000);

  it("renderiza proposta imóvel + veículo com capa campanha", async () => {
    const segs = [segmento("imovel", "Imóvel"), segmento("veiculo", "Veículo")];
    const buf = await renderPropostaPdfBuffer(
      baseData({ capaEstilo: "campanha", segmentos: segs, consolidado: consolidadoDe(segs) }),
    );
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30000);

  it("cai no layout legado quando não há segmentos", async () => {
    const buf = await renderPropostaPdfBuffer(baseData({ segmentos: [], consolidado: null }));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30000);
});

function consolidadoDe(segs: SegmentoPdf[]): PropostaPdfData["consolidado"] {
  const grupos = segs.flatMap((s) => s.grupos);
  return {
    totalGrupos: grupos.length,
    totalCotas: grupos.reduce((a, g) => a + g.quantidadeCotas, 0),
    credito: grupos.reduce((a, g) => a + g.credito, 0),
    primeiraParcela: grupos.reduce((a, g) => a + g.primeiraParcela, 0),
    lanceEmbutido: grupos.reduce((a, g) => a + g.lanceEmbutido, 0),
    recursoProprio: grupos.reduce((a, g) => a + g.recursoProprio, 0),
    lanceTotal: grupos.reduce((a, g) => a + g.lanceTotal, 0),
    creditoLiquido: grupos.reduce((a, g) => a + g.creditoLiquido, 0),
    parcelaPosContemplacaoMedia: grupos.reduce((a, g) => a + g.parcelaPosContemplacao, 0) / grupos.length,
  };
}
