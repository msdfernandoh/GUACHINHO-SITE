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
