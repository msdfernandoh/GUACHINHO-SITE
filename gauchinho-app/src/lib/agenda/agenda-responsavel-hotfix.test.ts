import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("hotfix do responsável da Agenda", () => {
  const consultores = readFileSync(resolve(process.cwd(), "src/lib/admin/consultores.ts"), "utf8");
  const actions = readFileSync(resolve(process.cwd(), "src/app/admin/agenda/actions.ts"), "utf8");
  const view = readFileSync(resolve(process.cwd(), "src/components/admin/agenda/agenda-view.tsx"), "utf8");

  it("aceita vínculo consultor explícito e o papel de superadmin", () => {
    expect(consultores).toContain("link.is_consultor === true");
    expect(consultores).toContain('"super_admin"');
  });

  it("devolve validações operacionais ao formulário em vez de derrubar a página", () => {
    expect(actions).toContain("createCompromissoStateAction");
    expect(view).toContain("useActionState(createCompromissoStateAction");
    expect(view).toContain('role="alert"');
  });
});
