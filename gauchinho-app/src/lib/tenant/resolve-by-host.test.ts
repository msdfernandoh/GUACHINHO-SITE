import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveHostContextForRequest, resolveTenantForRequest } from "./resolve-by-host";
import { invalidateTenantHostCache } from "./tenant-host-cache";

const ORIGINAL_FETCH = globalThis.fetch;

describe("resolveTenantForRequest — fallback de transição e overrides", () => {
  afterEach(() => {
    invalidateTenantHostCache();
    vi.unstubAllEnvs();
    globalThis.fetch = ORIGINAL_FETCH;
  });

  function mockSupabaseMissingTable() {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          message: "Could not find the table 'public.empresa_dominios' in the schema cache",
          code: "PGRST205",
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
  }

  it("host oficial Gauchinho com infra 044 ausente → falha fechada", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockSupabaseMissingTable();

    const result = await resolveTenantForRequest({
      hostHeader: "gauchinhoconsorcios.com.br",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("infra_unavailable_non_official");
  });

  it("www oficial também falha fechado quando 044 está ausente", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockSupabaseMissingTable();

    const result = await resolveTenantForRequest({
      hostHeader: "www.gauchinhoconsorcios.com.br",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(false);
  });

  it("host desconhecido com 044 ausente NÃO vira Gauchinho", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockSupabaseMissingTable();

    const result = await resolveTenantForRequest({
      hostHeader: "desconhecido-total.com.br",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(false);
  });

  it("query __tenant bloqueada em production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockSupabaseMissingTable();

    const params = new URLSearchParams({ __tenant: "empresa-b" });
    const result = await resolveTenantForRequest({
      hostHeader: "desconhecido.com.br",
      searchParams: params,
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(false);
  });

  it("empresa-b.localhost resolve em development pelo cadastro real", async () => {
    vi.stubEnv("NODE_ENV", "development");
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("empresa_dominios")) {
        return new Response(JSON.stringify({
          message: "Could not find the table 'public.empresa_dominios' in the schema cache",
          code: "PGRST205",
        }), { status: 404, headers: { "content-type": "application/json" } });
      }
      if (url.includes("empresas")) {
        return new Response(JSON.stringify({
          id: "8e4e13f9-80e6-44db-a21b-584a43b6f024",
          slug: "empresa-b",
          status: "rascunho",
          ativo: false,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify(null), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const result = await resolveTenantForRequest({
      hostHeader: "empresa-b.localhost",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tenant.slug).toBe("empresa-b");
      expect(result.tenant.source).toBe("dev_override");
    }
  });

  it("DEV_TENANT_SLUG ignorado em production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_TENANT_SLUG", "empresa-b");
    mockSupabaseMissingTable();

    const result = await resolveTenantForRequest({
      hostHeader: "desconhecido.com.br",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(false);
  });

  it("erro transitório falha fechado e não mistura cache entre hosts", async () => {
    vi.stubEnv("NODE_ENV", "production");
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ message: "upstream timeout" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const official = await resolveTenantForRequest({
      hostHeader: "gauchinhoconsorcios.com.br",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });
    const unknown = await resolveTenantForRequest({
      hostHeader: "outro-desconhecido.com.br",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(official.ok).toBe(false);
    expect(unknown.ok).toBe(false);
  });

  it("Empresa B não resolve por domínio em production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockSupabaseMissingTable();
    const result = await resolveTenantForRequest({
      hostHeader: "empresa-b.com.br",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });
    expect(result.ok).toBe(false);
  });
});

describe("resolveHostContextForRequest — PLATFORM antes de tenant", () => {
  afterEach(() => {
    invalidateTenantHostCache();
    vi.unstubAllEnvs();
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("admin canônico retorna PLATFORM sem consultar empresa_dominios", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;

    const result = await resolveHostContextForRequest({
      hostHeader: "admin.gauchinhoconsorcios.com.br",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result).toEqual({ ok: true, context: "platform" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("resolveTenantForRequest — preview Vercel seguro", () => {
  const PREVIEW_HOST = "guachinho-site-d2g4rrpyv-hugo-8097s-projects.vercel.app";

  afterEach(() => {
    invalidateTenantHostCache();
    vi.unstubAllEnvs();
    globalThis.fetch = ORIGINAL_FETCH;
  });

  function mockDomainMissAndGauchinhoEmpresa() {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("empresa_dominios")) {
        return new Response(JSON.stringify(null), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("empresas")) {
        return new Response(
          JSON.stringify({
            id: "gauchinho-uuid-1",
            slug: "gauchinho",
            status: "ativo",
            ativo: true,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify(null), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
  }

  function stubPreviewRuntime() {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", PREVIEW_HOST);
    vi.stubEnv("VERCEL_BRANCH_URL", PREVIEW_HOST);
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "guachinho-site.vercel.app");
  }

  it("preview oficial + VERCEL_ENV=preview → Gauchinho (source vercel_preview_gauchinho)", async () => {
    stubPreviewRuntime();
    mockDomainMissAndGauchinhoEmpresa();

    const result = await resolveTenantForRequest({
      hostHeader: PREVIEW_HOST,
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tenant.slug).toBe("gauchinho");
      expect(result.tenant.source).toBe("vercel_preview_gauchinho");
      expect(result.tenant.empresaId).toBe("gauchinho-uuid-1");
    }
  });

  it("mesmo host preview + VERCEL_ENV=production → bloqueado", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_URL", PREVIEW_HOST);
    mockDomainMissAndGauchinhoEmpresa();

    const result = await resolveTenantForRequest({
      hostHeader: PREVIEW_HOST,
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(false);
  });

  it("preview de outro projeto → bloqueado", async () => {
    stubPreviewRuntime();
    vi.stubEnv("VERCEL_URL", "outro-app-xyz-other-team.vercel.app");
    vi.stubEnv("VERCEL_BRANCH_URL", "outro-app-xyz-other-team.vercel.app");
    mockDomainMissAndGauchinhoEmpresa();

    const result = await resolveTenantForRequest({
      hostHeader: "outro-app-xyz-other-team.vercel.app",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(false);
  });

  it("host aleatório *.vercel.app → bloqueado", async () => {
    stubPreviewRuntime();
    mockDomainMissAndGauchinhoEmpresa();

    const result = await resolveTenantForRequest({
      hostHeader: "qualquer-coisa.vercel.app",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(false);
  });

  it("?__tenant=empresa-b em preview (NODE_ENV=production) → ignorado; segue Gauchinho pelo host", async () => {
    stubPreviewRuntime();
    mockDomainMissAndGauchinhoEmpresa();

    const result = await resolveTenantForRequest({
      hostHeader: PREVIEW_HOST,
      searchParams: new URLSearchParams({ __tenant: "empresa-b" }),
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tenant.slug).toBe("gauchinho");
      expect(result.tenant.source).toBe("vercel_preview_gauchinho");
    }
  });

  it("domínio oficial Gauchinho continua funcionando (não usa source de preview)", async () => {
    stubPreviewRuntime();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("empresa_dominios")) {
        return new Response(
          JSON.stringify({
            ativo: true,
            verificado: true,
            empresa: {
              id: "gauchinho-uuid-1",
              slug: "gauchinho",
              status: "ativo",
              ativo: true,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("empresa_branding")) {
        return new Response(
          JSON.stringify({ status_publicacao: "PUBLICADO" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify(null), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    const result = await resolveTenantForRequest({
      hostHeader: "gauchinhoconsorcios.com.br",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tenant.slug).toBe("gauchinho");
      expect(result.tenant.source).toBe("domain");
    }
  });

  it("host desconhecido continua 404", async () => {
    stubPreviewRuntime();
    mockDomainMissAndGauchinhoEmpresa();

    const result = await resolveTenantForRequest({
      hostHeader: "desconhecido-total.com.br",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(false);
  });

  it("cache não mistura preview e produção", async () => {
    stubPreviewRuntime();
    mockDomainMissAndGauchinhoEmpresa();

    const preview = await resolveTenantForRequest({
      hostHeader: PREVIEW_HOST,
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });
    expect(preview.ok).toBe(true);

    // Host de produção do projeto Vercel permanece bloqueado (chave de cache distinta).
    const prodProject = await resolveTenantForRequest({
      hostHeader: "guachinho-site.vercel.app",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });
    expect(prodProject.ok).toBe(false);

    const unknown = await resolveTenantForRequest({
      hostHeader: "outro.com.br",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });
    expect(unknown.ok).toBe(false);

    // Preview continua hit pelo cache próprio do host.
    const previewAgain = await resolveTenantForRequest({
      hostHeader: PREVIEW_HOST,
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });
    expect(previewAgain.ok).toBe(true);
    if (previewAgain.ok) {
      expect(previewAgain.tenant.source).toBe("vercel_preview_gauchinho");
    }
  });
});
