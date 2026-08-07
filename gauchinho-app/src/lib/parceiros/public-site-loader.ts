/**
 * Loader de site público de parceiro (E8).
 * Sem `server-only` — pode ser usado pelo proxy (Edge) e por RSC.
 * Credenciais lidas de process.env; nunca reexportadas.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { FASE3_PARCEIRO_PUBLIC_SITE_ENABLED } from "./constants";
import { normalizeHost } from "./normalize";
import { buildPartnerPublicViewModel, type PartnerPublicViewModel } from "./public-site-data";
import {
  computeCanonicalRedirect,
  evaluatePublicServeGate,
} from "./public-site-gates";
import type { PartnerSiteResolution } from "./partner-site-types";
import {
  resolvePartnerSiteFromFacts,
  type PartnerDomainFact,
  type PartnerResolveFacts,
  type PartnerSiteFact,
} from "./resolve-partner-site";

function createReader(supabaseUrl: string, serviceKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function envCreds(inject?: { supabaseUrl?: string; serviceKey?: string }) {
  return {
    supabaseUrl: inject?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: inject?.serviceKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export async function loadPartnerResolveFacts(input?: {
  supabaseUrl?: string;
  serviceKey?: string;
  /** Limita sites/domínios a uma empresa (otimização). */
  empresaId?: string;
}): Promise<PartnerResolveFacts | null> {
  const { supabaseUrl, serviceKey } = envCreds(input);
  if (!supabaseUrl || !serviceKey) return null;
  const reader = createReader(supabaseUrl, serviceKey);

  let empresasQ = reader.from("empresas").select("id, slug, nome_fantasia");
  let hostsQ = reader
    .from("empresa_dominios")
    .select("valor, empresa_id, empresas!inner(slug)")
    .eq("ativo", true);
  let sitesQ = reader
    .from("parceiro_sites")
    .select(
      "id, empresa_id, organizacao_parceira_id, slug, status_publicacao, ativo, canal_principal, organizacoes_parceiras!inner(empresa_id, status)"
    );
  let domainsQ = reader
    .from("parceiro_site_dominios")
    .select(
      "id, empresa_id, parceiro_site_id, valor, tipo, principal, status, verificado, ssl_status, canonical_redirect, dns_instrucoes"
    )
    .neq("status", "REMOVIDO");

  if (input?.empresaId) {
    empresasQ = empresasQ.eq("id", input.empresaId);
    hostsQ = hostsQ.eq("empresa_id", input.empresaId);
    sitesQ = sitesQ.eq("empresa_id", input.empresaId);
    domainsQ = domainsQ.eq("empresa_id", input.empresaId);
  }

  const [empresasRes, hostsRes, sitesRes, domainsRes] = await Promise.all([
    empresasQ,
    hostsQ,
    sitesQ,
    domainsQ,
  ]);

  if (empresasRes.error || hostsRes.error || sitesRes.error || domainsRes.error) {
    return null;
  }

  const empresas = (empresasRes.data ?? []).map((e) => ({
    id: e.id as string,
    slug: e.slug as string,
  }));

  const tenantHosts = (hostsRes.data ?? []).map((h) => {
    const emp = h.empresas as unknown as { slug?: string } | null;
    return {
      host: normalizeHost(String(h.valor)),
      empresa_id: h.empresa_id as string,
      empresa_slug: emp?.slug ?? "",
    };
  });

  const sites: PartnerSiteFact[] = (sitesRes.data ?? []).map((s) => {
    const org = s.organizacoes_parceiras as unknown as {
      empresa_id?: string;
      status?: string;
    } | null;
    return {
      id: s.id as string,
      empresa_id: s.empresa_id as string,
      organizacao_parceira_id: s.organizacao_parceira_id as string,
      slug: s.slug as string,
      status_publicacao: s.status_publicacao as string,
      ativo: Boolean(s.ativo),
      canal_principal: s.canal_principal as string,
      org_empresa_id: org?.empresa_id ?? "",
      org_status: org?.status ?? "",
    };
  });

  const domains: PartnerDomainFact[] = (domainsRes.data ?? []).map((d) => {
    const dns = (d.dns_instrucoes ?? {}) as { principal_variant?: "apex" | "www" };
    return {
      id: d.id as string,
      empresa_id: d.empresa_id as string,
      parceiro_site_id: d.parceiro_site_id as string,
      valor: d.valor as string,
      tipo: d.tipo as string,
      principal: Boolean(d.principal),
      status: d.status as string,
      verificado: Boolean(d.verificado),
      ssl_status: d.ssl_status as string,
      canonical_redirect: d.canonical_redirect !== false,
      principal_variant: dns.principal_variant === "www" ? "www" : "apex",
    };
  });

  return { empresas, tenantHosts, sites, domains };
}

export async function loadPartnerSiteViewModel(input: {
  siteId: string;
  empresaId: string;
  isPreview?: boolean;
  supabaseUrl?: string;
  serviceKey?: string;
}): Promise<PartnerPublicViewModel | null> {
  const { supabaseUrl, serviceKey } = envCreds(input);
  if (!supabaseUrl || !serviceKey) return null;
  const reader = createReader(supabaseUrl, serviceKey);

  const { data: site, error } = await reader
    .from("parceiro_sites")
    .select(
      "id, empresa_id, organizacao_parceira_id, slug, nome_site, descricao, template_codigo, status_publicacao, canal_principal, whatsapp_modo, whatsapp, branding, menus, seo, ativo"
    )
    .eq("id", input.siteId)
    .eq("empresa_id", input.empresaId)
    .maybeSingle();
  if (error || !site) return null;

  const [{ data: org }, { data: empresa }, { data: branding }] = await Promise.all([
    reader
      .from("organizacoes_parceiras")
      .select("id, nome_fantasia, logo_url, telefone, whatsapp, email, instagram, status, empresa_id")
      .eq("id", site.organizacao_parceira_id)
      .eq("empresa_id", input.empresaId)
      .maybeSingle(),
    reader
      .from("empresas")
      .select("id, slug, nome_fantasia")
      .eq("id", input.empresaId)
      .maybeSingle(),
    reader
      .from("empresa_branding")
      .select("logo_url, telefone, whatsapp, email_contato")
      .eq("empresa_id", input.empresaId)
      .maybeSingle(),
  ]);

  if (!org || !empresa) return null;
  if (org.empresa_id !== site.empresa_id) return null;

  return buildPartnerPublicViewModel({
    site: {
      id: site.id,
      empresa_id: site.empresa_id,
      organizacao_parceira_id: site.organizacao_parceira_id,
      slug: site.slug,
      nome_site: site.nome_site,
      descricao: site.descricao ?? "",
      template_codigo: site.template_codigo,
      status_publicacao: site.status_publicacao,
      canal_principal: site.canal_principal,
      whatsapp_modo: site.whatsapp_modo,
      whatsapp: site.whatsapp,
      branding: (site.branding ?? {}) as Record<string, unknown>,
      menus: site.menus,
      seo: (site.seo ?? {}) as Record<string, unknown>,
    },
    org: {
      id: org.id,
      nome_fantasia: org.nome_fantasia,
      logo_url: org.logo_url,
      telefone: org.telefone,
      whatsapp: org.whatsapp,
      email: org.email,
      instagram: org.instagram,
    },
    empresa: {
      id: empresa.id,
      slug: empresa.slug,
      nome: empresa.nome_fantasia,
      logo_url: branding?.logo_url ?? null,
      telefone: branding?.telefone ?? null,
      whatsapp: branding?.whatsapp ?? null,
      email: branding?.email_contato ?? null,
    },
    isPreview: input.isPreview,
  });
}

export type PartnerPublicRequestResult =
  | {
      ok: true;
      partner: PartnerSiteResolution;
      view: PartnerPublicViewModel;
      redirect?: { location: string; status: 308 };
    }
  | { ok: false; reason: string };

/**
 * Resolução pública completa para um request.
 * Com flag=false → sempre ok:false reason flag_off (não serve).
 */
export async function resolvePartnerPublicRequest(input: {
  hostHeader: string | null;
  pathname: string;
  searchParams?: URLSearchParams;
  mode?: "public" | "admin_preview";
  resolvedTenant?: { empresa_id: string; empresa_slug: string } | null;
  supabaseUrl?: string;
  serviceKey?: string;
}): Promise<PartnerPublicRequestResult> {
  const mode = input.mode ?? "public";
  if (mode === "public" && !FASE3_PARCEIRO_PUBLIC_SITE_ENABLED) {
    return { ok: false, reason: "flag_off" };
  }

  const facts = await loadPartnerResolveFacts({
    supabaseUrl: input.supabaseUrl,
    serviceKey: input.serviceKey,
    empresaId: input.resolvedTenant?.empresa_id,
  });
  if (!facts) return { ok: false, reason: "facts_unavailable" };

  // Para domínio próprio, facts limitados por empresaId quebrariam — recarregar sem filtro se path não for parceiro
  let factsFull = facts;
  const host = normalizeHost(input.hostHeader);
  const isPath = input.pathname.startsWith("/parceiro/");
  if (!isPath && input.resolvedTenant?.empresa_id) {
    // host de parceiro: não está em empresa_dominios; precisa facts globais de domínios
    const all = await loadPartnerResolveFacts({
      supabaseUrl: input.supabaseUrl,
      serviceKey: input.serviceKey,
    });
    if (all) factsFull = all;
  }

  const resolution = resolvePartnerSiteFromFacts({
    hostHeader: input.hostHeader,
    pathname: input.pathname,
    searchParams: input.searchParams,
    facts: factsFull,
    mode,
    resolvedTenant: input.resolvedTenant,
  });

  if (mode === "admin_preview") {
    if (!resolution.ok) return { ok: false, reason: resolution.reason };
    const view = await loadPartnerSiteViewModel({
      siteId: resolution.partner.parceiro_site_id,
      empresaId: resolution.partner.empresa_id,
      isPreview: true,
      supabaseUrl: input.supabaseUrl,
      serviceKey: input.serviceKey,
    });
    if (!view) return { ok: false, reason: "view_unavailable" };
    return { ok: true, partner: resolution.partner, view };
  }

  const siteFact = factsFull.sites.find(
    (s) => resolution.ok && s.id === resolution.partner.parceiro_site_id
  );
  const gate = evaluatePublicServeGate({
    resolution,
    orgStatus: siteFact?.org_status,
  });
  if (!gate.ok) return { ok: false, reason: gate.reason };

  const redirect = computeCanonicalRedirect({
    requestedHost: host || (input.hostHeader ?? ""),
    requestedPath: input.pathname,
    partner: gate.partner,
    principalVariant:
      factsFull.domains.find((d) => d.id === gate.partner.dominio_id)?.principal_variant ??
      "apex",
  });

  const view = await loadPartnerSiteViewModel({
    siteId: gate.partner.parceiro_site_id,
    empresaId: gate.partner.empresa_id,
    isPreview: false,
    supabaseUrl: input.supabaseUrl,
    serviceKey: input.serviceKey,
  });
  if (!view) return { ok: false, reason: "view_unavailable" };

  if (redirect.redirect) {
    return {
      ok: true,
      partner: gate.partner,
      view,
      redirect: { location: redirect.location, status: 308 },
    };
  }
  return { ok: true, partner: gate.partner, view };
}
