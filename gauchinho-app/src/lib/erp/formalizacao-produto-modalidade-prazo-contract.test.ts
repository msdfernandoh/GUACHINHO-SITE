import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relative: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relative), "utf8");

describe("formalização — produto, modalidade e prazo separados", () => {
  const page = read("src/app/erp/contratacoes/[id]/page.tsx");
  const fields = read("src/app/erp/contratacoes/[id]/formalizacao-catalogo-fields.tsx");
  const migration104 = read("../supabase/migrations/104_fix_rpc_prazo_total_e_governanca.sql");
  const migration105 = read("../supabase/migrations/105_hardening_multitenant_escala_franquias.sql");

  it("produto comercial transporta somente UUID e valor do crédito", () => {
    expect(page).toContain("grupos_cotas(id,valor_credito,ativo,status)");
    expect(page).not.toContain("grupos_cotas(id,valor_credito,valor_parcela");
    expect(fields).toContain("Crédito de {money.format(item.valorCredito)}");
  });

  it("modalidade escolhida altera a parcela exibida", () => {
    expect(fields).toContain('type="radio"');
    expect(fields).toContain('name="modalidade_comissao_id"');
    expect(fields).toContain("money.format(modalidade.valorParcela)");
    expect(fields).toContain("setModalidadeId(item.id)");
  });

  it("prazo da venda usa saldo do grupo e preserva prazo original no snapshot", () => {
    expect(migration104).toContain("calcular_prazo_restante_grupo");
    expect(migration104).not.toContain("v_opcao.prazo");
    expect(migration105).toContain("parcelas_restantes_venda");
    expect(migration105).toContain("prazo_original_grupo");
    expect(migration105).toContain("prazo_referencia_em");
  });

  it("não pré-seleciona grupo/cota por nome, valor aproximado ou primeiro item", () => {
    expect(page).toContain("Pré-seleção somente por UUID canônico");
    expect(page).not.toContain("Math.abs(o.valor_credito");
    expect(fields).toContain('setProdutoId("")');
    expect(fields).toContain('setModalidadeId("")');
  });
});
