import type { ConfigLinhaSimulacaoGrupo, ResultadoLinhaSimulacaoGrupo } from "@/lib/grupos/simulacao-linha";
import { calcularPrazoGrupoFromRow } from "@/lib/grupos/prazos";
import type { GrupoConsorcio } from "@/lib/types";

export type LinhaGrupoContratacao = {
  grupoId: string;
  cotaId: string;
  config: ConfigLinhaSimulacaoGrupo;
  resultado: ResultadoLinhaSimulacaoGrupo;
  grupo: GrupoConsorcio;
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
        },
      };
    }),
    totais,
    modalidadeResumo: linhas.map((l) => l.grupo.modalidade).join(", "),
    creditoLiquidoTotal: totais.creditoLiquido,
    primeiraParcelaTotal: totais.primeiraParcela,
  };
}
