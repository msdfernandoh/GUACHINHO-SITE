import { describe, expect, it } from "vitest";
import { evaluateGestaoMembership } from "@/lib/gestao/access-policy";

describe("política das APIs de gestão por tenant", () => {
  it("nega usuário autenticado vinculado somente a outro tenant", () => {
    expect(
      evaluateGestaoMembership(
        [{ empresa_id: "empresa-b", papel: { codigo: "admin_empresa" } }],
        "empresa-a",
        "read",
      ),
    ).toEqual({ allowed: false, reason: "missing_tenant" });
  });

  it("nega escrita ao visualizador mesmo que o perfil global legado seja master", () => {
    expect(
      evaluateGestaoMembership(
        [{ empresa_id: "empresa-a", papel: { codigo: "visualizador" } }],
        "empresa-a",
        "write",
      ),
    ).toEqual({ allowed: false, reason: "forbidden_role" });
  });

  it("permite leitura a papel interno autorizado do tenant correto", () => {
    expect(
      evaluateGestaoMembership(
        [{ empresa_id: "empresa-a", papel: { codigo: "consultor" } }],
        "empresa-a",
        "read",
      ),
    ).toEqual({ allowed: true });
  });

  it("permite escrita somente ao administrador do tenant correto", () => {
    expect(
      evaluateGestaoMembership(
        [{ empresa_id: "empresa-a", papel: { codigo: "admin_empresa" } }],
        "empresa-a",
        "write",
      ),
    ).toEqual({ allowed: true });
  });
});
