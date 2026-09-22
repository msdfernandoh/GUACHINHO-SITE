import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("fase 264 - indicação de contato ou evento no app", () => {
  it("oferece a escolha inicial sem alterar o fluxo de contato", () => {
    const page = source("src/app/app-indicador/indicar/page.tsx");
    expect(page).toContain('href="/app-indicador/indicar?tipo=contato"');
    expect(page).toContain('href="/app-indicador/indicar?tipo=evento"');
    expect(page).toContain("<IndicacaoChat");
    expect(page).toContain("<IndicacaoEventoForm");
  });

  it("lista somente eventos ativos, publicados e futuros", () => {
    const page = source("src/app/app-indicador/indicar/page.tsx");
    const action = source("src/app/app-indicador/indicar/actions.ts");
    const query = source("src/lib/parceiros/eventos-indicador.ts");
    expect(query).toContain('.eq("ativo", true)');
    expect(query).toContain('.eq("publicado", true)');
    expect(query).toContain('.gte("data_evento"');
    expect(action).toContain('.eq("publicado", true)');
  });

  it("cria o lead, preserva a atribuição do indicador e inclui convidado pendente", () => {
    const action = source("src/app/app-indicador/indicar/actions.ts");
    expect(action).toContain("registrarIndicacaoEventoDoAppAction");
    expect(action).toContain('origem_detalhe: "Convite pelo app do indicador"');
    expect(action).toContain('indicador_id: indicador.id');
    expect(action).toContain('.from("eventos_listas_convidados_itens")');
    expect(action).toContain('status_presenca: "pendente"');
  });
});
