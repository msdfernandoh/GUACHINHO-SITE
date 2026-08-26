import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "../supabase/migrations/136_importacao_clientes_legado_racon.sql"), "utf8");
const aliasMigration = readFileSync(resolve(process.cwd(), "../supabase/migrations/137_importacao_legado_alias_numerico_grupo.sql"), "utf8");

describe("migration 136 — carteira legada Racon", () => {
  it("isola faturamento, preserva auditoria e idempotência", () => {
    expect(migration).toContain("afeta_faturamento boolean NOT NULL DEFAULT true");
    expect(migration).toContain("IMPORTACAO_LEGADO");
    expect(migration).toContain("UNIQUE (empresa_id, idempotency_key)");
    expect(migration).toContain("public.can_write_tenant_internal(p_empresa_id)");
  });

  it("gera somente parcelas futuras e mantém pendências não bloqueantes", () => {
    expect(migration).toContain("v_data_pagamento >= p_data_referencia");
    expect(migration).toContain("PENDENTE_CPF_CNPJ");
    expect(migration).toContain("PENDENTE_TELEFONE");
    expect(migration).toContain("direto_ao_socio");
  });

  it("resolve o número simples sem renomear o grupo canônico", () => {
    expect(aliasMigration).toContain("regexp_replace(g.codigo_grupo,'[^0-9]','','g')");
    expect(aliasMigration).toContain("rpc_importar_clientes_legado_racon_canonico");
    expect(aliasMigration).not.toContain("UPDATE public.grupos_consorcio");
  });
});
