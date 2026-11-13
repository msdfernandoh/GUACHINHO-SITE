import { describe, expect, it } from "vitest";
import { euaLandingRewritePath, euaParentHost } from "./host";

describe("euaParentHost", () => {
  it("resolve o domínio pai do subdomínio eua", () => {
    expect(euaParentHost("eua.raconsinop.com.br")).toBe("raconsinop.com.br");
    expect(euaParentHost("EUA.raconsinop.com.br:443")).toBe("raconsinop.com.br");
    expect(euaParentHost("www.eua.raconsinop.com.br")).toBe("raconsinop.com.br");
  });

  it("ignora hosts que não são o subdomínio eua", () => {
    expect(euaParentHost("raconsinop.com.br")).toBeNull();
    expect(euaParentHost("www.raconsinop.com.br")).toBeNull();
    expect(euaParentHost("euax.raconsinop.com.br")).toBeNull();
    expect(euaParentHost("eua.localhost")).toBeNull();
    expect(euaParentHost(null)).toBeNull();
  });
});

describe("euaLandingRewritePath", () => {
  it("só reescreve a raiz", () => {
    expect(euaLandingRewritePath("/")).toBe("/eua");
    expect(euaLandingRewritePath("/proposta/rascunho")).toBeNull();
    expect(euaLandingRewritePath("/api/public/eua/lead")).toBeNull();
  });
});
