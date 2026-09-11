import { describe, expect, it } from "vitest";
import { resolveFaviconConfig } from "./favicon-resolver";

describe("resolveFaviconConfig", () => {
  it("deve resolver o favicon padrão da marca Gauchinho com suporte multi-resolução e alta fidelidade", () => {
    const res = resolveFaviconConfig({ isRacon: false });

    expect(res.shortcut).toBe("/favicon.ico");
    expect(res.apple).toBe("/apple-touch-icon.png");
    expect(res.iconList).toEqual([
      { url: "/favicon.ico" },
      { url: "/favicon-gauchinho.png", sizes: "512x512", type: "image/png" },
    ]);
  });

  it("deve preservar o favicon específico dos modelos Racon sem afetar outros modelos", () => {
    const res = resolveFaviconConfig({ isRacon: true });

    expect(res.shortcut).toBe("/racon/favicon-racon.png");
    expect(res.apple).toBe("/racon/favicon-racon.png");
    expect(res.iconList).toEqual([
      { url: "/racon/favicon-racon.png", type: "image/png" },
    ]);
  });

  it("deve dar prioridade para favicon customizado se fornecido", () => {
    const res = resolveFaviconConfig({
      isRacon: false,
      customFavicon: "https://custom.cdn/meu-favicon.png",
    });

    expect(res.shortcut).toBe("https://custom.cdn/meu-favicon.png");
    expect(res.apple).toBe("https://custom.cdn/meu-favicon.png");
    expect(res.iconList).toEqual([
      { url: "https://custom.cdn/meu-favicon.png" },
    ]);
  });
});
