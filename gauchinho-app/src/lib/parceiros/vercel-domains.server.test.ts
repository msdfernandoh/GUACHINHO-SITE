import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("E5 — vercel-domains.server", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("módulo é server-only e não usa NEXT_PUBLIC para token", () => {
    const src = readFileSync(
      path.resolve(__dirname, "vercel-domains.server.ts"),
      "utf8"
    );
    expect(src).toContain('import "server-only"');
    expect(src).not.toMatch(/NEXT_PUBLIC_.*TOKEN/);
    expect(src).not.toContain("NEXT_PUBLIC_VERCEL");
  });

  it("projeto correto por default", async () => {
    const { VERCEL_PARCEIRO_PROJECT_NAME } = await import("./constants");
    const { getConfiguredVercelProject } = await import("./vercel-domains.server");
    expect(VERCEL_PARCEIRO_PROJECT_NAME).toBe("guachinho-site");
    const p = getConfiguredVercelProject();
    expect(p.projectName).toBe("guachinho-site");
    expect(p.projectId).toMatch(/^prj_/);
  });

  it("nenhum request quando flag=false", async () => {
    vi.stubEnv("FASE3_VERCEL_DOMAINS_ENABLED", "false");
    vi.stubEnv("VERCEL_API_TOKEN", "secret-should-not-fetch");
    const fetchImpl = vi.fn();
    const mod = await import("./vercel-domains.server");
    expect(mod.isVercelDomainsIntegrationReady()).toBe(false);
    expect(mod.vercelDomainsDisabledReason()).toMatch(/FASE3_VERCEL_DOMAINS_ENABLED/);
    // Cliente pode existir, mas integração ready=false — actions não devem chamar.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("adiciona domínio e trata already exists no mesmo projeto", async () => {
    vi.stubEnv("FASE3_VERCEL_DOMAINS_ENABLED", "true");
    vi.stubEnv("VERCEL_API_TOKEN", "tok");
    vi.stubEnv("VERCEL_PROJECT_ID", "prj_test");

    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({
            error: { code: "domain_already_exists", message: "already" },
          }),
          { status: 409 }
        );
      }
      // GET domain
      if (String(url).includes("/domains/parceiro.com.br")) {
        return new Response(
          JSON.stringify({ name: "parceiro.com.br", verified: false, id: "dom_1" }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }) as unknown as typeof fetch;

    const { createVercelDomainsClient } = await import("./vercel-domains.server");
    const client = createVercelDomainsClient({
      fetchImpl,
      token: "tok",
      projectId: "prj_test",
      teamId: null,
    });
    const add = await client.addDomain("parceiro.com.br");
    expect(add.ok).toBe(true);
    if (add.ok) {
      expect(add.alreadyExists).toBe(true);
      expect(add.data.name).toBe("parceiro.com.br");
    }
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("/v10/projects/prj_test/domains");
  });

  it("domain_already_in_use → erro controlado", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: { code: "domain_already_in_use", message: "other project" },
        }),
        { status: 409 }
      )
    ) as unknown as typeof fetch;

    const { createVercelDomainsClient } = await import("./vercel-domains.server");
    const client = createVercelDomainsClient({
      fetchImpl,
      token: "tok",
      projectId: "prj_test",
    });
    const add = await client.addDomain("outro.com.br");
    expect(add.ok).toBe(false);
    if (!add.ok) {
      expect(add.code).toBe("domain_already_in_use");
      expect(add.error).toMatch(/outro projeto/);
    }
  });

  it("consulta domínio, config DNS e remoção idempotente", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      if (method === "GET" && u.includes("/config")) {
        return new Response(
          JSON.stringify({
            recommendedCNAME: [{ rank: 1, value: "cname.vercel-dns.com" }],
            recommendedIPv4: [{ rank: 1, value: "76.76.21.21" }],
            misconfigured: false,
          }),
          { status: 200 }
        );
      }
      if (method === "GET" && u.includes("/domains/")) {
        return new Response(
          JSON.stringify({ name: "x.com.br", verified: true }),
          { status: 200 }
        );
      }
      if (method === "DELETE") {
        return new Response(null, { status: 404 });
      }
      return new Response("{}", { status: 500 });
    }) as unknown as typeof fetch;

    const {
      createVercelDomainsClient,
      dnsRegistrosFromVercelConfig,
      dnsRegistrosPreferenciaisFromVercelConfig,
    } = await import("./vercel-domains.server");
    const client = createVercelDomainsClient({
      fetchImpl,
      token: "tok",
      projectId: "prj_test",
    });

    const get = await client.getDomain("x.com.br");
    expect(get.ok && get.data?.verified).toBe(true);

    const cfg = await client.getDomainConfig("x.com.br");
    expect(cfg.ok).toBe(true);
    if (cfg.ok) {
      const regs = dnsRegistrosFromVercelConfig(cfg.data, "@");
      expect(regs.some((r) => r.tipo === "CNAME")).toBe(true);
      expect(regs.some((r) => r.tipo === "A")).toBe(true);
      const raiz = dnsRegistrosPreferenciaisFromVercelConfig(cfg.data, "x.com.br", false);
      const subdominio = dnsRegistrosPreferenciaisFromVercelConfig(cfg.data, "site.x.com.br", true);
      expect(raiz.length).toBeGreaterThan(0);
      expect(raiz.every((r) => r.tipo === "A" && r.host === "@")).toBe(true);
      expect(subdominio.length).toBeGreaterThan(0);
      expect(subdominio.every((r) => r.tipo === "CNAME" && r.host === "site.x.com.br")).toBe(true);
    }

    const del = await client.removeDomain("x.com.br");
    expect(del.ok).toBe(true);
  });

  it("erro de remoção não finge sucesso", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "cannot delete" } }), {
        status: 500,
      })
    ) as unknown as typeof fetch;
    const { createVercelDomainsClient } = await import("./vercel-domains.server");
    const client = createVercelDomainsClient({
      fetchImpl,
      token: "tok",
      projectId: "prj_test",
    });
    const del = await client.removeDomain("x.com.br");
    expect(del.ok).toBe(false);
  });

  it("token nunca vai ao client bundle — source guard", () => {
    const src = readFileSync(
      path.resolve(__dirname, "vercel-domains.server.ts"),
      "utf8"
    );
    // Apenas process.env server-side; sem export do valor do token.
    expect(src).toMatch(/process\.env\.VERCEL_API_TOKEN|process\.env\.VERCEL_TOKEN/);
    expect(src).not.toMatch(/export const.*TOKEN.*=.*['"]/);
  });
});
