import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("fase 270 - acesso por e-mail e lista de convidados", () => {
  it("aceita o mesmo e-mail da conta existente no login do app", () => {
    const login = source("src/app/app-indicador/login/actions.ts");
    const input = source("src/app/app-indicador/login/cpf-login-input.tsx");
    expect(login).toContain('formData.get("identificador")');
    expect(login).toContain("loginPorEmail");
    expect(input).toContain("CPF ou e-mail");
  });

  it("exibe ao indicador somente a própria lista do evento", () => {
    const painel = source("src/app/app-indicador/page.tsx");
    const lista = source("src/app/app-indicador/evento/lista-convidados/page.tsx");
    expect(painel).toContain("Lista de convidados");
    expect(lista).toContain('eq("consultor_usuario_id", usuario.id)');
    expect(lista).toContain('eq("lista_id", lista.id)');
  });
});
