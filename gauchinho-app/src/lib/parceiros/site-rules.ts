import { brandingMinimoOk, validateSiteBranding, type SiteBranding } from "./branding";
import {
  PARCEIRO_CANAIS,
  PARCEIRO_DOMINIO_TIPOS,
  PARCEIRO_SITE_STATUS,
  type ParceiroCanalPrincipal,
  type ParceiroDominioTipo,
  type ParceiroSiteStatus,
} from "./constants";
import { validateMenusForTemplate, type MenuLiberado } from "./menus";
import { normalizeSlug, validateParceiroHostForPersist } from "./normalize";
import {
  validateDominioUnico,
  validateSiteAtivoUnicoPorOrg,
  validateSlugUnicoPorEmpresa,
  type RuleResult,
} from "./rules";
import { isTemplateCodigo } from "./templates";

export function isSiteStatus(v: string): v is ParceiroSiteStatus {
  return (PARCEIRO_SITE_STATUS as readonly string[]).includes(v);
}

export function isCanalPrincipal(v: string): v is ParceiroCanalPrincipal {
  return (PARCEIRO_CANAIS as readonly string[]).includes(v);
}

export function isDominioTipo(v: string): v is ParceiroDominioTipo {
  return (PARCEIRO_DOMINIO_TIPOS as readonly string[]).includes(v);
}

/** Org deve estar ATIVA e do mesmo tenant para criar site. */
export function validateOrgElegivelParaSite(input: {
  organizacaoEmpresaId: string;
  tenantEmpresaId: string;
  organizacaoStatus: string;
}): RuleResult {
  if (input.organizacaoEmpresaId !== input.tenantEmpresaId) {
    return { ok: false, error: "Organização de outro tenant." };
  }
  if (input.organizacaoStatus !== "ATIVA") {
    return { ok: false, error: "Somente organização ATIVA pode receber site." };
  }
  return { ok: true };
}

export function validateSiteCreateInput(input: {
  empresaId: string;
  organizacaoId: string;
  organizacaoEmpresaId: string;
  organizacaoStatus: string;
  nomeSite: string;
  slug: string;
  templateCodigo: string;
  canalPrincipal: string;
  statusPublicacao: string;
  branding: SiteBranding;
  menus: Array<{ codigo: string; habilitado?: boolean }>;
  existingActiveSites: Array<{ id: string; organizacaoId: string }>;
  existingSlugs: Array<{ id: string; empresaId: string; slug: string }>;
  /** true = criação (exige org ATIVA); false = edição (ATIVA só se PUBLICADO) */
  exigirOrgAtiva?: boolean;
}): RuleResult & { menus?: MenuLiberado[]; slug?: string } {
  if (input.organizacaoEmpresaId !== input.empresaId) {
    return { ok: false, error: "Organização de outro tenant." };
  }
  const exigirAtiva = input.exigirOrgAtiva !== false;
  if (exigirAtiva || input.statusPublicacao === "PUBLICADO") {
    const orgOk = validateOrgElegivelParaSite({
      organizacaoEmpresaId: input.organizacaoEmpresaId,
      tenantEmpresaId: input.empresaId,
      organizacaoStatus: input.organizacaoStatus,
    });
    if (!orgOk.ok) return orgOk;
  }

  if (!input.nomeSite.trim()) return { ok: false, error: "Nome do site é obrigatório." };
  if (!isTemplateCodigo(input.templateCodigo)) return { ok: false, error: "Template inválido." };
  if (!isCanalPrincipal(input.canalPrincipal)) return { ok: false, error: "Canal principal inválido." };
  if (!isSiteStatus(input.statusPublicacao)) return { ok: false, error: "Status inválido." };

  const slug = normalizeSlug(input.slug);
  if (!slug) return { ok: false, error: "Slug inválido." };

  const uniqueSite = validateSiteAtivoUnicoPorOrg({
    organizacaoId: input.organizacaoId,
    ativo: true,
    statusPublicacao: input.statusPublicacao,
    existingActiveSites: input.existingActiveSites,
  });
  if (!uniqueSite.ok) return uniqueSite;

  const slugOk = validateSlugUnicoPorEmpresa({
    empresaId: input.empresaId,
    slug,
    existing: input.existingSlugs,
  });
  if (!slugOk.ok) return slugOk;

  const brandingOk = validateSiteBranding(input.branding);
  if (!brandingOk.ok) return brandingOk;

  const menusOk = validateMenusForTemplate(input.templateCodigo, input.menus);
  if (!menusOk.ok) return menusOk;

  // PUBLICADO nesta rodada NÃO ativa rota pública (flag E8). Apenas status administrativo.
  if (input.statusPublicacao === "PUBLICADO") {
    if (!brandingMinimoOk(input.branding, input.nomeSite)) {
      return { ok: false, error: "Branding mínimo incompleto para PUBLICADO." };
    }
    if (!menusOk.menus.some((m) => m.habilitado)) {
      return { ok: false, error: "Habilite ao menos um menu para PUBLICADO." };
    }
  }

  return { ok: true, menus: menusOk.menus, slug };
}

/**
 * Cadastro local de domínio — SEMPRE nasce PENDENTE_DNS / SSL PENDING.
 * Não chama Vercel; não verifica DNS; não marca ATIVO.
 */
export function validateDominioLocalCreate(input: {
  valorRaw: string;
  tipo: string;
  principal: boolean;
  existingParceiroHosts: string[];
  existingEmpresaHosts: string[];
  hasPrimaryAlready: boolean;
}): RuleResult & { valor?: string; status?: "PENDENTE_DNS"; sslStatus?: "PENDING" } {
  if (!isDominioTipo(input.tipo)) return { ok: false, error: "Tipo de domínio inválido." };

  const host = validateParceiroHostForPersist(input.valorRaw);
  if (!host.ok) return host;

  const uniq = validateDominioUnico({
    valor: host.valor,
    existingParceiroHosts: input.existingParceiroHosts,
    existingEmpresaHosts: input.existingEmpresaHosts,
  });
  if (!uniq.ok) return uniq;

  if (input.principal && input.hasPrimaryAlready) {
    return { ok: false, error: "Já existe domínio principal neste site." };
  }

  return {
    ok: true,
    valor: host.valor,
    status: "PENDENTE_DNS",
    sslStatus: "PENDING",
  };
}

/** Guard: papéis que nunca editam site. */
export function papelBloqueadoParaEditorSite(papelCodigo: string | null | undefined): boolean {
  return (
    papelCodigo === "parceiro_comercial" ||
    papelCodigo === "parceiro_imobiliaria" ||
    papelCodigo === "consultor"
  );
}

/** Garantia de que nenhum código E4 dispara integração Vercel. */
export const VERCEL_INTEGRATION_ENABLED_IN_E4 = false as const;
