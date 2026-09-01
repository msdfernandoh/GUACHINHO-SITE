import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const modal = fs.readFileSync(path.join(process.cwd(), "src/components/contratacao/proposta-link-modal.tsx"), "utf8");
const nav = fs.readFileSync(path.join(process.cwd(), "src/components/public/public-header-nav.tsx"), "utf8");
const form = fs.readFileSync(path.join(process.cwd(), "src/components/public/indicacao-form.tsx"), "utf8");

describe("Fase 189 — indicação legível e imagem completa", () => {
  it("restaura o nome curto no menu e reforça os rótulos", () => {
    expect(nav).toContain('{ href: "/indicar", label: "Indicação" }');
    expect(form).toContain('className="font-bold text-white"');
  });

  it("a imagem carrega a proposta pública e respeita a visualização", () => {
    expect(modal).toContain("/api/public/contratacoes/");
    expect(modal).toContain("montarLinhasImagemProposta(payload, visualizacao)");
    expect(modal).toContain('visualizacao === "resumida" ? "VERSÃO RESUMIDA" : "VERSÃO DETALHADA"');
    expect(modal).not.toContain('context.fillText("RASCUNHO"');
  });
});
