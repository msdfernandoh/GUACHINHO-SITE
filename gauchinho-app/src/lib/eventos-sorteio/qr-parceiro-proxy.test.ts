import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { TENANT_EMPRESA_ID_HEADER } from "@/lib/tenant/constants";

vi.mock("@/lib/parceiros/constants", () => ({ FASE3_PARCEIRO_PUBLIC_SITE_ENABLED: true }));
vi.mock("@/lib/tenant/resolve-by-host", () => ({
  resolveHostContextForRequest: async () => ({ ok: false, reason: "not_configured" }),
}));
vi.mock("@/lib/parceiros/public-site-loader", () => ({
  resolvePartnerPublicRequest: async () => ({
    ok: true,
    partner: { empresa_id: "empresa-dona", empresa_slug: "empresa", parceiro_site_id: "parceiro", site_slug: "racon", source: "domain" },
  }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

import { proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

describe("QR no domínio parceiro", () => {
  it.each(["externo", "network"])("preserva /qr/%s e o contexto confiável sem reescrever para a home", async (slug) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test");
    const request = new NextRequest(`https://www.raconsinop.com.br/qr/${slug}`, {
      headers: { host: "www.raconsinop.com.br", [TENANT_EMPRESA_ID_HEADER]: "injetado" },
    });
    const response = await proxy(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get(`x-middleware-request-${TENANT_EMPRESA_ID_HEADER}`)).toBe("empresa-dona");
  });
});
