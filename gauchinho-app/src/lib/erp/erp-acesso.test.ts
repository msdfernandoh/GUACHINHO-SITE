import { describe, expect, it } from "vitest";
import {
  canAccessErpRoute,
  canAuthorizedAccessErpRoute,
  resolveAuthorizedErpUserAccess,
  resolveErpUserAccess,
} from "./erp-acesso";

const config = {
  habilitado: true,
  modulos: ["painel", "leads", "financeiro", "usuarios"] as const,
};

describe("acesso individual ao ERP", () => {
  it("null preserva todos os menus habilitados para a empresa", () => {
    expect(resolveErpUserAccess(config, null)).toContain("contas-pagar");
    expect(resolveErpUserAccess(config, null)).toContain("usuarios");
  });

  it("array vazio bloqueia todos os menus e URLs", () => {
    expect(resolveErpUserAccess(config, [])).toEqual([]);
    expect(canAccessErpRoute(config, [], "contas-pagar")).toBe(false);
  });

  it("permite somente os menus selecionados e válidos no tenant", () => {
    expect(resolveErpUserAccess(config, ["painel", "contas-pagar", "grupos", "invalido"])).toEqual([
      "painel",
      "contas-pagar",
    ]);
  });
});

describe("matriz canônica de papel e permissões do ERP", () => {
  it("não deixa parceiros herdarem todos os módulos quando o vínculo é nulo", () => {
    expect(
      resolveAuthorizedErpUserAccess(config, null, {
        papelCodigo: "parceiro_comercial",
        permissoes: ["acessar_area_parceiro"],
      }),
    ).toEqual([]);
    expect(
      resolveAuthorizedErpUserAccess(config, null, {
        papelCodigo: "parceiro_imobiliaria",
        permissoes: ["gerenciar_leads"],
      }),
    ).toEqual([]);
  });

  it("mantém admin e superadmin limitados pelos módulos atribuídos", () => {
    expect(
      resolveAuthorizedErpUserAccess(config, ["painel", "financeiro"], {
        papelCodigo: "admin_empresa",
        permissoes: [],
      }),
    ).toEqual(["painel", "financeiro"]);
  });

  it("consultor acessa operação comercial e não acessa financeiro", () => {
    const consultantConfig = {
      habilitado: true,
      modulos: ["painel", "leads", "propostas", "comissoes", "financeiro"] as const,
    };
    const authorization = {
      papelCodigo: "consultor",
      permissoes: ["gerenciar_leads", "gerenciar_propostas"],
    };
    expect(canAuthorizedAccessErpRoute(consultantConfig, null, "leads", authorization)).toBe(true);
    expect(canAuthorizedAccessErpRoute(consultantConfig, null, "minhas-comissoes", authorization)).toBe(true);
    expect(canAuthorizedAccessErpRoute(consultantConfig, null, "financeiro", authorization)).toBe(false);
    expect(canAuthorizedAccessErpRoute(consultantConfig, null, "contas-pagar", authorization)).toBe(false);
  });

  it("gestor usa as permissões canônicas sem receber gestão de usuários", () => {
    const authorization = {
      papelCodigo: "gestor",
      permissoes: ["gerenciar_financeiro", "acessar_relatorios"],
    };
    expect(canAuthorizedAccessErpRoute(config, null, "financeiro", authorization)).toBe(true);
    expect(canAuthorizedAccessErpRoute(config, null, "relatorios", authorization)).toBe(false);
    expect(canAuthorizedAccessErpRoute(config, null, "usuarios", authorization)).toBe(false);
  });

  it("não exibe a gestão de consultores sem a permissão de participantes", () => {
    const teamConfig = {
      habilitado: true,
      modulos: ["usuarios", "comissoes"] as const,
    };
    expect(
      canAuthorizedAccessErpRoute(teamConfig, null, "consultores", {
        papelCodigo: "gestor",
        permissoes: ["gerenciar_comissoes"],
      }),
    ).toBe(false);
    expect(
      canAuthorizedAccessErpRoute(teamConfig, null, "consultores", {
        papelCodigo: "gestor",
        permissoes: ["gerenciar_participantes"],
      }),
    ).toBe(true);
  });

  it("visualizador fica somente nas áreas cobertas pela permissão de leitura", () => {
    const readConfig = {
      habilitado: true,
      modulos: ["painel", "relatorios", "metas", "financeiro"] as const,
    };
    expect(
      resolveAuthorizedErpUserAccess(readConfig, null, {
        papelCodigo: "visualizador",
        permissoes: ["acessar_relatorios"],
      }),
    ).toEqual(["painel", "relatorios", "metas"]);
  });
});
