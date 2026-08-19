import { describe, it, expect } from "vitest";

function resolveModulosComDependencias(
  selecionados: string[],
  catalogo: { codigo: string; dependencias: string[] }[],
): string[] {
  const result = new Set<string>(selecionados);
  let changed = true;

  while (changed) {
    changed = false;
    for (const code of Array.from(result)) {
      const mod = catalogo.find((m) => m.codigo === code);
      if (mod?.dependencias) {
        for (const dep of mod.dependencias) {
          if (!result.has(dep)) {
            result.add(dep);
            changed = true;
          }
        }
      }
    }
  }

  return Array.from(result);
}

function calcularValorMensalEstimado(params: {
  valorBase: number;
  sitesParceiros: number;
  valorSiteParceiro: number;
  sitesDominioProprio: number;
  valorSiteDominioProprio: number;
}): number {
  return (
    params.valorBase +
    params.sitesParceiros * params.valorSiteParceiro +
    params.sitesDominioProprio * params.valorSiteDominioProprio
  );
}

function resolverLimitesEfetivos(params: {
  plano: {
    limiteUsuarios: number;
    maxSitesParceiros: number;
    maxSitesDominioProprio: number;
    modulos: string[];
    erpIncluido: boolean;
  };
  assinatura: {
    usuariosContratados: number;
    sitesParceirosContratados: number;
    sitesDominioProprioContratados: number;
  };
  overrides: { recursoCodigo: string; efeito: "LIBERAR" | "BLOQUEAR"; valor?: number }[];
}) {
  // 1. Quotas base contratadas da assinatura (respeitando limite do plano)
  if (params.assinatura.sitesParceirosContratados > params.plano.maxSitesParceiros) {
    throw new Error("Sites parceiros excede o limite do plano.");
  }
  if (params.assinatura.sitesDominioProprioContratados > params.plano.maxSitesDominioProprio) {
    throw new Error("Domínios próprios excede o limite do plano.");
  }

  let usuariosEfetivos = params.assinatura.usuariosContratados || params.plano.limiteUsuarios;
  let sitesEfetivos = params.assinatura.sitesParceirosContratados;
  let dominiosEfetivos = params.assinatura.sitesDominioProprioContratados;
  const modulosEfetivos = new Set<string>(params.plano.erpIncluido ? params.plano.modulos : []);

  // 2. Aplicar overrides
  for (const ov of params.overrides) {
    if (ov.recursoCodigo === "limite_usuarios_extra" && ov.efeito === "LIBERAR" && ov.valor) {
      usuariosEfetivos += ov.valor;
    } else if (ov.recursoCodigo === "sites_parceiros_extra" && ov.efeito === "LIBERAR" && ov.valor) {
      sitesEfetivos += ov.valor;
    } else if (ov.efeito === "LIBERAR") {
      modulosEfetivos.add(ov.recursoCodigo);
    } else if (ov.efeito === "BLOQUEAR") {
      modulosEfetivos.delete(ov.recursoCodigo);
    }
  }

  return {
    usuariosEfetivos,
    sitesEfetivos,
    dominiosEfetivos,
    modulosEfetivos: Array.from(modulosEfetivos),
  };
}

describe("Fase 089 — Planos SaaS, Assinaturas, Limites e Resolução de Entitlements", () => {
  const catalogoERP = [
    { codigo: "painel", dependencias: [] },
    { codigo: "leads", dependencias: [] },
    { codigo: "propostas", dependencias: ["leads"] },
    { codigo: "contratacoes", dependencias: ["propostas"] },
    { codigo: "vendas", dependencias: ["contratacoes"] },
    { codigo: "comissoes", dependencias: ["vendas"] },
    { codigo: "financeiro", dependencias: ["comissoes"] },
    { codigo: "relatorios", dependencias: [] },
    { codigo: "metas", dependencias: [] },
    { codigo: "usuarios", dependencias: [] },
  ];

  it("deve resolver dependências em cascata automaticamente (contratacoes -> propostas -> leads)", () => {
    const resolvidos = resolveModulosComDependencias(["contratacoes"], catalogoERP);
    expect(resolvidos).toContain("contratacoes");
    expect(resolvidos).toContain("propostas");
    expect(resolvidos).toContain("leads");
    expect(resolvidos.length).toBe(3);
  });

  it("deve resolver cadeia completa de dependências de financeiro", () => {
    const resolvidos = resolveModulosComDependencias(["financeiro"], catalogoERP);
    expect(resolvidos).toEqual(
      expect.arrayContaining(["financeiro", "comissoes", "vendas", "contratacoes", "propostas", "leads"]),
    );
  });

  it("deve calcular o valor total mensal estimado com base no plano e quotas contratadas", () => {
    const total = calcularValorMensalEstimado({
      valorBase: 999.0,
      sitesParceiros: 8,
      valorSiteParceiro: 49.9,
      sitesDominioProprio: 2,
      valorSiteDominioProprio: 79.9,
    });
    // 999 + (8 * 49.90) + (2 * 79.90) = 999 + 399.20 + 159.80 = 1558.00
    expect(total).toBeCloseTo(1558.0, 2);
  });

  it("deve validar e rejeitar quotas contratadas superiores ao limite do plano", () => {
    const plano = {
      limiteUsuarios: 10,
      maxSitesParceiros: 20,
      maxSitesDominioProprio: 5,
      modulos: ["painel", "leads"],
      erpIncluido: true,
    };

    expect(() =>
      resolverLimitesEfetivos({
        plano,
        assinatura: {
          usuariosContratados: 10,
          sitesParceirosContratados: 25, // Excede 20
          sitesDominioProprioContratados: 2,
        },
        overrides: [],
      }),
    ).toThrowError(/excede o limite do plano/);
  });

  it("deve resolver limites efetivos aplicando overrides pontuais da Master Franquia", () => {
    const plano = {
      limiteUsuarios: 10,
      maxSitesParceiros: 20,
      maxSitesDominioProprio: 5,
      modulos: ["painel", "leads"],
      erpIncluido: true,
    };

    const resultado = resolverLimitesEfetivos({
      plano,
      assinatura: {
        usuariosContratados: 10,
        sitesParceirosContratados: 8,
        sitesDominioProprioContratados: 2,
      },
      overrides: [
        { recursoCodigo: "metas", efeito: "LIBERAR" },
        { recursoCodigo: "limite_usuarios_extra", efeito: "LIBERAR", valor: 5 },
      ],
    });

    expect(resultado.usuariosEfetivos).toBe(15);
    expect(resultado.sitesEfetivos).toBe(8);
    expect(resultado.dominiosEfetivos).toBe(2);
    expect(resultado.modulosEfetivos).toContain("metas");
    expect(resultado.modulosEfetivos).toContain("painel");
    expect(resultado.modulosEfetivos).toContain("leads");
  });
});
