import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("fase 254 - sessão consistente no app do indicador", () => {
  it("resolve participante e indicador pelo mesmo vínculo multi-tenant", () => {
    const resolver = source("src/lib/parceiros/indicador-app-session.ts");
    expect(resolver).toContain('.eq("empresa_id", empresaId)');
    expect(resolver).toContain('.eq("usuario_id", usuarioId)');
    expect(resolver).toContain('(participante.status ?? "ATIVO").toUpperCase() === "ATIVO"');
    expect(resolver).toContain('.in("participante_id", participantesAtivos.map');
    expect(resolver).toContain('.eq("ativo", true)');
    expect(resolver).toContain('origem_cadastro: "APP_LEGADO_REPARADO"');
    expect(resolver).toContain('tipo_codigo: "INDICADOR"');
  });

  it("usa o resolvedor no painel e no envio", () => {
    expect(source("src/app/app-indicador/page.tsx")).toContain("resolveIndicadorAppSession");
    expect(source("src/app/app-indicador/indicar/actions.ts")).toContain("resolveIndicadorAppSession");
  });

  it("oferece troca de usuário e linguagem de investimento", () => {
    expect(source("src/app/app-indicador/page.tsx")).toContain("Trocar usuário");
    expect(source("src/app/app-indicador/login/actions.ts")).toContain("auth.signOut()");
    expect(source("src/components/app-indicador/indicacao-chat.tsx")).toContain("Qual valor disponível mensal para investimento?");
  });
});
