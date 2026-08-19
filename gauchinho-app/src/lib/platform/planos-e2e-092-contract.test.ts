import { describe, it, expect } from "vitest";

describe("Platform SaaS — Governança de Planos, Assinaturas, Quotas e Overrides (Fase 092)", () => {
  const planoProfissional = {
    codigo: "plano_profissional",
    nome: "Plano Profissional",
    erp_incluido: true,
    modulos_habilitados: [
      "painel",
      "crm",
      "propostas",
      "contratacoes",
      "vendas",
      "comissoes",
      "financeiro",
      "relatorios",
      "usuarios",
    ],
    limite_usuarios: 10,
    site_principal_incluido: true,
    permite_sites_parceiros: true,
    max_parceiros: 20,
    max_sites_parceiros: 20,
    max_sites_dominio_proprio: 5,
    valor_mensal: 1000.0,
    valor_site_parceiro: 50.0,
    valor_site_dominio_proprio: 80.0,
    status: "ATIVO",
  };

  it("deve validar entitlements e módulos incluídos no Plano Profissional", () => {
    expect(planoProfissional.erp_incluido).toBe(true);
    expect(planoProfissional.modulos_habilitados.length).toBe(9);
    expect(planoProfissional.modulos_habilitados).toContain("crm");
    expect(planoProfissional.modulos_habilitados).toContain("contratacoes");
    expect(planoProfissional.modulos_habilitados).toContain("financeiro");
    expect(planoProfissional.limite_usuarios).toBe(10);
    expect(planoProfissional.max_sites_parceiros).toBe(20);
    expect(planoProfissional.max_sites_dominio_proprio).toBe(5);
  });

  it("deve calcular o resumo financeiro exato para a contratação da Master Franquia (8 sites, 2 domínios)", () => {
    const contratacao = {
      sites_parceiros_contratados: 8,
      sites_dominio_proprio_contratados: 2,
    };

    const valorBase = planoProfissional.valor_mensal;
    const valorSites = contratacao.sites_parceiros_contratados * planoProfissional.valor_site_parceiro;
    const valorDominios = contratacao.sites_dominio_proprio_contratados * planoProfissional.valor_site_dominio_proprio;
    const totalEstimado = valorBase + valorSites + valorDominios;

    expect(valorBase).toBe(1000.0);
    expect(valorSites).toBe(400.0);
    expect(valorDominios).toBe(160.0);
    expect(totalEstimado).toBe(1560.0);
  });

  it("deve bloquear tentativa de contratação que exceda os limites do plano sem override", () => {
    const validarQuotas = (
      usuarios: number,
      sites: number,
      dominios: number,
      overrides: { usuarios?: number; sites?: number; dominios?: number } = {},
    ) => {
      const limiteUsuariosEfetivo = overrides.usuarios ?? planoProfissional.limite_usuarios;
      const limiteSitesEfetivo = overrides.sites ?? planoProfissional.max_sites_parceiros;
      const limiteDominiosEfetivo = overrides.dominios ?? planoProfissional.max_sites_dominio_proprio;

      if (usuarios > limiteUsuariosEfetivo) {
        return { valido: false, erro: "Limite de usuários excedido" };
      }
      if (sites > limiteSitesEfetivo) {
        return { valido: false, erro: "Limite de sites parceiros excedido" };
      }
      if (dominios > limiteDominiosEfetivo) {
        return { valido: false, erro: "Limite de domínios próprios excedido" };
      }
      return { valido: true };
    };

    // 11 usuários > limite 10 -> Bloqueado
    expect(validarQuotas(11, 8, 2).valido).toBe(false);

    // 21 sites > limite 20 -> Bloqueado
    expect(validarQuotas(10, 21, 2).valido).toBe(false);

    // 6 domínios > limite 5 -> Bloqueado
    expect(validarQuotas(10, 8, 6).valido).toBe(false);

    // 15 usuários COM override de 15 -> Permitido
    expect(validarQuotas(15, 8, 2, { usuarios: 15 }).valido).toBe(true);

    // 25 sites COM override de 30 -> Permitido
    expect(validarQuotas(10, 25, 2, { sites: 30 }).valido).toBe(true);
  });

  it("deve resolver a hierarquia de entitlements de forma estrita (Catálogo -> Plano -> Assinatura -> Override)", () => {
    const catalogo = ["painel", "crm", "propostas", "contratacoes", "vendas", "comissoes", "financeiro", "metas"];
    const planoModulos = ["painel", "crm", "propostas", "contratacoes"];
    const empresaOverrides = ["metas"]; // Override de liberação do módulo metas

    const resolverModulosEfetivos = (
      cat: string[],
      plano: string[],
      overrides: string[],
    ) => {
      const permitidosNoCatalogo = new Set(cat);
      const modulosAtivos = new Set(plano.filter((m) => permitidosNoCatalogo.has(m)));
      overrides.forEach((o) => {
        if (permitidosNoCatalogo.has(o)) {
          modulosAtivos.add(o);
        }
      });
      return Array.from(modulosAtivos);
    };

    const modulosFinais = resolverModulosEfetivos(catalogo, planoModulos, empresaOverrides);
    expect(modulosFinais).toContain("painel");
    expect(modulosFinais).toContain("crm");
    expect(modulosFinais).toContain("propostas");
    expect(modulosFinais).toContain("contratacoes");
    expect(modulosFinais).toContain("metas"); // Liberado por override
    expect(modulosFinais).not.toContain("financeiro"); // Não incluso no plano e sem override
  });

  it("deve bloquear exclusão destrutiva de plano que possua assinantes ativos", () => {
    const excluirPlano = (planoId: string, assinantesCount: number) => {
      if (assinantesCount > 0) {
        throw new Error(
          `Plano em uso por ${assinantesCount} empresa(s) assinante(s). Não pode ser excluído destrutivamente. Altere seu status para INATIVO.`,
        );
      }
      return true;
    };

    expect(() => excluirPlano("plano-1", 3)).toThrow("Plano em uso por 3 empresa(s)");
    expect(excluirPlano("plano-sem-uso", 0)).toBe(true);
  });
});
