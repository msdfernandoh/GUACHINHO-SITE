import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateLegacyOperationalApiAccess } from "./assert-legacy-operational-api";
import { invalidateTenantHostCache } from "./tenant-host-cache";

const ORIGINAL_FETCH = globalThis.fetch;

describe("evaluateLegacyOperationalApiAccess (sem proxy)", () => {
  afterEach(() => {
    invalidateTenantHostCache();
    vi.unstubAllEnvs();
    globalThis.fetch = ORIGINAL_FETCH;
  });

  function mockMissingTable() {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          message: "Could not find the table 'public.empresa_dominios' in the schema cache",
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;
  }

  it("permite Gauchinho oficial com fallback de infra", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    mockMissingTable();

    const r = await evaluateLegacyOperationalApiAccess({
      hostHeader: "gauchinhoconsorcios.com.br",
    });
    expect(r.allow).toBe(true);
    if (r.allow) expect(r.slug).toBe("gauchinho");
  });

  it("bloqueia host desconhecido mesmo com x-tenant injetável no Request", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    mockMissingTable();

    const r = await evaluateLegacyOperationalApiAccess({
      hostHeader: "desconhecido.com.br",
    });
    expect(r.allow).toBe(false);
  });

  it("bloqueia Empresa B em development para APIs operacionais", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    mockMissingTable();

    const r = await evaluateLegacyOperationalApiAccess({
      hostHeader: "empresa-b.localhost",
    });
    expect(r.allow).toBe(false);
    if (!r.allow) expect(r.error).toMatch(/não disponível/i);
  });
});
