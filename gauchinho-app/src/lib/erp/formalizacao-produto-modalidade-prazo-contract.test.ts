import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relative: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relative), "utf8");

describe("formalização — produto, modalidade e prazo separados", () => {
  const page = read("src/app/erp/contratacoes/[id]/page.tsx");
  const fields = read("src/components/erp/contratacoes/formalizacao-venda-form.tsx");
  const migration126 = read("../supabase/migrations/126_hardening_multitenant_escala_franquias.sql");
  const migration127 = read("../supabase/migrations/127_formalizacao_canonica_e_comissoes_estritas.sql");

  it("produto comercial transporta somente UUID e valor do crédito", () => {
    expect(page).toContain("grupos_cotas(id,valor_credito,ativo,status");
    expect(page).not.toContain("grupos_cotas(id,valor_credito,valor_parcela");
    expect(fields).toContain("Crédito de {brl(Number(o.valor_credito))}");
  });

  it("modalidade escolhida altera a parcela exibida", () => {
    expect(fields).toContain('type="radio"');
    expect(fields).toContain('name="modalidade_comissao_id"');
    expect(fields).toContain("brl(modalidade.valor_parcela)");
    expect(fields).toContain("setSelectedModalidadeId(m.id)");
  });

  it("prazo da venda usa saldo do grupo e preserva prazo original no snapshot", () => {
    expect(migration126).toContain("calcular_prazo_restante_grupo");
    expect(migration127).not.toContain("v_opcao.prazo");
    expect(migration127).toContain("parcelas_restantes_venda");
    expect(migration127).toContain("prazo_original_grupo");
    expect(migration127).toContain("prazo_referencia_em");
  });

  it("não pré-seleciona grupo/cota por nome, valor aproximado ou primeiro item", () => {
    expect(page).toContain("Pré-seleção somente por UUID canônico");
    expect(page).not.toContain("Math.abs(o.valor_credito");
    expect(fields).toContain('setSelectedCotaId("")');
    expect(fields).toContain('setSelectedModalidadeId("")');
  });
});
