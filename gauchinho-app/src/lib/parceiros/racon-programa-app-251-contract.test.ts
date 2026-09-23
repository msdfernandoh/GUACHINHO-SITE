import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Fase 251 — programa de parceiros no domínio Racon", () => {
  it("preserva as rotas do programa e o manifesto sem rewrite institucional", () => {
    const proxy = source("src/proxy.ts");
    expect(proxy).toContain('"/parceiros"');
    expect(proxy).toContain('"/app-indicador"');
    expect(proxy).toContain('"/manifest.webmanifest"');
    expect(proxy).not.toMatch(/matcher:[\s\S]*manifest\\\.webmanifest/);
  });

  it("usa a identidade Racon no cadastro e nas rotas do app", () => {
    expect(source("src/app/(public)/parceiros/cadastro/page.tsx")).toContain("isRaconModel");
    expect(source("src/app/app-indicador/login/page.tsx")).toContain("isRaconModel");
    expect(source("src/app/app-indicador/recuperar-senha/page.tsx")).toContain("isRaconModel");
    expect(source("src/app/manifest.ts")).toContain("racon ?");
  });

  it("leva o novo parceiro diretamente ao formulário de cadastro pelo app", () => {
    const login = source("src/app/app-indicador/login/page.tsx");
    expect(login).toContain('href="/parceiros/cadastro"');
    expect(login).not.toContain('href="/parceiros" className="mt-3');
  });

  it("prioriza cadastro público e oferece instalação dentro do painel autenticado", () => {
    const cta = source("src/components/public/instalar-app-parceiro-button.tsx");
    const modalidade = source("src/components/public/modelo-parceiro-landing-client.tsx");
    const painel = source("src/app/app-indicador/page.tsx");
    expect(cta).toContain("Cadastre-se e baixe o app");
    expect(cta).toContain("/parceiros/cadastro?modelo=");
    expect(cta).not.toContain("beforeinstallprompt");
    expect(modalidade).toContain("InstalarAppParceiroButton");
    expect(modalidade).toContain("modelo={modelo.id}");
    expect(painel).toContain("InstalarAppIndicadorCard");
  });
});
