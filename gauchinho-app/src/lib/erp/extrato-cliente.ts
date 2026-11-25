import type { ResultadoAssembleia } from "./contemplacoes";
import { chaveRecusa, normalizarCotaContemplacao, resultadosVigentes } from "./contemplacoes";

export type ReajusteExtrato = { data_iso: string; preco: number; tipo: string; variacao_percentual?: string };
export type CotaExtrato = {
  id: string; numero_grupo: string; numero_cota: string; grupo_id: string | null;
  valor_credito: number | null; parcela: number | null; prazo: number | null;
  contemplada: boolean; data_contemplacao: string | null;
  credito_atual_newcon: number | null; parcela_vigente_newcon: number | null;
  data_adesao_newcon: string | null; primeira_assembleia_newcon: string | null;
  snapshot_cota: { historico_reajustes_newcon?: { registros?: ReajusteExtrato[] } };
  venda: { data_venda: string; cliente_id: string };
};

export const moedaExtrato = (valor: number | null) => valor === null ? "Não informado" : valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const arredondar = (valor: number) => Math.round(valor * 100) / 100;
export function calcularExtratoCota(cota: CotaExtrato, hoje: string, mes: string) {
  const adesao = cota.data_adesao_newcon || cota.venda.data_venda?.slice(0, 10);
  const registros = (cota.snapshot_cota?.historico_reajustes_newcon?.registros ?? [])
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.data_iso) && Number(r.preco) > 0 && r.data_iso <= hoje)
    .sort((a, b) => a.data_iso.localeCompare(b.data_iso));
  const inicial = registros.filter((r) => r.data_iso <= adesao).at(-1);
  const atual = Number(cota.credito_atual_newcon) || null;
  const contratado = inicial ? Number(inicial.preco) : null;
  const ultimo = registros.filter((r) => r.tipo === "X").at(-1);
  const taxa = ultimo ? Number(String(ultimo.variacao_percentual ?? "").replace(",", ".")) : NaN;
  const primeira = cota.primeira_assembleia_newcon || (adesao ? (() => {
    const [ano, mesAdesao, dia] = adesao.split("-").map(Number);
    return new Date(Date.UTC(ano, mesAdesao - 1 + (dia >= 10 ? 1 : 0), 10)).toISOString().slice(0, 10);
  })() : null);
  let quantidade = 0;
  if (primeira && primeira <= hoje) {
    const [a, m] = primeira.split("-").map(Number);
    const [ano, mesAtual, dia] = hoje.split("-").map(Number);
    quantidade = Math.max(0, (ano - a) * 12 + mesAtual - m + (dia >= 10 ? 1 : 0));
    if (cota.prazo) quantidade = Math.min(quantidade, cota.prazo);
  }
  // A parcela na adesão é estimada a partir da parcela vigente e dos reajustes confirmados do mesmo bem.
  const fator = inicial && registros.length ? Number(registros.at(-1)!.preco) / Number(inicial.preco) : null;
  const parcelaAdesao = fator && cota.parcela_vigente_newcon ? Number(cota.parcela_vigente_newcon) / fator : null;
  let totalParcelas: number | null = parcelaAdesao === null ? null : 0;
  if (totalParcelas !== null && primeira && inicial) {
    const [ano, mesInicial] = primeira.split("-").map(Number);
    for (let i = 0; i < quantidade; i++) {
      const data = new Date(Date.UTC(ano, mesInicial - 1 + i, 10)).toISOString().slice(0, 10);
      const preco = Number(registros.filter((r) => r.data_iso <= data).at(-1)?.preco ?? inicial.preco);
      totalParcelas += arredondar(parcelaAdesao! * preco / Number(inicial.preco));
    }
    totalParcelas = arredondar(totalParcelas);
  }
  const confiavel = !registros.some((r) => r.tipo === "S" && r.data_iso >= adesao);
  return {
    adesao, primeira, quantidade, contratado: confiavel ? contratado : null, atual,
    totalParcelas: confiavel ? totalParcelas : null,
    valorizacao: confiavel && atual && contratado ? arredondar(atual - contratado) : null,
    percentual: confiavel && atual && contratado ? (atual / contratado - 1) * 100 : null,
    taxa: Number.isFinite(taxa) ? taxa : null,
    projecao3: atual && Number.isFinite(taxa) ? arredondar(atual * (1 + taxa / 100) ** 3) : null,
    projecao5: atual && Number.isFinite(taxa) ? arredondar(atual * (1 + taxa / 100) ** 5) : null,
    reajustou: registros.some((r) => r.tipo === "X" && r.data_iso.startsWith(mes) && r.data_iso >= adesao),
    registros,
  };
}

/**
 * A apuração parte do número sorteado e sobe até achar uma cota apta: nunca desce.
 * Por isso a cota do cliente só seria alcançada a partir de números iguais ou abaixo dela.
 * Acima dela, só dando a volta no grupo (do último número de volta ao 1).
 */
export function distanciaParaCima(referencia: number, numero: number, capacidade: number | null) {
  if (!Number.isFinite(referencia) || !Number.isFinite(numero)) return Number.NaN;
  if (numero >= referencia) return numero - referencia;
  return capacidade && referencia <= capacidade ? capacidade - referencia + numero : Number.NaN;
}

export type EventoPropriaCota = { tipo: "contemplada" | "sem_pagamento"; modalidade: string } | null;

export function proximidadesCota(cota: CotaExtrato, resultados: ResultadoAssembleia[], capacidade: number | null, inicio: string, fim: string, recusas: Set<string> = new Set()) {
  const numero = Number.parseInt(cota.numero_cota, 10);
  const propria = normalizarCotaContemplacao(cota.numero_cota);
  return resultadosVigentes(resultados).filter((a) => a.grupo_id === cota.grupo_id && a.assembleia_data >= inicio && a.assembleia_data <= fim &&
    (!cota.data_contemplacao || a.assembleia_data <= cota.data_contemplacao))
    .map((a) => {
      const candidatos = a.cotas.filter((r) => r.situacao_cota === "ATIVA" &&
        ["SORTEIO", "LANCE_FIXO", "LANCE_FIXO_2", "LANCE_FIXO2", "LANCE_FIDELIDADE"].includes(r.modalidade))
        .map((r) => ({ ...r, distancia: distanciaParaCima(Number.parseInt(r.cota, 10), numero, capacidade) }))
        .filter((r) => Number.isFinite(r.distancia)).sort((a, b) => a.distancia - b.distancia);
      const melhor = candidatos[0];
      const percentual = melhor && capacidade && numero >= 1 && numero <= capacidade && melhor.distancia < capacidade
        ? (1 - melhor.distancia / capacidade) * 100 : null;
      // A própria cota no resultado: contemplada, ou contemplada por lance sem pagamento (desclassificada ou recusada).
      const minha = a.cotas.find((r) => normalizarCotaContemplacao(r.cota) === propria && (r.situacao_cota === "ATIVA" || r.situacao_cota === "DESCLASSIFICADA"));
      const evento: EventoPropriaCota = !minha || !cota.grupo_id ? null : {
        tipo: minha.situacao_cota === "DESCLASSIFICADA" || recusas.has(chaveRecusa(cota.grupo_id, cota.numero_cota, a.assembleia_data)) ? "sem_pagamento" : "contemplada",
        modalidade: minha.modalidade,
      };
      return { data: a.assembleia_data, numero: a.assembleia_numero, melhor, percentual, evento };
    }).sort((a, b) => b.data.localeCompare(a.data));
}
