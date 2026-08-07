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
import { MENU_CODIGOS, parseMenusFromForm } from "@/lib/parceiros/menus";
import {
  fase3SitesAdminDisabledMessage,
  isFase3ParceiroSitesAdminReady,
} from "@/lib/parceiros/schema-ready";
import {
  papelBloqueadoParaEditorSite,
  validateDominioLocalCreate,
  validateSiteCreateInput,
  VERCEL_INTEGRATION_ENABLED_IN_E4,
} from "@/lib/parceiros/site-rules";
import type { ParceiroSite, ParceiroSiteDominio, ParceiroSiteListRow } from "@/lib/parceiros/types";
import { TEMPLATE_CODIGOS } from "@/lib/parceiros/templates";
import { PARCEIRO_CANAIS, PARCEIRO_SITE_STATUS } from "@/lib/parceiros/constants";

async function resolveEmpresaIdPadrao(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("id")
    .eq("slug", "gauchinho")
    .single();
  if (error || !data) throw new Error("Empresa Gauchinho não encontrada.");
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
  if (VERCEL_INTEGRATION_ENABLED_IN_E4) {
    throw new Error("Integração Vercel não autorizada na E4.");
  }
}

async function audit(
  empresaId: string,
  siteId: string | null,
  dominioId: string | null,
  acao: string,
  payload: Record<string, unknown>
) {
  const supabase = await createClient();
  await supabase.from("parceiro_site_auditoria").insert({
    empresa_id: empresaId,
    parceiro_site_id: siteId,
    dominio_id: dominioId,
    acao,
    payload,
  });
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

  return {
    empresaId,
    site: site as ParceiroSite,
    organizacao: org,
    dominios: (dominios ?? []) as ParceiroSiteDominio[],
    templates: TEMPLATE_CODIGOS,
    menusCatalogo: MENU_CODIGOS,
    statusOptions: PARCEIRO_SITE_STATUS,
    canais: PARCEIRO_CANAIS,
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
  });
  if (!validated.ok) throw new Error(validated.error);

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

  const [{ data: existingSites }, { data: allSlugs }] = await Promise.all([
    supabase
      .from("parceiro_sites")
      .select("id, organizacao_parceira_id")
      .eq("organizacao_parceira_id", current.organizacao_parceira_id)
      .eq("ativo", true)
      .neq("status_publicacao", "ARQUIVADO"),
    supabase.from("parceiro_sites").select("id, empresa_id, slug").eq("empresa_id", empresaId),
  ]);

  const menus = parseMenusFromForm(formData.getAll("menus"));
  const branding = { ...emptyBranding(), ...brandingFromForm(formData) };
  const validated = validateSiteCreateInput({
    empresaId,
    organizacaoId: current.organizacao_parceira_id,
    organizacaoEmpresaId: org?.empresa_id ?? "",
    organizacaoStatus: org?.status ?? "",
    nomeSite: String(formData.get("nome_site") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    templateCodigo: String(formData.get("template_codigo") ?? current.template_codigo),
    canalPrincipal: String(formData.get("canal_principal") ?? current.canal_principal),
    statusPublicacao: String(formData.get("status_publicacao") ?? current.status_publicacao),
    branding,
    menus,
    existingActiveSites: (existingSites ?? [])
      .filter((s) => s.id !== id)
      .map((s) => ({ id: s.id, organizacaoId: s.organizacao_parceira_id })),
    existingSlugs: (allSlugs ?? [])
      .filter((s) => s.id !== id)
      .map((s) => ({ id: s.id, empresaId: s.empresa_id, slug: s.slug })),
    exigirOrgAtiva: false,
  });
  if (!validated.ok) throw new Error(validated.error);

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
      status_publicacao: String(formData.get("status_publicacao") ?? current.status_publicacao),
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
      ativo: formData.get("ativo") === "on",
    })
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);

  const afterStatus = String(formData.get("status_publicacao") ?? current.status_publicacao);
  const acao =
    afterStatus !== current.status_publicacao
      ? afterStatus === "PUBLICADO"
        ? "PUBLICAR"
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

/** Cadastro local apenas — sem Vercel/DNS/SSL real. */
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

  const [{ data: parceiroHosts }, { data: empresaHosts }, { data: primaries }] = await Promise.all([
    supabase.from("parceiro_site_dominios").select("valor").neq("status", "REMOVIDO"),
    supabase.from("empresa_dominios").select("valor").eq("ativo", true),
    supabase
      .from("parceiro_site_dominios")
      .select("id")
      .eq("parceiro_site_id", siteId)
      .eq("principal", true)
      .neq("status", "REMOVIDO"),
  ]);

  const principal = formData.get("principal") === "on";
  const validated = validateDominioLocalCreate({
    valorRaw: String(formData.get("valor") ?? ""),
    tipo: String(formData.get("tipo") ?? "DOMINIO_PROPRIO"),
    principal,
    existingParceiroHosts: (parceiroHosts ?? []).map((h) => h.valor),
    existingEmpresaHosts: (empresaHosts ?? []).map((h) => h.valor),
    hasPrimaryAlready: (primaries ?? []).length > 0,
  });
  if (!validated.ok) throw new Error(validated.error);

  const { data: created, error } = await supabase
    .from("parceiro_site_dominios")
    .insert({
      empresa_id: empresaId,
      parceiro_site_id: siteId,
      valor: validated.valor,
      tipo: String(formData.get("tipo") ?? "DOMINIO_PROPRIO"),
      principal,
      verificado: false,
      status: "PENDENTE_DNS",
      ssl_status: "PENDING",
      dns_instrucoes: {
        nota: "Cadastro local apenas. Verificação Vercel/DNS não habilitada nesta rodada (E4).",
        registros_sugeridos: [
          { tipo: "CNAME", host: "www", valor: "cname.vercel-dns.com" },
          { tipo: "A", host: "@", valor: "(aguardar instrução Vercel — não integrar na E4)" },
        ],
      },
      canonical_redirect: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await audit(empresaId, siteId, created.id, "CRIAR_DOMINIO", {
    valor: validated.valor,
    status: "PENDENTE_DNS",
    ssl: "PENDING",
    vercel: false,
  });

  revalidatePath(`/admin/parceiro-sites/${siteId}`);
}

export async function setDominioPrincipalAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertSitesAdmin(empresaId);
  const siteId = String(formData.get("parceiro_site_id") ?? "");
  const dominioId = String(formData.get("dominio_id") ?? "");
  const supabase = await createClient();

  await supabase
    .from("parceiro_site_dominios")
    .update({ principal: false })
    .eq("parceiro_site_id", siteId)
    .eq("empresa_id", empresaId);

  const { error } = await supabase
    .from("parceiro_site_dominios")
    .update({ principal: true })
    .eq("id", dominioId)
    .eq("parceiro_site_id", siteId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);

  await audit(empresaId, siteId, dominioId, "SET_PRINCIPAL", {});
  revalidatePath(`/admin/parceiro-sites/${siteId}`);
}

export async function softRemoveDominioAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertSitesAdmin(empresaId);
  const siteId = String(formData.get("parceiro_site_id") ?? "");
  const dominioId = String(formData.get("dominio_id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("parceiro_site_dominios")
    .update({ status: "REMOVIDO", principal: false })
    .eq("id", dominioId)
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);
  await audit(empresaId, siteId, dominioId, "REMOVER_DOMINIO", { soft: true, vercel: false });
  revalidatePath(`/admin/parceiro-sites/${siteId}`);
}

/** Usado em testes para garantir que action rejeita papel parceiro. */
export async function assertParceiroComercialBlockedAction(papelCodigo: string) {
  await assertNaoPodeEditarSiteComoParceiro(papelCodigo);
  if (papelBloqueadoParaEditorSite(papelCodigo)) {
    throw new Error("Papel sem permissão para editar sites de parceiros.");
  }
}
