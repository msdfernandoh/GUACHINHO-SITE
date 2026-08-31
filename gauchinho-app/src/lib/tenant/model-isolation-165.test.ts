import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { InstitutionalTenantHome } from "@/components/public/institutional-tenant-home";
import { PropostaLinkModal } from "@/components/contratacao/proposta-link-modal";
import type { EmpresaBranding } from "./branding";
import type { EmpresaSiteModel } from "./site-model";

vi.stubGlobal("React", React);
vi.mock("@/components/public/templates/racon-inspired-home", () => ({
  RaconInspiredHome: () => React.createElement("div", { "data-racon": true }, "Racon"),
}));
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const branding = { nome_site: "Empresa teste" } as EmpresaBranding;

describe("Fase 165 — isolamento dos modelos e Grupos", () => {
  for (const codigo of ["gauchinho_default", "outro_modelo", null]) {
    it(`não transforma ${codigo} em Racon quando o operacional está bloqueado`, () => {
      const html = renderToStaticMarkup(React.createElement(InstitutionalTenantHome, {
        branding, siteModel: codigo ? { codigo } as EmpresaSiteModel : null,
        showModuloIndisponivel: true,
      }));
      expect(html).not.toContain("data-racon");
      expect(html).toContain("Empresa teste");
    });
  }
  it("renderiza o Racon apenas com seu código explícito", () => {
    const html = renderToStaticMarkup(React.createElement(InstitutionalTenantHome, {
      branding, siteModel: { codigo: "racon_inspired", identidadeVisual: {}, menus: [], secoes: [] } as unknown as EmpresaSiteModel,
    }));
    expect(html).toContain("data-racon");
  });
  it("expõe os dois formatos no compartilhamento existente", () => {
    const html = renderToStaticMarkup(React.createElement(PropostaLinkModal, {
      open: true, onClose: () => {}, protocolo: "RASCUNHO",
      url: "https://example.test/proposta/rascunho?d=teste",
    }));
    expect(html).toContain("Link resumido");
    expect(html).toContain("Link detalhado");
    expect(html).toContain("Copiar link");
    expect(html).toContain("Abrir proposta");
  });
  it("alinha a permissão da página à API sem liberar escrita anônima", () => {
    const page = read("src/app/(public)/grupos/page.tsx");
    expect(page).toContain('tenantContext.empresaAtiva?.id === empresaId');
    expect(page).toContain('tenantContext.permissoes.has("gerenciar_propostas")');
    const api = read("src/app/api/public/contratacoes/iniciar/route.ts");
    expect(api).toContain('tenantContext.empresaAtiva?.id !== ingress.empresaId');
    expect(api).toContain('tenantContext.permissoes.has("gerenciar_propostas")');
  });
  it("mantém controles e seleções restritos à paleta Racon", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain('.tenant-racon .grupos-workspace :is(input, select, textarea, option, optgroup)');
    expect(css).toContain('.tenant-racon .grupos-workspace [data-grupo-selected="true"]');
    expect(css).not.toContain('.tenant-operational [class*="bg-amber"] *');
  });
  it("repara apenas vínculo publicado legado vazio, preservando edições concorrentes", () => {
    const script = read("scripts/restore-gauchinho-site-menus.mjs");
    expect(script).toContain('.eq("slug", "gauchinho")');
    expect(script).toContain('link.site_modelos?.codigo !== "gauchinho_default"');
    expect(script).toContain('.eq("menus_habilitados", "[]")');
    expect(script).toContain('process.argv.includes("--apply")');
  });
});
