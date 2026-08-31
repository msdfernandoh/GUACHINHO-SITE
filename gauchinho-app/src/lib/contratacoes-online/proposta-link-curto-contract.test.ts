import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const draftLink = readFileSync(resolve(process.cwd(), "src/lib/contratacoes-online/draft-link.ts"), "utf8");
const route = readFileSync(resolve(process.cwd(), "src/app/api/public/contratacoes/rascunho/link/route.ts"), "utf8");
const modal = readFileSync(resolve(process.cwd(), "src/components/contratacao/proposta-link-modal.tsx"), "utf8");

describe("proposta compartilhável", () => {
  it("persiste o payload fora da URL e resolve código curto pelo tenant", () => {
    expect(draftLink).toContain('from("proposta_links_curtos")');
    expect(draftLink).toContain("empresa_id: draft.empresa_id");
    expect(draftLink).toContain("/proposta/rascunho?c=");
    expect(route).toContain("validarContratacaoDraftLinkCurto(body.c, tenant.empresaId)");
  });

  it("oferece cópia de cartão PNG sem depender do link", () => {
    expect(modal).toContain("copyProposalImage");
    expect(modal).toContain('new ClipboardItem({ "image/png": blob })');
    expect(modal).toContain("Copiar imagem");
  });
});
