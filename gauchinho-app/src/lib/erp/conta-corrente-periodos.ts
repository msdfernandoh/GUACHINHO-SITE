export type TipoFiltroPeriodo =
  | "mes"
  | "mes_atual"
  | "mes_anterior"
  | "ultimos_3_meses"
  | "ultimos_6_meses"
  | "ano_atual"
  | "todos_periodos"
  | "personalizado";

export interface FiltroPeriodoParams {
  tipoPeriodo?: TipoFiltroPeriodo | string;
  competencia?: string; // YYYY-MM
  dataInicio?: string;  // YYYY-MM-DD
  dataFim?: string;     // YYYY-MM-DD
  referenciaHoje?: string; // YYYY-MM-DD
}

export interface FiltroPeriodoResultado {
  tipoPeriodo: TipoFiltroPeriodo;
  competencia: string; // YYYY-MM principal
  dataInicio: string;  // YYYY-MM-DD
  dataFim: string;     // YYYY-MM-DD
  rotuloPeriodo: string;
  isTodosPeriodos: boolean;
  isMesUnico: boolean;
}

export interface LancamentoConferenciaDTO {
  id: string;
  data: string;
  descricao: string;
  origem: string;
  debito: number;
  credito: number;
  saldoApos: number;
  responsavelNome?: string | null;
  natureza: "CREDITO" | "DEBITO";
  tipoMovimento: string;
}

export interface ConferenciaMensalDTO {
  competencia: string; // YYYY-MM
  rotuloCompetencia: string; // 'SET/2026'
  saldoInicial: number;
  creditos: number;
  debitos: number;
  reservas: number;
  saques: number;
  ajustes: number;
  saldoFinal: number;
  statusFechamento: "FECHADO" | "ABERTO";
  fechamentoId?: string | null;
  totalLancamentos: number;
  lancamentos: LancamentoConferenciaDTO[];
}

export interface FechamentoGeralDTO {
  saldoInicialHistorico: number;
  todosCreditos: number;
  todosDebitos: number;
  todosSaques: number;
  reservasVigentes: number;
  saldoCalculadoHistorico: number;
  saldoExibidoDashboard: number;
  divergencia: number;
  status: "OK" | "DIVERGENCIA";
  mensagemAuditoria: string;
}

const NOMES_MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const NOMES_MESES_ABREV = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
];

export function formatarRotuloMes(competencia: string, abrev = false): string {
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) return competencia || "-";
  const [ano, mes] = competencia.split("-").map(Number);
  const idx = mes - 1;
  if (idx < 0 || idx > 11) return competencia;
  return abrev ? `${NOMES_MESES_ABREV[idx]}/${ano}` : `${NOMES_MESES[idx]}/${ano}`;
}

export function formatarDataPtBr(dataIso: string): string {
  if (!dataIso) return "-";
  const partes = dataIso.split("-");
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  if (partes.length === 2) {
    return `${partes[1]}/${partes[0]}`;
  }
  return dataIso;
}

export function obterHojeCuiaba(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Cuiaba",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function resolverIntervaloPeriodo(params: FiltroPeriodoParams): FiltroPeriodoResultado {
  const hoje = params.referenciaHoje || obterHojeCuiaba();
  const [anoAtual, mesAtual] = hoje.split("-").map(Number);

  let tipo: TipoFiltroPeriodo = (params.tipoPeriodo as TipoFiltroPeriodo) || "mes";

  // Se passou apenas dataInicio e dataFim explícitos sem tipo
  if (!params.tipoPeriodo && params.dataInicio && params.dataFim) {
    tipo = "personalizado";
  } else if (!params.tipoPeriodo && params.competencia) {
    tipo = "mes";
  }

  let competenciaPrincipal = params.competencia && /^\d{4}-\d{2}$/.test(params.competencia)
    ? params.competencia
    : `${anoAtual}-${String(mesAtual).padStart(2, "0")}`;

  let dataInicio = "";
  let dataFim = "";
  let rotulo = "";
  let isTodos = false;
  let isMes = false;

  switch (tipo) {
    case "mes_atual": {
      const comp = `${anoAtual}-${String(mesAtual).padStart(2, "0")}`;
      competenciaPrincipal = comp;
      dataInicio = `${comp}-01`;
      dataFim = `${comp}-${String(ultimoDiaDoMes(anoAtual, mesAtual)).padStart(2, "0")}`;
      rotulo = `Mês Atual (${formatarRotuloMes(comp)})`;
      isMes = true;
      break;
    }

    case "mes_anterior": {
      let anoAnt = anoAtual;
      let mesAnt = mesAtual - 1;
      if (mesAnt < 1) {
        mesAnt = 12;
        anoAnt -= 1;
      }
      const comp = `${anoAnt}-${String(mesAnt).padStart(2, "0")}`;
      competenciaPrincipal = comp;
      dataInicio = `${comp}-01`;
      dataFim = `${comp}-${String(ultimoDiaDoMes(anoAnt, mesAnt)).padStart(2, "0")}`;
      rotulo = `Mês Anterior (${formatarRotuloMes(comp)})`;
      isMes = true;
      break;
    }

    case "ultimos_3_meses": {
      // 3 meses incluindo o atual: ex. se mês é 09, inclui 07, 08, 09
      let anoInicio = anoAtual;
      let mesInicio = mesAtual - 2;
      if (mesInicio < 1) {
        mesInicio += 12;
        anoInicio -= 1;
      }
      dataInicio = `${anoInicio}-${String(mesInicio).padStart(2, "0")}-01`;
      dataFim = `${anoAtual}-${String(mesAtual).padStart(2, "0")}-${String(ultimoDiaDoMes(anoAtual, mesAtual)).padStart(2, "0")}`;
      rotulo = "Últimos 3 Meses";
      break;
    }

    case "ultimos_6_meses": {
      let anoInicio = anoAtual;
      let mesInicio = mesAtual - 5;
      if (mesInicio < 1) {
        mesInicio += 12;
        anoInicio -= 1;
      }
      dataInicio = `${anoInicio}-${String(mesInicio).padStart(2, "0")}-01`;
      dataFim = `${anoAtual}-${String(mesAtual).padStart(2, "0")}-${String(ultimoDiaDoMes(anoAtual, mesAtual)).padStart(2, "0")}`;
      rotulo = "Últimos 6 Meses";
      break;
    }

    case "ano_atual": {
      dataInicio = `${anoAtual}-01-01`;
      dataFim = `${anoAtual}-12-31`;
      rotulo = `Ano ${anoAtual}`;
      break;
    }

    case "todos_periodos": {
      dataInicio = "2000-01-01";
      dataFim = "2099-12-31";
      rotulo = "Todos os Períodos";
      isTodos = true;
      break;
    }

    case "personalizado": {
      dataInicio = params.dataInicio && /^\d{4}-\d{2}-\d{2}$/.test(params.dataInicio)
        ? params.dataInicio
        : `${anoAtual}-01-01`;
      dataFim = params.dataFim && /^\d{4}-\d{2}-\d{2}$/.test(params.dataFim)
        ? params.dataFim
        : hoje;
      rotulo = `${formatarDataPtBr(dataInicio)} até ${formatarDataPtBr(dataFim)}`;
      isMes = dataInicio.slice(0, 7) === dataFim.slice(0, 7);
      break;
    }

    case "mes":
    default: {
      tipo = "mes";
      const [ano, mes] = competenciaPrincipal.split("-").map(Number);
      dataInicio = `${competenciaPrincipal}-01`;
      dataFim = `${competenciaPrincipal}-${String(ultimoDiaDoMes(ano, mes)).padStart(2, "0")}`;
      rotulo = formatarRotuloMes(competenciaPrincipal);
      isMes = true;
      break;
    }
  }

  return {
    tipoPeriodo: tipo,
    competencia: competenciaPrincipal,
    dataInicio,
    dataFim,
    rotuloPeriodo: rotulo,
    isTodosPeriodos: isTodos,
    isMesUnico: isMes,
  };
}

export function encadearConferenciaMensal(
  competenciasOrdenadas: string[],
  movimentosPorMes: Map<string, {
    creditos: number;
    debitos: number;
    reservas: number;
    saques: number;
    ajustes: number;
    statusFechamento: "FECHADO" | "ABERTO";
    fechamentoId?: string | null;
    lancamentos: LancamentoConferenciaDTO[];
  }>,
  saldoInicialGeral = 0
): ConferenciaMensalDTO[] {
  let saldoCorrente = saldoInicialGeral;
  const resultado: ConferenciaMensalDTO[] = [];

  for (const comp of competenciasOrdenadas) {
    const dadosMes = movimentosPorMes.get(comp) || {
      creditos: 0,
      debitos: 0,
      reservas: 0,
      saques: 0,
      ajustes: 0,
      statusFechamento: "ABERTO",
      fechamentoId: null,
      lancamentos: [],
    };

    const saldoInicial = Number(saldoCorrente.toFixed(2));
    const creditos = Number(dadosMes.creditos.toFixed(2));
    const debitos = Number(dadosMes.debitos.toFixed(2));
    const saques = Number(dadosMes.saques.toFixed(2));
    const reservas = Number(dadosMes.reservas.toFixed(2));
    const ajustes = Number(dadosMes.ajustes.toFixed(2));

    // Saldo final = Saldo inicial + créditos - débitos - saques + ajustes
    const saldoFinal = Number((saldoInicial + creditos - debitos - saques + ajustes).toFixed(2));

    resultado.push({
      competencia: comp,
      rotuloCompetencia: formatarRotuloMes(comp, true),
      saldoInicial,
      creditos,
      debitos,
      reservas,
      saques,
      ajustes,
      saldoFinal,
      statusFechamento: dadosMes.statusFechamento,
      fechamentoId: dadosMes.fechamentoId,
      totalLancamentos: dadosMes.lancamentos.length,
      lancamentos: dadosMes.lancamentos,
    });

    // O saldo final do mês atual se torna o saldo inicial do mês seguinte!
    saldoCorrente = saldoFinal;
  }

  return resultado;
}

export function reconciliarLedgerComDashboard(params: {
  saldoLedger: number;
  saldoApurado: number;
  saldoInicialHistorico?: number;
  todosCreditos: number;
  todosDebitos: number;
  todosSaques: number;
  reservasVigentes: number;
}): FechamentoGeralDTO {
  const saldoLedger = Number(params.saldoLedger.toFixed(2));
  const saldoApurado = Number(params.saldoApurado.toFixed(2));
  const diferenca = Number(Math.abs(saldoLedger - saldoApurado).toFixed(2));
  const statusOk = diferenca < 0.01;

  const mensagem = statusOk
    ? "O saldo apurado pelo dashboard confere 100% com o histórico do ledger imutável."
    : `Divergência detectada de R$ ${diferenca.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} entre o ledger contábil e a apuração operacional. Não oculte divergências.`;

  return {
    saldoInicialHistorico: Number((params.saldoInicialHistorico || 0).toFixed(2)),
    todosCreditos: Number(params.todosCreditos.toFixed(2)),
    todosDebitos: Number(params.todosDebitos.toFixed(2)),
    todosSaques: Number(params.todosSaques.toFixed(2)),
    reservasVigentes: Number(params.reservasVigentes.toFixed(2)),
    saldoCalculadoHistorico: saldoLedger,
    saldoExibidoDashboard: saldoApurado,
    divergencia: diferenca,
    status: statusOk ? "OK" : "DIVERGENCIA",
    mensagemAuditoria: mensagem,
  };
}
