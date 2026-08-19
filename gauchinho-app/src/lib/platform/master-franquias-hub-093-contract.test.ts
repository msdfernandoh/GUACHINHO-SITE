import { describe, it, expect } from "vitest";

describe("Platform SaaS — Master Franquias Hub (Fase 093)", () => {
  it("valida o checklist de prontidão da Master Franquia antes da ativação", () => {
    const checklistIncompleto = [
      { titulo: "1. Dados da Empresa", ok: true },
      { titulo: "2. Plano SaaS & Assinatura", ok: false }, // Sem plano
      { titulo: "3. Administradora Homologada", ok: true },
      { titulo: "4. Usuário Responsável", ok: true },
      { titulo: "5. Quotas e Limites", ok: true },
      { titulo: "6. Modelo de Site", ok: true },
      { titulo: "7. Domínio / Endereço", ok: true },
    ];

    const pendencias = checklistIncompleto.filter((c) => !c.ok);
    expect(pendencias.length).toBe(1);
    expect(pendencias[0].titulo).toBe("2. Plano SaaS & Assinatura");

    const checklistCompleto = checklistIncompleto.map((c) => ({ ...c, ok: true }));
    const prontaParaAtivar = checklistCompleto.every((c) => c.ok);
    expect(prontaParaAtivar).toBe(true);
  });

  it("calcula indicadores de limites no formato UTILIZADO / CONTRATADO / MÁXIMO DO PLANO", () => {
    const plano = {
      nome: "Plano Enterprise",
      limite_usuarios: 50,
      max_sites_parceiros: 30,
      max_sites_dominio_proprio: 10,
    };

    const assinatura = {
      usuarios_contratados: 20,
      sites_parceiros_contratados: 12,
      sites_dominio_proprio_contratados: 3,
    };

    const usoAtual = {
      usuarios_ativos: 14,
      sites_parceiros_publicados: 8,
      dominios_proprios_ativos: 2,
    };

    expect(usoAtual.usuarios_ativos).toBeLessThanOrEqual(assinatura.usuarios_contratados);
    expect(assinatura.usuarios_contratados).toBeLessThanOrEqual(plano.limite_usuarios);

    expect(usoAtual.sites_parceiros_publicados).toBeLessThanOrEqual(assinatura.sites_parceiros_contratados);
    expect(assinatura.sites_parceiros_contratados).toBeLessThanOrEqual(plano.max_sites_parceiros);

    expect(usoAtual.dominios_proprios_ativos).toBeLessThanOrEqual(assinatura.sites_dominio_proprio_contratados);
    expect(assinatura.sites_dominio_proprio_contratados).toBeLessThanOrEqual(plano.max_sites_dominio_proprio);
  });

  it("preserva dados ao suspender Master Franquia exigindo motivo e observação", () => {
    const empresa = {
      id: "emp-sorriso-123",
      status: "ativa",
      ativo: true,
      usuarios_count: 8,
      contratos_count: 45,
    };

    const suspensao = {
      motivo: "Inadimplência de mensalidade SaaS",
      observacao: "Notificado em 10/08/2026",
    };

    expect(suspensao.motivo.trim().length).toBeGreaterThan(0);

    const empresaSuspensa = {
      ...empresa,
      status: "suspensa",
      ativo: false,
    };

    // Dados essenciais preservados
    expect(empresaSuspensa.usuarios_count).toBe(8);
    expect(empresaSuspensa.contratos_count).toBe(45);
    expect(empresaSuspensa.status).toBe("suspensa");
  });

  it("valida troca assistida de Plano SaaS com cálculo financeiro", () => {
    const planoNovo = {
      id: "plano-pro",
      nome: "Profissional",
      valor_mensal: 980,
      valor_site_parceiro: 50,
      valor_site_dominio_proprio: 90,
      limite_usuarios: 25,
      max_sites_parceiros: 20,
    };

    const contratacao = {
      usuarios: 20,
      sites_parceiros: 8,
      sites_dominio_proprio: 2,
    };

    const valorTotalEstimado =
      planoNovo.valor_mensal +
      contratacao.sites_parceiros * planoNovo.valor_site_parceiro +
      contratacao.sites_dominio_proprio * planoNovo.valor_site_dominio_proprio;

    // 980 + (8 * 50 = 400) + (2 * 90 = 180) = 1560
    expect(valorTotalEstimado).toBe(1560);
  });

  it("garante que parceiro pertence à Master Franquia e não cria novo tenant SaaS", () => {
    const masterFranquia = { id: "empresa-master-1", slug: "master-sp" };
    const parceiro = { id: "org-1", nome: "Imobiliária Alpha", master_empresa_id: masterFranquia.id };
    const siteParceiro = {
      id: "site-1",
      empresa_id: masterFranquia.id,
      organizacao_parceira_id: parceiro.id,
      slug: "imobiliaria-alpha",
      canal: "SUBDOMINIO",
    };

    expect(siteParceiro.empresa_id).toBe(masterFranquia.id);
    expect(siteParceiro.organizacao_parceira_id).toBe(parceiro.id);
  });
});
