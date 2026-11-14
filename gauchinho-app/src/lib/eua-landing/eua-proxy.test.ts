import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { TENANT_EMPRESA_ID_HEADER } from "@/lib/tenant/constants";

const hostsResolvidos: string[] = [];

vi.mock("@/lib/parceiros/constants", () => ({ FASE3_PARCEIRO_PUBLIC_SITE_ENABLED: true }));
vi.mock("@/lib/tenant/resolve-by-host", () => ({
  resolveHostContextForRequest: async () => ({ ok: false, reason: "not_configured" }),
}));
vi.mock("@/lib/parceiros/public-site-loader", () => ({
  resolvePartnerPublicRequest: async (input: { hostHeader: string }) => {
    hostsResolvidos.push(input.hostHeader);
    return {
      ok: true,
      partner: { empresa_id: "empresa-dona", empresa_slug: "empresa", parceiro_site_id: "parceiro", site_slug: "racon-sinop", source: "domain" },
      // O apex redireciona para o principal www: o subdomínio EUA não pode herdar esse redirect.
      redirect: input.hostHeader === "raconsinop.com.br" ? { location: "https://www.raconsinop.com.br/", status: 308 } : undefined,
    };
  },
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

import { proxy } from "@/proxy";

beforeEach(() => {
  hostsResolvidos.length = 0;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test");
});
afterEach(() => vi.unstubAllEnvs());

function req(url: string) {
  const host = new URL(url).host;
  return new NextRequest(url, { headers: { host, [TENANT_EMPRESA_ID_HEADER]: "injetado" } });
}

describe("subdomínio eua.raconsinop.com.br", () => {
  it("abre a página EUA na raiz com o tenant do domínio pai e sem redirect canônico", async () => {
    const response = await proxy(req("https://eua.raconsinop.com.br/"));
    expect(hostsResolvidos).toEqual(["raconsinop.com.br"]);
    expect(response.status).toBe(200);
    expect(new URL(response.headers.get("x-middleware-rewrite")!).pathname).toBe("/eua");
    expect(response.headers.get(`x-middleware-request-${TENANT_EMPRESA_ID_HEADER}`)).toBe("empresa-dona");
  });

  it("mantém APIs e o fluxo de proposta sem reescrita", async () => {
    for (const path of ["/api/public/eua/lead", "/proposta/rascunho"]) {
      const response = await proxy(req(`https://eua.raconsinop.com.br${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(response.headers.get(`x-middleware-request-${TENANT_EMPRESA_ID_HEADER}`)).toBe("empresa-dona");
    }
  });

  it("no domínio principal /eua não é reescrito para a home do parceiro", async () => {
    const response = await proxy(req("https://www.raconsinop.com.br/eua"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("a home do domínio principal continua sendo a do parceiro", async () => {
    const response = await proxy(req("https://www.raconsinop.com.br/"));
    expect(new URL(response.headers.get("x-middleware-rewrite")!).pathname).toBe("/parceiro/racon-sinop");
  });
});

describe("subdomínio filhos.raconsinop.com.br", () => {
  it("abre a página Herança Inteligente na raiz e a inscrição em /evento", async () => {
    const raiz = await proxy(req("https://filhos.raconsinop.com.br/"));
    expect(new URL(raiz.headers.get("x-middleware-rewrite")!).pathname).toBe("/filhos");
    const evento = await proxy(req("https://filhos.raconsinop.com.br/evento"));
    expect(new URL(evento.headers.get("x-middleware-rewrite")!).pathname).toBe("/filhos/evento");
    expect(evento.headers.get(`x-middleware-request-${TENANT_EMPRESA_ID_HEADER}`)).toBe("empresa-dona");
    expect(hostsResolvidos.every((h) => h === "raconsinop.com.br")).toBe(true);
  });

  it("mantém a API de inscrição sem reescrita", async () => {
    const response = await proxy(req("https://filhos.raconsinop.com.br/api/public/eventos/inscricao"));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
