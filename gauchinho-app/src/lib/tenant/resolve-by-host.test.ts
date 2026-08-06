import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTenantForRequest } from "./resolve-by-host";
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

  it("host oficial Gauchinho com infra 044 ausente → fallback temporário", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockSupabaseMissingTable();

    const result = await resolveTenantForRequest({
      hostHeader: "gauchinhoconsorcios.com.br",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tenant.slug).toBe("gauchinho");
      expect(result.tenant.source).toBe("emergency_gauchinho_fallback");
    }
  });

  it("www oficial também recebe fallback quando 044 ausente", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockSupabaseMissingTable();

    const result = await resolveTenantForRequest({
      hostHeader: "www.gauchinhoconsorcios.com.br",
      supabaseUrl: "https://example.supabase.co",
      serviceKey: "service-role-test-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tenant.slug).toBe("gauchinho");
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

  it("empresa-b.localhost resolve em development mesmo sem 044", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mockSupabaseMissingTable();

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

  it("erro transitório no host oficial usa fallback sem misturar cache com outro host", async () => {
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

    expect(official.ok).toBe(true);
    if (official.ok) expect(official.tenant.slug).toBe("gauchinho");
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
