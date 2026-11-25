import { describe, expect, it } from "vitest";
import { calcularExtratoCota, proximidadesCota, type CotaExtrato } from "./extrato-cliente";

const cota: CotaExtrato = {
  id: "c", numero_grupo: "1203", numero_cota: "0493", grupo_id: "g", valor_credito: 110000,
  parcela: 1100, prazo: 180, contemplada: false, data_contemplacao: null,
  credito_atual_newcon: 110000, parcela_vigente_newcon: 1100, data_adesao_newcon: "2025-09-01",
  primeira_assembleia_newcon: "2025-11-12", venda: { data_venda: "2025-09-01", cliente_id: "cl" },
  snapshot_cota: { historico_reajustes_newcon: { registros: [
    { data_iso: "2025-01-01", preco: 100000, tipo: "I" },
    { data_iso: "2026-11-01", preco: 110000, tipo: "X", variacao_percentual: "10,0000" },
  ] } },
};

describe("extrato por cota", () => {
  it("respeita grupo em formação e recalcula parcelas no reajuste", () => {
    const dados = calcularExtratoCota(cota, "2026-11-25", "2026-11");
    expect(dados.quantidade).toBe(13);
    expect(dados.totalParcelas).toBe(13100);
    expect(dados.contratado).toBe(100000);
    expect(dados.valorizacao).toBe(10000);
    expect(dados.projecao3).toBe(146410);
    expect(dados.reajustou).toBe(true);
  });
  it("usa somente resultados ativos e a melhor distância numérica", () => {
    const dados = proximidadesCota(cota, [{
      id: "a", grupo_id: "g", assembleia_numero: 12, assembleia_data: "2026-10-10", criado_em: "2026-10-10",
      cotas: [
        { cota: "0493", modalidade: "SORTEIO", situacao_cota: "CANCELADA", percentual_lance: 0 },
        { cota: "0528", modalidade: "SORTEIO", situacao_cota: "ATIVA", percentual_lance: 0 },
      ],
    }], 3000, "2026-01-01", "2026-11-25");
    expect(dados[0].melhor.distancia).toBe(35);
    expect(dados[0].percentual).toBeCloseTo(98.833333);
  });
  it("informa ausência de histórico e de parcela sem estimar um total", () => {
    const dados = calcularExtratoCota({ ...cota, snapshot_cota: {}, parcela_vigente_newcon: null }, "2026-11-25", "2026-11");
    expect(dados.totalParcelas).toBeNull();
    expect(dados.contratado).toBeNull();
  });
});
