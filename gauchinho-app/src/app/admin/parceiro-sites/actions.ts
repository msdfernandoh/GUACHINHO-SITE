"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import {
  assertNaoPodeEditarSiteComoParceiro,
  requireGerenciarSitesParceiros,
} from "@/lib/parceiros/authorization";
import { brandingFromForm, emptyBranding } from "@/lib/parceiros/branding";
import {
  buildDnsInstrucoesFromVercel,
  evaluatePublicationGates,
  isHostBlockedByEmpresaDominios,
  mapVercelEvidenceToLocal,
  parsePrincipalVariant,
  reconcileLocalVsVercel,
  validateDominioE5Create,
  type DnsInstrucoesE5,
  type DnsRegistro,
} from "@/lib/parceiros/domain-e5";
import { MENU_CODIGOS, parseMenusFromForm } from "@/lib/parceiros/menus";
import {
  fase3SitesAdminDisabledMessage,
  isFase3ParceiroSitesAdminReady,
} from "@/lib/parceiros/schema-ready";
import {
  papelBloqueadoParaEditorSite,
  validateDominioLocalCreate,
  validateSiteCreateInput,
} from "@/lib/parceiros/site-rules";
import type { ParceiroSite, ParceiroSiteDominio, ParceiroSiteListRow } from "@/lib/parceiros/types";
import { TEMPLATE_CODIGOS } from "@/lib/parceiros/templates";
import { PARCEIRO_CANAIS, PARCEIRO_SITE_STATUS } from "@/lib/parceiros/constants";
import {
  dnsRegistrosFromVercelConfig,
  getConfiguredVercelProject,
  getDefaultVercelDomainsClient,
  isVercelDomainsIntegrationReady,
  vercelDomainsDisabledReason,
  type VercelDomainsClient,
} from "@/lib/parceiros/vercel-domains.server";

/** Injável em testes — produção usa cliente default. */
let vercelClientOverride: VercelDomainsClient | null = null;

export async function __setVercelDomainsClientForTests(client: VercelDomainsClient | null) {
  vercelClientOverride = client;
}

function vercelClient(): VercelDomainsClient {
  return vercelClientOverride ?? getDefaultVercelDomainsClient();
}

async function resolveEmpresaIdPadrao(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("id")
    .eq("slug", "gauchinho")
    .single();
  if (error || !data) throw new Error("Empresa não encontrada.");
  return data.id as string;
}

async function assertSitesAdmin(empresaId: string, papelCodigo?: string | null) {
  const ready = await isFase3ParceiroSitesAdminReady();
  if (!ready) throw new Error(fase3SitesAdminDisabledMessage());
  if (papelCodigo) await assertNaoPodeEditarSiteComoParceiro(papelCodigo);
  if (papelBloqueadoParaEditorSite(papelCodigo ?? undefined) && !(await isPlatformSuperadmin())) {
    throw new Error("Papel sem permissão para editar sites de parceiros.");
  }
  await requireGerenciarSitesParceiros(empresaId);
}

async function audit(
  empresaId: string,
  siteId: string | null,
  dominioId: string | null,
  acao: string,
  payload: Record<string, unknown>
) {
  const supabase = await createClient();
  // Nunca registrar token ou Authorization.
  const safe = { ...payload };
  delete safe.token;
  delete safe.authorization;
  delete safe.Authorization;
  await supabase.from("parceiro_site_auditoria").insert({
    empresa_id: empresaId,
    parceiro_site_id: siteId,
    dominio_id: dominioId,
    acao,
    payload: safe,
  });
}

async function loadEmpresaHosts(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("empresa_dominios").select("valor, ativo, verificado");
  return data ?? [];
}

async function assertDominioOwnership(input: {
  empresaId: string;
  siteId: string;
  dominioId: string;
}) {
  const supabase = await createClient();
  const { data: site } = await supabase
    .from("parceiro_sites")
    .select("id, empresa_id")
    .eq("id", input.siteId)
    .eq("empresa_id", input.empresaId)
    .maybeSingle();
  if (!site) throw new Error("Site não encontrado neste tenant.");

  const { data: dom } = await supabase
    .from("parceiro_site_dominios")
    .select("*")
    .eq("id", input.dominioId)
    .eq("parceiro_site_id", input.siteId)
    .eq("empresa_id", input.empresaId)
    .maybeSingle();
  if (!dom) throw new Error("Domínio não pertence a este site/tenant.");

  const empresaHosts = await loadEmpresaHosts(supabase);
  if (isHostBlockedByEmpresaDominios(
    dom.valor,
    empresaHosts.map((h) => h.valor)
  )) {
    throw new Error("Operação bloqueada: host pertence a empresa_dominios (deny-list absoluta).");
  }

  return { supabase, site, dominio: dom as ParceiroSiteDominio, empresaHosts };
}

async function collectDnsFromVercel(
  client: VercelDomainsClient,
  apex: string,
  www: string | null,
  tipo: string
): Promise<{ registros: DnsRegistro[]; vercelMeta: DnsInstrucoesE5["vercel"] }> {
  const registros: DnsRegistro[] = [];
  const vercelMeta: DnsInstrucoesE5["vercel"] = {};

  const apexCfg = await client.getDomainConfig(apex);
  if (apexCfg.ok) {
    registros.push(...dnsRegistrosFromVercelConfig(apexCfg.data, "@"));
  }
  const apexInfo = await client.getDomain(apex);
  if (apexInfo.ok && apexInfo.data) {
    vercelMeta.apex = {
      name: apexInfo.data.name,
      verified: apexInfo.data.verified,
      configured: !apexCfg.ok ? undefined : !apexCfg.data.misconfigured,
    };
  }

  if (www && (tipo === "DOMINIO_PROPRIO" || tipo === "ALIAS")) {
    const wwwCfg = await client.getDomainConfig(www);
    if (wwwCfg.ok) {
      registros.push(...dnsRegistrosFromVercelConfig(wwwCfg.data, "www"));
    }
    const wwwInfo = await client.getDomain(www);
    if (wwwInfo.ok && wwwInfo.data) {
      vercelMeta.www = {
        name: wwwInfo.data.name,
        verified: wwwInfo.data.verified,
        configured: !wwwCfg.ok ? undefined : !wwwCfg.data.misconfigured,
      };
    }
  }

  return { registros, vercelMeta };
}

export async function canAccessParceiroSitesAdmin(): Promise<boolean> {
  if (await isPlatformSuperadmin()) return true;
  try {
    const empresaId = await resolveEmpresaIdPadrao();
    await requireGerenciarSitesParceiros(empresaId);
    return true;
  } catch {
    return false;
  }
}

export async function fetchParceiroSitesList(filters?: {
  organizacaoId?: string;
  status?: string;
  template?: string;
  comDominio?: string;
  publicado?: string;
  q?: string;
}): Promise<{
  ready: boolean;
  message?: string;
  rows: ParceiroSiteListRow[];
  empresaId: string | null;
  organizacoes: Array<{ id: string; nome_fantasia: string; status: string }>;
}> {
  const ready = await isFase3ParceiroSitesAdminReady();
  if (!ready) {
    return {
      ready: false,
      message: fase3SitesAdminDisabledMessage(),
      rows: [],
      empresaId: null,
      organizacoes: [],
    };
  }

  const empresaId = await resolveEmpresaIdPadrao();
  await requireGerenciarSitesParceiros(empresaId);
  const supabase = await createClient();

  const { data: orgs } = await supabase
    .from("organizacoes_parceiras")
    .select("id, nome_fantasia, status")
    .eq("empresa_id", empresaId)
    .order("nome_fantasia");

  let query = supabase
    .from("parceiro_sites")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("updated_at", { ascending: false });

  if (filters?.organizacaoId) query = query.eq("organizacao_parceira_id", filters.organizacaoId);
  if (filters?.status) query = query.eq("status_publicacao", filters.status);
  if (filters?.template) query = query.eq("template_codigo", filters.template);
  if (filters?.publicado === "1") query = query.eq("status_publicacao", "PUBLICADO");
  if (filters?.q?.trim()) {
    const q = filters.q.trim();
    query = query.or(`nome_site.ilike.%${q}%,slug.ilike.%${q}%`);
  }

  const { data: sites, error } = await query;
  if (error) throw new Error(error.message);

  const siteIds = (sites ?? []).map((s) => s.id);
  const { data: dominios } = siteIds.length
    ? await supabase
        .from("parceiro_site_dominios")
        .select("*")
        .in("parceiro_site_id", siteIds)
        .neq("status", "REMOVIDO")
    : { data: [] as ParceiroSiteDominio[] };

  const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.nome_fantasia]));
  let rows: ParceiroSiteListRow[] = (sites ?? []).map((s) => {
    const principal = (dominios ?? []).find((d) => d.parceiro_site_id === s.id && d.principal);
    return {
      ...(s as ParceiroSite),
      organizacao_nome: orgMap.get(s.organizacao_parceira_id) ?? null,
      dominio_principal: principal?.valor ?? null,
      dominio_status: principal?.status ?? null,
      dominio_ssl: principal?.ssl_status ?? null,
    };
  });

  if (filters?.comDominio === "1") {
    rows = rows.filter((r) => Boolean(r.dominio_principal));
  } else if (filters?.comDominio === "0") {
    rows = rows.filter((r) => !r.dominio_principal);
  }
  if (filters?.q?.trim()) {
    const q = filters.q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.nome_site.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.dominio_principal ?? "").toLowerCase().includes(q)
    );
  }

  return {
    ready: true,
    rows,
    empresaId,
    organizacoes: (orgs ?? []) as Array<{ id: string; nome_fantasia: string; status: string }>,
  };
}

export async function fetchParceiroSiteDetalhe(id: string) {
  const ready = await isFase3ParceiroSitesAdminReady();
  if (!ready) throw new Error(fase3SitesAdminDisabledMessage());
  const empresaId = await resolveEmpresaIdPadrao();
  await requireGerenciarSitesParceiros(empresaId);
  const supabase = await createClient();

  const { data: site, error } = await supabase
    .from("parceiro_sites")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .single();
  if (error || !site) throw new Error("Site não encontrado.");

  const [{ data: org }, { data: dominios }] = await Promise.all([
    supabase
      .from("organizacoes_parceiras")
      .select("id, nome_fantasia, status, telefone, whatsapp, email, instagram")
      .eq("id", site.organizacao_parceira_id)
      .maybeSingle(),
    supabase
      .from("parceiro_site_dominios")
      .select("*")
      .eq("parceiro_site_id", id)
      .neq("status", "REMOVIDO")
      .order("principal", { ascending: false }),
  ]);

  const principal = (dominios ?? []).find((d) => d.principal) ?? null;
  const publicationGates = evaluatePublicationGates({
    organizacaoStatus: org?.status ?? "",
    siteAtivo: Boolean(site.ativo),
    nomeSite: site.nome_site,
    branding: (site.branding ?? {}) as Parameters<typeof evaluatePublicationGates>[0]["branding"],
    menus: Array.isArray(site.menus) ? site.menus : [],
    canalPrincipal: site.canal_principal,
    dominioPrincipal: principal
      ? {
          valor: principal.valor,
          verificado: principal.verificado,
          status: principal.status,
          ssl_status: principal.ssl_status,
        }
      : null,
  });

  return {
    empresaId,
    site: site as ParceiroSite,
    organizacao: org,
    dominios: (dominios ?? []) as ParceiroSiteDominio[],
    templates: TEMPLATE_CODIGOS,
    menusCatalogo: MENU_CODIGOS,
    statusOptions: PARCEIRO_SITE_STATUS,
    canais: PARCEIRO_CANAIS,
    vercelReady: isVercelDomainsIntegrationReady(),
    vercelDisabledReason: isVercelDomainsIntegrationReady()
      ? null
      : vercelDomainsDisabledReason(),
    vercelProject: getConfiguredVercelProject(),
    publicationGates,
  };
}

export async function fetchOrgsAtivasParaSite() {
  const empresaId = await resolveEmpresaIdPadrao();
  await assertSitesAdmin(empresaId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizacoes_parceiras")
    .select("id, nome_fantasia, status")
    .eq("empresa_id", empresaId)
    .eq("status", "ATIVA")
    .order("nome_fantasia");
  if (error) throw new Error(error.message);
  return { empresaId, orgs: data ?? [] };
}

export async function createParceiroSiteAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertSitesAdmin(empresaId);

  const organizacaoId = String(formData.get("organizacao_parceira_id") ?? "");
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizacoes_parceiras")
    .select("id, empresa_id, status")
    .eq("id", organizacaoId)
    .maybeSingle();

  const [{ data: existingSites }, { data: allSlugs }] = await Promise.all([
    supabase
      .from("parceiro_sites")
      .select("id, organizacao_parceira_id, ativo, status_publicacao")
      .eq("organizacao_parceira_id", organizacaoId)
      .eq("ativo", true)
      .neq("status_publicacao", "ARQUIVADO"),
    supabase.from("parceiro_sites").select("id, empresa_id, slug").eq("empresa_id", empresaId),
  ]);

  const menus = parseMenusFromForm(formData.getAll("menus"));
  const branding = { ...emptyBranding(), ...brandingFromForm(formData) };
  const validated = validateSiteCreateInput({
    empresaId,
    organizacaoId,
    organizacaoEmpresaId: org?.empresa_id ?? "",
    organizacaoStatus: org?.status ?? "",
    nomeSite: String(formData.get("nome_site") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    templateCodigo: String(formData.get("template_codigo") ?? "institucional_v1"),
    canalPrincipal: String(formData.get("canal_principal") ?? "ROTA"),
    statusPublicacao: String(formData.get("status_publicacao") ?? "RASCUNHO"),
    branding,
    menus,
    existingActiveSites: (existingSites ?? []).map((s) => ({
      id: s.id,
      organizacaoId: s.organizacao_parceira_id,
    })),
    existingSlugs: (allSlugs ?? []).map((s) => ({
      id: s.id,
      empresaId: s.empresa_id,
      slug: s.slug,
    })),
    dominioPrincipal: null,
  });
  if (!validated.ok) {
    if (validated.publicationReasons) {
      await audit(empresaId, null, null, "PUBLICACAO_BLOQUEADA", {
        reasons: validated.publicationReasons,
      });
    }
    throw new Error(validated.error);
  }

  const { data: created, error } = await supabase
    .from("parceiro_sites")
    .insert({
      empresa_id: empresaId,
      organizacao_parceira_id: organizacaoId,
      slug: validated.slug,
      template_codigo: String(formData.get("template_codigo") ?? "institucional_v1"),
      status_publicacao: String(formData.get("status_publicacao") ?? "RASCUNHO"),
      canal_principal: String(formData.get("canal_principal") ?? "ROTA"),
      nome_site: String(formData.get("nome_site") ?? "").trim(),
      descricao: String(formData.get("descricao") ?? ""),
      branding,
      menus: validated.menus ?? [],
      whatsapp_modo: String(formData.get("whatsapp_modo") ?? "EMPRESA"),
      whatsapp: String(formData.get("whatsapp") ?? "") || null,
      seo: {
        titulo: String(formData.get("seo_titulo") ?? "") || null,
        descricao: String(formData.get("seo_descricao") ?? "") || null,
      },
      ativo: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await audit(empresaId, created.id, null, "CRIAR_SITE", {
    slug: validated.slug,
    template: formData.get("template_codigo"),
  });

  revalidatePath("/admin/parceiro-sites");
  redirect(`/admin/parceiro-sites/${created.id}`);
}

export async function updateParceiroSiteAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertSitesAdmin(empresaId);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("ID obrigatório.");

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("parceiro_sites")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", empresaId)
    .single();
  if (!current) throw new Error("Site não encontrado.");

  const { data: org } = await supabase
    .from("organizacoes_parceiras")
    .select("empresa_id, status")
    .eq("id", current.organizacao_parceira_id)
    .maybeSingle();

  const [{ data: existingSites }, { data: allSlugs }, { data: principalDom }] = await Promise.all([
    supabase
      .from("parceiro_sites")
      .select("id, organizacao_parceira_id")
      .eq("organizacao_parceira_id", current.organizacao_parceira_id)
      .eq("ativo", true)
      .neq("status_publicacao", "ARQUIVADO"),
    supabase.from("parceiro_sites").select("id, empresa_id, slug").eq("empresa_id", empresaId),
    supabase
      .from("parceiro_site_dominios")
      .select("valor, verificado, status, ssl_status")
      .eq("parceiro_site_id", id)
      .eq("principal", true)
      .neq("status", "REMOVIDO")
      .maybeSingle(),
  ]);

  const menus = parseMenusFromForm(formData.getAll("menus"));
  const branding = { ...emptyBranding(), ...brandingFromForm(formData) };
  const afterStatus = String(formData.get("status_publicacao") ?? current.status_publicacao);
  const siteAtivo = formData.get("ativo") === "on";

  const validated = validateSiteCreateInput({
    empresaId,
    organizacaoId: current.organizacao_parceira_id,
    organizacaoEmpresaId: org?.empresa_id ?? "",
    organizacaoStatus: org?.status ?? "",
    nomeSite: String(formData.get("nome_site") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    templateCodigo: String(formData.get("template_codigo") ?? current.template_codigo),
    canalPrincipal: String(formData.get("canal_principal") ?? current.canal_principal),
    statusPublicacao: afterStatus,
    branding,
    menus,
    existingActiveSites: (existingSites ?? [])
      .filter((s) => s.id !== id)
      .map((s) => ({ id: s.id, organizacaoId: s.organizacao_parceira_id })),
    existingSlugs: (allSlugs ?? [])
      .filter((s) => s.id !== id)
      .map((s) => ({ id: s.id, empresaId: s.empresa_id, slug: s.slug })),
    exigirOrgAtiva: false,
    siteAtivo,
    dominioPrincipal: principalDom
      ? {
          valor: principalDom.valor,
          verificado: principalDom.verificado,
          status: principalDom.status,
          ssl_status: principalDom.ssl_status,
        }
      : null,
  });
  if (!validated.ok) {
    if (afterStatus === "PUBLICADO") {
      await audit(empresaId, id, null, "PUBLICACAO_BLOQUEADA", {
        reasons: validated.publicationReasons ?? [validated.error],
      });
    }
    throw new Error(validated.error);
  }

  const before = {
    template: current.template_codigo,
    status: current.status_publicacao,
    menus: current.menus,
    branding: current.branding,
  };

  const { error } = await supabase
    .from("parceiro_sites")
    .update({
      slug: validated.slug ?? current.slug,
      template_codigo: String(formData.get("template_codigo") ?? current.template_codigo),
      status_publicacao: afterStatus,
      canal_principal: String(formData.get("canal_principal") ?? current.canal_principal),
      nome_site: String(formData.get("nome_site") ?? "").trim(),
      descricao: String(formData.get("descricao") ?? ""),
      branding,
      menus: validated.menus ?? current.menus,
      whatsapp_modo: String(formData.get("whatsapp_modo") ?? current.whatsapp_modo),
      whatsapp: String(formData.get("whatsapp") ?? "") || null,
      seo: {
        titulo: String(formData.get("seo_titulo") ?? "") || null,
        descricao: String(formData.get("seo_descricao") ?? "") || null,
      },
      ativo: siteAtivo,
    })
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);

  const acao =
    afterStatus !== current.status_publicacao
      ? afterStatus === "PUBLICADO"
        ? "PUBLICACAO_APROVADA"
        : afterStatus === "SUSPENSO"
          ? "SUSPENDER"
          : afterStatus === "ARQUIVADO"
            ? "ARQUIVAR"
            : "ATUALIZAR_SITE"
      : "ATUALIZAR_SITE";

  await audit(empresaId, id, null, acao, {
    before,
    after: {
      template: formData.get("template_codigo"),
      status: afterStatus,
      menus: validated.menus,
    },
  });

  revalidatePath("/admin/parceiro-sites");
  revalidatePath(`/admin/parceiro-sites/${id}`);
}

/** Cadastro de domínio: local sempre; Vercel somente se flag+credencial. */
export async function addParceiroSiteDominioAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertSitesAdmin(empresaId);
  const siteId = String(formData.get("parceiro_site_id") ?? "");
  if (!siteId) throw new Error("Site obrigatório.");

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("parceiro_sites")
    .select("id, empresa_id")
    .eq("id", siteId)
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (!site) throw new Error("Site não encontrado.");

  const [{ data: parceiroHosts }, empresaHostsRows, { data: primaries }] = await Promise.all([
    supabase.from("parceiro_site_dominios").select("valor").neq("status", "REMOVIDO"),
    loadEmpresaHosts(supabase),
    supabase
      .from("parceiro_site_dominios")
      .select("id")
      .eq("parceiro_site_id", siteId)
      .eq("principal", true)
      .neq("status", "REMOVIDO"),
  ]);

  const empresaHosts = empresaHostsRows.map((h) => h.valor);
  const baseAtivos = empresaHostsRows
    .filter((h) => h.ativo !== false)
    .map((h) => h.valor);

  const tipo = String(formData.get("tipo") ?? "DOMINIO_PROPRIO");
  const principal = formData.get("principal") === "on";
  const principalVariant = parsePrincipalVariant(String(formData.get("principal_variant") ?? "apex"));

  const validated = validateDominioE5Create({
    valorRaw: String(formData.get("valor") ?? ""),
    tipo,
    principal,
    principalVariant,
    existingParceiroHosts: (parceiroHosts ?? []).map((h) => h.valor),
    existingEmpresaHosts: empresaHosts,
    hasPrimaryAlready: (primaries ?? []).length > 0,
    baseEmpresaHostsAtivos: baseAtivos,
  });
  if (!validated.ok) throw new Error(validated.error);

  // Deny-list absoluta pré-mutação
  if (isHostBlockedByEmpresaDominios(validated.valor!, empresaHosts)) {
    throw new Error("Domínio oficial/tenant bloqueado (empresa_dominios).");
  }

  const pair = validated.pair!;
  const dnsLocal: DnsInstrucoesE5 = {
    nota: isVercelDomainsIntegrationReady()
      ? "Cadastro local; sincronizando com Vercel…"
      : "Cadastro local. Integração Vercel desabilitada nesta rodada/ambiente.",
    apex: pair.apex,
    www: tipo === "SUBDOMINIO_EMPRESA" ? undefined : pair.www,
    principal_variant: validated.principalVariant,
    registros: [],
  };

  const { data: created, error } = await supabase
    .from("parceiro_site_dominios")
    .insert({
      empresa_id: empresaId,
      parceiro_site_id: siteId,
      valor: validated.valor,
      tipo,
      principal,
      verificado: false,
      status: "PENDENTE_DNS",
      ssl_status: "PENDING",
      dns_instrucoes: dnsLocal,
      canonical_redirect: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await audit(empresaId, siteId, created.id, "DOMINIO_CRIADO", {
    valor: validated.valor,
    tipo,
    status: "PENDENTE_DNS",
  });

  if (!isVercelDomainsIntegrationReady()) {
    // Compat E4: validação local pura também coberta por validateDominioLocalCreate nos testes.
    void validateDominioLocalCreate;
    revalidatePath(`/admin/parceiro-sites/${siteId}`);
    return;
  }

  const client = vercelClient();
  const project = getConfiguredVercelProject();
  const hostsToAdd =
    tipo === "DOMINIO_PROPRIO" || tipo === "ALIAS"
      ? [pair.apex, pair.www]
      : [pair.apex];

  let lastError: string | null = null;
  let vercelDomainId: string | null = null;

  for (const host of hostsToAdd) {
    const add = await client.addDomain(host);
    if (!add.ok) {
      lastError = add.error;
      if (add.code === "domain_already_in_use") break;
      continue;
    }
    if (host === pair.apex && add.data.id) vercelDomainId = add.data.id;
    await audit(empresaId, siteId, created.id, "VERCEL_ADICIONADO", {
      host,
      alreadyExists: Boolean(add.alreadyExists),
      projectId: project.projectId,
      projectName: project.projectName,
    });
  }

  const { registros, vercelMeta } = await collectDnsFromVercel(
    client,
    pair.apex,
    tipo === "SUBDOMINIO_EMPRESA" ? null : pair.www,
    tipo
  );

  const evidence = mapVercelEvidenceToLocal({
    verified: Boolean(vercelMeta?.apex?.verified),
    configured: vercelMeta?.apex?.configured,
    sslReady: false,
    errorMessage: lastError,
  });

  const dns = buildDnsInstrucoesFromVercel({
    apex: pair.apex,
    www: tipo === "SUBDOMINIO_EMPRESA" ? null : pair.www,
    principalVariant: validated.principalVariant ?? "apex",
    registros,
    vercelMeta,
    nota: lastError
      ? `Erro ao adicionar na Vercel: ${lastError}`
      : "Instruções retornadas/confirmadas pela Vercel.",
  });

  await supabase
    .from("parceiro_site_dominios")
    .update({
      status: evidence.status,
      ssl_status: evidence.ssl_status,
      verificado: evidence.verificado,
      dns_instrucoes: dns,
      vercel_domain_id: vercelDomainId,
      vercel_project_id: project.projectId,
      ultima_mensagem_erro: lastError,
      ultima_verificacao_em: new Date().toISOString(),
    })
    .eq("id", created.id);

  if (registros.length) {
    await audit(empresaId, siteId, created.id, "DNS_ATUALIZADO", {
      count: registros.length,
    });
  }
  if (evidence.status === "ATIVO") {
    await audit(empresaId, siteId, created.id, "DOMINIO_ATIVADO", { valor: validated.valor });
  }

  revalidatePath(`/admin/parceiro-sites/${siteId}`);
}

export async function verificarDominioAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertSitesAdmin(empresaId);
  const siteId = String(formData.get("parceiro_site_id") ?? "");
  const dominioId = String(formData.get("dominio_id") ?? "");

  if (!isVercelDomainsIntegrationReady()) {
    throw new Error(vercelDomainsDisabledReason());
  }

  const { supabase, dominio } = await assertDominioOwnership({ empresaId, siteId, dominioId });
  if (dominio.status === "SUSPENSO" || dominio.status === "REMOVIDO") {
    throw new Error("Domínio suspenso/removido não pode ser verificado.");
  }

  const client = vercelClient();
  const instr = (dominio.dns_instrucoes ?? {}) as DnsInstrucoesE5;
  const www =
    dominio.tipo === "DOMINIO_PROPRIO" || dominio.tipo === "ALIAS"
      ? instr.www ?? `www.${dominio.valor}`
      : null;

  const { registros, vercelMeta } = await collectDnsFromVercel(
    client,
    dominio.valor,
    www,
    dominio.tipo
  );

  // SSL READY só com evidência: verified + configured (sem misconfigured) — MVP sem endpoint SSL dedicado.
  const sslReady = Boolean(
    vercelMeta?.apex?.verified && vercelMeta?.apex?.configured === true
  );

  const evidence = mapVercelEvidenceToLocal({
    verified: Boolean(vercelMeta?.apex?.verified),
    configured: vercelMeta?.apex?.configured,
    sslReady,
    errorMessage: null,
  });

  const dns = buildDnsInstrucoesFromVercel({
    apex: dominio.valor,
    www,
    principalVariant: parsePrincipalVariant(instr.principal_variant),
    registros,
    vercelMeta,
  });

  const { error } = await supabase
    .from("parceiro_site_dominios")
    .update({
      status: evidence.status,
      ssl_status: evidence.ssl_status,
      verificado: evidence.verificado,
      dns_instrucoes: dns,
      ultima_verificacao_em: new Date().toISOString(),
      ultima_mensagem_erro: null,
    })
    .eq("id", dominioId);
  if (error) throw new Error(error.message);

  await audit(empresaId, siteId, dominioId, "VERIFICACAO_EXECUTADA", {
    status: evidence.status,
    ssl: evidence.ssl_status,
    verificado: evidence.verificado,
  });
  if (evidence.status === "ATIVO") {
    await audit(empresaId, siteId, dominioId, "DOMINIO_ATIVADO", {});
  }
  if (registros.length) {
    await audit(empresaId, siteId, dominioId, "DNS_ATUALIZADO", { count: registros.length });
  }

  revalidatePath(`/admin/parceiro-sites/${siteId}`);
}

export async function reconciliarDominioAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertSitesAdmin(empresaId);
  const siteId = String(formData.get("parceiro_site_id") ?? "");
  const dominioId = String(formData.get("dominio_id") ?? "");

  if (!isVercelDomainsIntegrationReady()) {
    throw new Error(vercelDomainsDisabledReason());
  }

  const { supabase, dominio } = await assertDominioOwnership({ empresaId, siteId, dominioId });
  const client = vercelClient();
  const instr = (dominio.dns_instrucoes ?? {}) as DnsInstrucoesE5;
  const www =
    dominio.tipo === "DOMINIO_PROPRIO" || dominio.tipo === "ALIAS"
      ? instr.www ?? `www.${dominio.valor}`
      : null;

  const apexGet = await client.getDomain(dominio.valor);
  const wwwGet = www ? await client.getDomain(www) : null;

  const rec = reconcileLocalVsVercel({
    localValor: dominio.valor,
    tipo: dominio.tipo,
    vercelApexPresent: apexGet.ok ? apexGet.data != null : null,
    vercelWwwPresent: wwwGet ? (wwwGet.ok ? wwwGet.data != null : null) : null,
    vercelVerified: apexGet.ok && apexGet.data ? apexGet.data.verified : null,
    localVerificado: dominio.verificado,
  });

  const { registros, vercelMeta } = await collectDnsFromVercel(
    client,
    dominio.valor,
    www,
    dominio.tipo
  );

  const sslReady = Boolean(
    vercelMeta?.apex?.verified && vercelMeta?.apex?.configured === true
  );
  const evidence = mapVercelEvidenceToLocal({
    verified: Boolean(vercelMeta?.apex?.verified),
    configured: vercelMeta?.apex?.configured,
    sslReady,
  });

  const dns: DnsInstrucoesE5 = {
    ...buildDnsInstrucoesFromVercel({
      apex: dominio.valor,
      www,
      principalVariant: parsePrincipalVariant(instr.principal_variant),
      registros,
      vercelMeta,
    }),
    reconciliacao: {
      em: new Date().toISOString(),
      local_existe: true,
      vercel_apex: rec.vercel_apex,
      vercel_www: rec.vercel_www,
      divergencias: rec.divergencias,
    },
  };

  await supabase
    .from("parceiro_site_dominios")
    .update({
      status: evidence.status,
      ssl_status: evidence.ssl_status,
      verificado: evidence.verificado,
      dns_instrucoes: dns,
      ultima_verificacao_em: new Date().toISOString(),
    })
    .eq("id", dominioId);

  await audit(empresaId, siteId, dominioId, "DOMINIO_RECONCILIADO", {
    divergencias: rec.divergencias,
    vercel_apex: rec.vercel_apex,
    vercel_www: rec.vercel_www,
  });

  revalidatePath(`/admin/parceiro-sites/${siteId}`);
}

export async function suspenderDominioAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertSitesAdmin(empresaId);
  const siteId = String(formData.get("parceiro_site_id") ?? "");
  const dominioId = String(formData.get("dominio_id") ?? "");
  const { supabase, dominio } = await assertDominioOwnership({ empresaId, siteId, dominioId });

  const { error } = await supabase
    .from("parceiro_site_dominios")
    .update({ status: "SUSPENSO", principal: false })
    .eq("id", dominioId);
  if (error) throw new Error(error.message);

  await audit(empresaId, siteId, dominioId, "DOMINIO_SUSPENSO", {
    before: { status: dominio.status, principal: dominio.principal },
    vercel: false,
  });
  revalidatePath(`/admin/parceiro-sites/${siteId}`);
}

export async function setDominioPrincipalAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertSitesAdmin(empresaId);
  const siteId = String(formData.get("parceiro_site_id") ?? "");
  const dominioId = String(formData.get("dominio_id") ?? "");
  const { supabase, dominio } = await assertDominioOwnership({ empresaId, siteId, dominioId });
  if (dominio.status === "SUSPENSO" || dominio.status === "REMOVIDO") {
    throw new Error("Domínio suspenso/removido não pode ser principal.");
  }

  const variant = parsePrincipalVariant(String(formData.get("principal_variant") ?? ""));
  const instr = {
    ...((dominio.dns_instrucoes ?? {}) as DnsInstrucoesE5),
    principal_variant: variant || parsePrincipalVariant(
      ((dominio.dns_instrucoes ?? {}) as DnsInstrucoesE5).principal_variant
    ),
  };

  await supabase
    .from("parceiro_site_dominios")
    .update({ principal: false })
    .eq("parceiro_site_id", siteId)
    .eq("empresa_id", empresaId);

  const { error } = await supabase
    .from("parceiro_site_dominios")
    .update({ principal: true, dns_instrucoes: instr, canonical_redirect: true })
    .eq("id", dominioId)
    .eq("parceiro_site_id", siteId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);

  await audit(empresaId, siteId, dominioId, "PRINCIPAL_ALTERADO", {
    valor: dominio.valor,
    principal_variant: instr.principal_variant,
  });
  revalidatePath(`/admin/parceiro-sites/${siteId}`);
}

/** Remoção explícita: DELETE Vercel (se integração) + REMOVIDO local. */
export async function softRemoveDominioAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertSitesAdmin(empresaId);
  const siteId = String(formData.get("parceiro_site_id") ?? "");
  const dominioId = String(formData.get("dominio_id") ?? "");
  const { supabase, dominio, empresaHosts } = await assertDominioOwnership({
    empresaId,
    siteId,
    dominioId,
  });

  if (isHostBlockedByEmpresaDominios(dominio.valor, empresaHosts.map((h) => h.valor))) {
    throw new Error("Não é permitido remover host de empresa_dominios via fluxo de parceiro.");
  }

  if (dominio.principal) {
    const canalNeedsDomain = true; // UI deve escolher outro principal antes se necessário
    const { data: others } = await supabase
      .from("parceiro_site_dominios")
      .select("id")
      .eq("parceiro_site_id", siteId)
      .neq("id", dominioId)
      .neq("status", "REMOVIDO");
    if (canalNeedsDomain && (others ?? []).length > 0) {
      // Permite remoção do principal se houver outro — exige setar principal depois.
    }
  }

  let vercelError: string | null = null;
  if (isVercelDomainsIntegrationReady()) {
    const client = vercelClient();
    const instr = (dominio.dns_instrucoes ?? {}) as DnsInstrucoesE5;
    const hosts =
      dominio.tipo === "DOMINIO_PROPRIO" || dominio.tipo === "ALIAS"
        ? [dominio.valor, instr.www ?? `www.${dominio.valor}`]
        : [dominio.valor];

    for (const host of hosts) {
      const del = await client.removeDomain(host);
      if (!del.ok) {
        vercelError = del.error;
        await supabase
          .from("parceiro_site_dominios")
          .update({
            status: "ERRO",
            ultima_mensagem_erro: `Falha ao remover na Vercel: ${del.error}`,
          })
          .eq("id", dominioId);
        await audit(empresaId, siteId, dominioId, "DOMINIO_REMOVIDO", {
          ok: false,
          vercelError: del.error,
          host,
        });
        revalidatePath(`/admin/parceiro-sites/${siteId}`);
        throw new Error(`Remoção Vercel falhou: ${del.error}`);
      }
    }
  }

  const { error } = await supabase
    .from("parceiro_site_dominios")
    .update({
      status: "REMOVIDO",
      principal: false,
      ultima_mensagem_erro: vercelError,
    })
    .eq("id", dominioId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);

  await audit(empresaId, siteId, dominioId, "DOMINIO_REMOVIDO", {
    ok: true,
    soft: true,
    vercel: isVercelDomainsIntegrationReady(),
  });
  revalidatePath(`/admin/parceiro-sites/${siteId}`);
}

/** Usado em testes para garantir que action rejeita papel parceiro. */
export async function assertParceiroComercialBlockedAction(papelCodigo: string) {
  await assertNaoPodeEditarSiteComoParceiro(papelCodigo);
  if (papelBloqueadoParaEditorSite(papelCodigo)) {
    throw new Error("Papel sem permissão para editar sites de parceiros.");
  }
}
