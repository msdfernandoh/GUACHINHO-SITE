import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPRESA_B_ID,
  GAUCHINHO_EMPRESA_ID,
  RACON_ADMINISTRADORA_ID,
  RACON_SLUG,
} from "./constants";

const requireGerenciarAdministradorasEmpresa = vi.fn();
const createClient = vi.fn();
const getUsuarioNegocio = vi.fn();
const writeAdministradorasAuditLog = vi.fn();

vi.mock("./authorization", () => ({
  requireGerenciarAdministradorasEmpresa: () => requireGerenciarAdministradorasEmpresa(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

vi.mock("@/lib/auth/get-usuario", () => ({
  getUsuarioNegocio: () => getUsuarioNegocio(),
}));

vi.mock("./audit", () => ({
  writeAdministradorasAuditLog: (input: unknown) => writeAdministradorasAuditLog(input),
}));

function chainable(result: { data: unknown; error: unknown }) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = self;
  api.insert = self;
  api.update = self;
  api.eq = self;
  api.order = self;
  api.single = async () => result;
  api.maybeSingle = async () => result;
  // thenable for await supabase.from().select()...order()
  api.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return api;
}

describe("concessoes — autorização", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsuarioNegocio.mockResolvedValue({ id: "super-1" });
    writeAdministradorasAuditLog.mockResolvedValue({ ok: true });
  });

  it("nega listagem para não-Superadmin", async () => {
    requireGerenciarAdministradorasEmpresa.mockRejectedValue(
      new Error("Sem permissão para gerenciar concessões de administradoras."),
    );
    const { getEmpresaAdministradorasForSuperadmin } = await import("./concessoes");
    await expect(getEmpresaAdministradorasForSuperadmin(GAUCHINHO_EMPRESA_ID)).rejects.toThrow(
      /concessões/i,
    );
  });

  it("nega grant para não-Superadmin", async () => {
    requireGerenciarAdministradorasEmpresa.mockRejectedValue(
      new Error("Sem permissão para gerenciar concessões de administradoras."),
    );
    const { grantAdministradoraToEmpresa } = await import("./concessoes");
    await expect(
      grantAdministradoraToEmpresa({
        empresaId: EMPRESA_B_ID,
        administradoraId: RACON_ADMINISTRADORA_ID,
      }),
    ).rejects.toThrow(/concessões/i);
  });

  it("nega status para não-Superadmin", async () => {
    requireGerenciarAdministradorasEmpresa.mockRejectedValue(
      new Error("Sem permissão para gerenciar concessões de administradoras."),
    );
    const { setEmpresaAdministradoraStatus } = await import("./concessoes");
    await expect(setEmpresaAdministradoraStatus("v1", "SUSPENSA")).rejects.toThrow(/concessões/i);
  });
});

describe("concessoes — regras de negócio (mock)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireGerenciarAdministradorasEmpresa.mockResolvedValue(undefined);
    getUsuarioNegocio.mockResolvedValue({ id: "super-1" });
    writeAdministradorasAuditLog.mockResolvedValue({ ok: true });
  });

  it("lista Gauchinho com Racon ATIVA", async () => {
    createClient.mockResolvedValue({
      from: (table: string) => {
        if (table === "empresa_administradoras") {
          return chainable({
            data: [
              {
                id: "vinculo-gauchinho-racon",
                empresa_id: GAUCHINHO_EMPRESA_ID,
                administradora_id: RACON_ADMINISTRADORA_ID,
                status: "ATIVA",
                codigo_franquia: null,
                codigo_comercial: null,
                contato_interno: null,
                observacoes: null,
                created_at: "2026-08-01T00:00:00Z",
                updated_at: "2026-08-01T00:00:00Z",
                administradora: {
                  id: RACON_ADMINISTRADORA_ID,
                  nome: "Racon",
                  nome_fantasia: "Racon",
                  slug: RACON_SLUG,
                  status: "ATIVA",
                  logo_url: null,
                },
              },
            ],
            error: null,
          });
        }
        return chainable({ data: null, error: null });
      },
    });

    const { getEmpresaAdministradorasForSuperadmin } = await import("./concessoes");
    const rows = await getEmpresaAdministradorasForSuperadmin(GAUCHINHO_EMPRESA_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.administradora.slug).toBe("racon");
    expect(rows[0]?.status).toBe("ATIVA");
  });

  it("Empresa B sem concessões", async () => {
    createClient.mockResolvedValue({
      from: () => chainable({ data: [], error: null }),
    });
    const { getEmpresaAdministradorasForSuperadmin } = await import("./concessoes");
    const rows = await getEmpresaAdministradorasForSuperadmin(EMPRESA_B_ID);
    expect(rows).toHaveLength(0);
  });

  it("nega grant de administradora global INATIVA", async () => {
    createClient.mockResolvedValue({
      from: (table: string) => {
        if (table === "empresas") {
          return chainable({ data: { id: EMPRESA_B_ID }, error: null });
        }
        if (table === "administradoras") {
          return chainable({
            data: {
              id: RACON_ADMINISTRADORA_ID,
              status: "INATIVA",
              slug: RACON_SLUG,
              nome: "Racon",
            },
            error: null,
          });
        }
        return chainable({ data: null, error: null });
      },
    });
    const { grantAdministradoraToEmpresa } = await import("./concessoes");
    await expect(
      grantAdministradoraToEmpresa({
        empresaId: EMPRESA_B_ID,
        administradoraId: RACON_ADMINISTRADORA_ID,
      }),
    ).rejects.toThrow(/INATIVA/i);
  });

  it("duplicate Gauchinho/Racon → mensagem amigável", async () => {
    createClient.mockResolvedValue({
      from: (table: string) => {
        if (table === "empresas") {
          return chainable({ data: { id: GAUCHINHO_EMPRESA_ID }, error: null });
        }
        if (table === "administradoras") {
          return chainable({
            data: {
              id: RACON_ADMINISTRADORA_ID,
              status: "ATIVA",
              slug: RACON_SLUG,
              nome: "Racon",
            },
            error: null,
          });
        }
        if (table === "empresa_administradoras") {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: null,
                  error: {
                    message:
                      "duplicate key value violates unique constraint empresa_administradoras_empresa_admin_uidx",
                  },
                }),
              }),
            }),
          };
        }
        return chainable({ data: null, error: null });
      },
    });
    const { grantAdministradoraToEmpresa } = await import("./concessoes");
    await expect(
      grantAdministradoraToEmpresa({
        empresaId: GAUCHINHO_EMPRESA_ID,
        administradoraId: RACON_ADMINISTRADORA_ID,
      }),
    ).rejects.toThrow(/já está vinculada/i);
  });

  it("status ATIVA → SUSPENSA com auditoria", async () => {
    const before = {
      id: "vinculo-1",
      empresa_id: GAUCHINHO_EMPRESA_ID,
      administradora_id: RACON_ADMINISTRADORA_ID,
      status: "ATIVA",
      codigo_franquia: null,
      codigo_comercial: null,
      contato_interno: null,
      observacoes: null,
      configuracoes: {},
      created_at: "",
      updated_at: "",
    };
    createClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: before, error: null }),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({
                data: { ...before, status: "SUSPENSA" },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    const { setEmpresaAdministradoraStatus } = await import("./concessoes");
    const after = await setEmpresaAdministradoraStatus("vinculo-1", "SUSPENSA");
    expect(after.status).toBe("SUSPENSA");
    expect(writeAdministradorasAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EMPRESA_ADMINISTRADORA_STATUS_ALTERADO",
        privileged: true,
      }),
    );
  });

  it("status SUSPENSA → ATIVA permitido quando global ATIVA", async () => {
    const before = {
      id: "vinculo-1",
      empresa_id: GAUCHINHO_EMPRESA_ID,
      administradora_id: RACON_ADMINISTRADORA_ID,
      status: "SUSPENSA",
      codigo_franquia: null,
      codigo_comercial: null,
      contato_interno: null,
      observacoes: null,
      configuracoes: {},
      created_at: "",
      updated_at: "",
    };
    createClient.mockResolvedValue({
      from: (table: string) => {
        if (table === "administradoras") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: RACON_ADMINISTRADORA_ID, status: "ATIVA" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: before, error: null }),
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({
                  data: { ...before, status: "ATIVA" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      },
    });
    const { setEmpresaAdministradoraStatus } = await import("./concessoes");
    const after = await setEmpresaAdministradoraStatus("vinculo-1", "ATIVA");
    expect(after.status).toBe("ATIVA");
  });

  it("não ativa vínculo se administradora global INATIVA", async () => {
    const before = {
      id: "vinculo-1",
      empresa_id: GAUCHINHO_EMPRESA_ID,
      administradora_id: RACON_ADMINISTRADORA_ID,
      status: "SUSPENSA",
      codigo_franquia: null,
      codigo_comercial: null,
      contato_interno: null,
      observacoes: null,
      configuracoes: {},
      created_at: "",
      updated_at: "",
    };
    createClient.mockResolvedValue({
      from: (table: string) => {
        if (table === "administradoras") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: RACON_ADMINISTRADORA_ID, status: "INATIVA" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: before, error: null }),
            }),
          }),
        };
      },
    });
    const { setEmpresaAdministradoraStatus } = await import("./concessoes");
    await expect(setEmpresaAdministradoraStatus("vinculo-1", "ATIVA")).rejects.toThrow(
      /global estiver INATIVA/i,
    );
  });

  it("candidatas excluem já vinculadas e só ATIVAS", async () => {
    createClient.mockResolvedValue({
      from: (table: string) => {
        if (table === "administradoras") {
          return chainable({
            data: [
              {
                id: RACON_ADMINISTRADORA_ID,
                nome: "Racon",
                slug: "racon",
                status: "ATIVA",
              },
              { id: "other-ativa", nome: "Outra", slug: "outra", status: "ATIVA" },
            ],
            error: null,
          });
        }
        if (table === "empresa_administradoras") {
          return chainable({
            data: [{ administradora_id: RACON_ADMINISTRADORA_ID }],
            error: null,
          });
        }
        return chainable({ data: null, error: null });
      },
    });
    const { listAdministradorasCandidatasParaEmpresa } = await import("./concessoes");
    const candidatas = await listAdministradorasCandidatasParaEmpresa(GAUCHINHO_EMPRESA_ID);
    expect(candidatas.map((c) => c.slug)).toEqual(["outra"]);
  });
});

describe("concessoes — confidencialidade / terminologia", () => {
  it("IDs canônicos não misturam Racon com tenants", () => {
    expect(RACON_ADMINISTRADORA_ID).not.toBe(GAUCHINHO_EMPRESA_ID);
    expect(RACON_ADMINISTRADORA_ID).not.toBe(EMPRESA_B_ID);
  });
});
