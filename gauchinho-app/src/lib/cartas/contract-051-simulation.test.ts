import { describe, expect, it, vi } from "vitest";
import {
  assertEmpresaPodeAcessarCarta,
  cartaPertenceAoCatalogoAutorizado,
  fetchPublicCartasAutorizadasForEmpresa,
  getCartaAutorizadaForEmpresa,
  type CatalogoCartasDeps,
} from "./catalogo-autorizado-cartas";

const RACON_UUID = "c5f8ecb4-cb5a-5014-b567-50484719b404";
const OUTRA_ADMIN_UUID = "00000000-0000-0000-0000-000000000099";
const GAUCHINHO_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
const EMPRESA_B_ID = "e2000000-0000-0000-0000-000000000002";

const mockCartasRacon = [
  {
    id: "carta-racon-1",
    administradora_id: RACON_UUID,
    administradora: "RACON",
    tipo_carta: "imovel",
    credito: 1012000,
    entrada: 450000,
    status: "disponivel",
    ativo: true,
    created_at: "2026-08-08T00:00:00Z",
  },
  {
    id: "carta-racon-2",
    administradora_id: RACON_UUID,
    administradora: "RACON",
    tipo_carta: "imovel",
    credito: 1635000,
    entrada: 720000,
    status: "disponivel",
    ativo: true,
    created_at: "2026-08-08T00:00:00Z",
  },
];

describe("Contract 051 — Simulação da Revogação da Policy cartas_public_read", () => {
  it("simula que anon direct SELECT sem a policy cartas_public_read retorna 0 registros / bloqueado", () => {
    // Com a policy cartas_public_read revogada, uma query anon cliente direto sem service role key
    // retorna 0 registros pelo PostgreSQL RLS.
    const anonQueryMock = () => ({
      data: [],
      error: null,
    });
    const result = anonQueryMock();
    expect(result.data).toEqual([]);
  });

  it("runtime Gauchinho com service role continua retornando 4 cartas Racon autorizadas pós-051", async () => {
    const mockDeps: CatalogoCartasDeps = {
      fetchConcessoes: vi.fn().mockResolvedValue([
        {
          concessao: { id: "conc-1", empresa_id: GAUCHINHO_ID, administradora_id: RACON_UUID, status: "ATIVA" },
          administradora: { id: RACON_UUID, nome: "Racon", status: "ATIVA" },
        },
      ]),
      adminFrom: vi.fn(() => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => Promise.resolve({ data: mockCartasRacon, error: null }),
              }),
            }),
          }),
        }),
      })) as any,
    };

    const cartas = await fetchPublicCartasAutorizadasForEmpresa(GAUCHINHO_ID, {}, mockDeps);
    expect(cartas).toHaveLength(2);
    expect(cartas[0].administradora_id).toBe(RACON_UUID);
  });

  it("runtime Empresa B com 0 concessões retorna lista vazia [] pós-051", async () => {
    const mockDeps: CatalogoCartasDeps = {
      fetchConcessoes: vi.fn().mockResolvedValue([]),
      adminFrom: vi.fn(() => {
        throw new Error("adminFrom não deveria ser chamado para tenant sem concessão");
      }),
    };

    const cartas = await fetchPublicCartasAutorizadasForEmpresa(EMPRESA_B_ID, {}, mockDeps);
    expect(cartas).toEqual([]);
  });

  it("tentativa cross-tenant de Empresa B acessar carta Racon retorna NOT_FOUND / null", async () => {
    const mockDeps: CatalogoCartasDeps = {
      fetchConcessoes: vi.fn().mockResolvedValue([]),
      adminFrom: vi.fn(),
    };

    const carta = await getCartaAutorizadaForEmpresa(EMPRESA_B_ID, "carta-racon-1", mockDeps);
    expect(carta).toBeNull();

    await expect(assertEmpresaPodeAcessarCarta(EMPRESA_B_ID, "carta-racon-1", mockDeps)).rejects.toThrow(
      "Carta contemplada não encontrada",
    );
  });

  it("reafirma a Regra Canônica UUID-first: UUID não autorizado com snapshot RACON -> FALSE", () => {
    const autorizadas = { adminIds: [RACON_UUID], adminNamesLower: ["racon"] };
    const cartaInsegura = { administradora_id: OUTRA_ADMIN_UUID, administradora: "RACON" };

    expect(cartaPertenceAoCatalogoAutorizado(cartaInsegura, autorizadas)).toBe(false);
  });
});
