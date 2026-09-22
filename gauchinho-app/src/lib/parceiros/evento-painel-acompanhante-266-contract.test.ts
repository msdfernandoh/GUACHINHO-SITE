import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), "..", relative), "utf8");

describe("fase 266 - evento no painel e acompanhante", () => {
  it("mostra o evento ativo e as vagas antes dos indicados", () => {
    const page = source("gauchinho-app/src/app/app-indicador/page.tsx");
    expect(page).toContain("EVENTO ATIVO");
    expect(page).toContain("vagas_disponiveis");
    expect(page.indexOf("EVENTO ATIVO")).toBeLessThan(page.indexOf("Meus indicados"));
  });

  it("pergunta pelo acompanhante e informa o consumo de duas vagas", () => {
    const form = source("gauchinho-app/src/components/app-indicador/indicacao-evento-form.tsx");
    expect(form).toContain("Vai levar acompanhante?");
    expect(form).toContain("Primeiro nome do acompanhante");
    expect(form).toContain("Esta inscrição utilizará 2 vagas.");
  });

  it("registra a participação oficial com capacidade e lista de espera", () => {
    const service = source("gauchinho-app/src/lib/parceiros/participacao-evento-indicador.ts");
    expect(service).toContain("quantidadeVagasInscricao");
    expect(service).toContain("haVagaDisponivel");
    expect(service).toContain('"lista_espera"');
    expect(service).toContain('.from("eventos_participantes")');
  });
});
