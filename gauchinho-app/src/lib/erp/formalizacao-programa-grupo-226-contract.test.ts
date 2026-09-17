import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relative: string) => fs.readFileSync(path.resolve(process.cwd(), relative), "utf8");

describe("Fase 238 — programa da comissão por grupo", () => {
  const migration = read("../supabase/migrations/226_formalizacao_programa_por_grupo_preservar_consultor.sql");
  const migration227 = read("../supabase/migrations/227_programas_tipos_n_n_perfil.sql");
  const action = read("src/app/erp/contratacoes/actions.ts");

  it("resolve uma única regra do perfil compatível com grupo e modalidade", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.comissao_programa_tipos");
    expect(migration).toContain("validar_comissao_programa_tipo_trigger");
    expect(migration227).toContain("DROP INDEX IF EXISTS public.uq_comissao_programa_tipo_operacional");
    expect(migration227).toContain("idx_comissao_programa_tipos_resolucao");
    expect(migration227).toContain("cbeba2f1-19f7-4465-be43-4d4ff5d4534d");
    expect(migration).toContain("SELECT array_agg(DISTINCT rp.programa_id) INTO v_programa_ids");
    expect(migration).toContain("p.administradora_id = v_grupo.administradora_id");
    expect(migration).toContain("pt.tipo_administradora_id = v_grupo.tipo_administradora_id");
    expect(migration).toContain("r.modalidade_comissao_id = p_modalidade_comissao_id");
    expect(migration).toContain("v_programa_id := v_programa_ids[1]");
  });

  it("preserva consultor, perfil e modalidade quando a formalização falha", () => {
    expect(action).toContain("payloadPendencia.participante_comercial_id = principalId");
    expect(action).toContain("perfil_principal_id: perfilPrincipalId");
    expect(action).toContain("modalidade_comissao_id: modalidadeComissaoId");
    expect(action).toContain("participante_principal_id: principalId");
  });
});
