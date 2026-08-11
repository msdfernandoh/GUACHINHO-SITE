import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCachedTenantResolution,
  setCachedTenantResolution,
  invalidateTenantHostCache,
  setTenantCacheNow,
  resetTenantCacheNow,
  TENANT_CACHE_TTL,
} from "./tenant-host-cache";

describe("tenant-host-cache", () => {
  afterEach(() => {
    invalidateTenantHostCache();
    resetTenantCacheNow();
  });

  it("cache positivo por host", () => {
    const now = 1_000;
    setTenantCacheNow(() => now);
    setCachedTenantResolution("a.com", {
      kind: "hit",
      empresaId: "1",
      slug: "gauchinho",
      source: "domain",
    });
    expect(getCachedTenantResolution("a.com")?.kind).toBe("hit");
  });

  it("cache negativo curto e separado por host", () => {
    const now = 1_000;
    setTenantCacheNow(() => now);
    setCachedTenantResolution("a.com", { kind: "miss", reason: "not_found" });
    setCachedTenantResolution("b.com", {
      kind: "hit",
      empresaId: "2",
      slug: "empresa-b",
      source: "dev_override",
    });
    expect(getCachedTenantResolution("a.com")?.kind).toBe("miss");
    expect(getCachedTenantResolution("b.com")?.kind).toBe("hit");
  });

  it("expira cache positivo após TTL", () => {
    let now = 1_000;
    setTenantCacheNow(() => now);
    setCachedTenantResolution("a.com", {
      kind: "hit",
      empresaId: "1",
      slug: "gauchinho",
      source: "domain",
    });
    now += TENANT_CACHE_TTL.positiveMs + 1;
    expect(getCachedTenantResolution("a.com")).toBeNull();
  });

  it("erro transitório expira rápido", () => {
    let now = 1_000;
    setTenantCacheNow(() => now);
    setCachedTenantResolution(
      "a.com",
      { kind: "miss", reason: "infra_unavailable" },
      { errorTransient: true },
    );
    expect(getCachedTenantResolution("a.com")?.kind).toBe("miss");
    now += TENANT_CACHE_TTL.errorMs + 1;
    expect(getCachedTenantResolution("a.com")).toBeNull();
  });

  it("invalidação limpa todos os hosts", () => {
    setCachedTenantResolution("a.com", {
      kind: "hit",
      empresaId: "1",
      slug: "gauchinho",
      source: "domain",
    });
    setCachedTenantResolution("b.com", { kind: "miss", reason: "not_found" });
    invalidateTenantHostCache();
    expect(getCachedTenantResolution("a.com")).toBeNull();
    expect(getCachedTenantResolution("b.com")).toBeNull();
  });
});

// silencia unused vi se necessário
void vi;
