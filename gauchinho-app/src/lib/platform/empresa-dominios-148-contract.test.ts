import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, "..");
const migration = fs.readFileSync(path.join(repoRoot, "supabase/migrations/148_normaliza_dns_registrobr_vercel.sql"), "utf8");
const actions = fs.readFileSync(path.join(appRoot, "src/app/platform/dominios-actions.ts"), "utf8");
const client = fs.readFileSync(path.join(appRoot, "src/app/platform/dominios/client.tsx"), "utf8");
const dns = fs.readFileSync(path.join(appRoot, "src/lib/platform/empresa-dominio-dns.server.ts"), "utf8");
const vercel = fs.readFileSync(path.join(appRoot, "src/lib/parceiros/vercel-domains.server.ts"), "utf8");

describe("Fase 150 — onboarding DNS Registro.br/Vercel", () => {
  it("classifica domínio pelo tipo persistido e não pela quantidade de pontos de .com.br", () => {
    expect(actions).not.toContain('valor.split(".").length');
    expect(dns).not.toContain('dominio.split(".").length');
    expect(actions).toContain('tipo === "SUBDOMINIO"');
  });

  it("mantém fallback técnico correto para raiz e www", () => {
    expect(dns).toContain('VERCEL_APEX_IP = "216.150.1.1"');
    expect(dns).toContain('"76.76.21.21"');
    expect(dns).toContain("resolveNs");
    expect(dns).toContain('VERCEL_CNAME = "cname.vercel-dns-0.com"');
    expect(migration).toContain("'A', 'host', '@'");
    expect(migration).toContain("'CNAME', 'host', 'www'");
  });

  it("explica a troca de nameservers no Registro.br e impede avanço silencioso com erro Vercel", () => {
    expect(client).toContain("ns1.vercel-dns.com");
    expect(client).toContain("ns2.vercel-dns.com");
    expect(client).toContain("Ainda não altere os servidores DNS");
    expect(vercel).toContain("já está vinculado a outro projeto ou conta Vercel");
  });
});
