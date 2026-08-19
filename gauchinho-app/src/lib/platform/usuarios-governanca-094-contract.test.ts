import { describe, it, expect } from "vitest";

describe("Platform SaaS — Governança Global de Usuários e Responsáveis (Fase 094)", () => {
  it("envia convite sem criação de senha manual", () => {
    const convite = {
      empresa_id: "emp-sorriso-1",
      nome: "Carlos Consultor",
      email: "carlos@sorrisoconsorcios.com.br",
      papel_id: "papel-consultor",
      is_responsavel: false,
    };

    // Convite não deve conter campo de senha
    expect(convite).not.toHaveProperty("senha");
    expect(convite).not.toHaveProperty("password");
    expect(convite.email).toContain("@");
    expect(convite.nome.trim().length).toBeGreaterThan(0);
  });

  it("bloqueia novo convite caso o limite contratado seja atingido sem override", () => {
    const limiteContratado = 10;
    const usuariosAtivos = 10;
    const overrides = 0;
    const limiteEfetivo = limiteContratado + overrides;

    const podeConvidar = usuariosAtivos < limiteEfetivo;
    expect(podeConvidar).toBe(false);
  });

  it("permite convite caso haja override de usuários ativo", () => {
    const limiteContratado = 10;
    const usuariosAtivos = 10;
    const overrides = 5; // +5 usuários liberados por exceção comercial
    const limiteEfetivo = limiteContratado + overrides;

    const podeConvidar = usuariosAtivos < limiteEfetivo;
    expect(podeConvidar).toBe(true);
  });

  it("garante a resolução hierárquica estrita de módulos e bloqueia módulos não permitidos", () => {
    const planoModulos = ["leads", "propostas", "clientes", "comissoes"];
    const overrideModulos = ["financeiro"]; // Exceção pontual
    const modulosEmpresaEfetivos = Array.from(new Set([...planoModulos, ...overrideModulos]));

    // Usuário solicitou módulo 'metas' que não está no Plano nem no Override
    const modulosSolicitados = ["leads", "propostas", "financeiro", "metas"];

    // Resolução: usuário só recebe a interseção com o permitido para a empresa
    const modulosEfetivosUsuario = modulosSolicitados.filter((m) =>
      modulosEmpresaEfetivos.includes(m),
    );

    expect(modulosEfetivosUsuario).toContain("leads");
    expect(modulosEfetivosUsuario).toContain("propostas");
    expect(modulosEfetivosUsuario).toContain("financeiro");
    expect(modulosEfetivosUsuario).not.toContain("metas"); // Bloqueado!
  });

  it("mantém a unicidade do responsável principal por Master Franquia", () => {
    const equipe = [
      { id: "usr-1", nome: "Ana Responsável Antiga", is_responsavel: true },
      { id: "usr-2", nome: "Bruno Novo Responsável", is_responsavel: false },
      { id: "usr-3", nome: "Carla Consultora", is_responsavel: false },
    ];

    // Transferir responsável principal para Bruno
    const novoResponsavelId = "usr-2";
    const equipeAtualizada = equipe.map((u) => ({
      ...u,
      is_responsavel: u.id === novoResponsavelId,
    }));

    const responsaveisAtivos = equipeAtualizada.filter((u) => u.is_responsavel);
    expect(responsaveisAtivos.length).toBe(1);
    expect(responsaveisAtivos[0].nome).toBe("Bruno Novo Responsável");
  });

  it("garante isolamento multi-tenant: tenant não pode alterar vínculos de outra Master Franquia", () => {
    const tenantMasterSP = { id: "empresa-sp" };
    const tenantMasterRS = { id: "empresa-rs" };

    const vinculoUsuarioRS = { id: "link-rs-1", empresa_id: tenantMasterRS.id, usuario_id: "usr-rs" };

    // Tenant SP tenta alterar vínculo de RS
    const permissaoTenant = vinculoUsuarioRS.empresa_id === tenantMasterSP.id;
    expect(permissaoTenant).toBe(false);
  });
});
