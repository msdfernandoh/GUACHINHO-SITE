import { describe, expect, it } from "vitest";
import { fatorSeguroGrupo, parseSeguroInput } from "./seguro";
import {
  agregarResultadosLinhas,
  calcularLinhaSimulacaoGrupo,
  formatPrazoGrupo,
} from "./simulacao-linha";
import type { GrupoConsorcio, GrupoCota } from "@/lib/types";

const grupoBase: GrupoConsorcio = {
  id: "g1",
  codigo_grupo: "1533",
  modalidade: "Imóvel",
  administradora: null,
  taxa_administrativa_percentual: 20,
  fundo_reserva_percentual: 2,
  seguro_habilitado: true,
  seguro_percentual: 0.0004,
  seguro_valor: null,
  tem_parcela_reduzida: true,
  percentual_parcela_reduzida: 50,
  permite_lance_embutido: true,
  percentual_lance_embutido: 25,
  percentual_recurso_proprio_sugerido: 0,
  prazo_total: 220,
  parcelas_realizadas: 11,
  prazo_restante: 209,
  seguro_pos_contemplacao: false,
  cet_percentual: null,
  status: "Disponível",
  ativo: true,
  observacoes: null,
  created_at: "",
  updated_at: "",
};

const cota: GrupoCota = {
  id: "c1",
  grupo_id: "g1",
  valor_credito: 750_000,
  valor_parcela: 3000,
  parcela_integral: 6000,
  parcela_reduzida: 3000,
  parcela_com_seguro: 3100,
  parcela_sem_seguro: 6000,
  saldo_devedor: 623_483.33,
  vagas_percentual: null,
  vagas_texto: null,
  status: "Disponível",
  ativo: true,
  ordem: 0,
};

describe("seguro grupos", () => {
  it("fator decimal 0,0004", () => {
    expect(fatorSeguroGrupo(0.0004)).toBeCloseTo(0.0004);
    expect(parseSeguroInput("0,0004")).toBeCloseTo(0.0004);
  });

  it("legado percentual >= 0.1", () => {
    expect(fatorSeguroGrupo(1)).toBeCloseTo(0.01);
  });
});

describe("simulacao linha grupo", () => {
  it("soma cotas = crédito × qtd", () => {
    const r = calcularLinhaSimulacaoGrupo({
      grupo: grupoBase,
      cota,
      modalidades: [],
      config: {
        cotaId: cota.id,
        quantidadeCotas: 6,
        modalidadeParcela: "reduzida",
        usaLanceEmbutido: false,
        modalidadeLanceId: null,
        usaRecursoProprio: false,
        recursoProprioModo: "percentual",
        recursoProprioInput: 0,
        usaSeguro: false,
      },
    });
    expect(r.ativo).toBe(true);
    expect(r.somaCotas).toBe(4_500_000);
  });

  it("seguro mensal sobre saldo", () => {
    const r = calcularLinhaSimulacaoGrupo({
      grupo: grupoBase,
      cota,
      modalidades: [],
      config: {
        cotaId: cota.id,
        quantidadeCotas: 1,
        modalidadeParcela: "integral",
        usaLanceEmbutido: false,
        modalidadeLanceId: null,
        usaRecursoProprio: false,
        recursoProprioModo: "percentual",
        recursoProprioInput: 0,
        usaSeguro: true,
      },
    });
    expect(r.seguroMensal).toBeCloseTo(623_483.33 * 0.0004, 1);
  });

  it("agrega múltiplos grupos", () => {
    const linha = calcularLinhaSimulacaoGrupo({
      grupo: grupoBase,
      cota,
      modalidades: [],
      config: {
        cotaId: cota.id,
        quantidadeCotas: 2,
        modalidadeParcela: "reduzida",
        usaLanceEmbutido: true,
        modalidadeLanceId: null,
        usaRecursoProprio: false,
        recursoProprioModo: "percentual",
        recursoProprioInput: 0,
        usaSeguro: false,
      },
    });
    const tot = agregarResultadosLinhas([linha]);
    expect(tot.totalCotas).toBe(2);
    expect(tot.somaCotas).toBe(1_500_000);
  });

  it("formato prazo", () => {
    expect(formatPrazoGrupo(grupoBase)).toBe("220 / 209 / 11");
  });
});

describe("caso Excel — grupos 1513 e 1533", () => {
  const grupoExcel = (codigo: string, id: string): GrupoConsorcio => ({
    ...grupoBase,
    id,
    codigo_grupo: codigo,
    taxa_administrativa_percentual: 22,
    fundo_reserva_percentual: 2,
    seguro_habilitado: false,
    percentual_lance_embutido: 40,
    permite_lance_embutido: true,
  });

  const mod40 = [
    {
      id: "m40",
      grupo_id: "g",
      nome: "40% embutido",
      percentual_lance_embutido: 40,
      percentual_recurso_proprio_minimo: 0,
      descricao: null,
      ativo: true,
      ordem: 0,
      created_at: "",
      updated_at: "",
    },
  ];

  it("soma, lance e crédito líquido batem com planilha", () => {
    const c1513: GrupoCota = {
      ...cota,
      id: "c1513",
      valor_credito: 1_050_000,
      saldo_devedor: 1_037_000,
      valor_parcela: 3726.77,
    };
    const c1533: GrupoCota = {
      ...cota,
      id: "c1533",
      valor_credito: 1_000_000,
      saldo_devedor: 1_040_000,
      valor_parcela: 3726.76,
    };
    const cfg = {
      cotaId: "",
      quantidadeCotas: 1,
      modalidadeParcela: "reduzida" as const,
      usaLanceEmbutido: true,
      modalidadeLanceId: "m40",
      usaRecursoProprio: false,
      recursoProprioModo: "percentual" as const,
      recursoProprioInput: 0,
      usaSeguro: false,
    };
    const r1 = calcularLinhaSimulacaoGrupo({
      grupo: grupoExcel("1513", "g1513"),
      cota: c1513,
      modalidades: mod40,
      config: { ...cfg, cotaId: c1513.id },
    });
    const r2 = calcularLinhaSimulacaoGrupo({
      grupo: grupoExcel("1533", "g1533"),
      cota: c1533,
      modalidades: mod40,
      config: { ...cfg, cotaId: c1533.id },
    });
    const tot = agregarResultadosLinhas([r1, r2]);
    expect(tot.somaCotas).toBe(2_050_000);
    expect(tot.lanceEmbutido).toBeCloseTo(820_000, 0);
    expect(tot.creditoLiquido).toBeCloseTo(1_230_000, 0);
  });

  it("parcela reduzida usa prazo total (Excel 1533)", () => {
    const g1533 = {
      ...grupoExcel("1533", "g1533"),
      seguro_pos_contemplacao: true,
      seguro_percentual: 0.0004,
      percentual_parcela_reduzida: 60,
    };
    const c1533: GrupoCota = {
      ...cota,
      id: "c1533x",
      valor_credito: 1_000_000,
      saldo_devedor: 1_240_000,
      valor_parcela: 3381.82,
      parcela_integral: 5636.36,
      parcela_reduzida: 3381.82,
      parcela_com_seguro: 6132.36,
      parcela_sem_seguro: 5636.36,
    };
    const r = calcularLinhaSimulacaoGrupo({
      grupo: g1533,
      cota: c1533,
      modalidades: mod40,
      config: {
        cotaId: c1533.id,
        quantidadeCotas: 1,
        modalidadeParcela: "reduzida",
        usaLanceEmbutido: true,
        modalidadeLanceId: "m40",
        usaRecursoProprio: false,
        recursoProprioModo: "percentual",
        recursoProprioInput: 0,
        usaSeguro: false,
      },
    });
    expect(r.parcelaBase).toBeCloseTo(3381.82, 1);
  });
});
