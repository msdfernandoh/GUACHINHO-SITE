/**
 * Motor do portal de contempladas: junta cotas, procura a combinação mais
 * próxima do crédito pedido e monta o cronograma de parcelas.
 * Funções puras (sem banco) para poder testar e rodar no cliente.
 */

export type CotaMotor = {
  id: string;
  codigo: string;
  administradora: string;
  tipo: "imovel" | "automovel";
  credito: number;
  entrada: number;
  prazo: number;
  parcela: number;
  saldo_devedor: number;
  vencimento_mes: number | null;
  comissao_parceiro: number;
};

export type Preferencia = "MENOR_PARCELA" | "MENOR_PRAZO";

export type Combinacao = {
  cotas: CotaMotor[];
  credito: number;
  entrada: number;
  saldo: number;
  /** Soma das parcelas no primeiro mês (todas as cotas pagando). */
  parcelaInicial: number;
  /** Média mensal diluída até a última parcela. */
  parcelaMedia: number;
  prazoMaximo: number;
  comissao: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function resumirCombinacao(cotas: CotaMotor[]): Combinacao {
  const credito = cotas.reduce((s, c) => s + c.credito, 0);
  const entrada = cotas.reduce((s, c) => s + c.entrada, 0);
  const saldo = cotas.reduce((s, c) => s + c.saldo_devedor, 0);
  const parcelaInicial = cotas.reduce((s, c) => s + c.parcela, 0);
  const prazoMaximo = cotas.reduce((m, c) => Math.max(m, c.prazo), 0);
  const totalParcelas = cotas.reduce((s, c) => s + c.parcela * c.prazo, 0);
  return {
    cotas,
    credito: r2(credito),
    entrada: r2(entrada),
    saldo: r2(saldo),
    parcelaInicial: r2(parcelaInicial),
    parcelaMedia: prazoMaximo ? r2(totalParcelas / prazoMaximo) : 0,
    prazoMaximo,
    comissao: r2(cotas.reduce((s, c) => s + c.comissao_parceiro, 0)),
  };
}

export type BuscaParams = {
  credito: number;
  entradaMax: number | null;
  preferencia: Preferencia;
  maxCotas?: number;
};

export type ResultadoBusca = {
  acima: Combinacao | null;
  abaixo: Combinacao | null;
  proximas: Combinacao[];
  /** true quando nada coube na entrada máxima e as opções vieram sem esse limite. */
  entradaExcedida?: boolean;
};

function melhorPorPreferencia(a: Combinacao, b: Combinacao, pref: Preferencia) {
  if (pref === "MENOR_PRAZO") return a.prazoMaximo - b.prazoMaximo || a.parcelaMedia - b.parcelaMedia;
  return a.parcelaMedia - b.parcelaMedia || a.prazoMaximo - b.prazoMaximo;
}

/** Todas as combinações de 1..maxCotas cotas que cabem na entrada máxima. */
function combinar(cotas: CotaMotor[], maxCotas: number, entradaMax: number | null, teto: number): CotaMotor[][] {
  const out: CotaMotor[][] = [];
  const lista = [...cotas].sort((a, b) => a.entrada - b.entrada);
  const atual: CotaMotor[] = [];
  const walk = (inicio: number, entrada: number, credito: number) => {
    for (let i = inicio; i < lista.length; i++) {
      const c = lista[i];
      const e = entrada + c.entrada;
      if (entradaMax != null && e > entradaMax) break; // ordenado por entrada
      const cr = credito + c.credito;
      if (cr > teto) continue;
      atual.push(c);
      out.push([...atual]);
      if (atual.length < maxCotas) walk(i + 1, e, cr);
      atual.pop();
    }
  };
  walk(0, 0, 0);
  return out;
}

/**
 * Sem limite de cotas e com muitas cotas: busca em feixe. A cada nível junta mais
 * uma cota e guarda só as combinações mais perto do crédito pedido.
 */
function combinarFeixe(cotas: CotaMotor[], entradaMax: number | null, teto: number, alvo: number, largura = 400): CotaMotor[][] {
  const lista = [...cotas].sort((a, b) => a.credito - b.credito);
  const out: CotaMotor[][] = [];
  type No = { idx: number[]; credito: number; entrada: number };
  let nivel: No[] = lista
    .map((c, i) => ({ idx: [i], credito: c.credito, entrada: c.entrada }))
    .filter((n) => n.credito <= teto && (entradaMax == null || n.entrada <= entradaMax));
  while (nivel.length) {
    for (const n of nivel) out.push(n.idx.map((i) => lista[i]));
    const prox: No[] = [];
    const vistos = new Set<string>();
    for (const n of nivel) {
      if (n.credito >= alvo) continue; // já passou do pedido: juntar mais só afasta
      const usados = new Set(n.idx);
      for (let j = 0; j < lista.length; j++) {
        if (usados.has(j)) continue;
        const cr = n.credito + lista[j].credito;
        const en = n.entrada + lista[j].entrada;
        if (cr > teto) break;
        if (entradaMax != null && en > entradaMax) continue;
        const idx = [...n.idx, j].sort((a, b) => a - b);
        const k = idx.join(",");
        if (vistos.has(k)) continue;
        vistos.add(k);
        prox.push({ idx, credito: cr, entrada: en });
      }
    }
    nivel = prox.sort((a, b) => Math.abs(a.credito - alvo) - Math.abs(b.credito - alvo)).slice(0, largura);
  }
  return out;
}

/**
 * Procura uma opção um pouco acima e outra um pouco abaixo do crédito pedido,
 * dentro da entrada máxima. Entre opções com crédito quase igual (faixa de 2%),
 * decide pela preferência: menor parcela ou menor prazo.
 */
export function buscarCombinacoes(cotas: CotaMotor[], p: BuscaParams): ResultadoBusca {
  const r = buscarDentro(cotas, p);
  // Nada coube na entrada informada: traz as mais próximas mesmo assim, avisando.
  if (!r.proximas.length && p.entradaMax != null && cotas.length) {
    return { ...buscarDentro(cotas, { ...p, entradaMax: null }), entradaExcedida: true };
  }
  return r;
}

function buscarDentro(cotas: CotaMotor[], p: BuscaParams): ResultadoBusca {
  // maxCotas 0 (ou ausente) = sem limite de cotas juntas.
  const semLimite = !p.maxCotas || p.maxCotas > 4;
  const maxCotas = semLimite ? cotas.length : Math.max(p.maxCotas!, 1);
  const alvo = Math.max(0, p.credito);
  const faixa = Math.max(alvo * 0.02, 5000);
  const teto = alvo * 2.5 + faixa;
  const candidatas = (semLimite && cotas.length > 12 ? combinarFeixe(cotas, p.entradaMax, teto, alvo) : combinar(cotas, maxCotas, p.entradaMax, teto)).map(resumirCombinacao);

  const escolher = (lista: Combinacao[], dist: (c: Combinacao) => number) => {
    if (!lista.length) return null;
    const melhorDist = Math.min(...lista.map(dist));
    const perto = lista.filter((c) => dist(c) <= melhorDist + faixa);
    return perto.sort((a, b) => melhorPorPreferencia(a, b, p.preferencia) || a.cotas.length - b.cotas.length)[0];
  };

  const acima = escolher(candidatas.filter((c) => c.credito >= alvo), (c) => c.credito - alvo);
  const abaixo = escolher(candidatas.filter((c) => c.credito < alvo), (c) => alvo - c.credito);

  const chave = (c: Combinacao) => c.cotas.map((x) => x.id).sort().join(",");
  const usadas = new Set([acima, abaixo].filter(Boolean).map((c) => chave(c!)));
  const proximas = [...(acima ? [acima] : []), ...(abaixo ? [abaixo] : [])];
  const resto = candidatas
    .filter((c) => !usadas.has(chave(c)))
    .sort((a, b) => Math.abs(a.credito - alvo) - Math.abs(b.credito - alvo) || melhorPorPreferencia(a, b, p.preferencia));
  for (const c of resto) {
    if (proximas.length >= 3) break;
    proximas.push(c);
  }
  return { acima, abaixo, proximas };
}

/* ------------------------------ Cronograma ------------------------------ */

export type MesCronograma = {
  /** YYYY-MM */
  mes: string;
  total: number;
  itens: { codigo: string; parcela: number; numero: number; de: number }[];
};

function mesInicial(c: CotaMotor, hoje: Date): { ano: number; mes: number } {
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  const venc = c.vencimento_mes ?? (mesAtual === 12 ? 1 : mesAtual + 1);
  const ano = venc < mesAtual ? anoAtual + 1 : anoAtual;
  return { ano, mes: venc };
}

export function cronogramaMensal(cotas: CotaMotor[], hoje: Date = new Date()): MesCronograma[] {
  const mapa = new Map<string, MesCronograma>();
  for (const c of cotas) {
    let { ano, mes } = mesInicial(c, hoje);
    for (let n = 1; n <= c.prazo; n++) {
      const k = `${ano}-${String(mes).padStart(2, "0")}`;
      const m = mapa.get(k) ?? { mes: k, total: 0, itens: [] };
      m.total = r2(m.total + c.parcela);
      m.itens.push({ codigo: c.codigo, parcela: c.parcela, numero: n, de: c.prazo });
      mapa.set(k, m);
      mes++;
      if (mes > 12) {
        mes = 1;
        ano++;
      }
    }
  }
  return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

export type Faixa = { de: string; ate: string; meses: number; valor: number; total: number };

/** Mensal resumido: quebra só quando o valor mensal muda (uma cota começa ou termina). */
export function faixasMensais(meses: MesCronograma[]): Faixa[] {
  const out: Faixa[] = [];
  for (const m of meses) {
    const ultima = out[out.length - 1];
    if (ultima && ultima.valor === m.total && proximoMes(ultima.ate) === m.mes) {
      ultima.ate = m.mes;
      ultima.meses++;
      ultima.total = r2(ultima.total + m.total);
    } else {
      out.push({ de: m.mes, ate: m.mes, meses: 1, valor: m.total, total: m.total });
    }
  }
  return out;
}

function proximoMes(k: string) {
  const [a, m] = k.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

export type Periodo = { rotulo: string; meses: number; total: number; mediaMensal: number };

export function agruparPeriodos(meses: MesCronograma[], tipo: "SEMESTRAL" | "ANUAL"): Periodo[] {
  const mapa = new Map<string, Periodo>();
  for (const m of meses) {
    const [a, mes] = m.mes.split("-").map(Number);
    const rotulo = tipo === "ANUAL" ? String(a) : `${mes <= 6 ? "1º" : "2º"} sem/${a}`;
    const p = mapa.get(rotulo) ?? { rotulo, meses: 0, total: 0, mediaMensal: 0 };
    p.meses++;
    p.total = r2(p.total + m.total);
    p.mediaMensal = r2(p.total / p.meses);
    mapa.set(rotulo, p);
  }
  return [...mapa.values()];
}

export type Acrescimo = { tipo: "PERCENTUAL" | "FIXO"; valor: number };

/** Valor extra somado à entrada (comissão adicional do usuário). Percentual é sobre o crédito. */
export function valorAcrescimo(credito: number, a: Acrescimo | null | undefined): number {
  if (!a || !(a.valor > 0)) return 0;
  return r2(a.tipo === "PERCENTUAL" ? (credito * a.valor) / 100 : a.valor);
}

export const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function rotuloMes(k: string) {
  const [a, m] = k.split("-").map(Number);
  return `${NOMES_MES[m - 1]}/${String(a).slice(2)}`;
}
