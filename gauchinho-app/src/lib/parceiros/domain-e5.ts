import { brandingMinimoOk, type SiteBranding } from "./branding";
import {
  PARCEIRO_DOMINIO_TIPOS,
  PARCEIRO_SUBDOMAIN_BASE,
  PARCEIRO_SUBDOMAIN_LABELS_RESERVADOS,
  type ParceiroCanalPrincipal,
  type ParceiroDominioTipo,
} from "./constants";
import { normalizeHost, normalizeParceiroHost, validateParceiroHostForPersist } from "./normalize";
import { validateDominioUnico, type RuleResult } from "./rules";
import type { MenuLiberado } from "./menus";

function isDominioTipo(v: string): v is ParceiroDominioTipo {
  return (PARCEIRO_DOMINIO_TIPOS as readonly string[]).includes(v);
}

export type PrincipalVariant = "apex" | "www";

export type DnsRegistro = {
  tipo: string;
  host: string;
  valor: string;
  origem?: "vercel" | "local";
};

export type DnsInstrucoesE5 = {
  nota?: string;
  apex?: string;
  www?: string;
  principal_variant?: PrincipalVariant;
  registros?: DnsRegistro[];
  vercel?: {
    apex?: { name?: string; verified?: boolean; configured?: boolean };
    www?: { name?: string; verified?: boolean; configured?: boolean };
  };
  reconciliacao?: {
    em?: string;
    local_existe?: boolean;
    vercel_apex?: "presente" | "ausente" | "desconhecido";
    vercel_www?: "presente" | "ausente" | "desconhecido" | "nao_aplicavel";
    divergencias?: string[];
  };
};

/** Deny-list absoluta: qualquer host de empresa_dominios. */
export function isHostBlockedByEmpresaDominios(
  host: string,
  empresaHosts: string[]
): boolean {
  const h = normalizeHost(host);
  const set = new Set(empresaHosts.map((x) => normalizeHost(x)).filter(Boolean));
  if (set.has(h)) return true;
  if (h.startsWith("www.") && set.has(h.slice(4))) return true;
  if (set.has(`www.${h}`)) return true;
  return false;
}

export function parsePrincipalVariant(raw: string | null | undefined): PrincipalVariant {
  return raw === "www" ? "www" : "apex";
}

export function apexAndWww(apex: string): { apex: string; www: string } {
  const a = normalizeParceiroHost(apex);
  return { apex: a, www: a.startsWith("www.") ? a : `www.${a}` };
}

export function validateSubdominioEmpresa(input: {
  slugOrHost: string;
  baseDomain?: string;
  baseEmpresaHostsAtivos: string[];
  reservedLabels?: readonly string[];
}): RuleResult & { valor?: string; label?: string } {
  const base = normalizeHost(input.baseDomain ?? PARCEIRO_SUBDOMAIN_BASE);
  if (!base) return { ok: false, error: "Base de subdomínio inválida." };

  const baseOk = input.baseEmpresaHostsAtivos
    .map((h) => normalizeHost(h))
    .some((h) => h === base || h === `www.${base}`);
  if (!baseOk) {
    return {
      ok: false,
      error: `Base ${base} não está ativa/verificada em empresa_dominios do tenant.`,
    };
  }

  let label = input.slugOrHost.trim().toLowerCase();
  const fullTry = normalizeHost(label);
  if (fullTry.endsWith(`.${base}`)) {
    label = fullTry.slice(0, -(base.length + 1));
  } else if (label.includes(".")) {
    return { ok: false, error: "Informe apenas o label do subdomínio ou o FQDN completo na base." };
  }

  label = label.replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
  if (!label || label.length > 63) {
    return { ok: false, error: "Label de subdomínio inválido." };
  }

  const reserved = input.reservedLabels ?? PARCEIRO_SUBDOMAIN_LABELS_RESERVADOS;
  if ((reserved as readonly string[]).includes(label)) {
    return { ok: false, error: `Label reservado: ${label}.` };
  }

  const valor = `${label}.${base}`;
  const hostOk = validateParceiroHostForPersist(valor);
  if (!hostOk.ok) return hostOk;
  return { ok: true, valor: hostOk.valor, label };
}

/**
 * Cadastro E5 de domínio (local + preparação apex/www).
 * www nunca é persistido em valor (constraint schema); preferência em dns_instrucoes.
 */
export function validateDominioE5Create(input: {
  valorRaw: string;
  tipo: string;
  principal: boolean;
  principalVariant?: PrincipalVariant;
  existingParceiroHosts: string[];
  existingEmpresaHosts: string[];
  hasPrimaryAlready: boolean;
  /** hosts ativos/verificados do tenant (para SUBDOMINIO_EMPRESA) */
  baseEmpresaHostsAtivos?: string[];
}): RuleResult & {
  valor?: string;
  status?: "PENDENTE_DNS";
  sslStatus?: "PENDING";
  principalVariant?: PrincipalVariant;
  pair?: { apex: string; www: string };
} {
  if (!isDominioTipo(input.tipo)) return { ok: false, error: "Tipo de domínio inválido." };

  let valor: string;
  let principalVariant: PrincipalVariant = input.principalVariant ?? "apex";

  if (input.tipo === "SUBDOMINIO_EMPRESA") {
    const sub = validateSubdominioEmpresa({
      slugOrHost: input.valorRaw,
      baseEmpresaHostsAtivos: input.baseEmpresaHostsAtivos ?? [],
    });
    if (!sub.ok || !sub.valor) return sub;
    valor = sub.valor;
    principalVariant = "apex";
  } else {
    const raw = input.valorRaw.trim().toLowerCase();
    const wantsWww = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").startsWith("www.");
    if (wantsWww) principalVariant = "www";
    const host = validateParceiroHostForPersist(input.valorRaw);
    if (!host.ok) return host;
    valor = host.valor;
  }

  if (isHostBlockedByEmpresaDominios(valor, input.existingEmpresaHosts)) {
    return { ok: false, error: "Domínio bloqueado: pertence a empresa_dominios (tenant)." };
  }

  const uniq = validateDominioUnico({
    valor,
    existingParceiroHosts: input.existingParceiroHosts,
    existingEmpresaHosts: input.existingEmpresaHosts,
  });
  if (!uniq.ok) return uniq;

  if (input.principal && input.hasPrimaryAlready) {
    return { ok: false, error: "Já existe domínio principal neste site." };
  }

  const pair =
    input.tipo === "DOMINIO_PROPRIO" || input.tipo === "ALIAS"
      ? apexAndWww(valor)
      : { apex: valor, www: valor };

  return {
    ok: true,
    valor,
    status: "PENDENTE_DNS",
    sslStatus: "PENDING",
    principalVariant,
    pair,
  };
}

export type PublicationGateInput = {
  organizacaoStatus: string;
  siteAtivo: boolean;
  nomeSite: string;
  branding: SiteBranding;
  menus: MenuLiberado[] | Array<{ codigo: string; habilitado?: boolean }>;
  canalPrincipal: ParceiroCanalPrincipal | string;
  dominioPrincipal: {
    valor: string;
    verificado: boolean;
    status: string;
    ssl_status: string;
  } | null;
  empresaAutorizaPublicacao?: boolean;
};

export function evaluatePublicationGates(
  input: PublicationGateInput
): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];

  if (input.organizacaoStatus !== "ATIVA") {
    reasons.push("Organização deve estar ATIVA.");
  }
  if (!input.siteAtivo) {
    reasons.push("Site deve estar ativo.");
  }
  if (!brandingMinimoOk(input.branding, input.nomeSite)) {
    reasons.push("Branding mínimo incompleto.");
  }
  const menusOn = (input.menus ?? []).filter((m) => m.habilitado !== false);
  if (menusOn.length === 0) {
    reasons.push("Habilite ao menos um menu válido.");
  }
  if (input.empresaAutorizaPublicacao === false) {
    reasons.push("Empresa tenant não autoriza publicação.");
  }

  const canal = input.canalPrincipal;
  if (canal === "DOMINIO" || canal === "SUBDOMINIO") {
    const d = input.dominioPrincipal;
    if (!d) {
      reasons.push("Domínio principal inexistente.");
    } else {
      if (!d.verificado) reasons.push("Domínio principal não verificado.");
      if (d.status !== "ATIVO") reasons.push(`Status do domínio deve ser ATIVO (atual: ${d.status}).`);
      if (d.ssl_status !== "READY") reasons.push(`SSL deve estar READY (atual: ${d.ssl_status}).`);
      if (d.status === "SUSPENSO") reasons.push("Domínio principal está SUSPENSO.");
    }
  }

  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}

/** Mapeia evidência Vercel → status/ssl locais. Nunca marca ATIVO sem verified. */
export function mapVercelEvidenceToLocal(evidence: {
  verified: boolean;
  configured?: boolean;
  sslReady?: boolean;
  errorMessage?: string | null;
}): {
  status: "PENDENTE_DNS" | "VERIFICANDO" | "ATIVO" | "ERRO";
  ssl_status: "PENDING" | "READY" | "ERROR";
  verificado: boolean;
} {
  if (evidence.errorMessage) {
    return { status: "ERRO", ssl_status: "ERROR", verificado: false };
  }
  if (evidence.verified && evidence.sslReady) {
    return { status: "ATIVO", ssl_status: "READY", verificado: true };
  }
  if (evidence.verified) {
    return { status: "VERIFICANDO", ssl_status: "PENDING", verificado: true };
  }
  if (evidence.configured) {
    return { status: "VERIFICANDO", ssl_status: "PENDING", verificado: false };
  }
  return { status: "PENDENTE_DNS", ssl_status: "PENDING", verificado: false };
}

export function buildDnsInstrucoesFromVercel(input: {
  apex: string;
  www?: string | null;
  principalVariant: PrincipalVariant;
  registros: DnsRegistro[];
  vercelMeta?: DnsInstrucoesE5["vercel"];
  nota?: string;
}): DnsInstrucoesE5 {
  return {
    nota: input.nota ?? "Instruções retornadas/confirmadas pela Vercel. Não inventar DNS.",
    apex: input.apex,
    www: input.www ?? undefined,
    principal_variant: input.principalVariant,
    registros: input.registros,
    vercel: input.vercelMeta,
  };
}

export function reconcileLocalVsVercel(input: {
  localValor: string;
  tipo: string;
  vercelApexPresent: boolean | null;
  vercelWwwPresent: boolean | null;
  vercelVerified?: boolean | null;
  localVerificado: boolean;
}): {
  divergencias: string[];
  vercel_apex: "presente" | "ausente" | "desconhecido";
  vercel_www: "presente" | "ausente" | "desconhecido" | "nao_aplicavel";
} {
  const divergencias: string[] = [];
  const vercel_apex =
    input.vercelApexPresent === null
      ? ("desconhecido" as const)
      : input.vercelApexPresent
        ? ("presente" as const)
        : ("ausente" as const);

  const needsWww = input.tipo === "DOMINIO_PROPRIO" || input.tipo === "ALIAS";
  const vercel_www = !needsWww
    ? ("nao_aplicavel" as const)
    : input.vercelWwwPresent === null
      ? ("desconhecido" as const)
      : input.vercelWwwPresent
        ? ("presente" as const)
        : ("ausente" as const);

  if (input.vercelApexPresent === false) {
    divergencias.push("Registro local existe; apex ausente na Vercel.");
  }
  if (needsWww && input.vercelWwwPresent === false) {
    divergencias.push("www ausente na Vercel para domínio próprio.");
  }
  if (
    input.vercelVerified != null &&
    input.vercelVerified !== input.localVerificado
  ) {
    divergencias.push("Flag verificado divergente entre local e Vercel.");
  }

  return { divergencias, vercel_apex, vercel_www };
}
