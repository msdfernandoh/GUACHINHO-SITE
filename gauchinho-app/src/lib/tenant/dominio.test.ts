import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeHost,
  validateHostForPersist,
  isOfficialGauchinhoHost,
  isPlatformHost,
  devSlugFromHost,
  isDevelopmentNodeEnv,
} from "./dominio";
import {
  tenantAllowsLegacyOperationalData,
  isLegacyOperationalPath,
  isLegacyOperationalApiPath,
} from "./operational-access";
import {
  getCachedTenantResolution,
  setCachedTenantResolution,
  invalidateTenantHostCache,
} from "./tenant-host-cache";

describe("normalizeHost", () => {
  it("minúsculas, sem porta, sem www", () => {
    expect(normalizeHost("WWW.GauchinhoConsorcios.com.br:443")).toBe(
      "gauchinhoconsorcios.com.br",
    );
  });

  it("remove protocolo, path, query e fragmento", () => {
    expect(normalizeHost("https://www.exemplo.com.br/path?x=1#frag")).toBe("exemplo.com.br");
  });

  it("string vazia / null", () => {
    expect(normalizeHost("")).toBe("");
    expect(normalizeHost(null)).toBe("");
    expect(normalizeHost("   ")).toBe("");
  });
});

describe("validateHostForPersist", () => {
  it("aceita domínio válido", () => {
    const r = validateHostForPersist("https://WWW.Empresa.com.br/foo");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor).toBe("empresa.com.br");
  });

  it("bloqueia localhost, IP, wildcard e vazio", () => {
    expect(validateHostForPersist("localhost").ok).toBe(false);
    expect(validateHostForPersist("127.0.0.1").ok).toBe(false);
    expect(validateHostForPersist("*.exemplo.com").ok).toBe(false);
    expect(validateHostForPersist("").ok).toBe(false);
    expect(validateHostForPersist("empresa-b.localhost").ok).toBe(false);
  });
});

describe("isOfficialGauchinhoHost", () => {
  it("aceita apenas os dois hosts oficiais", () => {
    expect(isOfficialGauchinhoHost("gauchinhoconsorcios.com.br")).toBe(true);
    expect(isOfficialGauchinhoHost("www.gauchinhoconsorcios.com.br")).toBe(true);
    expect(isOfficialGauchinhoHost("outro.com.br")).toBe(false);
    expect(isOfficialGauchinhoHost("empresa-b.localhost")).toBe(false);
  });
});

describe("isPlatformHost", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reconhece somente o host canônico da plataforma", () => {
    expect(isPlatformHost("admin.gauchinhoconsorcios.com.br")).toBe(true);
    expect(isPlatformHost("www.admin.gauchinhoconsorcios.com.br")).toBe(false);
    expect(isPlatformHost("gauchinhoconsorcios.com.br")).toBe(false);
  });

  it("aceita override explícito de ambiente", () => {
    vi.stubEnv("PLATFORM_HOST", "admin.plataforma.teste");
    expect(isPlatformHost("admin.plataforma.teste")).toBe(true);
    expect(isPlatformHost("admin.gauchinhoconsorcios.com.br")).toBe(false);
  });
});

describe("devSlugFromHost", () => {
  it("resolve *.localhost", () => {
    expect(devSlugFromHost("gauchinho.localhost")).toBe("gauchinho");
    expect(devSlugFromHost("empresa-b.localhost")).toBe("empresa-b");
    expect(devSlugFromHost("localhost")).toBe("gauchinho");
  });
});

describe("tenantAllowsLegacyOperationalData", () => {
  it("depende exclusivamente do entitlement explícito", () => {
    expect(tenantAllowsLegacyOperationalData(true)).toBe(true);
    expect(tenantAllowsLegacyOperationalData({ operationalEnabled: true })).toBe(true);
    expect(tenantAllowsLegacyOperationalData(false)).toBe(false);
    expect(tenantAllowsLegacyOperationalData({ operationalEnabled: false })).toBe(false);
    expect(tenantAllowsLegacyOperationalData({})).toBe(false);
    expect(tenantAllowsLegacyOperationalData(null)).toBe(false);
  });
});

describe("operational paths", () => {
  it("marca rotas e APIs operacionais", () => {
    expect(isLegacyOperationalPath("/grupos")).toBe(true);
    expect(isLegacyOperationalPath("/simulador")).toBe(true);
    expect(isLegacyOperationalPath("/")).toBe(false);
    expect(isLegacyOperationalPath("/login")).toBe(false);
    expect(isLegacyOperationalPath("/admin")).toBe(false);
    expect(isLegacyOperationalPath("/admin/empresas")).toBe(false);
    expect(isLegacyOperationalApiPath("/api/public/consultores")).toBe(true);
    expect(isLegacyOperationalApiPath("/api/health")).toBe(false);
    expect(isLegacyOperationalApiPath("/api/cron/indices-financeiros")).toBe(false);
  });
});

describe("tenant-host-cache", () => {
  afterEach(() => {
    invalidateTenantHostCache();
  });

  it("armazena hit e miss sem misturar", () => {
    setCachedTenantResolution("a.com", {
      kind: "hit",
      empresaId: "1",
      slug: "gauchinho",
      source: "domain",
      operationalEnabled: true,
    });
    setCachedTenantResolution("b.com", { kind: "miss", reason: "not_found" });
    expect(getCachedTenantResolution("a.com")?.kind).toBe("hit");
    expect(getCachedTenantResolution("b.com")?.kind).toBe("miss");
    invalidateTenantHostCache();
    expect(getCachedTenantResolution("a.com")).toBeNull();
  });
});

describe("isDevelopmentNodeEnv + production overrides", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("development true apenas com NODE_ENV=development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isDevelopmentNodeEnv()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(isDevelopmentNodeEnv()).toBe(false);
  });
});
