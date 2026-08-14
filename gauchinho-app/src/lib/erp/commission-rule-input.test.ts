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
    tipo_administradora_id: "tipo-1",
    modalidade_comissao_id: "modalidade-1",
    etapas_cronograma: JSON.stringify([
      { nome: "Adesão", tipo_gatilho: "MES_RELATIVO", mes_relativo: 1, percentual_venda: "1,25" },
      { nome: "Parcela 2", tipo_gatilho: "MES_RELATIVO", mes_relativo: 2, percentual_venda: "1,50" },
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

  it("recusa cronograma percentual que não fecha o total sobre a venda", () => {
    expect(() => parseFranchiseRuleForm(form({ etapas_cronograma: JSON.stringify([{ nome: "Única", tipo_gatilho: "MES_RELATIVO", mes_relativo: 1, percentual_venda: 2.5 }]) }))).toThrow("percentual total");
  });

  it("não fornece percentual implícito", () => {
    expect(() => parseFranchiseRuleForm(form({ valor_comissao: "" }))).toThrow("percentual");
  });

  it("exige que etapas de valor fixo fechem no total", () => {
    expect(() => parseFranchiseRuleForm(form({ base_calculo: "valor_fixo", valor_comissao: "1000", etapas_cronograma: JSON.stringify([{ nome: "Única", tipo_gatilho: "MES_RELATIVO", mes_relativo: 1, valor_etapa: 900 }]) }))).toThrow("valor fixo total");
  });

  it("aceita contemplação opcional sem mês fictício", () => {
    const parsed = parseFranchiseRuleForm(form({ etapas_cronograma: JSON.stringify([
      { nome: "1ª", tipo_gatilho: "MES_RELATIVO", mes_relativo: 1, percentual_venda: 1.5 },
      { nome: "CONTEMPLAÇÃO", tipo_gatilho: "CONTEMPLACAO", mes_relativo: null, percentual_venda: 1.25 },
    ]) }));
    expect(parsed.etapas[1]).toMatchObject({ tipo_gatilho: "CONTEMPLACAO", mes_relativo: null, percentual_venda: 1.25 });
  });

  it("identifica ambiguidade apenas no mesmo escopo e em vigências sobrepostas", () => {
    const base = { vigenciaInicio: "2026-01-01", vigenciaFim: "2026-12-31", modalidade: "imóvel", opcaoCotaId: null, planoCondicao: "reduzida" };
    expect(commissionRuleScopesConflict(base, { ...base, vigenciaInicio: "2026-06-01", vigenciaFim: null })).toBe(true);
    expect(commissionRuleScopesConflict(base, { ...base, modalidade: "automóvel" })).toBe(false);
    expect(commissionRuleScopesConflict(base, { ...base, vigenciaInicio: "2027-01-01", vigenciaFim: null })).toBe(false);
  });
});
