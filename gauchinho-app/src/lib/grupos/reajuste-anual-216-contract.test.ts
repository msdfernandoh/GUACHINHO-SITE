import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const migration216 = fs.readFileSync(
  path.join(root, "supabase/migrations/216_grupos_reajuste_anual_operacional.sql"),
  "utf8",
);
const actions = fs.readFileSync(
  path.join(root, "gauchinho-app/src/app/platform/grupos-actions.ts"),
  "utf8",
);
const listClient = fs.readFileSync(
  path.join(root, "gauchinho-app/src/components/platform/grupos-list-platform-client.tsx"),
  "utf8",
);
const modal = fs.readFileSync(
  path.join(root, "gauchinho-app/src/components/platform/grupo-reajuste-anual-modal.tsx"),
  "utf8",
);
const page = fs.readFileSync(
  path.join(root, "gauchinho-app/src/app/platform/grupos/page.tsx"),
  "utf8",
);

describe("Fase 216 — Reajuste Anual Operacional de Grupos (Platform SaaS)", () => {
  it("migration 216 persiste colunas de ano/data do último reajuste e RPC de dispensa", () => {
    expect(migration216).toContain("ano_ultimo_reajuste integer");
    expect(migration216).toContain("data_ultimo_reajuste timestamptz");
    expect(migration216).toContain("rpc_marcar_grupo_reajustado");
    expect(migration216).toContain("rpc_platform_reajustar_creditos_grupo");
  });

  it("server action permite marcar grupo como já reajustado", () => {
    expect(actions).toContain("marcarGrupoJaReajustadoPlatformAction");
    expect(actions).toContain("rpc_marcar_grupo_reajustado");
    expect(actions).toContain("reajustarCreditosGrupoPlatformAction");
  });

  it("listagem de grupos na plataforma integra tag de atenção e botões de reajuste", () => {
    expect(listClient).toContain("obterStatusReajusteAnual");
    expect(listClient).toContain("Aplicar Reajuste");
    expect(listClient).toContain("Já Reajustado");
    expect(listClient).toContain("⚠ Reajuste: Mês de");
    expect(page).toContain("GruposListPlatformClient");
    expect(page).toContain("tipo_reajuste_anual");
    expect(page).toContain("ano_ultimo_reajuste");
  });

  it("modal de reajuste anual atende aos fluxos FIXO e VARIÁVEL", () => {
    expect(modal).toContain("GrupoReajusteAnualModal");
    expect(modal).toContain("isFixo");
    expect(modal).toContain("handleValorCotaChange");
    expect(modal).toContain("calcularPropagacaoCotaBase");
    expect(modal).toContain("calcularNovoCreditoPorPercentual");
  });
});
