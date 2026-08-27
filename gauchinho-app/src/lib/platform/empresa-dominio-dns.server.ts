import "server-only";

import { resolve4, resolveCname, resolveNs } from "node:dns/promises";

export const VERCEL_APEX_IP = "216.150.1.1";
export const VERCEL_APEX_IPS_COMPATIVEIS = [VERCEL_APEX_IP, "76.76.21.21"] as const;
export const VERCEL_CNAME = "cname.vercel-dns-0.com";

export type EmpresaDominioDnsDiagnostico = {
  verificado: boolean;
  status: "ATIVO" | "PENDENTE_DNS";
  registros_esperados: Array<{ tipo: "A" | "CNAME"; host: string; valor: string }>;
  registros_encontrados: Array<{ tipo: "A" | "CNAME" | "NS"; host: string; valor: string }>;
  mensagem: string;
};

export type DnsRegistroEsperado = { tipo: string; host: string; valor: string };

function isVercelCname(value: string): boolean {
  const normalized = value.toLowerCase().replace(/\.$/, "");
  return normalized === VERCEL_CNAME || /^cname\.vercel-dns(?:-[a-z0-9]+)?\.com$/.test(normalized);
}

async function safeResolve4(host: string): Promise<string[]> {
  try {
    return await resolve4(host);
  } catch {
    return [];
  }
}

async function safeResolveCname(host: string): Promise<string[]> {
  try {
    return await resolveCname(host);
  } catch {
    return [];
  }
}

async function safeResolveNs(host: string): Promise<string[]> {
  try {
    return await resolveNs(host);
  } catch {
    return [];
  }
}

export async function diagnosticarDnsEmpresaDominio(
  host: string,
  tipo: string,
  recomendados?: DnsRegistroEsperado[] | null,
): Promise<EmpresaDominioDnsDiagnostico> {
  const dominio = host.trim().toLowerCase().replace(/\.$/, "");
  const isSubdominio = tipo === "SUBDOMINIO";
  const padrao: EmpresaDominioDnsDiagnostico["registros_esperados"] = isSubdominio
    ? [{ tipo: "CNAME", host: dominio, valor: VERCEL_CNAME }]
    : [
        { tipo: "A", host: "@", valor: VERCEL_APEX_IP },
        { tipo: "CNAME", host: "www", valor: VERCEL_CNAME },
      ];
  const registros_esperados = (recomendados ?? [])
    .filter((registro) => registro?.tipo && registro?.valor)
    .map((registro) => ({
      tipo: registro.tipo.toUpperCase() === "A" ? "A" as const : "CNAME" as const,
      host: registro.host || (isSubdominio ? dominio : "@"),
      valor: registro.valor.toLowerCase().replace(/\.$/, ""),
    }));
  if (registros_esperados.length === 0) registros_esperados.push(...padrao);

  const [ips, cnames, wwwCnames, nameservers] = await Promise.all([
    safeResolve4(dominio),
    safeResolveCname(dominio),
    isSubdominio ? Promise.resolve([]) : safeResolveCname(`www.${dominio}`),
    isSubdominio ? Promise.resolve([]) : safeResolveNs(dominio),
  ]);

  const registros_encontrados: EmpresaDominioDnsDiagnostico["registros_encontrados"] = [
    ...ips.map((valor) => ({ tipo: "A" as const, host: dominio, valor })),
    ...cnames.map((valor) => ({ tipo: "CNAME" as const, host: dominio, valor: valor.replace(/\.$/, "") })),
    ...wwwCnames.map((valor) => ({ tipo: "CNAME" as const, host: `www.${dominio}`, valor: valor.replace(/\.$/, "") })),
    ...nameservers.map((valor) => ({ tipo: "NS" as const, host: dominio, valor: valor.replace(/\.$/, "") })),
  ];

  const expectedApexIps = registros_esperados
    .filter((registro) => registro.tipo === "A" && (registro.host === "@" || registro.host === dominio))
    .map((registro) => registro.valor);
  const expectedApexCnames = registros_esperados
    .filter((registro) => registro.tipo === "CNAME" && registro.host !== "www")
    .map((registro) => registro.valor);
  const expectedWwwCnames = registros_esperados
    .filter((registro) => registro.tipo === "CNAME" && registro.host === "www")
    .map((registro) => registro.valor);
  const cnameMatches = (found: string[], expected: string[]) => found.some((value) => {
    const normalized = value.toLowerCase().replace(/\.$/, "");
    return expected.includes(normalized) || isVercelCname(normalized);
  });
  const nameserversNormalizados = new Set(nameservers.map((valor) => valor.toLowerCase().replace(/\.$/, "")));
  const usaDnsVercel = nameserversNormalizados.has("ns1.vercel-dns.com") && nameserversNormalizados.has("ns2.vercel-dns.com");
  const apexOk = isSubdominio
    ? cnameMatches(cnames, expectedApexCnames)
    : usaDnsVercel || ips.some((ip) => expectedApexIps.includes(ip) || VERCEL_APEX_IPS_COMPATIVEIS.includes(ip as typeof VERCEL_APEX_IPS_COMPATIVEIS[number])) || cnameMatches(cnames, expectedApexCnames);
  const wwwOk = isSubdominio || usaDnsVercel || expectedWwwCnames.length === 0 || cnameMatches(wwwCnames, expectedWwwCnames);
  const verificado = apexOk && wwwOk;

  return {
    verificado,
    status: verificado ? "ATIVO" : "PENDENTE_DNS",
    registros_esperados,
    registros_encontrados,
    mensagem: verificado
      ? "DNS propagado corretamente para a Vercel."
      : "DNS ainda não propagou todos os registros esperados. Confira os registros e tente novamente.",
  };
}

export async function verificarHttpsEmpresaDominio(host: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${host}`, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    return response.status > 0;
  } catch {
    return false;
  }
}
