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
});
