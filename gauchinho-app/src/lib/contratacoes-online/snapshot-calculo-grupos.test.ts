import { describe, expect, it } from "vitest";
import type { GrupoConsorcio, GrupoCota } from "@/lib/types";
import {
  assertSnapshotCalculoGruposIntegro,
  canonicalizarDadosSimulacaoGruposComCatalogo,
} from "./snapshot-calculo-grupos";

const grupo: GrupoConsorcio = {
  id: "grupo-1",
  codigo_grupo: "1453",
  modalidade: "Imóvel",
  administradora: "Racon",
  administradora_id: "admin-1",
  taxa_administrativa_percentual: 25,
  fundo_reserva_percentual: 2,
  seguro_habilitado: true,
  seguro_percentual: 0.04,
  seguro_valor: null,
  tem_parcela_reduzida: true,
  percentual_parcela_reduzida: 60,
  permite_parcela_reduzida_personalizada: true,
  percentual_parcela_reduzida_personalizada: 45,
  permite_lance_embutido: true,
  percentual_lance_embutido: 25,
  percentual_recurso_proprio_sugerido: 0,
  prazo_total: 200,
  parcelas_realizadas: 15,
  prazo_restante: 185,
  seguro_pos_contemplacao: true,
  cet_percentual: null,
  status: "Disponível",
  ativo: true,
  observacoes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-08-26T00:00:00.000Z",
};

const cota: GrupoCota = {
  id: "cota-1",
  grupo_id: grupo.id,
  valor_credito: 127_200,
  valor_parcela: 484.63,
  parcela_integral: null,
  parcela_reduzida: null,
  parcela_com_seguro: null,
  parcela_sem_seguro: null,
  saldo_devedor: null,
  vagas_percentual: null,
  vagas_texto: null,
  status: "Disponível",
  ativo: true,
  ordem: 1,
};

const catalogo = {
  grupos: new Map([[grupo.id, grupo]]),
  cotas: new Map([[cota.id, cota]]),
  modalidades: new Map([[grupo.id, []]]),
};

describe("snapshot comercial de grupos", () => {
  it("recalcula no servidor com o mesmo motor do site e assina os valores aceitos", () => {
    const dados = canonicalizarDadosSimulacaoGruposComCatalogo(
      {
        selecoes: [{
          grupoId: grupo.id,
          cotaId: cota.id,
          config: {
            cotaId: cota.id,
            quantidadeCotas: 1,
            modalidadeParcela: "integral",
            percentualParcelaPersonalizada: 45,
            usaLanceEmbutido: false,
            modalidadeLanceId: null,
            usaRecursoProprio: false,
            recursoProprioModo: "percentual",
            recursoProprioInput: 0,
            usaSeguro: true,
          },
          resultado: { primeiraParcela: 0.01, somaCotas: 1 },
        }],
      },
      catalogo,
      new Date("2026-08-26T12:00:00.000Z"),
    );

    expect(dados.valor_credito).toBe(127_200);
    expect(Number(dados.valor_parcela)).toBeGreaterThan(0.01);
    expect(dados.snapshot_calculo.origem).toBe("SITE");
    expect(dados.snapshot_calculo.hash_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(() => assertSnapshotCalculoGruposIntegro(dados)).not.toThrow();
  });

  it("bloqueia alteração posterior do valor aceito", () => {
    const dados = canonicalizarDadosSimulacaoGruposComCatalogo(
      {
        selecoes: [{
          grupoId: grupo.id,
          cotaId: cota.id,
          config: { quantidadeCotas: 1, modalidadeParcela: "reduzida" },
        }],
      },
      catalogo,
    );

    expect(() => assertSnapshotCalculoGruposIntegro({ ...dados, valor_parcela: 1 })).toThrow(
      "valores aceitos",
    );
  });

  it("mantém compatibilidade de leitura com contratações legadas sem assinatura", () => {
    expect(() => assertSnapshotCalculoGruposIntegro({ valor_parcela: 1000 })).not.toThrow();
  });
});
