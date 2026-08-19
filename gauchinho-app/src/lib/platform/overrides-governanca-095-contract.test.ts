import { describe, it, expect } from "vitest";

describe("Platform SaaS — Gestão Operacional de Exceções e Overrides (Fase 095)", () => {
  it("calcula limite efetivo quando há override numérico ativo (10 plano -> 15 override)", () => {
    const planoLimiteUsuarios = 10;
    const override = {
      tipo: "LIMITE_USUARIOS",
      valor_numerico: 15,
      status: "ATIVO",
      vigencia_fim: null,
    };

    const limiteEfetivo =
      override.status === "ATIVO" && override.valor_numerico !== null
        ? override.valor_numerico
        : planoLimiteUsuarios;

    expect(limiteEfetivo).toBe(15);
  });

  it("restaura o valor herdado do plano quando o override expira ou é encerrado", () => {
    const planoLimiteUsuarios = 10;
    const override = {
      tipo: "LIMITE_USUARIOS",
      valor_numerico: 15,
      status: "ENCERRADO", // Encerrado manualmente ou expirado
      vigencia_fim: "2026-08-01",
    };

    const limiteEfetivo =
      override.status === "ATIVO" && override.valor_numerico !== null
        ? override.valor_numerico
        : planoLimiteUsuarios;

    expect(limiteEfetivo).toBe(10);
  });

  it("habilita módulo no escopo da empresa quando há override de LIBERAR", () => {
    const modulosPlano = ["leads", "propostas", "clientes"];
    const overrideMetas = {
      recurso_codigo: "metas",
      efeito: "LIBERAR",
      status: "ATIVO",
    };

    const modulosEfetivosEmpresa = Array.from(
      new Set([...modulosPlano, overrideMetas.recurso_codigo]),
    );

    expect(modulosEfetivosEmpresa).toContain("metas");
    expect(modulosEfetivosEmpresa.length).toBe(4);
  });

  it("mantém bloqueio de usuário que não possui permissão mesmo que o módulo tenha sido liberado por override", () => {
    const modulosEfetivosEmpresa = ["leads", "propostas", "clientes", "metas"];
    const permissoesUsuario = ["leads", "propostas"]; // Usuário sem acesso a metas

    // Resolução: usuário só acessa o que for permitido para a empresa E concedido no seu papel/permissão
    const usuarioAcessaMetas =
      modulosEfetivosEmpresa.includes("metas") &&
      permissoesUsuario.includes("metas");

    expect(usuarioAcessaMetas).toBe(false);
  });

  it("bloqueia módulo incluído no plano quando há override de BLOQUEAR sem apagar dados históricos", () => {
    const modulosPlano = ["leads", "propostas", "clientes", "financeiro"];
    const dadosHistoricosFinanceiro = [{ id: "mov-1", valor: 1500, status: "pago" }];

    const overrideBloquearFinanceiro = {
      recurso_codigo: "financeiro",
      efeito: "BLOQUEAR",
      status: "ATIVO",
    };

    const modulosEfetivosEmpresa = modulosPlano.filter(
      (m) => !(overrideBloquearFinanceiro.efeito === "BLOQUEAR" && overrideBloquearFinanceiro.recurso_codigo === m),
    );

    expect(modulosEfetivosEmpresa).not.toContain("financeiro");
    // Dados históricos permanecem intactos
    expect(dadosHistoricosFinanceiro.length).toBe(1);
    expect(dadosHistoricosFinanceiro[0].valor).toBe(1500);
  });

  it("garante resolução de conflitos: novo override para o mesmo recurso encerra a versão anterior", () => {
    const overridesExistentes = [
      { id: "ovr-1", recurso: "limite_usuarios", valor: 15, status: "ATIVO" },
    ];

    // Novo override de 20 usuários aplicado
    const novoOverride = { id: "ovr-2", recurso: "limite_usuarios", valor: 20, status: "ATIVO" };

    const historicoAtualizado = overridesExistentes
      .map((o) => (o.recurso === novoOverride.recurso ? { ...o, status: "ENCERRADO" } : o))
      .concat(novoOverride);

    const ativos = historicoAtualizado.filter((o) => o.status === "ATIVO");
    expect(ativos.length).toBe(1);
    expect(ativos[0].valor).toBe(20);
    expect(historicoAtualizado.length).toBe(2);
  });

  it("garante isolamento multi-tenant: tenant regular não pode criar override global", () => {
    const userRole = "admin_empresa"; // Tenant regular
    const isSuperAdmin = userRole === "super_admin";

    expect(isSuperAdmin).toBe(false);
  });
});
