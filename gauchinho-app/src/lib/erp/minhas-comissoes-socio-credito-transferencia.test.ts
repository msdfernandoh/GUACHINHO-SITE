import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "src/app/erp/minhas-comissoes/page.tsx"), "utf8");
const actions = readFileSync(resolve(process.cwd(), "src/app/erp/minhas-comissoes/actions.ts"), "utf8");
const client = readFileSync(resolve(process.cwd(), "src/components/erp/comissoes/minhas-comissoes-client.tsx"), "utf8");

describe("Minhas comissões — crédito societário e transferência de retirada", () => {
  it("detecta se o participante é sócio da empresa e repassa para a interface", () => {
    expect(page).toContain('.from("empresa_socios")');
    expect(page).toContain("ehSocio");
    expect(client).toContain("ehSocio?: boolean");
  });

  it("permite creditar e conferir comissão mantendo o dinheiro no caixa da empresa para despesas", () => {
    expect(actions).toContain("creditarEConferirComissaoAction");
    expect(actions).toContain("Crédito de comissão do sócio mantido na empresa para despesas");
    expect(actions).toContain("conferido_por_participante: true");
    // Não passa conta de saída bancária quando mantido na empresa
    expect(actions).toContain("manterNaEmpresa");
    expect(actions).toContain("contaIdParaBaixa");
  });

  it("oferece opção explícita na interface para sócios manterem o saldo na empresa", () => {
    expect(client).toContain("Creditar comissões do sócio no caixa da empresa");
    expect(client).toContain("manter_empresa");
    expect(client).toContain("Creditar e conferir");
    expect(client).toContain("A baixa no banco do ERP só ocorrerá no momento da transferência de retirada");
  });
});
