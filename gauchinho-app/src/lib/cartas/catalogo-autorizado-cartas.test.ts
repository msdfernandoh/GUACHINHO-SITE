import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchPublicCartasAutorizadasForEmpresa,
  getCartaAutorizadaForEmpresa,
  assertEmpresaPodeAcessarCarta,
  fetchAuthorizedAdministradoraIdsForEmpresa,
} from "./catalogo-autorizado-cartas";
import * as concessoesModule from "@/lib/administradoras/concessoes";

vi.mock("@/lib/administradoras/concessoes", () => ({
  fetchConcessoesAtivasDaEmpresa: vi.fn(),
}));

const RACON_UUID = "c5f8ecb4-cb5a-5014-b567-50484719b404";
const GAUCHINHO_EMPRESA_ID = "e1000000-0000-0000-0000-000000000001";
const EMPRESA_B_ID = "e2000000-0000-0000-0000-000000000002";
const CARTA_RACON_ID = "a55a2915-9b30-43f0-8ecc-e723a616b61b";

describe("Confidencialidade de Cartas Contempladas por Concessão (Etapa 050)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Gauchinho com concessão Racon ativa autoriza administradora Racon", async () => {
    vi.mocked(concessoesModule.fetchConcessoesAtivasDaEmpresa).mockResolvedValueOnce([
      {
        id: "conc-1",
        empresa_id: GAUCHINHO_EMPRESA_ID,
        administradora_id: RACON_UUID,
        status: "ativa",
        administradora: {
          id: RACON_UUID,
          nome: "Racon",
          razao_social: "Racon Consórcios",
          ativo: true,
        },
      } as any,
    ]);

    const res = await fetchAuthorizedAdministradoraIdsForEmpresa(GAUCHINHO_EMPRESA_ID);
    expect(res.adminIds).toContain(RACON_UUID);
    expect(res.adminNamesLower).toContain("racon");
  });

  it("Empresa B com 0 concessões não autoriza nenhuma administradora", async () => {
    vi.mocked(concessoesModule.fetchConcessoesAtivasDaEmpresa).mockResolvedValueOnce([]);

    const res = await fetchAuthorizedAdministradoraIdsForEmpresa(EMPRESA_B_ID);
    expect(res.adminIds).toHaveLength(0);
    expect(res.adminNamesLower).toHaveLength(0);
  });

  it("fetchPublicCartasAutorizadasForEmpresa retorna lista vazia imediatamente para Empresa B", async () => {
    vi.mocked(concessoesModule.fetchConcessoesAtivasDaEmpresa).mockResolvedValueOnce([]);

    const cartas = await fetchPublicCartasAutorizadasForEmpresa(EMPRESA_B_ID);
    expect(cartas).toEqual([]);
  });

  it("getCartaAutorizadaForEmpresa retorna null (404 uniforme) para Empresa B tentando acessar carta Racon por UUID", async () => {
    vi.mocked(concessoesModule.fetchConcessoesAtivasDaEmpresa).mockResolvedValueOnce([]);

    const carta = await getCartaAutorizadaForEmpresa(EMPRESA_B_ID, CARTA_RACON_ID);
    expect(carta).toBeNull();
  });

  it("assertEmpresaPodeAcessarCarta lança erro 'Carta contemplada não encontrada' se não autorizada", async () => {
    vi.mocked(concessoesModule.fetchConcessoesAtivasDaEmpresa).mockResolvedValueOnce([]);

    await expect(assertEmpresaPodeAcessarCarta(EMPRESA_B_ID, CARTA_RACON_ID)).rejects.toThrow(
      "Carta contemplada não encontrada"
    );
  });

  it("concessão SUSPENSA ou INATIVA não libera cartas contempladas", async () => {
    vi.mocked(concessoesModule.fetchConcessoesAtivasDaEmpresa).mockResolvedValueOnce([]);

    const cartas = await fetchPublicCartasAutorizadasForEmpresa(GAUCHINHO_EMPRESA_ID);
    expect(cartas).toEqual([]);
  });
});
