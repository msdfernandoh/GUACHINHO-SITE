import { describe, expect, it } from "vitest";
import { opcoesVinculoRepasse, sugestaoVinculoRepasse } from "./repasse-vinculo-opcoes";

const item = { numero_grupo: "001453", numero_cota: "0414", cliente_nome: "MONICA LUZIA SINHORI", parcela_numero: 2, valor_comissao: 1060 };
const previsao = { id: "correta", numero_grupo: "1453 IMÓVEL", numero_cota: "414", cliente_nome: "Mônica Luzia Sinhori", ordem_etapa: 2, valor_previsto: 1060, valor_liquidado: 0, competencia: "2026-11" };

describe("opções seguras do vínculo de repasse", () => {
  it("identifica zeros e sufixos de grupo sem exigir competência igual", () => {
    expect(sugestaoVinculoRepasse([previsao], item)).toBe("correta");
  });
  it("remove outras cotas e grupos da seleção", () => {
    expect(opcoesVinculoRepasse([previsao, { ...previsao, numero_cota: "593" }, { ...previsao, numero_grupo: "1463" }], item)).toEqual([previsao]);
  });
  it("permite identificar manualmente cota ainda sem número", () => {
    expect(opcoesVinculoRepasse([{ ...previsao, numero_cota: null }], item)).toHaveLength(1);
  });
  it("não sugere arbitrariamente duas previsões idênticas", () => {
    expect(sugestaoVinculoRepasse([previsao, { ...previsao, id: "outra" }], item)).toBe("");
  });
  it("não sugere outra parcela, titular ou valor", () => {
    for (const alteracao of [{ ordem_etapa: 3 }, { cliente_nome: "Outro cliente" }, { valor_previsto: 1061 }, { valor_liquidado: 1 }]) {
      expect(sugestaoVinculoRepasse([{ ...previsao, ...alteracao }], item)).toBe("");
    }
  });
  it("não considera duas identidades vazias como correspondência", () => {
    expect(opcoesVinculoRepasse([{ numero_grupo: null, numero_cota: null }], { numero_grupo: "", numero_cota: "" })).toEqual([]);
  });
});
