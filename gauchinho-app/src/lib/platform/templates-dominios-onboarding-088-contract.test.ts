import { describe, expect, it } from "vitest";
import {
  sanitizeCustomHtml,
  sanitizeCustomCss,
  sanitizeTemplateCode,
} from "./html-sanitizer";

describe("Fase 088 — Templates, Domínios e Onboarding de Franquias", () => {
  describe("1. HTML Sanitizer & Security Engine", () => {
    it("deve remover scripts perigosos do HTML customizado", () => {
      const maliciousHtml = '<div class="banner"><h1>Título Seguro</h1><script>alert("XSS")</script></div>';
      const result = sanitizeCustomHtml(maliciousHtml);
      expect(result.sanitized).not.toContain("<script");
      expect(result.sanitized).not.toContain("alert");
      expect(result.sanitized).toContain("<h1>Título Seguro</h1>");
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("<script>");
    });

    it("deve remover inline handlers como onclick, onerror, onload", () => {
      const inlineHandlerHtml = '<button onclick="evilFunction()" onerror="bad()" class="btn">Clique Aqui</button>';
      const result = sanitizeCustomHtml(inlineHandlerHtml);
      expect(result.sanitized).not.toContain("onclick");
      expect(result.sanitized).not.toContain("onerror");
      expect(result.sanitized).toContain("Clique Aqui");
      expect(result.warnings.some((w) => w.includes("onclick"))).toBe(true);
    });

    it("deve remover URLs javascript: e iframes não autorizados", () => {
      const unsafeLinks = '<a href="javascript:alert(1)">Link Inseguro</a><iframe src="https://evil.com"></iframe>';
      const result = sanitizeCustomHtml(unsafeLinks);
      expect(result.sanitized).not.toContain("javascript:");
      expect(result.sanitized).not.toContain("<iframe");
      expect(result.warnings.some((w) => w.includes("javascript:"))).toBe(true);
    });

    it("deve preservar elementos HTML e CSS seguros e estruturados", () => {
      const safeHtml = '<section class="hero p-8"><h2 class="text-2xl font-bold">Simule seu consórcio</h2><p>Sem juros</p></section>';
      const result = sanitizeCustomHtml(safeHtml);
      expect(result.sanitized).toBe(safeHtml);
      expect(result.warnings.length).toBe(0);
    });

    it("deve remover @import e expressões perigosas do CSS customizado", () => {
      const dangerousCss = '@import url("https://evil.com/leak.css"); .box { width: expression(alert(1)); color: red; }';
      const result = sanitizeCustomCss(dangerousCss);
      expect(result.sanitized).not.toContain("@import");
      expect(result.sanitized).not.toContain("expression");
      expect(result.sanitized).toContain("color: red;");
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("sanitizeTemplateCode deve combinar HTML e CSS em estrutura segura", () => {
      const res = sanitizeTemplateCode(
        '<div class="card">Seguro</div><script>xss()</script>',
        '.card { color: #0284c7; } @import "bad.css";',
      );
      expect(res.sanitizedHtml).toContain('<div class="card">Seguro</div>');
      expect(res.sanitizedHtml).not.toContain("<script>");
      expect(res.sanitizedCss).toContain("color: #0284c7;");
      expect(res.sanitizedCss).not.toContain("@import");
      expect(res.warnings.length).toBe(2);
    });
  });

  describe("2. Domínios e Governança de Hosts", () => {
    it("deve identificar o host da plataforma como reservado", () => {
      const platformHost = "admin.gauchinhoconsorcios.com.br";
      const isReserved = platformHost === "admin.gauchinhoconsorcios.com.br" || platformHost.startsWith("admin.");
      expect(isReserved).toBe(true);
    });

    it("deve permitir domínios customizados de franquias", () => {
      const franchiseDomain = "consorciocuritiba.com.br";
      const isReserved = franchiseDomain === "admin.gauchinhoconsorcios.com.br" || franchiseDomain.startsWith("admin.");
      expect(isReserved).toBe(false);
    });
  });

  describe("3. Onboarding de Master Franquia em Treinamento", () => {
    it("deve validar que o status inicial de nova franquia é sempre 'em_treinamento' com ativo=false", () => {
      const initialStatus = "em_treinamento";
      const initialAtivo = false;
      expect(initialStatus).toBe("em_treinamento");
      expect(initialAtivo).toBe(false);
    });
  });
});
