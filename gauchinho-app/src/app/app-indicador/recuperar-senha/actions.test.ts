import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tenant: vi.fn(), from: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/tenant/get-resolved-empresa", () => ({ getResolvedTenant: mocks.tenant }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from }) }));
vi.mock("@/app/(auth)/esqueci-senha/actions", () => ({ solicitarRecuperacaoSenhaAction: mocks.send }));

function query(data: unknown) {
  const result = { data, error: null };
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tenant.mockResolvedValue({ empresaId: "empresa-1" });
  mocks.from.mockImplementation((table: string) => {
    if (table === "participantes_comerciais") return query({ id: "participante-1", usuario_id: "usuario-1", status: "ATIVO" });
    if (table === "empresa_usuarios") return query({ id: "vinculo-1" });
    if (table === "programa_indicadores") return query({ id: "indicador-1" });
    if (table === "usuarios") return query({ email: "contato@example.com", ativo: true });
    throw new Error(`Tabela inesperada: ${table}`);
  });
  mocks.send.mockResolvedValue({ ok: true, message: "E-mail enviado." });
});

describe("recuperação do app por CPF", () => {
  it("envia recuperação ao e-mail cadastrado para indicador ativo do tenant", async () => {
    const { recuperarSenhaIndicadorPorCpfAction } = await import("./actions");
    const form = new FormData();
    form.set("identificador", "123.456.789-01");
    const result = await recuperarSenhaIndicadorPorCpfAction(null, form);
    expect(result.ok).toBe(true);
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(mocks.send.mock.calls[0][1].get("email")).toBe("contato@example.com");
  });

  it("não envia link se o indicador não estiver ativo", async () => {
    mocks.from.mockImplementation((table: string) => query(table === "programa_indicadores" ? null : table === "usuarios" ? { email: "contato@example.com", ativo: true } : { id: "participante-1", usuario_id: "usuario-1", status: "ATIVO" }));
    const { recuperarSenhaIndicadorPorCpfAction } = await import("./actions");
    const form = new FormData();
    form.set("identificador", "12345678901");
    const result = await recuperarSenhaIndicadorPorCpfAction(null, form);
    expect(result.ok).toBe(true);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
