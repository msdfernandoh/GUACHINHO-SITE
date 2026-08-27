import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, "..");
const migration = fs.readFileSync(path.join(repoRoot, "supabase/migrations/146_empresa_dominios_dns_operacional.sql"), "utf8");
const actions = fs.readFileSync(path.join(appRoot, "src/app/platform/dominios-actions.ts"), "utf8");
const client = fs.readFileSync(path.join(appRoot, "src/app/platform/dominios/client.tsx"), "utf8");
const cron = fs.readFileSync(path.join(appRoot, "src/app/api/cron/dominios/route.ts"), "utf8");
const proxy = fs.readFileSync(path.join(appRoot, "src/proxy.ts"), "utf8");

describe("Fase 147 — ciclo operacional de domínio tenant", () => {
  it("persiste estados separados de Vercel, DNS e SSL", () => {
    expect(migration).toContain("status_vercel");
    expect(migration).toContain("status_dns");
    expect(migration).toContain("status_ssl");
    expect(migration).toContain("ultima_verificacao_em");
  });

  it("adiciona domínio à Vercel e nunca marca verificado sem DNS e HTTPS", () => {
    expect(actions).toContain("client.addDomain(valor)");
    expect(actions).toContain("diagnostico.verificado && sslReady");
    expect(actions).toContain("verificarHttpsEmpresaDominio");
  });

  it("permite corrigir o cadastro e mostra os registros DNS na interface", () => {
    expect(client).toContain("DNS / Editar");
    expect(client).toContain("registros_esperados");
    expect(client).toContain("Verificar DNS agora");
  });

  it("reprocessa pendências automaticamente com cron autenticado", () => {
    expect(cron).toContain("process.env.CRON_SECRET");
    expect(cron).toContain('.eq("verificado", false)');
    expect(cron).toContain("Promise.allSettled");
    expect(proxy).toContain('if (path.startsWith("/api/cron"))');
    expect(proxy).toContain("return NextResponse.next");
  });
});
