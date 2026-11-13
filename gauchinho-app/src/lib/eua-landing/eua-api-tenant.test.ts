import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/parceiros/constants", () => ({ FASE3_PARCEIRO_PUBLIC_SITE_ENABLED: true }));
vi.mock("@/lib/tenant/resolve-by-host", () => ({
  resolveTenantForRequest: async () => ({ ok: false, reason: "not_configured" }),
}));
vi.mock("@/lib/parceiros/public-site-loader", () => ({
  resolvePartnerPublicRequest: async (input: { hostHeader: string }) =>
    input.hostHeader === "raconsinop.com.br" || input.hostHeader === "www.raconsinop.com.br"
      ? { ok: true, partner: { empresa_id: "empresa-dona", empresa_slug: "empresa", parceiro_site_id: "parceiro" } }
      : { ok: false, reason: "not_found" },
}));

import { evaluateLegacyOperationalApiAccess } from "@/lib/tenant/assert-legacy-operational-api";

describe("APIs públicas no subdomínio EUA", () => {
  it("resolvem a empresa do domínio pai", async () => {
    const r = await evaluateLegacyOperationalApiAccess({
      hostHeader: "eua.raconsinop.com.br",
      url: "https://eua.raconsinop.com.br/api/public/eua/lead",
    });
    expect(r).toMatchObject({ allow: true, empresaId: "empresa-dona", parceiroSiteId: "parceiro" });
  });

  it("continuam recusando hosts desconhecidos", async () => {
    const r = await evaluateLegacyOperationalApiAccess({ hostHeader: "eua.outro-site.com", url: "https://eua.outro-site.com/api" });
    expect(r.allow).toBe(false);
  });
});
