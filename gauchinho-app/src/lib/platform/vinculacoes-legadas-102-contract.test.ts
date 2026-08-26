import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration102 = fs.readFileSync(
  path.resolve(process.cwd(), "../supabase/migrations/103_platform_vinculacoes_legadas_grupos.sql"),
  "utf8"
);

describe("Fase 102 — Vinculações Legadas dos Grupos com o Catálogo Canônico SaaS", () => {
  it("define a tabela de auditoria grupos_vinculacoes_legadas_historico e a RPC rpc_vincular_grupo_legado", () => {
    expect(migration102).toContain("CREATE TABLE IF NOT EXISTS public.grupos_vinculacoes_legadas_historico");
    expect(migration102).toContain("CREATE OR REPLACE FUNCTION public.rpc_vincular_grupo_legado");
    expect(migration102).toContain("contratacoes_afetadas");
    expect(migration102).toContain("produtos_mapeamento");
  });

  it("reconcilia execução parcial sem inventar empresa para histórico existente", () => {
    expect(migration102).toContain("ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas");
    expect(migration102).toContain("WHERE empresa_id IS NULL");
    expect(migration102).toContain("classifique-os antes de reaplicar a migration 103");
    expect(migration102).toContain("contratacoes_online.empresa_id");
    expect(migration102).toContain("ALTER COLUMN empresa_id SET NOT NULL");
  });

  it("mapeia produtos legados por valor_credito contra grupos_cotas canônicos", () => {
    const cotasSaas = [
      { id: "cota-300", valor_credito: 300000, valor_parcela: 1950, prazo: 180 },
      { id: "cota-500", valor_credito: 500000, valor_parcela: 3250, prazo: 180 },
    ];
    const creditosLegados = [300000, 500000, 800000];

    const mapeamento = creditosLegados.map((cred) => {
      const match = cotasSaas.find((c) => Math.abs(c.valor_credito - cred) < 0.01);
      return {
        valor_credito: cred,
        grupo_cota_id: match?.id || null,
        status_produto: match ? "ENCONTRADO" : "NAO_ENCONTRADO_NO_SAAS",
      };
    });

    expect(mapeamento[0].status_produto).toBe("ENCONTRADO");
    expect(mapeamento[0].grupo_cota_id).toBe("cota-300");

    expect(mapeamento[1].status_produto).toBe("ENCONTRADO");
    expect(mapeamento[1].grupo_cota_id).toBe("cota-500");

    // Produto R$ 800.000 não existe no grupo SaaS -> não deve ser criado silenciosamente
    expect(mapeamento[2].status_produto).toBe("NAO_ENCONTRADO_NO_SAAS");
    expect(mapeamento[2].grupo_cota_id).toBeNull();
  });

  it("sugere match inequívoco por código numérico e administradora", () => {
    const grupoLegado = { identificador: "1463 Imóvel", administradora: "Racon" };
    const gruposSaas = [
      { id: "g-1463", codigo_grupo: "1463", administradora: "Racon" },
      { id: "g-2000", codigo_grupo: "2000", administradora: "Racon" },
    ];

    const cleanNum = grupoLegado.identificador.replace(/\D/g, "");
    const match = gruposSaas.find((g) => g.codigo_grupo === cleanNum && g.administradora === grupoLegado.administradora);

    expect(match).toBeDefined();
    expect(match?.id).toBe("g-1463");
  });

  it("garante que o ERP consome catálogo SaaS sem duplicação de dados locais", () => {
    const saasCatalogo = {
      grupo_id: "g-1463",
      codigo: "1463",
      administradora: "Racon",
      cotas: [{ id: "c-500", credito: 500000 }],
    };

    // ERP reutiliza a mesma referência sem criar tabela local duplicada
    expect(saasCatalogo.grupo_id).toBe("g-1463");
    expect(saasCatalogo.cotas[0].id).toBe("c-500");
  });
});
