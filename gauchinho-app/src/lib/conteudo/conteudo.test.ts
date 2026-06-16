import { describe, expect, it } from "vitest";
import { FAQ_INSTITUCIONAL_SEED } from "@/lib/conteudo/faq-seed";
import { seoFromCaso, seoFromDica } from "@/lib/conteudo/fetch-public";
import type { CasoSucesso, DicaTche } from "@/lib/conteudo/types";

describe("conteudo Fase 9", () => {
  it("FAQ seed inclui contemplação sem promessa", () => {
    const item = FAQ_INSTITUCIONAL_SEED.find((f) => f.pergunta.includes("contemplação"));
    expect(item?.resposta).toMatch(/Não existe garantia/i);
    expect(FAQ_INSTITUCIONAL_SEED.length).toBeGreaterThanOrEqual(8);
  });

  it("SEO fallback caso e dica", () => {
    const caso = {
      titulo: "Título",
      descricao_curta: "Curta",
      seo_title: "",
      seo_description: "",
    } as CasoSucesso;
    expect(seoFromCaso(caso).title).toBe("Título");
    expect(seoFromCaso({ ...caso, seo_title: "SEO" }).title).toBe("SEO");

    const dica = { titulo: "D", descricao_curta: "x" } as DicaTche;
    expect(seoFromDica(dica).description).toBe("x");
  });
});
