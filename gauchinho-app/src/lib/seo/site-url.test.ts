import { describe, expect, it, afterEach } from "vitest";
import { getPublicSiteUrl, resolvePublicSiteUrl } from "./site-url";

describe("getPublicSiteUrl", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("usa NEXT_PUBLIC_SITE_URL quando definida", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.gauchinhoconsorcios.com.br/";
    expect(getPublicSiteUrl()).toBe("https://www.gauchinhoconsorcios.com.br");
  });

  it("em produção Vercel sem env usa domínio canônico", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_ENV = "production";
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(getPublicSiteUrl()).toBe("https://www.gauchinhoconsorcios.com.br");
  });

  it("resolvePublicSiteUrl usa localhost só em dev", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_ENV;
    process.env.NODE_ENV = "development";
    expect(resolvePublicSiteUrl()).toBe("http://localhost:3000");
  });
});
