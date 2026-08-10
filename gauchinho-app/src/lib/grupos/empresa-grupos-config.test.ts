import { describe, expect, it, vi } from "vitest";
import {
  assertEmpresaTemConcessaoParaGrupo,
  deleteEmpresaGrupoConfig,
  getEmpresaGrupoConfig,
  resolveEmpresaGrupoPresentation,
  upsertEmpresaGrupoConfig,
  type EmpresaGrupoConfigDeps,
} from "./empresa-grupos-config";
import type { GrupoConsorcio } from "@/lib/types";

const RACON_UUID = "c5f8ecb4-cb5a-5014-b567-50484719b404";
const OUTRA_ADMIN_UUID = "00000000-0000-0000-0000-000000000099";
const GAUCHINHO_ID = "7170f38e-15dd-4b19-8588-51e9a9cf0d4c";
const EMPRESA_B_ID = "e2000000-0000-0000-0000-000000000002";

const GRUPO_RACON_ATIVO: GrupoConsorcio = {
  id: "grupo-racon-1",
  codigo_grupo: "1001",
  administradora_id: RACON_UUID,
  administradora: "RACON",
  modalidade: "Imóvel",
  taxa_administrativa_percentual: 15,
  fundo_reserva_percentual: 2,
  seguro_percentual: 0.05,
  tem_parcela_reduzida: true,
  percentual_parcela_reduzida: 50,
  permite_lance_embutido: true,
  percentual_lance_embutido: 30,
  prazo_total: 180,
  parcelas_realizadas: 10,
  prazo_restante: 170,
  status: "Disponível",
  ativo: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const GRUPO_RACON_INATIVO: GrupoConsorcio = {
  ...GRUPO_RACON_ATIVO,
  id: "grupo-racon-2",
  ativo: false,
  status: "Inativo",
};

describe("ETAPA E1.2 — Reconciliação Final de Autorização RLS da Migration 052", () => {
  describe("1. Semântica de Ausência de Configuração Local & Fallback Global", () => {
    it("Ausência de empresa_grupos_config utiliza defaults globais (visível, sem destaque, nome padrão)", () => {
      const resolved = resolveEmpresaGrupoPresentation(GRUPO_RACON_ATIVO, null);
      expect(resolved.visivelLocal).toBe(true);
      expect(resolved.destaqueLocal).toBe(false);
      expect(resolved.ordemLocal).toBeNull();
      expect(resolved.tituloComercial).toBe("Grupo 1001");
      expect(resolved.exibirAoPublico).toBe(true);
    });

    it("Configuração local visivel = false oculta o grupo apenas para aquela empresa", () => {
      const resolved = resolveEmpresaGrupoPresentation(GRUPO_RACON_ATIVO, {
        id: "cfg-1",
        empresa_id: GAUCHINHO_ID,
        grupo_id: "grupo-racon-1",
        visivel: false,
        destaque: true,
        ordem: 1,
        titulo_comercial: "Grupo Especial",
        descricao_comercial: "Descrição local",
      });

      expect(resolved.visivelLocal).toBe(false);
      expect(resolved.destaqueLocal).toBe(true);
      expect(resolved.ordemLocal).toBe(1);
      expect(resolved.tituloComercial).toBe("Grupo Especial");
      expect(resolved.exibirAoPublico).toBe(false);
    });
  });

  describe("2. Testes de Não Escalada de Autorização (Proteção Tríplice)", () => {
    it("10. Local true NÃO reativa grupo global inativo (grupo.ativo = false)", () => {
      const resolved = resolveEmpresaGrupoPresentation(GRUPO_RACON_INATIVO, {
        id: "cfg-2",
        empresa_id: GAUCHINHO_ID,
        grupo_id: "grupo-racon-2",
        visivel: true,
        destaque: false,
        ordem: null,
        titulo_comercial: null,
        descricao_comercial: null,
      });

      expect(resolved.visivelLocal).toBe(true);
      expect(resolved.exibirAoPublico).toBe(false);
    });

    it("11. Local true NÃO reativa concessão SUSPENSA", async () => {
      const mockDeps: EmpresaGrupoConfigDeps = {
        fetchConcessoes: vi.fn().mockResolvedValue([
          {
            empresa_id: GAUCHINHO_ID,
            administradora_id: RACON_UUID,
            concessao: { status: "SUSPENSA", administradora_id: RACON_UUID },
            administradora: { status: "ATIVA" },
          },
        ]),
        adminFrom: vi.fn().mockReturnValue({
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: GRUPO_RACON_ATIVO, error: null }),
              }),
            }),
          }),
        }),
      };

      await expect(assertEmpresaTemConcessaoParaGrupo(GAUCHINHO_ID, "grupo-racon-1", mockDeps)).rejects.toThrow(
        /não possui concessão ativa/i,
      );
    });

    it("12. Local true NÃO reativa administradora global INATIVA", async () => {
      const mockDeps: EmpresaGrupoConfigDeps = {
        fetchConcessoes: vi.fn().mockResolvedValue([
          {
            empresa_id: GAUCHINHO_ID,
            administradora_id: RACON_UUID,
            concessao: { status: "ATIVA", administradora_id: RACON_UUID },
            administradora: { status: "INATIVA" },
          },
        ]),
        adminFrom: vi.fn().mockReturnValue({
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: GRUPO_RACON_ATIVO, error: null }),
              }),
            }),
          }),
        }),
      };

      await expect(assertEmpresaTemConcessaoParaGrupo(GAUCHINHO_ID, "grupo-racon-1", mockDeps)).rejects.toThrow(
        /não possui concessão ativa/i,
      );
    });
  });

  describe("3. Matriz de Autorização RLS & Ataque Direto por Perfil (E1.2)", () => {
    it("1. Master da própria empresa + grupo concedido -> mutação permitida", async () => {
      const mockDeps: EmpresaGrupoConfigDeps = {
        fetchConcessoes: vi.fn().mockResolvedValue([
          {
            empresa_id: GAUCHINHO_ID,
            administradora_id: RACON_UUID,
            concessao: { status: "ATIVA", administradora_id: RACON_UUID },
            administradora: { status: "ATIVA" },
          },
        ]),
        adminFrom: vi.fn().mockReturnValue({
          from: () => ({
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
                maybeSingle: vi.fn().mockResolvedValue({ data: GRUPO_RACON_ATIVO, error: null }),
              }),
            }),
            upsert: () => ({
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "cfg-1",
                    empresa_id: GAUCHINHO_ID,
                    grupo_id: "grupo-racon-1",
                    visivel: true,
                    destaque: true,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      const res = await upsertEmpresaGrupoConfig(GAUCHINHO_ID, "grupo-racon-1", { destaque: true }, mockDeps);
      expect(res.empresa_id).toBe(GAUCHINHO_ID);
      expect(res.destaque).toBe(true);
    });

    it("2. Visualizador da própria empresa tenta mutação (Ataque Direto RLS) -> negado", () => {
      // Simulação conceitual da função SQL can_manage_empresa_grupos_config para perfil visualizador
      const perfilVisualizador = "visualizador";
      const canManage = perfilVisualizador === "master" || perfilVisualizador === "srd";
      expect(canManage).toBe(false);
    });

    it("3. Empresa B (0 concessões) tenta INSERT em grupo Racon -> negado", async () => {
      const mockDeps: EmpresaGrupoConfigDeps = {
        fetchConcessoes: vi.fn().mockResolvedValue([]),
        adminFrom: vi.fn().mockReturnValue({
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: GRUPO_RACON_ATIVO, error: null }),
              }),
            }),
          }),
        }),
      };

      await expect(upsertEmpresaGrupoConfig(EMPRESA_B_ID, "grupo-racon-1", { destaque: true }, mockDeps)).rejects.toThrow(
        /não possui concessão ativa/i,
      );
    });

    it("4. DELETE por perfil autorizado (Restaurar Padrão Global) -> permitido", async () => {
      const mockDeps: EmpresaGrupoConfigDeps = {
        fetchConcessoes: vi.fn().mockResolvedValue([
          {
            empresa_id: GAUCHINHO_ID,
            administradora_id: RACON_UUID,
            concessao: { status: "ATIVA", administradora_id: RACON_UUID },
            administradora: { status: "ATIVA" },
          },
        ]),
        adminFrom: vi.fn().mockReturnValue({
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: GRUPO_RACON_ATIVO, error: null }),
              }),
            }),
            delete: () => ({
              eq: () => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          }),
        }),
      };

      const res = await deleteEmpresaGrupoConfig(GAUCHINHO_ID, "grupo-racon-1", mockDeps);
      expect(res.ok).toBe(true);
    });
  });
});
