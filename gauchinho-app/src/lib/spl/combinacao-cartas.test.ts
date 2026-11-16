import { describe, expect, it } from "vitest";
import type { GrupoConsorcio, GrupoCota } from "@/lib/types";
import { acharGrupoPorCodigo, cotasElegiveis, sugerirComposicoes } from "./combinacao-cartas";

const agora = new Date().toISOString();
const grupo = {
  id: "g1553",
  codigo_grupo: "1553 IMÓVEL",
  modalidade: "Imóvel",
  administradora: "Racon",
  taxa_administrativa_percentual: 26,
  fundo_reserva_percentual: 1,
  seguro_habilitado: false,
  seguro_percentual: 0,
  seguro_valor: null,
  tem_parcela_reduzida: true,
  percentual_parcela_reduzida: 70,
  percentuais_parcela_reduzida: [70],
  permite_lance_embutido: true,
  percentual_lance_embutido: 25,
  percentual_recurso_proprio_sugerido: 0,
  prazo_total: 160,
  parcelas_realizadas: 0,
  prazo_restante: 160,
  seguro_pos_contemplacao: false,
  cet_percentual: null,
  status: "Disponível",
  ativo: true,
  created_at: agora,
  updated_at: agora,
} as unknown as GrupoConsorcio;

const cota = (valor: number, ordem: number): GrupoCota =>
  ({
    id: `c${valor}`,
    grupo_id: "g1553",
    valor_credito: valor,
    valor_parcela: valor * 0.0056,
    parcela_integral: valor * 0.008,
    parcela_reduzida: valor * 0.0056,
    parcela_com_seguro: null,
    parcela_sem_seguro: valor * 0.008,
    saldo_devedor: valor * 1.27,
    vagas_percentual: null,
    vagas_texto: null,
    status: "Disponível",
    ativo: true,
    ordem,
  }) as GrupoCota;

const cotas = [200_000, 250_000, 275_000, 300_000].map((v, i) => cota(v, i));
const plano = { reduzida: 70, embutido: 25 };

describe("sugerirComposicoes", () => {
  it("devolve uma opção abaixo e outra acima do valor das chaves", () => {
    const [abaixo, acima] = sugerirComposicoes({ grupo, cotas, modalidades: [], plano, valorLiquidoDesejado: 500_000 });
    expect(abaixo.posicao).toBe("abaixo");
    expect(acima.posicao).toBe("acima");
    expect(abaixo.creditoLiquido).toBeLessThanOrEqual(500_000);
    expect(acima.creditoLiquido).toBeGreaterThanOrEqual(500_000);
    expect(abaixo.creditoLiquido).toBeLessThan(acima.creditoLiquido);
  });

  it("usa o máximo de cotas que cabe no valor", () => {
    const [abaixo] = sugerirComposicoes({ grupo, cotas, modalidades: [], plano, valorLiquidoDesejado: 500_000 });
    // ~R$ 732 mil de crédito ÷ menor carta de R$ 200 mil = 3 cotas.
    expect(abaixo.totalCotas).toBe(3);
    expect(abaixo.itens.reduce((a, i) => a + i.quantidade, 0)).toBe(3);
  });

  it("aceita valores diferentes de carta na mesma composição", () => {
    const opcoes = sugerirComposicoes({ grupo, cotas, modalidades: [], plano, valorLiquidoDesejado: 500_000 });
    expect(opcoes.some((o) => o.itens.length > 1 || o.totalCotas >= 3)).toBe(true);
    for (const o of opcoes) {
      const soma = o.itens.reduce((a, i) => a + Number(i.cota.valor_credito) * i.quantidade, 0);
      expect(o.creditoContratado).toBe(soma);
      expect(o.parcelaAteContemplar).toBeGreaterThan(0);
    }
  });

  it("ignora cotas inativas e sem crédito", () => {
    const lista = [...cotas, { ...cota(100_000, 9), ativo: false }, { ...cota(0, 10) }];
    expect(cotasElegiveis(lista).map((c) => c.valor_credito)).toEqual([200_000, 250_000, 275_000, 300_000]);
  });

  it("acha o grupo pelo número", () => {
    expect(acharGrupoPorCodigo([{ grupo }], "1553")?.grupo.id).toBe("g1553");
    expect(acharGrupoPorCodigo([{ grupo }], "1563")).toBeNull();
  });
});
