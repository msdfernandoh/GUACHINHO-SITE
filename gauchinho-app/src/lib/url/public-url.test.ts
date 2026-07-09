import { afterEach, describe, expect, it } from "vitest";
import {
  buildPropostaPublicUrl,
  buildPublicUrl,
  ensureAbsolutePropostaUrl,
  getPublicSiteUrl,
} from "./public-url";

describe("public-url", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("base sem barra + path com barra", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://gauchinhoconsorcios.com.br";
    expect(buildPublicUrl("/proposta/abc")).toBe(
      "https://gauchinhoconsorcios.com.br/proposta/abc",
    );
  });

  it("base com barra + path com barra", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://gauchinhoconsorcios.com.br/";
    expect(buildPublicUrl("/proposta/abc")).toBe(
      "https://gauchinhoconsorcios.com.br/proposta/abc",
    );
  });

  it("base sem env usa domínio padrão ou resolvePublicSiteUrl em dev", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = "development";
    expect(getPublicSiteUrl()).toBe("http://localhost:3000");
  });

  it("buildPropostaPublicUrl retorna domínio + /proposta/token", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://gauchinhoconsorcios.com.br";
    expect(buildPropostaPublicUrl("QaPXc0Q1fOuVnMFGpqSfiA")).toBe(
      "https://gauchinhoconsorcios.com.br/proposta/QaPXc0Q1fOuVnMFGpqSfiA",
    );
  });

  it("ensureAbsolutePropostaUrl — contrato da API iniciar (path relativo → url absoluta)", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://gauchinhoconsorcios.com.br";
    const path = "/proposta/TOKEN";
    const urlAbsoluta = ensureAbsolutePropostaUrl(path, "TOKEN");
    expect(path).toBe("/proposta/TOKEN");
    expect(urlAbsoluta).toBe("https://gauchinhoconsorcios.com.br/proposta/TOKEN");
    expect(urlAbsoluta.startsWith("http")).toBe(true);
  });
});
