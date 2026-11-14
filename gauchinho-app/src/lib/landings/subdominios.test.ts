import { describe, expect, it } from "vitest";
import { hostParaResolucaoTenant, LANDING_BASES, landingDoHost, landingRewritePath } from "./subdominios";

describe("landingDoHost", () => {
  it("reconhece os subdomínios de landing e o domínio pai", () => {
    expect(landingDoHost("filhos.raconsinop.com.br")).toEqual({ subdominio: "filhos", parent: "raconsinop.com.br" });
    expect(landingDoHost("eua.raconsinop.com.br:443")).toEqual({ subdominio: "eua", parent: "raconsinop.com.br" });
  });

  it("ignora hosts comuns e prefixos desconhecidos", () => {
    expect(landingDoHost("www.raconsinop.com.br")).toBeNull();
    expect(landingDoHost("raconsinop.com.br")).toBeNull();
    expect(landingDoHost("filhosx.raconsinop.com.br")).toBeNull();
    expect(landingDoHost("filhos.localhost")).toBeNull();
  });
});

describe("landingRewritePath", () => {
  const filhos = { subdominio: "filhos" as const, parent: "raconsinop.com.br" };
  it("mapeia os caminhos curtos do subdomínio filhos", () => {
    expect(landingRewritePath(filhos, "/")).toBe("/filhos");
    expect(landingRewritePath(filhos, "/evento")).toBe("/filhos/evento");
    expect(landingRewritePath(filhos, "/evento/")).toBe("/filhos/evento");
    expect(landingRewritePath(filhos, "/qr")).toBe("/filhos/qr");
  });

  it("não reescreve APIs, proposta nem rotas de evento existentes", () => {
    expect(landingRewritePath(filhos, "/api/public/eventos/inscricao")).toBeNull();
    expect(landingRewritePath(filhos, "/proposta/rascunho")).toBeNull();
    expect(landingRewritePath(filhos, "/qr/network")).toBeNull();
  });
});

describe("tenant e domínio principal", () => {
  it("resolve o tenant pelo domínio pai", () => {
    expect(hostParaResolucaoTenant("filhos.raconsinop.com.br")).toBe("raconsinop.com.br");
    expect(hostParaResolucaoTenant("www.raconsinop.com.br")).toBe("www.raconsinop.com.br");
  });

  it("libera as bases das landings no domínio principal", () => {
    expect(LANDING_BASES).toEqual(expect.arrayContaining(["/eua", "/filhos"]));
  });
});
