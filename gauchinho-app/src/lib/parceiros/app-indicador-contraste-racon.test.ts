import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const themeSource = readFileSync(
  new URL("../../components/app-indicador/app-indicador-theme.tsx", import.meta.url),
  "utf8",
);

describe("contraste do app indicador Racon", () => {
  it("deixa brancos os textos secundarios dentro dos cartoes azuis", () => {
    expect(themeSource).toContain(
      '.racon-indicador [class*="bg-amber"] [class*="text-zinc-"]:not(input):not(textarea)',
    );
    expect(themeSource).toContain(
      '.racon-indicador [class*="from-amber"] [class*="text-zinc-"]:not(input):not(textarea)',
    );
    expect(themeSource).toMatch(/text-amber"\][\s\S]*color: #ffffff/);
  });

  it("preserva texto escuro nos campos brancos", () => {
    expect(themeSource).toContain(
      ".racon-indicador input, .racon-indicador textarea { background: #ffffff; color: #0b2855; }",
    );
  });
});
