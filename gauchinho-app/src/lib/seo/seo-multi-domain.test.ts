import { describe, expect, it } from "vitest";
import {
  CANONICAL_GAUCHINHO_ORIGIN,
  CANONICAL_RACON_ORIGIN,
  isRaconHost,
  resolveOriginFromHost,
} from "./site-url";
import robots from "@/app/robots";
import { GET as getLlmsTxt } from "@/app/llms.txt/route";
import { GET as getLlmsFullTxt } from "@/app/llms-full.txt/route";

describe("SEO Multi-Domain & GEO (Google + AI) Test Suite", () => {
  describe("resolveOriginFromHost e isRaconHost", () => {
    it("identifica corretamente hosts da Racon Sinop", () => {
      expect(isRaconHost("raconsinop.com.br")).toBe(true);
      expect(isRaconHost("www.raconsinop.com.br")).toBe(true);
      expect(isRaconHost("racon-sinop.vercel.app")).toBe(false);
      expect(isRaconHost("gauchinhoconsorcios.com.br")).toBe(false);
    });

    it("resolve a origem canônica correta para cada domínio", () => {
      expect(resolveOriginFromHost("raconsinop.com.br")).toBe(CANONICAL_RACON_ORIGIN);
      expect(resolveOriginFromHost("www.raconsinop.com.br")).toBe(CANONICAL_RACON_ORIGIN);
      expect(resolveOriginFromHost("gauchinhoconsorcios.com.br")).toBe(CANONICAL_GAUCHINHO_ORIGIN);
      expect(resolveOriginFromHost("www.gauchinhoconsorcios.com.br")).toBe(CANONICAL_GAUCHINHO_ORIGIN);
      expect(resolveOriginFromHost("localhost:3000")).toBe("http://localhost:3000");
    });
  });

  describe("robots.ts especializado para Google e IAs", () => {
    it("emite regras para crawlers de busca e bots de inteligência artificial", async () => {
      const robotsConfig = await robots();
      expect(robotsConfig.rules).toBeDefined();

      const rules = Array.isArray(robotsConfig.rules) ? robotsConfig.rules : [robotsConfig.rules];
      const aiRule = rules.find((r) =>
        Array.isArray(r.userAgent) && r.userAgent.includes("GPTBot")
      );

      expect(aiRule).toBeDefined();
      expect(aiRule?.userAgent).toContain("Googlebot");
      expect(aiRule?.userAgent).toContain("PerplexityBot");
      expect(aiRule?.userAgent).toContain("ClaudeBot");
      expect(aiRule?.userAgent).toContain("Google-Extended");
      expect(aiRule?.allow).toContain("/llms.txt");
      expect(aiRule?.disallow).toContain("/admin/");
      expect(aiRule?.disallow).toContain("/erp/");
      expect(aiRule?.disallow).toContain("/login");
    });
  });

  describe("Endpoints GEO (/llms.txt e /llms-full.txt)", () => {
    it("gera /llms.txt com formato markdown válido e links essenciais", async () => {
      const res = await getLlmsTxt();
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/markdown");
      const text = await res.text();
      expect(text).toContain("Consórcios");
      expect(text).toContain("Sinop");
      expect(text).toContain("/simulador");
    });

    it("gera /llms-full.txt com detalhamento aprofundado e FAQ", async () => {
      const res = await getLlmsFullTxt();
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/markdown");
      const text = await res.text();
      expect(text).toContain("DOCUMENTO COMPLETO DE CONTEXTO PARA IA");
      expect(text).toContain("Sinop");
    });
  });

  describe("Sitemap dinâmico e sem redirecionamentos", () => {
    it("gera lista de rotas canônicas e não inclui URL de redirecionamento 308 (/casos-de-sucesso)", async () => {
      const sitemapModule = await import("@/app/sitemap");
      const entries = await sitemapModule.default();
      expect(entries.length).toBeGreaterThan(5);

      const urls = entries.map((e) => e.url);
      expect(urls.some((u) => u.endsWith("/simulador"))).toBe(true);
      expect(urls.some((u) => u.endsWith("/grupos"))).toBe(true);
      expect(urls.some((u) => u.endsWith("/parceiros"))).toBe(true);

      // Garante que /casos-de-sucesso (que tem redirect permanente) foi excluído do sitemap
      expect(urls.some((u) => u.endsWith("/casos-de-sucesso"))).toBe(false);
    });
  });
});
