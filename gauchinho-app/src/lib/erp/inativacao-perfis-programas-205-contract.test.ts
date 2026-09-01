import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(resolve(process.cwd(), "src/app/erp/regras-comissao/actions.ts"), "utf8");
const view = readFileSync(resolve(process.cwd(), "src/components/erp/comissoes/erp-commission-hub-view.tsx"), "utf8");
const importer = readFileSync(resolve(process.cwd(), "src/app/erp/clientes/importar/page.tsx"), "utf8");

describe("Fase 205 — inativação dos perfis e programas de comissão", () => {
  it("oferece inativação sem excluir perfil ou vínculo do participante", () => {
    expect(view).toContain("action={toggleCommissionProfileAction}");
    expect(view).toContain("action={toggleParticipantePerfilAction}");
    expect(actions).toContain('from("comissao_perfis")');
    expect(actions).toContain('from("participante_comissao_perfis")');
  });

  it("reserva programa antigo para importação e inativa suas regras", () => {
    expect(view).toContain("action={setCommissionProgramLegacyOnlyAction}");
    expect(actions).toContain("uso_exclusivo_importacao_legado: exclusivo");
    expect(actions).toContain('origem_configuracao: ativa ? "ERP_MANUAL_NAO_HOMOLOGADO" : "ERP_INATIVADA"');
    expect(importer).toContain('.eq("uso_exclusivo_importacao_legado",true)');
  });

  it("separa a relação operacional do histórico e alerta escopos duplicados", () => {
    expect(view).toContain("Comissões atualmente usadas");
    expect(view).toContain("homologacoesDuplicadas");
    expect(view).toContain("programasOperacionais");
  });
});
