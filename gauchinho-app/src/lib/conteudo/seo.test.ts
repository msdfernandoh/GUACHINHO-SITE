import { describe, expect, it } from "vitest";
import { seoFromCaso, seoFromDica } from "./fetch-public";
import type { CasoSucesso, DicaTche } from "./types";

describe("conteudo seo helpers", () => {
  it("usa seo_title quando preenchido", () => {
    const caso = {
      titulo: "Título",
      seo_title: " SEO custom ",
      descricao_curta: "Curta",
      seo_description: null,
    } as CasoSucesso;
    expect(seoFromCaso(caso).title).toBe("SEO custom");
    expect(seoFromCaso(caso).description).toBe("Curta");
  });

  it("fallback dica para titulo e descricao curta", () => {
    const dica = {
      titulo: "Dica",
      seo_title: "",
      descricao_curta: "Resumo",
      seo_description: "",
    } as DicaTche;
    expect(seoFromDica(dica)).toEqual({ title: "Dica", description: "Resumo" });
  });
});
