import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("repasse — cadastro não bloqueante e decisões explícitas", () => {
  const ui = read("src/components/erp/repasse-pdf-conciliacao.tsx");
  const actions = read("src/app/erp/repasse-franquia/actions.ts");
  const migration = read("../supabase/migrations/197_repasse_ajustar_sistema_ou_manter.sql");

  it("limita CPF e telefone ao aviso cadastral", () => {
    expect(ui).toContain("Não bloqueiam o vínculo nem a comissão");
    expect(ui).toContain("cliente, cota, comissão e vínculo serão criados");
    expect(actions).toContain("A linha foi resolvida");
    expect(migration).toContain("Dados cadastrais incompletos do cliente não participam desta validação");
  });

  it("separa ajustar o sistema de manter como está", () => {
    expect(ui).toContain("Ajustar no sistema");
    expect(ui).toContain("Usar valor do relatório");
    expect(ui).toContain("Dar por ajustado · manter como está");
    expect(ui).toContain("Manter e encerrar divergência");
    expect(migration).toContain("MANTER_COMO_ESTA");
    expect(actions).toContain("Divergência encerrada mantendo os valores atuais como estão");
  });

  it("preserva decisões append-only, tenant-aware e idempotentes", () => {
    expect(migration).toContain("public.has_company_permission(p_empresa_id, 'gerenciar_financeiro')");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("INSERT INTO public.erp_repasse_atencao_resolucoes");
    expect(migration).not.toContain("UPDATE public.erp_repasse_atencao_resolucoes");
  });
});
