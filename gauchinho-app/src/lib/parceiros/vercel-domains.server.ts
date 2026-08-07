import "server-only";

import {
  FASE3_VERCEL_DOMAINS_ENABLED,
  VERCEL_PARCEIRO_PROJECT_ID_DEFAULT,
  VERCEL_PARCEIRO_PROJECT_NAME,
} from "./constants";
import type { DnsRegistro } from "./domain-e5";

export type VercelDomainInfo = {
  name: string;
  verified: boolean;
  configuredBy?: string | null;
  /** present when API returns it */
  verification?: Array<{ type?: string; domain?: string; value?: string; reason?: string }>;
  /** opaque id when available */
  id?: string | null;
};

export type VercelDomainConfig = {
  name: string;
  configuredBy?: string | null;
  acceptedChallenges?: string[];
  recommendedCNAME?: Array<{ rank: number; value: string }>;
  recommendedIPv4?: Array<{ rank: number; value: string }>;
  misconfigured?: boolean;
};

export type VercelApiResult<T> =
  | { ok: true; data: T; alreadyExists?: boolean }
  | { ok: false; error: string; code?: string; status?: number };

export type VercelDomainsClient = {
  addDomain: (name: string) => Promise<VercelApiResult<VercelDomainInfo>>;
  getDomain: (name: string) => Promise<VercelApiResult<VercelDomainInfo | null>>;
  getDomainConfig: (name: string) => Promise<VercelApiResult<VercelDomainConfig>>;
  removeDomain: (name: string) => Promise<VercelApiResult<{ removed: boolean }>>;
};

type FetchLike = typeof fetch;

function readToken(): string | null {
  const t =
    process.env.VERCEL_API_TOKEN?.trim() ||
    process.env.VERCEL_TOKEN?.trim() ||
    "";
  return t || null;
}

function readProjectId(): string {
  return (
    process.env.VERCEL_PROJECT_ID?.trim() ||
    VERCEL_PARCEIRO_PROJECT_ID_DEFAULT
  );
}

function readTeamId(): string | null {
  return process.env.VERCEL_TEAM_ID?.trim() || null;
}

/** Integração pronta: flag + token + projeto. Nunca expõe token. */
export function isVercelDomainsIntegrationReady(): boolean {
  if (!FASE3_VERCEL_DOMAINS_ENABLED) return false;
  if (!readToken()) return false;
  if (!readProjectId()) return false;
  return true;
}

export function vercelDomainsDisabledReason(): string {
  if (!FASE3_VERCEL_DOMAINS_ENABLED) {
    return "Integração Vercel desabilitada (FASE3_VERCEL_DOMAINS_ENABLED≠true). Nenhum request será feito.";
  }
  if (!readToken()) {
    return "Credencial Vercel ausente no servidor (VERCEL_API_TOKEN / VERCEL_TOKEN).";
  }
  if (!readProjectId()) {
    return "Projeto Vercel não configurado (VERCEL_PROJECT_ID).";
  }
  return "Integração Vercel indisponível.";
}

export function getConfiguredVercelProject(): {
  projectId: string;
  projectName: string;
  teamId: string | null;
} {
  return {
    projectId: readProjectId(),
    projectName: VERCEL_PARCEIRO_PROJECT_NAME,
    teamId: readTeamId(),
  };
}

function sanitizeErrorMessage(raw: unknown, status?: number): { error: string; code?: string } {
  if (raw && typeof raw === "object") {
    const o = raw as { error?: { code?: string; message?: string }; code?: string; message?: string };
    const code = o.error?.code ?? o.code;
    const message = o.error?.message ?? o.message;
    if (code === "domain_already_in_use") {
      return {
        code,
        error:
          "Domínio já pertence a outro projeto Vercel. Registro local marcado como ERRO — sem transferência automática.",
      };
    }
    if (code === "forbidden" || status === 403) {
      return { code: code ?? "forbidden", error: "Sem permissão na API Vercel para este projeto." };
    }
    if (typeof message === "string" && message.trim()) {
      // Nunca ecoar tokens; mensagens da API são técnicas e seguras.
      return { code, error: message.slice(0, 400) };
    }
    if (typeof code === "string") return { code, error: code };
  }
  return { error: status ? `Erro Vercel HTTP ${status}` : "Erro Vercel desconhecido." };
}

function mapDomainPayload(json: unknown): VercelDomainInfo {
  const o = (json ?? {}) as Record<string, unknown>;
  const name = String(o.name ?? o.domain ?? "");
  return {
    name,
    verified: Boolean(o.verified),
    configuredBy: (o.configuredBy as string | null | undefined) ?? null,
    verification: Array.isArray(o.verification)
      ? (o.verification as VercelDomainInfo["verification"])
      : undefined,
    id: (o.id as string | null | undefined) ?? null,
  };
}

export function createVercelDomainsClient(deps?: {
  fetchImpl?: FetchLike;
  token?: string | null;
  projectId?: string;
  teamId?: string | null;
}): VercelDomainsClient {
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const token = deps?.token === undefined ? readToken() : deps.token;
  const projectId = deps?.projectId ?? readProjectId();
  const teamId = deps?.teamId === undefined ? readTeamId() : deps.teamId;

  async function api(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<{ status: number; json: unknown }> {
    if (!token) {
      return { status: 0, json: { error: { code: "no_token", message: "Token ausente." } } };
    }
    const url = new URL(`https://api.vercel.com${path}`);
    if (teamId) url.searchParams.set("teamId", teamId);
    const res = await fetchImpl(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, json };
  }

  return {
    async addDomain(name: string) {
      const { status, json } = await api(
        "POST",
        `/v10/projects/${encodeURIComponent(projectId)}/domains`,
        { name }
      );
      if (status === 200 || status === 201) {
        return { ok: true, data: mapDomainPayload(json) };
      }
      // Idempotente: já no mesmo projeto
      const code =
        json && typeof json === "object"
          ? ((json as { error?: { code?: string } }).error?.code ??
            (json as { code?: string }).code)
          : undefined;
      if (
        status === 409 &&
        (code === "domain_already_exists" ||
          code === "domain_already_in_use" ||
          /already/i.test(String((json as { error?: { message?: string } })?.error?.message ?? "")))
      ) {
        if (code === "domain_already_in_use") {
          const s = sanitizeErrorMessage(json, status);
          return { ok: false, error: s.error, code: s.code, status };
        }
        // mesmo projeto — sincronizar
        const existing = await this.getDomain(name);
        if (existing.ok && existing.data) {
          return { ok: true, data: existing.data, alreadyExists: true };
        }
        return {
          ok: true,
          data: { name, verified: false },
          alreadyExists: true,
        };
      }
      const s = sanitizeErrorMessage(json, status);
      return { ok: false, error: s.error, code: s.code, status };
    },

    async getDomain(name: string) {
      const { status, json } = await api(
        "GET",
        `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(name)}`
      );
      if (status === 404) return { ok: true, data: null };
      if (status >= 200 && status < 300) {
        return { ok: true, data: mapDomainPayload(json) };
      }
      const s = sanitizeErrorMessage(json, status);
      return { ok: false, error: s.error, code: s.code, status };
    },

    async getDomainConfig(name: string) {
      const { status, json } = await api(
        "GET",
        `/v6/domains/${encodeURIComponent(name)}/config`
      );
      if (status >= 200 && status < 300) {
        const o = (json ?? {}) as VercelDomainConfig;
        return {
          ok: true,
          data: {
            name,
            configuredBy: o.configuredBy ?? null,
            acceptedChallenges: o.acceptedChallenges,
            recommendedCNAME: o.recommendedCNAME,
            recommendedIPv4: o.recommendedIPv4,
            misconfigured: o.misconfigured,
          },
        };
      }
      const s = sanitizeErrorMessage(json, status);
      return { ok: false, error: s.error, code: s.code, status };
    },

    async removeDomain(name: string) {
      const { status, json } = await api(
        "DELETE",
        `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(name)}`
      );
      if (status === 200 || status === 204 || status === 404) {
        // 404 = já ausente → idempotente
        return { ok: true, data: { removed: status !== 404 } };
      }
      const s = sanitizeErrorMessage(json, status);
      return { ok: false, error: s.error, code: s.code, status };
    },
  };
}

export function dnsRegistrosFromVercelConfig(
  config: VercelDomainConfig,
  hostLabel: string
): DnsRegistro[] {
  const regs: DnsRegistro[] = [];
  for (const c of config.recommendedCNAME ?? []) {
    if (c?.value) {
      regs.push({
        tipo: "CNAME",
        host: hostLabel,
        valor: c.value,
        origem: "vercel",
      });
    }
  }
  for (const a of config.recommendedIPv4 ?? []) {
    if (a?.value) {
      regs.push({
        tipo: "A",
        host: hostLabel,
        valor: a.value,
        origem: "vercel",
      });
    }
  }
  return regs;
}

/** Cliente default — só usar em server actions; testes injetam mock. */
export function getDefaultVercelDomainsClient(): VercelDomainsClient {
  return createVercelDomainsClient();
}
