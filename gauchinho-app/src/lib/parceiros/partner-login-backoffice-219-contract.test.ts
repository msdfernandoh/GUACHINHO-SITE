import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { leadVisibleForScope, type LeadAccessScope } from "@/lib/crm/lead-access";
import { isGauchinhoTenant } from "@/lib/tenant/get-resolved-empresa";

const root = resolve(process.cwd(), "..");

describe("Fase 219 — Área de Login e Backoffice em Domínios de Parceiros", () => {
  const proxySource = readFileSync(
    resolve(root, "gauchinho-app/src/proxy.ts"),
    "utf8",
  );
  const getResolvedTenantSource = readFileSync(
    resolve(root, "gauchinho-app/src/lib/tenant/get-resolved-empresa.ts"),
    "utf8",
  );
  const adminLayoutSource = readFileSync(
    resolve(root, "gauchinho-app/src/app/admin/layout.tsx"),
    "utf8",
  );

  it("garante que o proxy define rotas operacionais e administrativas completas no parceiro", () => {
    expect(proxySource).toContain("partnerOperationalPaths");
    expect(proxySource).toContain('"/admin"');
    expect(proxySource).toContain('"/erp"');
    expect(proxySource).toContain('"/login"');
    expect(proxySource).toContain('"/esqueci-senha"');
    expect(proxySource).toContain('"/definir-senha"');
    expect(proxySource).toContain('"/auth"');
    expect(proxySource).toContain('"/simulador"');
    expect(proxySource).toContain('"/grupos"');
    expect(proxySource).toContain('"/proposta"');
    expect(proxySource).toContain('"/contratar"');
    expect(proxySource).toContain('"/area-parceiro"');
    expect(proxySource).toContain('"/indicar"');
  });

  it("bloqueia rewrite da home institucional quando rota for backoffice ou operacional", () => {
    expect(proxySource).toContain("const isOperationalPath =");
    expect(proxySource).toContain("if (!isOperationalPath && !path.startsWith(\"/parceiro/\")) {");
    expect(proxySource).toContain("partnerRewriteSlug = partner.partner.site_slug;");
  });

  it("protege tanto /admin quanto /erp contra acesso sem autenticação", () => {
    expect(proxySource).toContain('if (path.startsWith("/admin") || path.startsWith("/erp")) {');
  });

  it("getResolvedTenant absorve o header PARCEIRO_SITE_ID_HEADER e carrega a identidade do parceiro", () => {
    expect(getResolvedTenantSource).toContain("PARCEIRO_SITE_ID_HEADER");
    expect(getResolvedTenantSource).toContain("loadPartnerSiteViewModel");
    expect(getResolvedTenantSource).toContain("parceiroSiteId");
    expect(getResolvedTenantSource).toContain("racon_inspired");
  });

  it("isGauchinhoTenant retorna falso quando parceiroSiteId está presente", () => {
    expect(isGauchinhoTenant({ slug: "gauchinho", parceiroSiteId: "site-123" })).toBe(false);
    expect(isGauchinhoTenant({ slug: "gauchinho", parceiroSiteId: null })).toBe(true);
    expect(isGauchinhoTenant({ slug: "gauchinho" })).toBe(true);
    expect(isGauchinhoTenant({ slug: "outra-empresa" })).toBe(false);
  });

  it("TenantBrandProvider no layout do admin não marca como Gauchinho em domínio parceiro", () => {
    expect(adminLayoutSource).toContain("!tenant?.parceiroSiteId && tenant?.slug === GAUCHINHO_SLUG");
  });

  it("regras de escopo de leads mantêm isolamento por consultor com leadsApenasProprios", () => {
    const scopeConsultorRestrito: LeadAccessScope = {
      usuarioId: "user-consultor-1",
      perfil: "consultor",
      leadsApenasProprios: true,
      eventosRestritos: new Map(),
    };

    const scopeAdminGauchinho: LeadAccessScope = {
      usuarioId: "user-admin-1",
      perfil: "admin_empresa",
      leadsApenasProprios: false,
      eventosRestritos: new Map(),
    };

    const leadDoConsultor = {
      srd_responsavel_id: "user-consultor-1",
      evento_id: null,
    };

    const leadDeOutroConsultor = {
      srd_responsavel_id: "user-consultor-2",
      evento_id: null,
    };

    // Consultor com leadsApenasProprios só vê o seu próprio lead
    expect(leadVisibleForScope(leadDoConsultor, scopeConsultorRestrito)).toBe(true);
    expect(leadVisibleForScope(leadDeOutroConsultor, scopeConsultorRestrito)).toBe(false);

    // Admin vê leads de qualquer consultor
    expect(leadVisibleForScope(leadDoConsultor, scopeAdminGauchinho)).toBe(true);
    expect(leadVisibleForScope(leadDeOutroConsultor, scopeAdminGauchinho)).toBe(true);
  });
});
