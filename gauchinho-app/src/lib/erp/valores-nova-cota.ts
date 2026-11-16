import { calcularParcelasLinhaGrupo, seguroMensalSobreSaldo } from "@/lib/grupos/calculos";
import { listarPercentuaisParcelaReduzida } from "@/lib/grupos/simulacao-linha";
import type { GrupoConsorcio, GrupoCota } from "@/lib/types";

type GrupoSeguro = {
  taxa_administrativa_percentual?: number | null;
  fundo_reserva_percentual?: number | null;
  seguro_percentual?: number | null;
  seguro_valor?: number | null;
};

function saldoDaCota(credito: number, grupo: GrupoSeguro) {
  const saldo = credito * (1 + (Number(grupo.taxa_administrativa_percentual ?? 0) +
    Number(grupo.fundo_reserva_percentual ?? 0)) / 100);
  return Math.round(saldo * 100) / 100;
}

export function parcelaDaNovaCota(
  grupo: GrupoConsorcio,
  cota: GrupoCota,
  codigo: string,
  homologada?: { valor_parcela: number; percentual_reducao?: number | null } | null,
) {
  const integral = codigo === "INTEGRAL";
  if (integral && grupo.permite_parcela_integral === false) return null;
  if (!integral && !["REDUZIDA_60_99", "REDUZIDA_ABAIXO_59"].includes(codigo)) return null;
  const homologadaValor = Number(homologada?.valor_parcela);
  if (homologadaValor > 0) {
    return { valor_parcela: homologadaValor, percentual_reducao: homologada?.percentual_reducao ?? null };
  }

  const credito = Number(cota.valor_credito);
  const prazo = Number(grupo.prazo_total);
  if (!(credito > 0 && prazo > 0)) return null;
  const percentuais = integral ? [] : listarPercentuaisParcelaReduzida(grupo, [cota])
    .filter((item) => codigo === "REDUZIDA_60_99" ? item >= 60 : item < 60);
  const padrao = Number(grupo.percentual_parcela_reduzida);
  const percentual = percentuais.includes(padrao) ? padrao : percentuais[0] ?? null;
  if (!integral && percentual == null) return null;

  const { parcelaExibida } = calcularParcelasLinhaGrupo({
    saldoDevedor: saldoDaCota(credito, grupo), prazoTotal: prazo, quantidadeCotas: 1,
    temParcelaReduzida: !integral, percentualParcelaReduzida: percentual ?? 100,
    modalidadeParcela: integral ? "integral" : "reduzida",
  });
  const parcelasPorPercentual = cota.parcelas_reduzidas as Record<string, number> | null | undefined;
  const tabela = integral ? cota.parcela_integral
    : parcelasPorPercentual?.[String(percentual)] ??
      (percentual === 50 ? cota.parcela_reduzida_50
        : percentual === 60 ? cota.parcela_reduzida_60 ?? cota.parcela_reduzida
        : percentual === 70 ? cota.parcela_reduzida_70 : null);
  const valor = Number(tabela) > 0 ? Number(tabela) : parcelaExibida;
  return valor > 0 ? { valor_parcela: valor, percentual_reducao: percentual } : null;
}

export function valoresNovaCota(credito: number, parcela: number, grupo: GrupoSeguro, comSeguro: boolean) {
  const seguroMensal = comSeguro ? seguroMensalSobreSaldo(saldoDaCota(credito, grupo), grupo) : 0;
  return { seguroMensal, parcela: Math.round((parcela + seguroMensal) * 100) / 100 };
}
