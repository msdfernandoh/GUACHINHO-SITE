import type { ConfigLinhaSimulacaoGrupo, ResultadoLinhaSimulacaoGrupo } from "@/lib/grupos/simulacao-linha";
import { calcularPrazoGrupoFromRow } from "@/lib/grupos/prazos";
import type { GrupoConsorcio, GrupoModalidadeLance } from "@/lib/types";

export type LinhaGrupoContratacao = {
  grupoId: string;
  cotaId: string;
  config: ConfigLinhaSimulacaoGrupo;
  resultado: ResultadoLinhaSimulacaoGrupo;
  grupo: GrupoConsorcio;
  modalidades?: GrupoModalidadeLance[];
};

export function buildDadosSimulacaoGrupos(
  linhas: LinhaGrupoContratacao[],
  totais: Record<string, unknown>,
) {
  return {
    selecoes: linhas.map((l) => {
      const prazo = calcularPrazoGrupoFromRow(l.grupo);
      return {
        grupoId: l.grupoId,
        cotaId: l.cotaId,
        config: l.config,
        resultado: l.resultado,
        grupo: {
          id: l.grupo.id,
          codigo_grupo: l.grupo.codigo_grupo,
          modalidade: l.grupo.modalidade,
          administradora: l.grupo.administradora,
          prazo_meses: l.grupo.prazo_total,
          prazo_total: l.grupo.prazo_total,
          parcelas_realizadas: prazo.parcelasRealizadasAtuais,
          prazo_restante: prazo.prazoRestanteAtual,
          taxa_administrativa_percentual: l.grupo.taxa_administrativa_percentual,
          data_primeira_assembleia: l.grupo.data_primeira_assembleia ?? null,
          percentual_parcela_reduzida: l.grupo.percentual_parcela_reduzida ?? null,
          regra_integralizacao_parcela_reduzida:
            l.grupo.regra_integralizacao_parcela_reduzida ?? null,
          assembleia_limite_parcela_reduzida:
            l.grupo.assembleia_limite_parcela_reduzida ?? null,
          modalidades_lance_informativas: (l.modalidades ?? []).map((modalidade) => ({
            id: modalidade.id,
            nome: modalidade.nome,
            percentual_lance_embutido: modalidade.percentual_lance_embutido,
            percentual_recurso_proprio_minimo: modalidade.percentual_recurso_proprio_minimo,
            base_referencia: modalidade.base_referencia ?? "SALDO_DEVEDOR",
            descricao: modalidade.descricao ?? null,
          })),
        },
      };
    }),
    totais,
    modalidadeResumo: linhas.map((l) => l.grupo.modalidade).join(", "),
    creditoLiquidoTotal: totais.creditoLiquido,
    primeiraParcelaTotal: totais.primeiraParcela,
  };
}
