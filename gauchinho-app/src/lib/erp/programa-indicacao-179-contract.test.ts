import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(path.join(process.cwd(), "..", "supabase", "migrations", "179_programa_indicacao_publico_comissoes.sql"), "utf8");
const api = fs.readFileSync(path.join(process.cwd(), "src", "app", "api", "public", "programa-indicacao", "route.ts"), "utf8");

describe("Programa de Indicação 179", () => {
  it("isola indicadores e indicações por empresa e liga venda pelo lead canônico", () => {
    expect(migration).toContain("empresa_id uuid NOT NULL");
    expect(migration).toContain("NEW.lead_id");
    expect(migration).toContain("v.lead_id=NEW.lead_id");
    expect(migration).not.toContain("auth.uid() = participante_id");
  });
  it("usa somente perfil INDICADOR e regra homologada, sem percentual padrão", () => {
    expect(migration).toContain("pc.papel_tipo='INDICADOR'");
    expect(migration).toContain("r.configuracao_homologada");
    expect(migration).toContain("r.status='HOMOLOGADA'");
    expect(migration).not.toMatch(/percentual[^\n]*DEFAULT\s+[0-9]/i);
  });
  it("consulta por CPF e mascara o nome sem retornar CPF ou PIX", () => {
    expect(api).toContain('acao === "consultar"');
    expect(api).toContain("ocultarNome");
    expect(api).not.toContain('select("cpf,chave_pix');
  });
  it("habilita o menu nos modelos Gauchinho e Racon", () => {
    expect(migration).toContain("'gauchinho_default','racon_inspired'");
    expect(migration).toContain("'programa_indicacao'");
  });
});
