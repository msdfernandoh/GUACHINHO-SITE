import {
  GAUCHINHO_OFFICIAL_HOSTS,
  MAX_DOMAIN_LENGTH,
  PLATFORM_HOST,
} from "./constants";

/**
 * Normaliza um host para comparação/armazenamento:
 * minúsculas, sem protocolo, porta, www., path, query, fragmento ou espaços.
 */
export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  let value = host.trim().toLowerCase();
  if (!value) return "";

  // Remove protocolo se alguém colar URL completa
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  // Remove credenciais user:pass@
  const atIdx = value.lastIndexOf("@");
  if (atIdx >= 0) value = value.slice(atIdx + 1);
  // Path / query / fragment
  value = value.split("/")[0] ?? "";
  value = value.split("?")[0] ?? "";
  value = value.split("#")[0] ?? "";
  // Porta
  if (value.includes(":") && !value.startsWith("[")) {
    value = value.split(":")[0] ?? "";
  }
  // IPv6 brackets — não suportamos persistência de IP
  value = value.replace(/^\[|\]$/g, "");
  if (value.startsWith("www.")) value = value.slice(4);
  return value.trim();
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/**
 * Valida host para persistência em empresa_dominios.
 * Bloqueia localhost, IPs, wildcards, vazios e formatos inválidos.
 */
export function validateHostForPersist(raw: string): { ok: true; valor: string } | { ok: false; error: string } {
  const valor = normalizeHost(raw);
  if (!valor) return { ok: false, error: "Domínio inválido ou vazio." };
  if (valor.length > MAX_DOMAIN_LENGTH) {
    return { ok: false, error: `Domínio excede ${MAX_DOMAIN_LENGTH} caracteres.` };
  }
  if (LOCAL_HOSTS.has(valor) || valor.endsWith(".localhost")) {
    return { ok: false, error: "Localhost não pode ser persistido como domínio." };
  }
  if (isIpv4(valor) || valor.includes(":")) {
    return { ok: false, error: "IP não pode ser persistido como domínio." };
  }
  if (valor.includes("*") || valor.includes(" ")) {
    return { ok: false, error: "Domínio contém caracteres inválidos." };
  }
  if (valor.includes("/") || valor.includes("?") || valor.includes("#")) {
    return { ok: false, error: "Domínio não pode conter path, query ou fragmento." };
  }
  // FQDN simples: labels alfanuméricos com hífen, pelo menos um ponto para domínio customizado
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(valor)) {
    return { ok: false, error: "Formato de domínio inválido." };
  }
  return { ok: true, valor };
}

/** Host normalizado é um dos dois oficiais da Gauchinho (com ou sem www no input bruto). */
export function isOfficialGauchinhoHost(rawHost: string | null | undefined): boolean {
  const raw = (rawHost ?? "").trim().toLowerCase().split(":")[0] ?? "";
  if ((GAUCHINHO_OFFICIAL_HOSTS as readonly string[]).includes(raw)) return true;
  const normalized = normalizeHost(rawHost);
  return normalized === "gauchinhoconsorcios.com.br";
}

/**
 * Identifica o host administrativo global antes da resolução por tenant.
 * O prefixo www não é aceito: a plataforma possui um único host canônico.
 */
export function isPlatformHost(rawHost: string | null | undefined): boolean {
  const raw = (rawHost ?? "").trim().toLowerCase().split(":")[0] ?? "";
  if (!raw || raw.startsWith("www.")) return false;
  const configured = normalizeHost(process.env.PLATFORM_HOST || PLATFORM_HOST);
  return raw === configured;
}

/** Override por host *.localhost — apenas desenvolvimento. */
export function devSlugFromHost(host: string): string | null {
  if (host === "localhost" || host === "127.0.0.1") return "gauchinho";
  if (host.endsWith(".localhost")) {
    const label = host.slice(0, -".localhost".length);
    return label || "gauchinho";
  }
  return null;
}

export function isDevelopmentNodeEnv(): boolean {
  return process.env.NODE_ENV === "development";
}
