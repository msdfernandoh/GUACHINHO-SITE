import { describe, expect, it } from "vitest";
import { commissionRuleScopesConflict, parseFranchiseRuleForm } from "./commission-rule-input";

function form(overrides: Record<string, string> = {}) {
  const values = {
    programa_id: "programa-1",
    base_calculo: "credito",
    valor_comissao: "2,75",
    vigencia_inicio: "2026-08-01",
    vigencia_fim: "",
    modalidade: "Imóvel",
    opcao_cota_id: "",
    plano_condicao: "Plano A",
    etapas_cronograma: JSON.stringify([
      { nome: "Adesão", mes_relativo: 1, percentual_etapa: "40" },
      { nome: "Parcela 2", mes_relativo: 2, percentual_etapa: "60" },
    ]),
    ...overrides,
  };
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("parseFranchiseRuleForm", () => {
  it("aceita uma regra explícita e normaliza seu escopo", () => {
    const parsed = parseFranchiseRuleForm(form());
    expect(parsed.valor).toBe(2.75);
    expect(parsed.modalidade).toBe("imóvel");
    expect(parsed.planoCondicao).toBe("plano a");
    expect(parsed.etapas).toHaveLength(2);
  });

  it("recusa cronograma percentual que não fecha em 100%", () => {
    expect(() => parseFranchiseRuleForm(form({ etapas_cronograma: JSON.stringify([{ nome: "Única", mes_relativo: 1, percentual_etapa: 99 }]) }))).toThrow("100%");
  });

  it("não fornece percentual implícito", () => {
    expect(() => parseFranchiseRuleForm(form({ valor_comissao: "" }))).toThrow("percentual");
  });

  it("exige que etapas de valor fixo fechem no total", () => {
    expect(() => parseFranchiseRuleForm(form({ base_calculo: "valor_fixo", valor_comissao: "1000", etapas_cronograma: JSON.stringify([{ nome: "Única", mes_relativo: 1, valor_etapa: 900 }]) }))).toThrow("valor fixo total");
  });

  it("identifica ambiguidade apenas no mesmo escopo e em vigências sobrepostas", () => {
    const base = { vigenciaInicio: "2026-01-01", vigenciaFim: "2026-12-31", modalidade: "imóvel", opcaoCotaId: null, planoCondicao: "reduzida" };
    expect(commissionRuleScopesConflict(base, { ...base, vigenciaInicio: "2026-06-01", vigenciaFim: null })).toBe(true);
    expect(commissionRuleScopesConflict(base, { ...base, modalidade: "automóvel" })).toBe(false);
    expect(commissionRuleScopesConflict(base, { ...base, vigenciaInicio: "2027-01-01", vigenciaFim: null })).toBe(false);
  });
});
