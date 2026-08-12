import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("../supabase/migrations/068_fluxo_proposta_contratacao_final.sql");
const materialize = read("src/app/api/public/contratacoes/rascunho/materializar/route.ts");
const start = read("src/app/api/public/contratacoes/iniciar/route.ts");
const finalRoute = read("src/app/api/public/contratacoes/[token]/finalizar/route.ts");
const service = read("src/lib/contratacoes-online/proposta-flow.ts");
const wizard = read("src/components/contratacao/contratacao-wizard.tsx");

describe("contrato proposta → contratação", () => {
  it("A/B: início vazio não persiste e proposta exige nome + telefone", () => {
    expect(start).toContain("draft: true");
    expect(materialize).toContain("criarPropostaDoFluxo");
    expect(service).toContain("Nome e telefone/WhatsApp são obrigatórios");
  });

  it("C: materializa proposta ao salvar dados básicos, sem inserir contratação", () => {
    const basicSave = wizard.indexOf('fetch("/api/public/contratacoes/rascunho/materializar"');
    const personSave = wizard.indexOf("async function salvarPessoa");
    expect(basicSave).toBeGreaterThan(0);
    expect(basicSave).toBeLessThan(personSave);
    expect(materialize).not.toContain('.from("contratacoes_online")');
  });

  it("D/E/H: documento persistido é pré-condição backend da confirmação final", () => {
    expect(migration).toContain("FROM public.propostas_documentos");
    expect(migration).toContain("IF v_doc_count < 1");
    expect(migration).toContain("Envie pelo menos um documento válido");
    expect(finalRoute).toContain("finalizarPropostaEmContratacao");
    expect(service).toContain('.storage.from("contratacoes-documentos").download');
  });

  it("F: INSERT de contratação existe somente no RPC final", () => {
    expect(migration).toContain("INSERT INTO public.contratacoes_online");
    expect(service).not.toContain('.from("contratacoes_online").insert');
  });

  it("G: lock e vínculo único tornam retry/double-click idempotente", () => {
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("contratacoes_online_proposta_uidx");
    expect(migration).toMatch(/IF FOUND THEN\s+RETURN v_existente;/);
  });

  it("I: tenant participa de todas as buscas e da finalização", () => {
    expect(service).toContain('.eq("empresa_id", empresaId)');
    expect(service).toContain("p_empresa_id: empresaId");
    expect(migration).toContain("v_proposta.empresa_id IS DISTINCT FROM p_empresa_id");
    expect(migration).toContain("propostas_documentos_proposta_empresa_fkey");
    expect(migration).toContain("contratacoes_online_proposta_empresa_fkey");
    expect(service).toContain("Consultor responsável não pertence a este tenant");
  });
});
