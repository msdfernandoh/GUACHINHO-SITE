import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("fase 271: evento público no domínio parceiro Racon", () => {
  it("preserva as rotas de evento em vez de reescrevê-las para a home do parceiro", () => {
    const proxy = source("src/proxy.ts");
    const operationalPaths = proxy.slice(
      proxy.indexOf("const partnerOperationalPaths"),
      proxy.indexOf("const isOperationalPath"),
    );
    expect(operationalPaths).toContain('"/eventos"');
  });

  it("mantém a rota pública de check-in dentro do layout temático", () => {
    const checkin = source("src/app/(public)/eventos/[slug]/sorteio/page.tsx");
    const layout = source("src/app/(public)/layout.tsx");
    expect(checkin).toContain("EventoCheckinConversacional");
    expect(layout).toContain("partnerView?.template_codigo === \"racon_inspired\"");
    expect(layout).toContain("<RaconInspiredHeader");
  });
});
