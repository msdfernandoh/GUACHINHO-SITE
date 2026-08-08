import { normalizeCnpj } from "@/lib/parceiros/normalize";
import { validarCnpj } from "@/lib/contratacoes-online/validacao";
import {
  ADMINISTRADORA_JSON_FORBIDDEN_KEY_RE,
  ADMINISTRADORA_STATUS,
  EMPRESA_ADMINISTRADORA_STATUS,
  FASE4_PERMISSOES,
} from "./constants";
import type {
  Administradora,
  AdministradoraAutorizada,
  AdministradoraStatus,
  EmpresaAdministradora,
  EmpresaAdministradoraStatus,
} from "./types";

export type AdministradoraWriteInput = {
  nome: string;
  nome_fantasia?: string | null;
  razao_social?: string | null;
  cnpj?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  site_url?: string | null;
  status?: string | null;
  recursos_integracao?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type AdministradoraValidatedWrite = {
  nome: string;
  nome_fantasia: string | null;
  razao_social: string | null;
  cnpj: string | null;
  slug: string;
  logo_url: string | null;
  site_url: string | null;
  status: AdministradoraStatus;
  recursos_integracao: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

/** Ambos ATIVA: único estado que autoriza operação nova. */
export function concessaoPermiteUso(
  administradoraStatus: AdministradoraStatus | string | null | undefined,
  vinculoStatus: EmpresaAdministradoraStatus | string | null | undefined,
): boolean {
  return (
    administradoraStatus === ADMINISTRADORA_STATUS.ATIVA &&
    vinculoStatus === EMPRESA_ADMINISTRADORA_STATUS.ATIVA
  );
}

export function normalizeAdministradoraSlug(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const normalized = valor
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : null;
}

export function toAdministradoraAutorizada(
  admin: Pick<
    Administradora,
    "id" | "nome" | "nome_fantasia" | "slug" | "logo_url" | "site_url" | "status"
  >,
  concessao: Pick<EmpresaAdministradora, "id" | "empresa_id" | "status">,
): AdministradoraAutorizada {
  return {
    id: admin.id,
    nome: admin.nome,
    nome_fantasia: admin.nome_fantasia,
    slug: admin.slug,
    logo_url: admin.logo_url,
    site_url: admin.site_url,
    status: admin.status,
    concessao: {
      id: concessao.id,
      empresa_id: concessao.empresa_id,
      status: concessao.status,
    },
  };
}

/**
 * Filtra concessões para uma empresa: só ATIVA+ATIVA.
 * Ignora vínculos de outras empresas (defesa em profundidade).
 */
export function filterAdministradorasAutorizadasForEmpresa(
  empresaId: string,
  rows: Array<{
    administradora: Pick<
      Administradora,
      "id" | "nome" | "nome_fantasia" | "slug" | "logo_url" | "site_url" | "status"
    > | null;
    concessao: Pick<EmpresaAdministradora, "id" | "empresa_id" | "status" | "administradora_id">;
  }>,
): AdministradoraAutorizada[] {
  const out: AdministradoraAutorizada[] = [];
  for (const row of rows) {
    if (!row.administradora) continue;
    if (row.concessao.empresa_id !== empresaId) continue;
    if (!concessaoPermiteUso(row.administradora.status, row.concessao.status)) continue;
    out.push(toAdministradoraAutorizada(row.administradora, row.concessao));
  }
  return out;
}

export function resolveAutorizadaById(
  empresaId: string,
  administradoraId: string,
  rows: Array<{
    administradora: Pick<
      Administradora,
      "id" | "nome" | "nome_fantasia" | "slug" | "logo_url" | "site_url" | "status"
    > | null;
    concessao: Pick<EmpresaAdministradora, "id" | "empresa_id" | "status" | "administradora_id">;
  }>,
): AdministradoraAutorizada | null {
  const match = rows.find(
    (r) =>
      r.administradora?.id === administradoraId &&
      r.concessao.empresa_id === empresaId &&
      r.concessao.administradora_id === administradoraId,
  );
  if (!match?.administradora) return null;
  if (!concessaoPermiteUso(match.administradora.status, match.concessao.status)) return null;
  return toAdministradoraAutorizada(match.administradora, match.concessao);
}

export function resolveAutorizadaBySlug(
  empresaId: string,
  slug: string,
  rows: Array<{
    administradora: Pick<
      Administradora,
      "id" | "nome" | "nome_fantasia" | "slug" | "logo_url" | "site_url" | "status"
    > | null;
    concessao: Pick<EmpresaAdministradora, "id" | "empresa_id" | "status" | "administradora_id">;
  }>,
): AdministradoraAutorizada | null {
  const normalized = normalizeAdministradoraSlug(slug);
  if (!normalized) return null;
  const match = rows.find(
    (r) =>
      r.concessao.empresa_id === empresaId &&
      r.administradora != null &&
      normalizeAdministradoraSlug(r.administradora.slug) === normalized,
  );
  if (!match?.administradora) return null;
  if (!concessaoPermiteUso(match.administradora.status, match.concessao.status)) return null;
  return toAdministradoraAutorizada(match.administradora, match.concessao);
}

/** Matriz estática: só super_admin recebe permissões Fase 4 (espelha seed 047). */
export function papelTemPermissaoFase4(
  papelCodigo: string,
  permissao: string,
): boolean {
  if (papelCodigo !== "super_admin") return false;
  return (
    permissao === FASE4_PERMISSOES.gerenciarCatalogoAdministradoras ||
    permissao === FASE4_PERMISSOES.gerenciarAdministradorasEmpresa
  );
}

export function papelPodeListarCatalogoGlobal(papelCodigo: string): boolean {
  return papelCodigo === "super_admin";
}

function trimOrNull(value: string | null | undefined): string | null {
  const t = (value ?? "").trim();
  return t.length ? t : null;
}

function assertJsonSemSegredos(
  obj: Record<string, unknown>,
  label: string,
): { ok: true } | { ok: false; error: string } {
  for (const key of Object.keys(obj)) {
    if (ADMINISTRADORA_JSON_FORBIDDEN_KEY_RE.test(key)) {
      return {
        ok: false,
        error: `${label}: chave "${key}" não permitida. Credenciais não ficam no catálogo global.`,
      };
    }
  }
  return { ok: true };
}

/** Validação de escrita do catálogo GLOBAL (E3). */
export function validateAdministradoraWriteInput(
  input: AdministradoraWriteInput,
  options?: { requireSlugFromNomeFallback?: boolean },
): { ok: true; value: AdministradoraValidatedWrite } | { ok: false; error: string } {
  const nome = (input.nome ?? "").trim();
  if (!nome) return { ok: false, error: "Nome é obrigatório." };

  const slugSource = (input.slug ?? "").trim() || (options?.requireSlugFromNomeFallback === false ? "" : nome);
  const slug = normalizeAdministradoraSlug(slugSource);
  if (!slug) return { ok: false, error: "Slug inválido ou vazio." };

  const cnpjRaw = trimOrNull(input.cnpj);
  let cnpj: string | null = null;
  if (cnpjRaw) {
    cnpj = normalizeCnpj(cnpjRaw);
    if (!cnpj || !validarCnpj(cnpj)) {
      return { ok: false, error: "CNPJ inválido." };
    }
  }

  const statusRaw = (input.status ?? ADMINISTRADORA_STATUS.ATIVA).toString().trim().toUpperCase();
  if (statusRaw !== ADMINISTRADORA_STATUS.ATIVA && statusRaw !== ADMINISTRADORA_STATUS.INATIVA) {
    return { ok: false, error: "Status inválido. Use ATIVA ou INATIVA." };
  }

  const recursos = input.recursos_integracao ?? {};
  const metadata = input.metadata ?? {};
  if (typeof recursos !== "object" || Array.isArray(recursos) || recursos === null) {
    return { ok: false, error: "recursos_integracao inválido." };
  }
  if (typeof metadata !== "object" || Array.isArray(metadata) || metadata === null) {
    return { ok: false, error: "metadata inválido." };
  }
  const secR = assertJsonSemSegredos(recursos, "recursos_integracao");
  if (!secR.ok) return secR;
  const secM = assertJsonSemSegredos(metadata, "metadata");
  if (!secM.ok) return secM;

  return {
    ok: true,
    value: {
      nome,
      nome_fantasia: trimOrNull(input.nome_fantasia),
      razao_social: trimOrNull(input.razao_social),
      cnpj,
      slug,
      logo_url: trimOrNull(input.logo_url),
      site_url: trimOrNull(input.site_url),
      status: statusRaw as AdministradoraStatus,
      recursos_integracao: recursos,
      metadata,
    },
  };
}

export function mapAdministradoraDbUniqueError(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("administradoras_slug") || (m.includes("slug") && m.includes("unique"))) {
    return "Já existe uma administradora com este slug.";
  }
  if (m.includes("administradoras_cnpj") || (m.includes("cnpj") && m.includes("unique"))) {
    return "Já existe uma administradora com este CNPJ.";
  }
  if (m.includes("duplicate key") || m.includes("unique")) {
    return "Registro duplicado (slug ou CNPJ).";
  }
  return null;
}

export function diffAdministradoraFields(
  before: Partial<AdministradoraValidatedWrite & { status: string }>,
  after: Partial<AdministradoraValidatedWrite & { status: string }>,
): { campos: string[]; antes: Record<string, unknown>; depois: Record<string, unknown> } {
  const keys = [
    "nome",
    "nome_fantasia",
    "razao_social",
    "cnpj",
    "slug",
    "logo_url",
    "site_url",
    "status",
    "recursos_integracao",
    "metadata",
  ] as const;
  const campos: string[] = [];
  const antes: Record<string, unknown> = {};
  const depois: Record<string, unknown> = {};
  for (const k of keys) {
    const b = before[k] ?? null;
    const a = after[k] ?? null;
    const same = JSON.stringify(b) === JSON.stringify(a);
    if (!same) {
      campos.push(k);
      antes[k] = b;
      depois[k] = a;
    }
  }
  return { campos, antes, depois };
}
