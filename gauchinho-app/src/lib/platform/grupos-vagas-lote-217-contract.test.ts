import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd(), "..");
const migration217 = fs.readFileSync(
  path.join(root, "supabase/migrations/217_grupos_atualizacao_vagas_lote.sql"),
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
const modalVagas = fs.readFileSync(
  path.join(root, "gauchinho-app/src/components/platform/grupo-vagas-lote-modal.tsx"),
  "utf8",
);

describe("Fase 217 — Atualização Rápida de Vagas de Grupos em Lote", () => {
  it("migration 217 define a RPC atômica e as permissões de segurança", () => {
    expect(migration217).toContain("rpc_platform_atualizar_vagas_grupos_lote");
    expect(migration217).toContain("is_platform_superadmin()");
    expect(migration217).toContain("vagas_disponiveis = v_vagas");
    expect(migration217).toContain("vagas_atualizado_em = now()");
    expect(migration217).toContain("NOTIFY pgrst, 'reload schema'");
  });

  it("server action exporta a ação de atualização de vagas em lote com validações", () => {
    expect(actions).toContain("atualizarVagasGruposLotePlatformAction");
    expect(actions).toContain("rpc_platform_atualizar_vagas_grupos_lote");
    expect(actions).toContain("isPlatformSuperadmin()");
    expect(actions).toContain("revalidatePath(\"/platform/grupos\")");
    expect(actions).toContain("revalidatePath(\"/grupos\")");
  });

  it("listagem de grupos no SaaS contém o botão no topo e acionamento do modal de vagas", () => {
    expect(listClient).toContain("Atualizar Vagas em Lote");
    expect(listClient).toContain("GrupoVagasEmLoteModal");
    expect(listClient).toContain("showVagasModal");
    expect(listClient).toContain("setShowVagasModal(true)");
  });

  it("modal de vagas em lote contém busca, abas, controles de +/- e salvar todos", () => {
    expect(modalVagas).toContain("Atualização Rápida de Vagas dos Grupos");
    expect(modalVagas).toContain("handleAjustarVagas");
    expect(modalVagas).toContain("handleSetVagas");
    expect(modalVagas).toContain("Zerar");
    expect(modalVagas).toContain("Salvar e Atualizar Todos");
    expect(modalVagas).toContain("atualizarVagasGruposLotePlatformAction");
  });
});
