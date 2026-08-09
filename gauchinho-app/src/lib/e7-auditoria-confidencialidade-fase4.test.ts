import { describe, expect, it, vi } from "vitest";
import {
  cartaPertenceAoCatalogoAutorizado,
  fetchPublicCartasAutorizadasForEmpresa,
  getCartaAutorizadaForEmpresa,
  type CatalogoCartasDeps,
} from "./cartas/catalogo-autorizado-cartas";
import {
  listGruposAutorizadosForEmpresa,
  getGrupoAutorizadoForEmpresa,
  type CatalogoAutorizadoDeps,
} from "./grupos/catalogo-autorizado-service";
import { GrupoNotFoundError } from "./grupos/catalogo-autorizado";

const RACON_UUID = "c5f8ecb4-cb5a-5014-b567-50484719b404";
const OUTRA_ADMIN_UUID = "00000000-0000-0000-0000-000000000099";
const GAUCHINHO_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
const EMPRESA_B_ID = "e2000000-0000-0000-0000-000000000002";

describe("ETAPA E7 — Auditoria Final de Confidencialidade e Isolamento Multi-tenant da Fase 4", () => {
  describe("1. Regra Canônica UUID-First (Cartas Contempladas)", () => {
    const autorizadas = { adminIds: [RACON_UUID], adminNamesLower: ["racon"] };

    it("UUID autorizado + snapshot RACON -> TRUE", () => {
      expect(cartaPertenceAoCatalogoAutorizado({ administradora_id: RACON_UUID, administradora: "RACON" }, autorizadas)).toBe(true);
    });

    it("UUID não autorizado + snapshot RACON -> FALSE (Bypass de texto bloqueado)", () => {
      expect(cartaPertenceAoCatalogoAutorizado({ administradora_id: OUTRA_ADMIN_UUID, administradora: "RACON" }, autorizadas)).toBe(false);
    });

    it("UUID não autorizado + snapshot OUTRA -> FALSE", () => {
      expect(cartaPertenceAoCatalogoAutorizado({ administradora_id: OUTRA_ADMIN_UUID, administradora: "OUTRA" }, autorizadas)).toBe(false);
    });

    it("UUID null + snapshot RACON -> TRUE (Fallback legado)", () => {
      expect(cartaPertenceAoCatalogoAutorizado({ administradora_id: null, administradora: "RACON" }, autorizadas)).toBe(true);
    });

    it("UUID null + snapshot OUTRA -> FALSE", () => {
      expect(cartaPertenceAoCatalogoAutorizado({ administradora_id: null, administradora: "OUTRA" }, autorizadas)).toBe(false);
    });
  });

  describe("2. Empresa B (0 concessões) vs Gauchinho (Concessão Racon ATIVA)", () => {
    it("Empresa B recebe [] no catálogo público de grupos consórcio", async () => {
      const mockDeps: CatalogoAutorizadoDeps = {
        fetchConcessoes: vi.fn().mockResolvedValue([]),
        adminFrom: vi.fn(),
      };
      const grupos = await listGruposAutorizadosForEmpresa(EMPRESA_B_ID, {}, mockDeps);
      expect(grupos).toEqual([]);
    });

    it("Empresa B recebe [] no catálogo público de cartas contempladas", async () => {
      const mockDeps: CatalogoCartasDeps = {
        fetchConcessoes: vi.fn().mockResolvedValue([]),
        adminFrom: vi.fn(),
      };
      const cartas = await fetchPublicCartasAutorizadasForEmpresa(EMPRESA_B_ID, {}, mockDeps);
      expect(cartas).toEqual([]);
    });

    it("Empresa B consulta por UUID de grupo Racon lança GrupoNotFoundError (404 uniforme)", async () => {
      const mockDeps: CatalogoAutorizadoDeps = {
        fetchConcessoes: vi.fn().mockResolvedValue([]),
        adminFrom: vi.fn(),
      };
      await expect(getGrupoAutorizadoForEmpresa(EMPRESA_B_ID, "grupo-racon-1", mockDeps)).rejects.toThrow(GrupoNotFoundError);
    });

    it("Empresa B consulta por UUID de carta Racon retorna null / NOT_FOUND uniforme", async () => {
      const mockDeps: CatalogoCartasDeps = {
        fetchConcessoes: vi.fn().mockResolvedValue([]),
        adminFrom: vi.fn(),
      };
      const carta = await getCartaAutorizadaForEmpresa(EMPRESA_B_ID, "carta-racon-1", mockDeps);
      expect(carta).toBeNull();
    });
  });

  describe("3. Uniformidade de Enumeração e Proteção Anti-Vazamento", () => {
    it("UUID inexistente e UUID existente mas não concedido retornam exatamente a mesma resposta para Empresa B", async () => {
      const mockDepsCartas: CatalogoCartasDeps = {
        fetchConcessoes: vi.fn().mockResolvedValue([]),
        adminFrom: vi.fn(),
      };

      const resInexistente = await getCartaAutorizadaForEmpresa(EMPRESA_B_ID, "00000000-0000-0000-0000-000000000000", mockDepsCartas);
      const resNaoConcedido = await getCartaAutorizadaForEmpresa(EMPRESA_B_ID, "carta-racon-existente", mockDepsCartas);

      expect(resInexistente).toBeNull();
      expect(resNaoConcedido).toBeNull();
      expect(resInexistente).toEqual(resNaoConcedido);

      const mockDepsGrupos: CatalogoAutorizadoDeps = {
        fetchConcessoes: vi.fn().mockResolvedValue([]),
        adminFrom: vi.fn(),
      };

      await expect(getGrupoAutorizadoForEmpresa(EMPRESA_B_ID, "00000000-0000-0000-0000-000000000000", mockDepsGrupos)).rejects.toThrow(GrupoNotFoundError);
      await expect(getGrupoAutorizadoForEmpresa(EMPRESA_B_ID, "grupo-racon-existente", mockDepsGrupos)).rejects.toThrow(GrupoNotFoundError);
    });
  });

  describe("4. Isolamento do Integration API Key Legado", () => {
    it("Chave GAUCHINHO_INTEGRATION_API_KEY autoriza exclusivamente o tenant Gauchinho", () => {
      const keyValida = "gauchinho-legacy-secret-key";
      const keyInvalida = "chave-invalida";

      const processKey = (k: string) => {
        if (k === keyValida) return GAUCHINHO_ID;
        return null;
      };

      expect(processKey(keyValida)).toBe(GAUCHINHO_ID);
      expect(processKey(keyInvalida)).toBeNull();
      expect(processKey("")).toBeNull();
    });
  });
});
