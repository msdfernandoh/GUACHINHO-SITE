import { describe, expect, it } from "vitest";
import {
  blockImage,
  normalizePageAppearance,
  pageAppearanceCss,
  raconPartnerNavigation,
  safeImageUrl,
  visibleModelMenus,
  visualBlocksForPage,
  RACON_LOGO,
} from "./site-appearance";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("aparência por página e bloco", () => {
  it("preserva fotos, cores e enquadramento independentes", () => {
    const raw = {
      "/": {
        card_veiculos: {
          cor_titulo: "#ffffff",
          imagem_url: "/racon/logoracon.jpg",
          imagem_ajuste: "contain",
          imagem_posicao: "top",
        },
      },
      "/grupos": { tabela: { cor_botao: "#0066cc" } },
    };
    const saved = normalizePageAppearance(JSON.parse(JSON.stringify(raw)));
    expect(saved).toEqual(raw);
    expect(
      blockImage(
        { paginas_blocos: saved },
        "/",
        "card_veiculos",
        "/fallback.jpg",
      ),
    ).toBe(RACON_LOGO);
    expect(
      blockImage(
        { paginas_blocos: saved },
        "/",
        "card_imoveis",
        "/fallback.jpg",
      ),
    ).toBe("/fallback.jpg");
    expect(
      pageAppearanceCss({ paginas_blocos: saved }, "/grupos"),
    ).not.toContain("card_veiculos");
    expect(pageAppearanceCss({ paginas_blocos: saved }, "/grupos")).toContain(
      "--visual-button:#0066cc!important",
    );
  });
  it("aplica a página antes das exceções de bloco", () => {
    const css = pageAppearanceCss(
      {
        paginas_blocos: {
          "/": {
            estatisticas: { cor_texto: "#ffffff" },
            pagina: { cor_texto: "#112233" },
          },
        },
      },
      "/",
    );
    expect(css.indexOf("#112233")).toBeLessThan(css.indexOf("#ffffff"));
    expect(css).toContain("[data-site-tone]{--visual-text:#112233!important}");
  });
  it("não permite CSS, scripts, atributos ou propriedades de protótipo", () => {
    const raw = JSON.parse(
      '{"</style>":{},"/":{"toString":{"cor_texto":"#123456"},"hero":{"cor_texto":"red;display:none","imagem_url":"https://x.test/</style>"}}}',
    );
    expect(normalizePageAppearance(raw)).toEqual({ "/": { hero: {} } });
    for (const url of [
      "javascript:alert(1)",
      "//evil.test/x",
      'https://x.test/");}body{',
      "data:image/svg+xml,test",
    ])
      expect(safeImageUrl(url)).toBe("");
    expect(safeImageUrl("https://example.test/a.jpg?version=2")).toBe(
      "https://example.test/a.jpg?version=2",
    );
  });
  it("mantém comportamento antigo quando não há configuração", () => {
    expect(pageAppearanceCss({}, "/")).toBe("");
    expect(normalizePageAppearance(null)).toEqual({});
    expect(visualBlocksForPage("/simulador")).toHaveProperty("resultado");
    expect(visualBlocksForPage("/grupos")).toHaveProperty("tabela");
    expect(visualBlocksForPage("/consorcio/carro-sem-entrada")).toHaveProperty(
      "conteudo",
    );
  });
});

describe("menus do modelo", () => {
  it("desativa globalmente sem confundir ativo padrão com seleção da empresa", () => {
    const menus = [
      { id: "home", obrigatorio: true },
      { id: "grupos", ativo: false },
      { id: "simulador", ativo_padrao: false },
      { id: "login" },
    ];
    expect(
      visibleModelMenus(menus, ["grupos", "simulador"]).map((m) => m.id),
    ).toEqual(["home", "simulador"]);
    expect(
      visibleModelMenus(
        [{ id: "home", obrigatorio: true, ativo: false }],
        ["home"],
      ),
    ).toEqual([]);
  });
  it("mantém os destinos de parceiros e cria Seja parceiro na família Racon", () => {
    const menus = raconPartnerNavigation([
      { id: "home", label: "Início", rota: "/" },
      { id: "seguradoras", label: "Seguradoras", rota: "/seguradoras" },
      { id: "indicacao", label: "Programa de Indicação", rota: "/indicar" },
      { id: "login", label: "Login", rota: "/login" },
    ]);
    expect(menus.map((menu) => menu.label)).toEqual([
      "Início",
      "Seguradoras",
      "Programa de Indicação",
      "Seja parceiro",
      "Login",
    ]);
    expect(menus[3].rota).toBe("/parceiros");
  });
  it("substitui Área do parceiro pelo CTA público Seja parceiro", () => {
    const menus = raconPartnerNavigation([
      { id: "home", label: "Início", rota: "/" },
      { id: "login", label: "Área do parceiro", rota: "/area-parceiro" },
    ]);
    expect(menus).toEqual([
      { id: "home", label: "Início", rota: "/" },
      { id: "parceiros", label: "Seja parceiro", rota: "/parceiros", ativo: true },
    ]);
  });
});

describe("isolamento da landing de parceiros", () => {
  it("aplica a camada clara operacional às telas públicas Racon", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/public/site-appearance.tsx"),
      "utf8",
    );
    expect(source).toContain('page !== "/" && !isPartnerLanding && !isStageDisplay');
    expect(source).not.toContain('"/simulador"].includes(page)');
  });

  it("preserva o contraste do telão de sorteio, que é intencionalmente escuro", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/public/site-appearance.tsx"),
      "utf8",
    );
    expect(source).toContain('^\\/eventos\\/[^/]+\\/telao$');
    expect(source).toContain("!isStageDisplay");
  });

  it("não aplica o tema operacional às rotas públicas do programa", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/public/site-appearance.tsx"),
      "utf8",
    );
    expect(source).toContain('page === "/parceiros" || page.startsWith("/parceiros/")');
    expect(source).toContain("!isPartnerLanding");
  });
});
