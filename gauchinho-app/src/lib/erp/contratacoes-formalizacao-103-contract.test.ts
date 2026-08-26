import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration103 = fs.readFileSync(
  path.resolve(process.cwd(), "../supabase/migrations/103_fix_rpc_prazo_total_e_governanca.sql"),
  "utf8"
);
const migration127 = fs.readFileSync(
  path.resolve(process.cwd(), "../supabase/migrations/127_formalizacao_canonica_e_comissoes_estritas.sql"),
  "utf8"
);

describe("Fase 103 — Correção de RPC, Governança e Resolução de Contratações", () => {
  it("elimina qualquer referência a prazo_meses ou v_opcao.prazo na RPC", () => {
    expect(migration103).not.toContain("prazo_meses");
    expect(migration127).not.toContain("v_opcao.prazo");
    expect(migration127).toContain("v_grupo.prazo_total");
  });

  it("consolida governança dos grupos existentes como GLOBAL", () => {
    expect(migration103).toContain("UPDATE public.grupos_consorcio");
    expect(migration103).toContain("SET origem_governanca = 'GLOBAL'");
    expect(migration103).toContain("WHERE origem_governanca IS NULL");
  });

  it("garante auto-criação/vinculação de cliente caso cliente_id seja nulo ao formalizar", () => {
    expect(migration127).toContain("INSERT INTO public.clientes");
    expect(migration127).toContain("RETURNING id INTO v_contratacao.cliente_id");
    expect(migration127).toContain("INSERT INTO public.vendas");
  });

  it("garante que grupos_cotas inseridas não chamem coluna inexistente prazo", () => {
    expect(migration127).not.toMatch(/INSERT INTO public\.grupos_cotas\s*\([^)]*prazo[^)]*\)/);
  });
});
