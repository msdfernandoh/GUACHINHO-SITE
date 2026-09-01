import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const componente = readFileSync("src/components/public/indicacao-form.tsx", "utf8");

describe("Programa de Indicação após cadastro", () => {
  it("substitui o formulário por confirmação e ações úteis", () => {
    expect(componente).toContain("Cadastro concluído!");
    expect(componente).toContain("Fazer uma indicação");
    expect(componente).toContain("Visualizar minhas indicações");
    expect(componente).toContain("Voltar à página inicial");
    expect(componente).toContain('setCadastroConcluido(true)');
    expect(componente).toContain('setCpfConsulta(cadastro.cpf)');
  });
});
