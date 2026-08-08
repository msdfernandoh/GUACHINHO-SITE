import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPRESA_B_ID,
  GAUCHINHO_EMPRESA_ID,
  RACON_ADMINISTRADORA_ID,
  RACON_SLUG,
} from "./constants";
import {
  mapAdministradoraDbUniqueError,
  validateAdministradoraWriteInput,
} from "./rules";

const requireGerenciarCatalogoAdministradoras = vi.fn();
const createClient = vi.fn();
const createAdminClient = vi.fn();
const getUsuarioNegocio = vi.fn();
const writeAdministradorasAuditLog = vi.fn();

vi.mock("./authorization", () => ({
  requireGerenciarCatalogoAdministradoras: () => requireGerenciarCatalogoAdministradoras(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClient(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClient(),
}));

vi.mock("@/lib/auth/get-usuario", () => ({
  getUsuarioNegocio: () => getUsuarioNegocio(),
}));

vi.mock("./audit", () => ({
  writeAdministradorasAuditLog: (input: unknown) => writeAdministradorasAuditLog(input),
  AUDIT_ACTIONS_ADMINISTRADORAS: {
    criada: "ADMINISTRADORA_GLOBAL_CRIADA",
    editada: "ADMINISTRADORA_GLOBAL_ATUALIZADA",
    statusAlterado: "ADMINISTRADORA_GLOBAL_STATUS_ALTERADO",
  },
}));

describe("validateAdministradoraWriteInput", () => {
  it("rejeita slug vazio sem fallback do nome", () => {
    const r = validateAdministradoraWriteInput(
      { nome: "X", slug: "   " },
      { requireSlugFromNomeFallback: false },
    );
    expect(r.ok).toBe(false);
  });

  it("normaliza slug a partir do nome", () => {
    const r = validateAdministradoraWriteInput({ nome: "Nova Admin", slug: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.slug).toBe("nova-admin");
  });

  it("rejeita status inválido", () => {
    const r = validateAdministradoraWriteInput({ nome: "X", slug: "x", status: "BLOQUEADA" });
    expect(r.ok).toBe(false);
  });

  it("rejeita CNPJ inválido quando informado", () => {
    const r = validateAdministradoraWriteInput({
      nome: "X",
      slug: "x",
      cnpj: "123",
    });
    expect(r.ok).toBe(false);
  });

  it("rejeita secrets em recursos_integracao", () => {
    const r = validateAdministradoraWriteInput({
      nome: "X",
      slug: "x",
      recursos_integracao: { api_key: "secret" },
    });
    expect(r.ok).toBe(false);
  });
});

describe("mapAdministradoraDbUniqueError", () => {
  it("mapeia slug e cnpj", () => {
    expect(mapAdministradoraDbUniqueError("duplicate key administradoras_slug_uidx")).toMatch(
      /slug/i,
    );
    expect(mapAdministradoraDbUniqueError("duplicate key administradoras_cnpj_uidx")).toMatch(
      /CNPJ/i,
    );
  });
});

describe("mutations — autorização e CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsuarioNegocio.mockResolvedValue({ id: "user-1" });
    writeAdministradorasAuditLog.mockResolvedValue({ ok: true });
  });

  it("nega create sem Superadmin", async () => {
    requireGerenciarCatalogoAdministradoras.mockRejectedValue(
      new Error("Sem permissão para gerenciar o catálogo global de administradoras."),
    );
    const { createAdministradoraGlobal } = await import("./mutations");
    await expect(createAdministradoraGlobal({ nome: "X", slug: "x" })).rejects.toThrow(
      /catálogo global/i,
    );
  });

  it("cria administradora e audita", async () => {
    requireGerenciarCatalogoAdministradoras.mockResolvedValue(undefined);
    const insert = vi.fn(async () => ({
      data: {
        id: "new-id",
        nome: "Nova",
        nome_fantasia: null,
        razao_social: null,
        cnpj: null,
        slug: "nova",
        logo_url: null,
        site_url: null,
        status: "ATIVA",
        recursos_integracao: {},
        metadata: {},
        created_at: "",
        updated_at: "",
      },
      error: null,
    }));
    createClient.mockResolvedValue({
      from: () => ({
        insert: (payload: unknown) => ({
          select: () => ({
            single: async () => insert(payload),
          }),
        }),
      }),
    });

    const { createAdministradoraGlobal } = await import("./mutations");
    const created = await createAdministradoraGlobal({ nome: "Nova", slug: "nova" });
    expect(created.slug).toBe("nova");
    expect(writeAdministradorasAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMINISTRADORA_GLOBAL_CRIADA",
        privileged: true,
      }),
    );
  });

  it("slug duplicado → mensagem amigável", async () => {
    requireGerenciarCatalogoAdministradoras.mockResolvedValue(undefined);
    createClient.mockResolvedValue({
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: null,
              error: { message: "duplicate key value violates unique constraint administradoras_slug_uidx" },
            }),
          }),
        }),
      }),
    });
    const { createAdministradoraGlobal } = await import("./mutations");
    await expect(createAdministradoraGlobal({ nome: "Dup", slug: "racon" })).rejects.toThrow(
      /slug/i,
    );
  });

  it("update inexistente → NOT_FOUND", async () => {
    requireGerenciarCatalogoAdministradoras.mockResolvedValue(undefined);
    createClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    });
    const { updateAdministradoraGlobal } = await import("./mutations");
    await expect(
      updateAdministradoraGlobal("00000000-0000-0000-0000-000000000099", {
        nome: "X",
        slug: "x",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("setStatus inativa com auditoria", async () => {
    requireGerenciarCatalogoAdministradoras.mockResolvedValue(undefined);
    const racon = {
      id: RACON_ADMINISTRADORA_ID,
      nome: "Racon",
      nome_fantasia: "Racon",
      razao_social: null,
      cnpj: null,
      slug: RACON_SLUG,
      logo_url: null,
      site_url: null,
      status: "ATIVA",
      recursos_integracao: {},
      metadata: {},
      created_at: "",
      updated_at: "",
    };
    createClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: racon, error: null }),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => ({
                data: { ...racon, status: "INATIVA" },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    const { setAdministradoraGlobalStatus } = await import("./mutations");
    const after = await setAdministradoraGlobalStatus(RACON_ADMINISTRADORA_ID, "INATIVA");
    expect(after.status).toBe("INATIVA");
    expect(writeAdministradorasAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMINISTRADORA_GLOBAL_STATUS_ALTERADO",
      }),
    );
  });
});

describe("terminologia — IDs canônicos", () => {
  it("Racon é administradora; Gauchinho e Empresa B são empresas distintas", () => {
    expect(RACON_ADMINISTRADORA_ID).not.toBe(GAUCHINHO_EMPRESA_ID);
    expect(RACON_ADMINISTRADORA_ID).not.toBe(EMPRESA_B_ID);
    expect(GAUCHINHO_EMPRESA_ID).not.toBe(EMPRESA_B_ID);
  });
});
