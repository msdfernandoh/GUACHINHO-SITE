import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/209_converter_racon_sinop_parceira_preservar_site.sql"), "utf8");
const canonical = fs.readFileSync(path.join(root, "supabase/migrations/210_racon_sinop_canonico_www.sql"), "utf8");

describe("Fase 209 — Racon Sinop como parceira da Gauchinho", () => {
  it("usa a identidade interna na chave estrangeira do site", () => {
    expect(migration).toContain("v_usuario_id uuid := public.current_usuario_id()");
    expect(migration).toContain("true, v_usuario_id");
    expect(migration).not.toContain("true, auth.uid()\n  ) RETURNING id INTO v_site_id");
  });

  it("preserva o modelo Racon e exige o domínio publicado", () => {
    expect(migration).toContain("codigo = 'racon_inspired'");
    expect(migration).toContain("lower(valor) = 'raconsinop.com.br'");
    expect(migration).toContain("principal AND ativo AND verificado AND status_ssl = 'READY'");
  });

  it("somente converte a origem sem fatos operacionais", () => {
    expect(migration).toContain("IF v_fatos <> 0 THEN");
    expect(migration).toContain("rpc_platform_converter_master_em_parceira");
    expect(migration).toContain("'CONVERTER PARA PARCEIRO'");
  });

  it("alinha o canonical ao host principal já configurado na Vercel", () => {
    expect(canonical).toContain("'principal_variant', 'www'");
    expect(canonical).toContain("canonical_redirect = true");
    expect(canonical).toContain("lower(valor) = 'raconsinop.com.br'");
  });
});
