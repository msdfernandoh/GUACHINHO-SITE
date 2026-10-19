type Identificacao = { numero_grupo: string | null; numero_cota: string | null };
type Parcela = Identificacao & { cliente_nome: string; parcela_numero: number; valor_comissao: number };
type Previsao = Identificacao & { id: string; cliente_nome: string; ordem_etapa: number; valor_previsto: number; valor_liquidado: number };

const numero = (valor: string | null) => (valor ?? "").replace(/\D/g, "").replace(/^0+/, "");
const nome = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function opcoesVinculoRepasse<T extends Identificacao>(previsoes: T[], item: Identificacao): T[] {
  const grupo = numero(item.numero_grupo);
  const cota = numero(item.numero_cota);
  return previsoes.filter((previsao) => grupo && cota && numero(previsao.numero_grupo) === grupo
    && (!previsao.numero_cota || numero(previsao.numero_cota) === cota));
}

export function sugestaoVinculoRepasse(previsoes: Previsao[], item: Parcela): string {
  const exatas = opcoesVinculoRepasse(previsoes, item).filter((p) => nome(p.cliente_nome) === nome(item.cliente_nome)
    && p.ordem_etapa === item.parcela_numero
    && Math.abs(Math.round((p.valor_previsto - p.valor_liquidado) * 100) - Math.round(item.valor_comissao * 100)) <= 2);
  return exatas.length === 1 ? exatas[0].id : "";
}
