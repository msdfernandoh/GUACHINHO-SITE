import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("fase 269 - app de indicação para consultor existente", () => {
  it("reaproveita o participante por CPF e não exige senha escolhida no formulário", () => {
    const route = source("src/app/api/public/programa-indicacao/route.ts");
    const cadastro = source("src/components/public/parceiros-landing-client.tsx");
    expect(route).toContain('.eq("cpf", cpf)');
    expect(route).toContain("consultorReaproveitado: true");
    expect(route).toContain("senhaInicialIndicador(cpf)");
    expect(cadastro).not.toContain('form.senha');
    expect(cadastro).toContain("últimos 6 dígitos do CPF");
  });

  it("preserva credencial existente e vincula o perfil de indicador no mesmo participante", () => {
    const route = source("src/app/api/public/programa-indicacao/route.ts");
    expect(route).toContain("CREDENCIAL_EXISTENTE_PRESERVADA");
    expect(route).toContain('papel_tipo: "INDICADOR"');
    expect(route).toContain('tipo_codigo: "INDICADOR"');
  });
});
