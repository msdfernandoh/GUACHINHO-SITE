import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), "..", file), "utf8");

describe("fase 257: consultores repetidos e vínculo de repasse", () => {
  it("chama a RPC com o mesmo nome de parâmetro publicado no banco", () => {
    const actions = read("gauchinho-app/src/app/erp/repasse-franquia/actions.ts");
    const migration = read("supabase/migrations/242_repasse_identificacao_cotas_apos_upload.sql");
    expect(migration).toContain("p_previsao_franquia_id uuid");
    expect(actions).toContain("p_previsao_franquia_id: previsaoId");
    expect(actions).not.toContain("p_nova_previsao_franquia_id: previsaoId");
  });

  it("identifica nomes repetidos e apresenta o perfil antes do consultor", () => {
    const page = read("gauchinho-app/src/components/erp/erp-operational-pages.tsx");
    const ui = read("gauchinho-app/src/components/erp/repasse-pdf-conciliacao.tsx");
    expect(page).toContain('from("participante_comissao_perfis")');
    expect(page).toContain("totalPorNome");
    expect(page).toContain("nome_repetido:");
    expect(ui).toContain('p.perfil_comissao || "Sem perfil de comissão"');
    expect(ui).toContain("`${p.perfil_comissao");
  });
});
