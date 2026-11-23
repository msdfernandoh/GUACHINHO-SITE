import { describe, expect, it } from "vitest";
import { calcularLinhaSimulacaoGrupo, type ConfigLinhaSimulacaoGrupo } from "./simulacao-linha";
import type { GrupoConsorcio, GrupoCota, GrupoModalidadeLance } from "@/lib/types";

// Grupo 1253: flag do grupo sem parcela reduzida, mas a cota tem as parcelas reduzidas cadastradas.
// A tela pública mostrava a reduzida e a proposta/PDF (servidor) saía com a integral.
const grupo = {
  id: "g1253", codigo_grupo: "1253", modalidade: "Imóvel", taxa_administrativa_percentual: 20,
  fundo_reserva_percentual: 2, seguro_habilitado: true, seguro_percentual: 0.04, tem_parcela_reduzida: false,
  percentual_parcela_reduzida: null, permite_lance_embutido: true, percentual_lance_embutido: 25.1,
  prazo_total: 180, parcelas_realizadas: 94, prazo_restante: 86, seguro_pos_contemplacao: true,
  ativo: true, permite_parcela_reduzida_personalizada: false, percentuais_parcela_reduzida: null,
} as unknown as GrupoConsorcio;
const cota = {
  id: "c1", grupo_id: "g1253", valor_credito: 507677.68, valor_parcela: 3441.04, parcela_integral: 3441.04,
  parcela_reduzida: 2064.62, parcela_reduzida_50: 1720.52, parcela_reduzida_60: 2064.62, parcela_reduzida_70: null,
  parcelas_reduzidas: { "50": 1720.52, "60": 2064.62 }, tipo_transcorrido: "PRORROGADA", valor_transcorrido: 323457.76, ativo: true,
} as unknown as GrupoCota;
const mods = [{
  id: "m1", grupo_id: "g1253", nome: "Lance Fixo 25%", percentual_lance_embutido: 25, percentual_recurso_proprio_minimo: 0,
  ativo: true, ordem: 0, tipo_parcela: null, percentual_parcela_reduzida: null, base_referencia: "CREDITO",
}] as unknown as GrupoModalidadeLance[];
const config: ConfigLinhaSimulacaoGrupo = {
  cotaId: "c1", quantidadeCotas: 3, usaSeguro: false, tipoTranscorrido: "PRORROGADA", usaLanceEmbutido: true,
  modalidadeLanceId: "m1", modalidadeParcela: "reduzida", usaRecursoProprio: false, recursoProprioModo: "percentual",
  recursoProprioInput: 0, percentualParcelaReduzida: 60, percentualParcelaPersonalizada: null,
};

describe("parcela reduzida cadastrada só na cota", () => {
  it("usa a reduzida escolhida mesmo com a flag do grupo desligada", () => {
    const r = calcularLinhaSimulacaoGrupo({ grupo, cota, config, modalidades: mods });
    expect(r.primeiraParcela).toBeCloseTo(3 * 2064.62, 2);
  });
});
