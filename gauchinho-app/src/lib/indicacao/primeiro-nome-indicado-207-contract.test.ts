import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const form = fs.readFileSync(path.join(process.cwd(), "src/components/public/indicacao-form.tsx"), "utf8");
const route = fs.readFileSync(path.join(process.cwd(), "src/app/api/public/leads/indicacao/route.ts"), "utf8");

describe("Fase 207 — primeiro nome na indicação pública", () => {
  it("habilita o envio quando o indicado informou ao menos um nome", () => {
    expect(form).toContain("i.nome.trim().length>0");
    expect(form).not.toContain("i.nome.trim().split(/\\s+/).length>=2");
    expect(form).toContain('label="Nome do indicado *"');
  });

  it("mantém a API alinhada sem exigir sobrenome do indicado", () => {
    expect(route).toContain("!ind.nome?.trim() || !ind.whatsapp?.trim()");
    expect(route).not.toContain("ind.nome.trim().split");
  });
});
