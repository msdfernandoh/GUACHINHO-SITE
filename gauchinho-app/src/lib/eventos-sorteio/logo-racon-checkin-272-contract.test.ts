import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("fase 272: logo Racon padronizada no check-in", () => {
  it.each([
    "src/components/public/eventos/evento-checkin-conversacional.tsx",
    "src/components/public/eventos/evento-checkin-fechado.tsx",
    "src/components/public/eventos/evento-sorteio-public-form.tsx",
  ])("usa a logo Racon em %s", (file) => {
    expect(source(file)).toContain('"/racon/logoracon.jpg"');
  });

  it("não herda a logo personalizada do evento no formulário conversacional", () => {
    const form = source("src/components/public/eventos/evento-checkin-conversacional.tsx");
    expect(form).not.toContain("evento.logoPersonalizadoUrl || tenantBrand.logoUrl");
    expect(form).toContain('const brandNome = "Racon Consórcios"');
  });
});
