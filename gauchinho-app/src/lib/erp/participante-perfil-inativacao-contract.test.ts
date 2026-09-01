import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const actions = fs.readFileSync(
  path.resolve(process.cwd(), "src/app/erp/regras-comissao/actions.ts"),
  "utf8",
);
const view = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "src/components/erp/comissoes/erp-commission-hub-view.tsx",
  ),
  "utf8",
);

describe("inativação do vínculo participante-perfil", () => {
  it("salva o estado ativo informado no modal", () => {
    expect(actions).toContain('formData.getAll("ativo")');
    expect(actions).toContain("ativo,");
    expect(view).toContain("Vínculo ativo para esta função e perfil");
  });

  it("permite inativar e reativar sem excluir o histórico", () => {
    expect(actions).toContain("toggleParticipantePerfilAction");
    expect(actions).toContain(".update({ ativo, updated_at:");
    expect(actions).not.toContain("unlinkParticipantePerfilAction");
    expect(view).toContain('{v.ativo ? "Inativar" : "Reativar"}');
    expect(view).toContain("Valores já gerados ou pagos permanecem preservados");
  });
});
