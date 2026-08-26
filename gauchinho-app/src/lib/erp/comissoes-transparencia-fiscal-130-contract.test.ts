import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "..");
const sql = readFileSync(
  resolve(root, "supabase/migrations/130_comissoes_transparencia_fiscal_vinculo_previsoes.sql"),
  "utf8",
);
const page = readFileSync(resolve(process.cwd(), "src/app/erp/minhas-comissoes/page.tsx"), "utf8");
const client = readFileSync(
  resolve(process.cwd(), "src/components/erp/comissoes/minhas-comissoes-client.tsx"),
  "utf8",
);

describe("migration 130 - vínculo fiscal das previsões", () => {
  it("recupera somente vínculos históricos da mesma empresa e venda", () => {
    expect(sql).toContain("fonte_previsao_franquia_id");
    expect(sql).toContain("f.empresa_id = p.empresa_id");
    expect(sql).toContain("f.venda_id = p.venda_id");
  });

  it("protege novos vínculos cruzados entre tenants", () => {
    expect(sql).toContain("validar_previsao_participante_franquia_tenant");
    expect(sql).toContain("f.empresa_id = NEW.empresa_id");
    expect(sql).toContain("f.venda_id = NEW.venda_id");
  });

  it("indexa extrato por participante, empresa e competência", () => {
    expect(sql).toContain("comissao_prev_part_empresa_part_competencia_idx");
    expect(sql).toContain("comissao_prev_part_empresa_franquia_idx");
  });
});

describe("extrato fiscal de comissões", () => {
  it("lê os snapshots gravados na previsão da franquia", () => {
    expect(page).toContain("valor_bruto,percentual_imposto,valor_imposto,valor_liquido");
    expect(page).toContain("valor_bruto_atribuido");
    expect(page).toContain("valor_imposto_atribuido");
  });

  it("respeita a preferência de transparência da configuração fiscal", () => {
    expect(page).toContain("participante_exibe_detalhes_fiscais");
    expect(client).toContain("mostrarDetalhesFiscais");
  });

  it("distingue bruto, imposto e líquido na interface", () => {
    expect(client).toContain("Bruto proporcional");
    expect(client).toContain("Imposto abatido");
    expect(client).toContain("Líquido do participante");
    expect(client).toContain("Líquido gerado");
  });
});
