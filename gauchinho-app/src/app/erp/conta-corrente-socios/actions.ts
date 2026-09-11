"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import {
  type TipoFiltroPeriodo,
  type TipoRegimePeriodo,
  type FiltroPeriodoParams,
  type ConferenciaMensalDTO,
  type LancamentoConferenciaDTO,
  type FechamentoGeralDTO,
  type PainelConferenciaDespesasDTO,
  type PainelConferenciaComissoesDTO,
  type QuadroComparativoGeralDTO,
  type ItemConferenciaDespesaDTO,
  type ItemConferenciaComissaoDTO,
  resolverIntervaloPeriodo,
  encadearConferenciaMensal,
  reconciliarLedgerComDashboard,
  formatarRotuloMes,
  formatarDataPtBr,
  obterHojeCuiaba,
} from "@/lib/erp/conta-corrente-periodos";

export type {
  TipoFiltroPeriodo,
  TipoRegimePeriodo,
  FiltroPeriodoParams,
  ConferenciaMensalDTO,
  LancamentoConferenciaDTO,
  FechamentoGeralDTO,
  PainelConferenciaDespesasDTO,
  PainelConferenciaComissoesDTO,
  QuadroComparativoGeralDTO,
  ItemConferenciaDespesaDTO,
  ItemConferenciaComissaoDTO,
};

export interface SocioDTO {
  id: string;
  usuarioId: string;
  nome: string;
  percentualParticipacao: number;
  ativo: boolean;
  participanteComercialId?: string;
  email?: string;
}

export interface DespesaRateioDTO {
  contaId: string;
  data: string;
  descricao: string;
  categoria: string;
  valorTotal: number;
  competencia: string;
  vencimento: string;
  status: "aberta" | "paga" | "cancelada";
  pagoPessoalmente: boolean;
  quemPagou: "EMPRESA" | "SOCIO_PESSOAL" | "OUTRO";
  pagoPorSocioId: string | null;
  pagoPorSocioNome: string | null;
  formaRateio: string;
  minhaParteResponsabilidade: number;
  quantoEuPaguei: number;
  saldoDiferenca: number; // >0 crédito, <0 a compensar
  comprovanteUrl?: string | null;
  comprovanteNome?: string | null;
  rateios: Array<{
    socioId: string;
    socioNome: string;
    percentual: number;
    responsabilidade: number;
    pago: number;
    diferenca: number;
  }>;
}

export interface ComissaoSocioDTO {
  id: string;
  vendaId: string;
  competencia: string;
  etapaNome: string;
  valorPrevisto: number;
  valorElegivel: number;
  valorPago: number;
  status: "prevista" | "parcialmente_elegivel" | "elegivel" | "parcialmente_paga" | "paga" | "suspensa" | "cancelada";
  clienteNome?: string;
  cotaInfo?: string;
  valorCredito?: number;
  dataVenda?: string;
  tipoClassificacao: "GARANTIDA" | "PREVISTA" | "RECEBIDA" | "COMPENSADA";
}

export interface MovimentoLedgerDTO {
  id: string;
  dataMovimento: string;
  competencia: string;
  natureza: "CREDITO" | "DEBITO";
  tipoMovimento: string;
  valor: number;
  saldoApos: number;
  descricao: string;
  origemTipo?: string | null;
  origemId?: string | null;
  comprovanteUrl?: string | null;
  estornado: boolean;
  createdAt: string;
  socioNome?: string;
}

export interface ReservaFuturaDTO {
  id: string;
  competencia: string;
  categoria: "ALUGUEL" | "FOLHA_SALARIOS" | "IMPOSTOS" | "CONTINGENCIA" | "OUTRA";
  valor: number;
  descricao: string;
  status: "ATIVA" | "LIBERADA" | "UTILIZADA";
  socioId: string;
  socioNome?: string;
}

export interface PrevisaoOrcamentoDTO {
  id?: string;
  categoria: string;
  tipo: "FIXA" | "VARIAVEL" | "EXTRAORDINARIA";
  valorSugeridoSistema: number;
  valorPrevistoAdmin: number;
  valorEfetivoUtilizado: number;
  observacoes?: string | null;
}

export interface MetaSocioDTO {
  socioId: string;
  socioNome: string;
  metaVendasValor: number;
  vendasRealizadasValor: number;
  faltaVenderValor: number;
  percentualAtingido: number;
  percentualDivisao: number;
}

export interface ContaCorrenteResumoDTO {
  // Informações de Período e Regime
  tipoPeriodo: TipoFiltroPeriodo;
  regime: TipoRegimePeriodo;
  competencia: string;
  rotuloPeriodo: string;
  dataInicio: string;
  dataFim: string;
  isTodosPeriodos: boolean;
  isMesUnico: boolean;

  socioSelecionado: SocioDTO | null;
  todosSocios: SocioDTO[];

  // Conciliação de Saldos: Saldo Inicial vs Movimentações vs Saldo Final
  saldoInicialPeriodo: number;
  creditosPeriodo: number;
  debitosPeriodo: number;
  saquesPeriodo: number;
  movimentacaoPeriodoLiquida: number;
  saldoAcumuladoFinal: number; // Saldo Inicial + Movimentação Líquida

  // Totais Históricos Gerais (Visão Consolidada)
  totalComissoesGeral: number;
  totalDespesasResponsabilidadeGeral: number;
  totalPagoBolsoGeral: number;
  totalCompensacoesGeral: number;
  totalSaquesGeral: number;
  
  // Cards do Sócio Selecionado no Período
  comissoesGarantidas: number;
  comissoesPrevistasPeriodo: number;
  comissoesRecebidasPeriodo: number;
  comissoesAReceber: number;
  comissoesFuturasPrevistas: number;
  comissoesCompensadasPeriodo: number;

  despesasMinhaResponsabilidade: number;
  despesasQueEuPaguei: number;
  pagoPelaEmpresaMinhaResponsabilidade: number;
  saldoACompensar: number; // positivo se devedor
  saldoCreditoEqualizacao: number; // positivo se credor
  reservaProximasDespesas: number;
  saldoInternoTotal: number;
  disponivelParaSaque: number;
  disponivelProjetado: number;
  fraseStatus: string;
  statusTipo: "credito" | "devedor" | "neutro";

  // Despesas do Período Consolidadas
  despesasTotalPeriodo: number;
  despesasPagasPeriodo: number;
  despesasAPagarPeriodo: number;
  pagoPelaEmpresaPeriodo: number;
  pagoPorFernandoPeriodo: number;
  pagoPorEroniPeriodo: number;
  outrosPagadoresPeriodo: number;

  // Termômetro da Empresa & Break-Even
  despesasPrevistasEmpresa: number;
  recursosGarantidosEmpresa: number;
  faltaCobrirEmpresa: number;
  percentualCoberturaEmpresa: number;
  taxaComissaoReferencia: number;
  vendasNecessariasEmpresa: number;
  vendasRealizadasEmpresa: number;
  
  // Metas por Sócio
  metasSocios: MetaSocioDTO[];

  // Visão 30 / 60 / 90 dias
  projecao30Dias: { percentual: number; despesas: number; garantido: number };
  projecao60Dias: { percentual: number; despesas: number; garantido: number };
  projecao90Dias: { percentual: number; despesas: number; garantido: number };

  // Listagens para as abas
  despesasRateadas: DespesaRateioDTO[];
  comissoesSocio: ComissaoSocioDTO[];
  ledgerExtrato: MovimentoLedgerDTO[];
  reservas: ReservaFuturaDTO[];
  orcamento: PrevisaoOrcamentoDTO[];

  // Quadro de Conferência Mensal & Fechamento Geral
  conferenciaMensal: ConferenciaMensalDTO[];
  fechamentoGeral: FechamentoGeralDTO;

  // Painéis Analíticos com Drill-Down
  painelDespesas: PainelConferenciaDespesasDTO;
  painelComissoes: PainelConferenciaComissoesDTO;

  // Quadro Comparativo Geral
  quadroGeral: QuadroComparativoGeralDTO;
}

/**
 * Consulta e consolida todos os dados da Conta-Corrente dos Sócios com suporte a múltiplos períodos
 */
export async function carregarDadosContaCorrenteSocios(
  filtroOuCompetencia?: string | (FiltroPeriodoParams & { socioId?: string; regime?: TipoRegimePeriodo | string }),
  socioIdParam?: string,
  dataInicioParam?: string,
  dataFimParam?: string,
  tipoPeriodoParam?: TipoFiltroPeriodo,
  regimeParam?: TipoRegimePeriodo
): Promise<ContaCorrenteResumoDTO> {
  const { empresaAtiva } = await requireErpRouteAccess("financeiro");
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  let tipoPeriodo: TipoFiltroPeriodo = "mes";
  let competenciaParam: string | undefined;
  let socioId: string | undefined = socioIdParam;
  let dataInicioParamDef: string | undefined = dataInicioParam;
  let dataFimParamDef: string | undefined = dataFimParam;
  let regimeDef: TipoRegimePeriodo | string | undefined = regimeParam;

  if (typeof filtroOuCompetencia === "object" && filtroOuCompetencia !== null) {
    tipoPeriodo = (filtroOuCompetencia.tipoPeriodo as TipoFiltroPeriodo) || "mes";
    competenciaParam = filtroOuCompetencia.competencia;
    socioId = filtroOuCompetencia.socioId ?? socioIdParam;
    dataInicioParamDef = filtroOuCompetencia.dataInicio ?? dataInicioParam;
    dataFimParamDef = filtroOuCompetencia.dataFim ?? dataFimParam;
    regimeDef = filtroOuCompetencia.regime ?? regimeParam;
  } else if (typeof filtroOuCompetencia === "string") {
    if (
      [
        "mes",
        "mes_atual",
        "mes_anterior",
        "ultimos_3_meses",
        "ultimos_6_meses",
        "ano_atual",
        "todos_periodos",
        "personalizado",
      ].includes(filtroOuCompetencia)
    ) {
      tipoPeriodo = filtroOuCompetencia as TipoFiltroPeriodo;
    } else if (/^\d{4}-\d{2}$/.test(filtroOuCompetencia)) {
      competenciaParam = filtroOuCompetencia;
      tipoPeriodo = tipoPeriodoParam || "mes";
    }
  }

  if (tipoPeriodoParam) {
    tipoPeriodo = tipoPeriodoParam;
  }

  const periodo = resolverIntervaloPeriodo({
    tipoPeriodo,
    competencia: competenciaParam,
    dataInicio: dataInicioParamDef,
    dataFim: dataFimParamDef,
    regime: regimeDef,
  });

  const admin = createAdminClient();

  // 1. Buscar Quadro Societário (empresa_socios)
  const { data: sociosDb, error: sociosErr } = await admin
    .from("empresa_socios")
    .select("id, usuario_id, nome, percentual_participacao, ativo, vigencia_inicio, vigencia_fim")
    .eq("empresa_id", empresaAtiva.id)
    .eq("ativo", true)
    .order("nome");

  if (sociosErr) throw new Error(`Erro ao carregar sócios: ${sociosErr.message}`);

  const usuarioIds = (sociosDb ?? []).map((s) => s.usuario_id);

  // 2. Buscar participantes comerciais vinculados aos sócios
  const { data: partDb } = await admin
    .from("participantes_comerciais")
    .select("id, usuario_id, nome, email")
    .eq("empresa_id", empresaAtiva.id)
    .in("usuario_id", usuarioIds)
    .ilike("status", "ativo");

  const partMapByUsuario = new Map((partDb ?? []).map((p) => [p.usuario_id, p]));
  const partIds = (partDb ?? []).map((p) => p.id);

  const todosSocios: SocioDTO[] = (sociosDb ?? []).map((s) => {
    const p = partMapByUsuario.get(s.usuario_id);
    return {
      id: s.id,
      usuarioId: s.usuario_id,
      nome: s.nome,
      percentualParticipacao: Number(s.percentual_participacao),
      ativo: s.ativo,
      participanteComercialId: p?.id,
      email: p?.email,
    };
  });

  const socioSelecionado = socioId && socioId !== "todos"
    ? todosSocios.find((s) => s.id === socioId) ?? todosSocios[0] ?? null
    : todosSocios[0] ?? null;

  const socioIdAtivo = socioSelecionado?.id ?? null;
  const participanteIdAtivo = socioSelecionado?.participanteComercialId ?? null;
  const isVisaoTodosSocios = socioId === "todos";

  const socioFernando = todosSocios.find((s) => s.nome.toLowerCase().includes("fernando"));
  const socioEroni = todosSocios.find((s) => s.nome.toLowerCase().includes("eroni"));

  // 3. Buscar Dados Históricos e Operacionais
  const [
    contasRes,
    rateiosRes,
    reservasRes,
    orcamentoRes,
    metasRes,
    ledgerRes,
    comissoesRes,
    vendasRes,
    caixaRes,
    fechamentosRes,
    compensacoesRes,
    pagamentosRes,
  ] = await Promise.all([
    admin
      .from("financeiro_contas_pagar")
      .select("id, empresa_id, descricao, valor, status, vencimento, competencia, pago_em, pago_pessoalmente, socio_pagador_usuario_id, fornecedor, observacao")
      .eq("empresa_id", empresaAtiva.id)
      .neq("status", "cancelada")
      .order("vencimento"),
    admin
      .from("financeiro_despesa_rateios")
      .select("*")
      .eq("empresa_id", empresaAtiva.id),
    admin
      .from("financeiro_reservas_socios")
      .select("*")
      .eq("empresa_id", empresaAtiva.id)
      .eq("status", "ATIVA"),
    admin
      .from("financeiro_previsoes_orcamento")
      .select("*")
      .eq("empresa_id", empresaAtiva.id),
    admin
      .from("financeiro_metas_socios")
      .select("*")
      .eq("empresa_id", empresaAtiva.id),
    admin
      .from("socio_conta_corrente_movimentos")
      .select("*")
      .eq("empresa_id", empresaAtiva.id)
      .order("data_movimento", { ascending: true }),
    admin
      .from("comissao_previsoes_participantes")
      .select(`
        id,
        venda_id,
        competencia,
        nome_etapa,
        valor_previsto,
        valor_elegivel,
        valor_pago,
        status,
        participante_comercial_id,
        venda:vendas(id, valor_credito, cliente_nome, data_venda)
      `)
      .eq("empresa_id", empresaAtiva.id)
      .in("participante_comercial_id", partIds.length ? partIds : ["00000000-0000-0000-0000-000000000000"])
      .neq("status", "cancelada")
      .order("competencia"),
    admin
      .from("vendas")
      .select("id, participante_comercial_id, valor_credito, status, data_venda")
      .eq("empresa_id", empresaAtiva.id)
      .eq("status", "confirmada"),
    admin
      .from("financeiro_contas_saldos")
      .select("saldo_atual")
      .eq("empresa_id", empresaAtiva.id)
      .eq("ativo", true),
    admin
      .from("financeiro_fechamentos_socios")
      .select("id, periodo_inicio, periodo_fim, status, total_despesas_pessoais")
      .eq("empresa_id", empresaAtiva.id),
    admin
      .from("financeiro_compensacoes_comissoes")
      .select("*")
      .eq("empresa_id", empresaAtiva.id),
    admin
      .from("financeiro_pagamentos")
      .select("id, data_pagamento, valor_bruto, valor_liquido, forma_pagamento, participante_comercial_id, status, created_at, itens:financeiro_pagamento_itens(id, previsao_participante_id, valor_liquidado)")
      .eq("empresa_id", empresaAtiva.id)
      .eq("status", "confirmado"),
  ]);

  const todasContas = contasRes.data ?? [];
  const rateiosDb = rateiosRes.data ?? [];
  const reservasDb = reservasRes.data ?? [];
  const orcamentoDb = orcamentoRes.data ?? [];
  const metasDb = metasRes.data ?? [];
  const ledgerDb = ledgerRes.data ?? [];
  const todasComissoesDb = comissoesRes.data ?? [];
  const todasVendasDb = vendasRes.data ?? [];
  const caixaSaldoTotal = (caixaRes.data ?? []).reduce((acc, c) => acc + Number(c.saldo_atual || 0), 0);
  const fechamentosDb = fechamentosRes.data ?? [];
  const compensacoesDb = compensacoesRes.data ?? [];
  const pagamentosDb = pagamentosRes.data ?? [];

  // Mapa de Pagamento das Comissões
  const pagamentosPorPrevisaoId = new Map<string, { dataPagamento: string; valor: number }>();
  pagamentosDb.forEach((pag: any) => {
    (pag.itens || []).forEach((item: any) => {
      pagamentosPorPrevisaoId.set(item.previsao_participante_id, {
        dataPagamento: pag.data_pagamento || pag.created_at?.slice(0, 10),
        valor: Number(item.valor_liquidado || 0),
      });
    });
  });

  // Mapeamento de Rateios
  const rateiosMap = new Map<string, Array<any>>();
  rateiosDb.forEach((r) => {
    const list = rateiosMap.get(r.conta_pagar_id) ?? [];
    list.push(r);
    rateiosMap.set(r.conta_pagar_id, list);
  });

  // Mapeamento de Despesas
  function mapearDespesaRateio(conta: any): DespesaRateioDTO {
    const valorConta = Number(conta.valor);
    const rateiosConta = rateiosMap.get(conta.id) ?? [];
    const quemPagouSocio = todosSocios.find((s) => s.usuarioId === conta.socio_pagador_usuario_id);
    const quemPagouSocioId = quemPagouSocio?.id ?? null;
    const quemPagouSocioNome = quemPagouSocio?.nome ?? null;
    const quemPagouTipo: "EMPRESA" | "SOCIO_PESSOAL" | "OUTRO" = conta.pago_pessoalmente ? "SOCIO_PESSOAL" : "EMPRESA";

    const rateiosCalculados = todosSocios.map((s) => {
      const rateioExistente = rateiosConta.find((r) => r.socio_id === s.id);
      if (rateioExistente) {
        return {
          socioId: s.id,
          socioNome: s.nome,
          percentual: Number(rateioExistente.percentual_atribuido),
          responsabilidade: Number(rateioExistente.valor_responsabilidade),
          pago: Number(rateioExistente.valor_pago_socio),
          diferenca: Number(rateioExistente.saldo_diferenca),
        };
      }
      const pct = s.percentualParticipacao || (100 / (todosSocios.length || 1));
      const resp = Number(((valorConta * pct) / 100).toFixed(2));
      const pago = quemPagouSocioId === s.id ? valorConta : 0;
      const dif = pago - resp;
      return {
        socioId: s.id,
        socioNome: s.nome,
        percentual: pct,
        responsabilidade: resp,
        pago,
        diferenca: dif,
      };
    });

    const meuRateio = isVisaoTodosSocios
      ? null
      : rateiosCalculados.find((r) => r.socioId === socioIdAtivo);

    return {
      contaId: conta.id,
      data: conta.pago_em || conta.vencimento,
      descricao: conta.descricao,
      categoria: conta.fornecedor || "Geral",
      valorTotal: valorConta,
      competencia: conta.competencia || conta.vencimento?.slice(0, 7) || periodo.competencia,
      vencimento: conta.vencimento,
      status: conta.status,
      pagoPessoalmente: Boolean(conta.pago_pessoalmente),
      quemPagou: quemPagouTipo,
      pagoPorSocioId: quemPagouSocioId,
      pagoPorSocioNome: quemPagouSocioNome,
      formaRateio: "50/50",
      minhaParteResponsabilidade: isVisaoTodosSocios ? valorConta : (meuRateio?.responsabilidade ?? 0),
      quantoEuPaguei: isVisaoTodosSocios
        ? (conta.pago_pessoalmente ? valorConta : 0)
        : (meuRateio?.pago ?? 0),
      saldoDiferenca: isVisaoTodosSocios ? 0 : (meuRateio?.diferenca ?? 0),
      rateios: rateiosCalculados,
    };
  }

  const todasDespesasRateadas = todasContas.map(mapearDespesaRateio);

  // Filtragem de Despesas conforme Regime (CAIXA vs COMPETÊNCIA)
  const compInicio = periodo.dataInicio.slice(0, 7);
  const compFim = periodo.dataFim.slice(0, 7);

  const despesasRateadas = todasDespesasRateadas.filter((d) => {
    if (periodo.isTodosPeriodos) return true;
    if (periodo.regime === "CAIXA") {
      // Regime Caixa: apenas despesas efetivamente pagas no intervalo
      if (d.status !== "paga") return false;
      const dtPag = d.data; // conta.pago_em || conta.vencimento
      return Boolean(dtPag && dtPag >= periodo.dataInicio && dtPag <= periodo.dataFim);
    } else {
      // Regime Competência: competência ou vencimento no intervalo
      const comp = d.competencia;
      const venc = d.vencimento;
      const inComp = comp >= compInicio && comp <= compFim;
      const inVenc = Boolean(venc && venc >= periodo.dataInicio && venc <= periodo.dataFim);
      return inComp || inVenc;
    }
  });

  // Mapeamento de Comissões
  const todasComissoesSocio: (ComissaoSocioDTO & { participanteComercialId: string; dataPagamentoReal?: string })[] = todasComissoesDb.map((c: any) => {
    const venda = Array.isArray(c.venda) ? c.venda[0] : c.venda;
    let tipo: "GARANTIDA" | "PREVISTA" | "RECEBIDA" | "COMPENSADA" = "PREVISTA";

    if (c.status === "paga" || Number(c.valor_pago) > 0) tipo = "RECEBIDA";
    else if (c.status === "elegivel" || Number(c.valor_elegivel) > 0) tipo = "GARANTIDA";
    else tipo = "PREVISTA";

    const pagInfo = pagamentosPorPrevisaoId.get(c.id);

    return {
      id: c.id,
      vendaId: c.venda_id,
      competencia: c.competencia,
      etapaNome: c.nome_etapa || "Parcela",
      valorPrevisto: Number(c.valor_previsto || 0),
      valorElegivel: Number(c.valor_elegivel || 0),
      valorPago: Number(c.valor_pago || 0),
      status: c.status,
      clienteNome: venda?.cliente_nome,
      valorCredito: venda?.valor_credito,
      dataVenda: venda?.data_venda,
      tipoClassificacao: tipo,
      participanteComercialId: c.participante_comercial_id,
      dataPagamentoReal: pagInfo?.dataPagamento,
    };
  });

  // Filtragem de Comissões por Sócio e Regime
  const comissoesDoEscopo = isVisaoTodosSocios
    ? todasComissoesSocio
    : todasComissoesSocio.filter((c) => c.participanteComercialId === participanteIdAtivo);

  const comissoesSocio = comissoesDoEscopo.filter((c) => {
    if (periodo.isTodosPeriodos) return true;
    if (periodo.regime === "CAIXA") {
      // Se recebida, filtra pela data do recebimento de caixa
      if (c.tipoClassificacao === "RECEBIDA") {
        const dt = c.dataPagamentoReal || c.competencia;
        if (dt.length === 7) return dt >= compInicio && dt <= compFim;
        return dt >= periodo.dataInicio && dt <= periodo.dataFim;
      }
      return c.competencia >= compInicio && c.competencia <= compFim;
    } else {
      return c.competencia >= compInicio && c.competencia <= compFim;
    }
  });

  // Totais de Despesas do Período
  const despesasTotalPeriodo = Number(despesasRateadas.reduce((acc, d) => acc + d.valorTotal, 0).toFixed(2));
  const despesasPagasPeriodo = Number(despesasRateadas.filter((d) => d.status === "paga").reduce((acc, d) => acc + d.valorTotal, 0).toFixed(2));
  const despesasAPagarPeriodo = Number(despesasRateadas.filter((d) => d.status !== "paga").reduce((acc, d) => acc + d.valorTotal, 0).toFixed(2));

  const pagoPelaEmpresaPeriodo = Number(despesasRateadas.filter((d) => d.status === "paga" && !d.pagoPessoalmente).reduce((acc, d) => acc + d.valorTotal, 0).toFixed(2));
  const pagoPorFernandoPeriodo = Number(despesasRateadas.filter((d) => d.status === "paga" && d.pagoPessoalmente && d.pagoPorSocioId === socioFernando?.id).reduce((acc, d) => acc + d.valorTotal, 0).toFixed(2));
  const pagoPorEroniPeriodo = Number(despesasRateadas.filter((d) => d.status === "paga" && d.pagoPessoalmente && d.pagoPorSocioId === socioEroni?.id).reduce((acc, d) => acc + d.valorTotal, 0).toFixed(2));
  const outrosPagadoresPeriodo = Number((despesasPagasPeriodo - pagoPelaEmpresaPeriodo - pagoPorFernandoPeriodo - pagoPorEroniPeriodo).toFixed(2));

  // Métricas do Sócio Ativo no Período
  const despesasMinhaResponsabilidade = Number(
    (isVisaoTodosSocios
      ? (periodo.regime === "CAIXA" ? despesasPagasPeriodo : despesasTotalPeriodo)
      : (periodo.regime === "CAIXA"
          ? despesasRateadas.filter((d) => d.status === "paga").reduce((acc, d) => acc + d.minhaParteResponsabilidade, 0)
          : despesasRateadas.reduce((acc, d) => acc + d.minhaParteResponsabilidade, 0))
    ).toFixed(2)
  );

  const despesasQueEuPaguei = Number(
    (isVisaoTodosSocios
      ? (pagoPorFernandoPeriodo + pagoPorEroniPeriodo)
      : despesasRateadas.filter((d) => d.status === "paga" && d.pagoPessoalmente && d.pagoPorSocioId === socioIdAtivo).reduce((acc, d) => acc + d.quantoEuPaguei, 0)
    ).toFixed(2)
  );

  const pagoPelaEmpresaMinhaResponsabilidade = Number(
    (isVisaoTodosSocios
      ? pagoPelaEmpresaPeriodo
      : despesasRateadas.filter((d) => d.status === "paga" && !d.pagoPessoalmente).reduce((acc, d) => acc + d.minhaParteResponsabilidade, 0)
    ).toFixed(2)
  );

  // Equalização: Valor Pago pelo Sócio - Responsabilidade
  const saldoDiferencaDespesas = Number((despesasQueEuPaguei - despesasMinhaResponsabilidade).toFixed(2));
  const saldoACompensar = saldoDiferencaDespesas < 0 ? Math.abs(saldoDiferencaDespesas) : 0;
  const saldoCreditoEqualizacao = saldoDiferencaDespesas > 0 ? saldoDiferencaDespesas : 0;

  // Comissões no Período
  const comissoesRecebidasPeriodo = Number(
    comissoesSocio
      .filter((c) => c.tipoClassificacao === "RECEBIDA")
      .reduce((acc, c) => acc + c.valorPago, 0)
      .toFixed(2)
  );

  const comissoesGarantidas = Number(
    comissoesSocio
      .reduce((acc, c) => {
        if (c.tipoClassificacao === "RECEBIDA") return acc + c.valorPago;
        if (c.tipoClassificacao === "GARANTIDA") return acc + c.valorElegivel;
        return acc;
      }, 0)
      .toFixed(2)
  );

  const comissoesAReceber = Number(Math.max(0, comissoesGarantidas - comissoesRecebidasPeriodo).toFixed(2));

  const comissoesFuturasPrevistas = Number(
    comissoesSocio
      .filter((c) => c.tipoClassificacao === "PREVISTA")
      .reduce((acc, c) => acc + c.valorPrevisto, 0)
      .toFixed(2)
  );

  const comissoesPrevistasPeriodo = comissoesFuturasPrevistas;

  // Reservas no Período
  const reservasDoSocio = reservasDb.filter((r) => !socioIdAtivo || isVisaoTodosSocios || r.socio_id === socioIdAtivo);
  const reservasFiltradasPeriodo = reservasDoSocio.filter((r) => {
    if (periodo.isTodosPeriodos) return true;
    return r.competencia >= compInicio && r.competencia <= compFim;
  });
  const reservaProximasDespesas = Number(reservasFiltradasPeriodo.reduce((acc, r) => acc + Number(r.valor_reservado), 0).toFixed(2));

  const reservas: ReservaFuturaDTO[] = reservasFiltradasPeriodo.map((r) => {
    const s = todosSocios.find((soc) => soc.id === r.socio_id);
    return {
      id: r.id,
      competencia: r.competencia,
      categoria: r.categoria,
      valor: Number(r.valor_reservado),
      descricao: r.descricao,
      status: r.status,
      socioId: r.socio_id,
      socioNome: s?.nome,
    };
  });

  // Movimentações do Ledger
  const ledgerDoSocio = !isVisaoTodosSocios && socioIdAtivo
    ? ledgerDb.filter((m) => m.socio_id === socioIdAtivo)
    : ledgerDb;

  const movimentosAnteriores = ledgerDoSocio.filter(
    (m) => !m.estornado && m.data_movimento < periodo.dataInicio
  );

  const saldoInicialPeriodo = periodo.isTodosPeriodos
    ? 0
    : Number(
        movimentosAnteriores
          .reduce(
            (acc, m) =>
              acc + (m.natureza === "CREDITO" ? Number(m.valor) : -Number(m.valor)),
            0
          )
          .toFixed(2)
      );

  const movimentosNoPeriodo = ledgerDoSocio.filter((m) => {
    if (m.estornado) return false;
    if (periodo.isTodosPeriodos) return true;
    return m.data_movimento >= periodo.dataInicio && m.data_movimento <= periodo.dataFim;
  });

  const creditosPeriodo = Number(
    movimentosNoPeriodo
      .filter((m) => m.natureza === "CREDITO")
      .reduce((acc, m) => acc + Number(m.valor), 0)
      .toFixed(2)
  );

  const debitosPeriodo = Number(
    movimentosNoPeriodo
      .filter((m) => m.natureza === "DEBITO" && m.tipo_movimento !== "SAQUE_REPASSE")
      .reduce((acc, m) => acc + Number(m.valor), 0)
      .toFixed(2)
  );

  const saquesPeriodo = Number(
    movimentosNoPeriodo
      .filter((m) => m.natureza === "DEBITO" && m.tipo_movimento === "SAQUE_REPASSE")
      .reduce((acc, m) => acc + Number(m.valor), 0)
      .toFixed(2)
  );

  const movimentacaoPeriodoLiquida = Number(
    (creditosPeriodo - debitosPeriodo - saquesPeriodo).toFixed(2)
  );

  // Disponível para Saque REALISTA (Item 15)
  const saldoOperacionalRecebido = comissoesRecebidasPeriodo + saldoCreditoEqualizacao + saldoInicialPeriodo - saldoACompensar - saquesPeriodo - reservaProximasDespesas;
  const disponivelParaSaque = Number(Math.max(0, saldoOperacionalRecebido).toFixed(2));
  const disponivelProjetado = Number(Math.max(0, disponivelParaSaque + comissoesAReceber).toFixed(2));

  const saldoInternoOperacional = Number((comissoesGarantidas + saldoCreditoEqualizacao - saldoACompensar).toFixed(2));
  const saldoAcumuladoFinal = movimentosNoPeriodo.length > 0 || movimentosAnteriores.length > 0
    ? Number((saldoInicialPeriodo + movimentacaoPeriodoLiquida).toFixed(2))
    : saldoInternoOperacional;

  // Totais Históricos Gerais (Visão Consolidada)
  const totalComissoesGeral = Number(comissoesDoEscopo.reduce((acc, c) => acc + (c.valorPago || c.valorElegivel || 0), 0).toFixed(2));
  const totalDespesasResponsabilidadeGeral = Number(despesasRateadas.reduce((acc, d) => acc + d.minhaParteResponsabilidade, 0).toFixed(2));
  const totalPagoBolsoGeral = Number(despesasRateadas.reduce((acc, d) => acc + d.quantoEuPaguei, 0).toFixed(2));
  const totalCompensacoesGeral = Number(
    compensacoesDb
      .filter((comp) => isVisaoTodosSocios || comp.socio_id === socioIdAtivo)
      .reduce((acc, comp) => acc + Number(comp.valor_compensado), 0)
      .toFixed(2)
  );
  const totalSaquesGeral = Number(
    ledgerDoSocio
      .filter((m) => !m.estornado && m.tipo_movimento === "SAQUE_REPASSE")
      .reduce((acc, m) => acc + Number(m.valor), 0)
      .toFixed(2)
  );

  // Frase de Status Instantânea
  let fraseStatus = "";
  let statusTipo: "credito" | "devedor" | "neutro" = "neutro";
  const nomeSocio = isVisaoTodosSocios ? "Gauchinho Consórcios" : (socioSelecionado?.nome || "Sócio");

  if (saldoACompensar > 0) {
    fraseStatus = `${nomeSocio} precisa compensar R$ ${saldoACompensar.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em despesas assumidas. Você possui R$ ${disponivelParaSaque.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} liberados após a equalização.`;
    statusTipo = "devedor";
  } else if (disponivelParaSaque > 0) {
    fraseStatus = `Todas as obrigações de ${nomeSocio} estão cobertas. Você possui R$ ${disponivelParaSaque.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} disponíveis para saque imediato.`;
    statusTipo = "credito";
  } else {
    fraseStatus = `Todas as suas obrigações estão equilibradas no período selecionado.`;
    statusTipo = "neutro";
  }

  // Previsões Orçamentárias da Empresa
  const despesasPrevistasEmpresa = despesasTotalPeriodo;
  const recursosGarantidosEmpresa = Math.max(0, caixaSaldoTotal);
  const faltaCobrirEmpresa = Math.max(0, despesasPrevistasEmpresa - recursosGarantidosEmpresa);
  const percentualCoberturaEmpresa = despesasPrevistasEmpresa > 0
    ? Math.min(100, Math.round((recursosGarantidosEmpresa / despesasPrevistasEmpresa) * 100))
    : 100;

  const metaDbRow = metasDb[0];
  const taxaComissaoReferencia = metaDbRow ? Number(metaDbRow.comissao_taxa_referencia) : 3.5;
  const vendasNecessariasEmpresa = faltaCobrirEmpresa > 0 && taxaComissaoReferencia > 0
    ? Number(((faltaCobrirEmpresa / taxaComissaoReferencia) * 100).toFixed(2))
    : 0;

  // Vendas do período
  const vendasMes = todasVendasDb.filter((v: any) => {
    if (periodo.isTodosPeriodos) return true;
    const dt = v.data_venda?.slice(0, 10);
    return dt >= periodo.dataInicio && dt <= periodo.dataFim;
  });
  const vendasRealizadasEmpresa = vendasMes.reduce((acc, v) => acc + Number(v.valor_credito || 0), 0);

  // Metas Individuais dos Sócios
  const metasSocios: MetaSocioDTO[] = todosSocios.map((s) => {
    const metaRow = metasDb.find((m) => m.socio_id === s.id);
    const pctDivisao = metaRow ? Number(metaRow.percentual_divisao) : (s.percentualParticipacao || 50);
    const metaSocioValor = metaRow && Number(metaRow.meta_vendas_valor) > 0
      ? Number(metaRow.meta_vendas_valor)
      : Number(((vendasNecessariasEmpresa * pctDivisao) / 100).toFixed(2));

    const vendasSocio = vendasMes
      .filter((v) => v.participante_comercial_id === s.participanteComercialId)
      .reduce((acc, v) => acc + Number(v.valor_credito || 0), 0);

    const falta = Math.max(0, metaSocioValor - vendasSocio);
    const atingido = metaSocioValor > 0 ? Math.min(100, Math.round((vendasSocio / metaSocioValor) * 100)) : 100;

    return {
      socioId: s.id,
      socioNome: s.nome,
      metaVendasValor: metaSocioValor,
      vendasRealizadasValor: vendasSocio,
      faltaVenderValor: falta,
      percentualAtingido: atingido,
      percentualDivisao: pctDivisao,
    };
  });

  // Visão 30 / 60 / 90 dias
  const projecao30Dias = {
    percentual: Math.min(100, Math.round((recursosGarantidosEmpresa / (despesasPrevistasEmpresa || 1)) * 100)),
    despesas: despesasPrevistasEmpresa,
    garantido: recursosGarantidosEmpresa,
  };
  const projecao60Dias = {
    percentual: Math.min(100, Math.round((recursosGarantidosEmpresa / ((despesasPrevistasEmpresa * 1.8) || 1)) * 100)),
    despesas: despesasPrevistasEmpresa * 1.8,
    garantido: recursosGarantidosEmpresa,
  };
  const projecao90Dias = {
    percentual: Math.min(100, Math.round((recursosGarantidosEmpresa / ((despesasPrevistasEmpresa * 2.6) || 1)) * 100)),
    despesas: despesasPrevistasEmpresa * 2.6,
    garantido: recursosGarantidosEmpresa,
  };

  // Movimentos do Ledger
  const ledgerExtrato: MovimentoLedgerDTO[] = movimentosNoPeriodo.map((m) => {
    const s = todosSocios.find((soc) => soc.id === m.socio_id);
    return {
      id: m.id,
      dataMovimento: m.data_movimento,
      competencia: m.competencia,
      natureza: m.natureza,
      tipoMovimento: m.tipo_movimento,
      valor: Number(m.valor),
      saldoApos: Number(m.saldo_apos),
      descricao: m.descricao,
      origemTipo: m.origem_tipo,
      origemId: m.origem_id,
      comprovanteUrl: m.comprovante_url,
      estornado: Boolean(m.estornado),
      createdAt: m.created_at,
      socioNome: s?.nome,
    };
  });

  // Orçamento
  const orcamentoFiltrado = orcamentoDb.filter((o) => {
    if (periodo.isTodosPeriodos) return true;
    return o.competencia >= compInicio && o.competencia <= compFim;
  });

  const orcamento: PrevisaoOrcamentoDTO[] = orcamentoFiltrado.map((o) => ({
    id: o.id,
    categoria: o.categoria,
    tipo: o.tipo,
    valorSugeridoSistema: Number(o.valor_sugerido_sistema || 0),
    valorPrevistoAdmin: Number(o.valor_previsto_admin || 0),
    valorEfetivoUtilizado: Number(o.valor_previsto_admin || o.valor_sugerido_sistema || 0),
    observacoes: o.observacoes,
  }));

  // Quadro de Conferência Mensal Encadeado
  const mapaCompetenciasSet = new Set<string>();
  todasContas.forEach((c) => {
    const cp = c.competencia || c.vencimento?.slice(0, 7);
    if (cp && /^\d{4}-\d{2}$/.test(cp)) mapaCompetenciasSet.add(cp);
  });
  todasComissoesDb.forEach((c: any) => {
    if (c.competencia && /^\d{4}-\d{2}$/.test(c.competencia)) mapaCompetenciasSet.add(c.competencia);
  });
  ledgerDoSocio.forEach((m) => {
    if (m.competencia && /^\d{4}-\d{2}$/.test(m.competencia)) mapaCompetenciasSet.add(m.competencia);
  });

  const competenciasOrdenadas = Array.from(mapaCompetenciasSet).sort();
  const fechamentosMap = new Map((fechamentosDb ?? []).map((f) => [f.periodo_inicio?.slice(0, 7), f]));
  const mapaMensal = new Map<string, any>();

  for (const comp of competenciasOrdenadas) {
    const fechamento = fechamentosMap.get(comp);
    const movsMes = ledgerDoSocio.filter((m) => !m.estornado && m.competencia === comp);

    const crLedger = movsMes
      .filter((m) => m.natureza === "CREDITO")
      .reduce((acc, m) => acc + Number(m.valor), 0);
    const debLedger = movsMes
      .filter((m) => m.natureza === "DEBITO" && m.tipo_movimento !== "SAQUE_REPASSE")
      .reduce((acc, m) => acc + Number(m.valor), 0);
    const saquesLedger = movsMes
      .filter((m) => m.natureza === "DEBITO" && m.tipo_movimento === "SAQUE_REPASSE")
      .reduce((acc, m) => acc + Number(m.valor), 0);

    const despMes = todasDespesasRateadas.filter((d) => d.competencia === comp);
    const respDespMes = despMes.reduce((acc, d) => acc + d.minhaParteResponsabilidade, 0);
    const pagBolsoMes = despMes.reduce((acc, d) => acc + d.quantoEuPaguei, 0);

    const comMes = todasComissoesSocio.filter((c) => c.competencia === comp);
    const comRecebidaOuGarantidaMes = comMes
      .filter((c) => c.tipoClassificacao === "RECEBIDA" || c.tipoClassificacao === "GARANTIDA")
      .reduce((acc, c) => acc + (c.tipoClassificacao === "RECEBIDA" ? c.valorPago : (c.valorElegivel - c.valorPago)), 0);

    const creditosMes = crLedger > 0 ? crLedger : (comRecebidaOuGarantidaMes + pagBolsoMes);
    const debitosMes = debLedger > 0 ? debLedger : respDespMes;
    const saquesMes = saquesLedger;

    const reservasMes = reservasDb
      .filter((r) => r.competencia === comp)
      .reduce((acc, r) => acc + Number(r.valor_reservado), 0);

    const lancamentos: LancamentoConferenciaDTO[] = [];

    movsMes.forEach((m) => {
      lancamentos.push({
        id: m.id,
        data: m.data_movimento,
        descricao: m.descricao,
        origem: m.origem_tipo || m.tipo_movimento,
        debito: m.natureza === "DEBITO" ? Number(m.valor) : 0,
        credito: m.natureza === "CREDITO" ? Number(m.valor) : 0,
        saldoApos: Number(m.saldo_apos),
        responsavelNome: todosSocios.find((s) => s.id === m.socio_id)?.nome,
        natureza: m.natureza,
        tipoMovimento: m.tipo_movimento,
      });
    });

    if (!lancamentos.length) {
      despMes.forEach((d) => {
        if (d.quantoEuPaguei > 0) {
          lancamentos.push({
            id: `pago-${d.contaId}`,
            data: d.data,
            descricao: `Despesa paga pessoalmente: ${d.descricao}`,
            origem: "Despesa pessoal",
            debito: 0,
            credito: d.quantoEuPaguei,
            saldoApos: 0,
            responsavelNome: d.pagoPorSocioNome,
            natureza: "CREDITO",
            tipoMovimento: "DESPESA_PAGA_PESSOAL",
          });
        }
        if (d.minhaParteResponsabilidade > 0) {
          lancamentos.push({
            id: `resp-${d.contaId}`,
            data: d.data,
            descricao: `Rateio de despesa: ${d.descricao}`,
            origem: "Rateio despesa",
            debito: d.minhaParteResponsabilidade,
            credito: 0,
            saldoApos: 0,
            responsavelNome: socioSelecionado?.nome,
            natureza: "DEBITO",
            tipoMovimento: "RESPONSABILIDADE_DESPESA",
          });
        }
      });

      comMes.forEach((c) => {
        if (c.valorPago > 0 || c.valorElegivel > 0) {
          lancamentos.push({
            id: `com-${c.id}`,
            data: c.dataVenda || `${comp}-15`,
            descricao: `Comissão ${c.tipoClassificacao.toLowerCase()} (${c.etapaNome}) - ${c.clienteNome || "Cliente"}`,
            origem: "Venda consórcio",
            debito: 0,
            credito: c.valorPago > 0 ? c.valorPago : c.valorElegivel,
            saldoApos: 0,
            responsavelNome: socioSelecionado?.nome,
            natureza: "CREDITO",
            tipoMovimento: "COMISSAO_GARANTIDA",
          });
        }
      });
    }

    mapaMensal.set(comp, {
      creditos: creditosMes,
      debitos: debitosMes,
      reservas: reservasMes,
      saques: saquesMes,
      ajustes: 0,
      statusFechamento: fechamento ? "FECHADO" : "ABERTO",
      fechamentoId: fechamento?.id ?? null,
      lancamentos,
    });
  }

  const conferenciaMensal = encadearConferenciaMensal(competenciasOrdenadas, mapaMensal, 0);

  // Reconciliação do Ledger & Fechamento Geral
  const saldoHistoricoLedger = Number(
    ledgerDoSocio
      .filter((m) => !m.estornado)
      .reduce(
        (acc, m) => acc + (m.natureza === "CREDITO" ? Number(m.valor) : -Number(m.valor)),
        0
      )
      .toFixed(2)
  );

  const fechamentoGeral = reconciliarLedgerComDashboard({
    saldoLedger: saldoHistoricoLedger,
    saldoApurado: saldoAcumuladoFinal,
    saldoInicialHistorico: 0,
    todosCreditos: creditosPeriodo,
    todosDebitos: debitosPeriodo,
    todosSaques: saquesPeriodo,
    reservasVigentes: reservaProximasDespesas,
  });

  // Mapeamento para os Painéis Analíticos (Item 11 e Item 12)
  const itensDespesasMapeados: ItemConferenciaDespesaDTO[] = despesasRateadas.map((d) => {
    let quemPagouTipo: "EMPRESA" | "FERNANDO" | "ERONI" | "OUTRO" = "EMPRESA";
    if (d.pagoPessoalmente) {
      if (d.pagoPorSocioId === socioFernando?.id) quemPagouTipo = "FERNANDO";
      else if (d.pagoPorSocioId === socioEroni?.id) quemPagouTipo = "ERONI";
      else quemPagouTipo = "OUTRO";
    }
    return {
      id: d.contaId,
      data: d.data,
      descricao: d.descricao,
      fornecedor: d.categoria,
      competencia: d.competencia,
      vencimento: d.vencimento,
      pagoEm: d.data,
      valor: d.valorTotal,
      status: d.status,
      pagoPessoalmente: d.pagoPessoalmente,
      quemPagouTipo,
      pagadorNome: d.pagoPorSocioNome,
      formaPagamento: "PIX/Bancário",
    };
  });

  const painelDespesas: PainelConferenciaDespesasDTO = {
    totalLancado: despesasTotalPeriodo,
    totalPago: despesasPagasPeriodo,
    totalEmAberto: despesasAPagarPeriodo,
    pagoPelaEmpresa: pagoPelaEmpresaPeriodo,
    pagoPorFernando: pagoPorFernandoPeriodo,
    pagoPorEroni: pagoPorEroniPeriodo,
    itensLancados: itensDespesasMapeados,
    itensPagos: itensDespesasMapeados.filter((i) => i.status === "paga"),
    itensEmAberto: itensDespesasMapeados.filter((i) => i.status !== "paga"),
    itensEmpresa: itensDespesasMapeados.filter((i) => i.status === "paga" && !i.pagoPessoalmente),
    itensFernando: itensDespesasMapeados.filter((i) => i.status === "paga" && i.pagoPessoalmente && i.quemPagouTipo === "FERNANDO"),
    itensEroni: itensDespesasMapeados.filter((i) => i.status === "paga" && i.pagoPessoalmente && i.quemPagouTipo === "ERONI"),
  };

  const itensComissoesMapeados: ItemConferenciaComissaoDTO[] = comissoesSocio.map((c) => {
    const s = todosSocios.find((soc) => soc.participanteComercialId === c.participanteComercialId);
    return {
      id: c.id,
      vendaId: c.vendaId,
      clienteNome: c.clienteNome,
      dataVenda: c.dataVenda,
      competencia: c.competencia,
      nomeEtapa: c.etapaNome,
      valorPrevisto: c.valorPrevisto,
      valorElegivel: c.valorElegivel,
      valorPago: c.valorPago,
      status: c.status,
      participanteNome: s?.nome || "Consultor",
      tipoClassificacao: c.tipoClassificacao,
    };
  });

  const painelComissoes: PainelConferenciaComissoesDTO = {
    totalGerado: Number(itensComissoesMapeados.reduce((s, c) => s + c.valorPrevisto, 0).toFixed(2)),
    totalGarantido: comissoesGarantidas,
    totalRecebido: comissoesRecebidasPeriodo,
    totalAReceber: comissoesAReceber,
    totalRepassadoAosSocios: comissoesRecebidasPeriodo,
    totalRetidoNaEmpresa: totalCompensacoesGeral,
    itensGerados: itensComissoesMapeados,
    itensGarantidos: itensComissoesMapeados.filter((c) => c.tipoClassificacao === "GARANTIDA" || c.tipoClassificacao === "RECEBIDA"),
    itensRecebidos: itensComissoesMapeados.filter((c) => c.tipoClassificacao === "RECEBIDA"),
    itensAReceber: itensComissoesMapeados.filter((c) => c.tipoClassificacao === "GARANTIDA"),
    itensRepassados: itensComissoesMapeados.filter((c) => c.tipoClassificacao === "RECEBIDA"),
    itensRetidos: [],
  };

  // Quadro Comparativo Geral (Item 10)
  // Cálculo exato para Fernando e Eroni no período selecionado
  const comissF = todasComissoesSocio.filter((c) => c.participanteComercialId === socioFernando?.participanteComercialId);
  const comissE = todasComissoesSocio.filter((c) => c.participanteComercialId === socioEroni?.participanteComercialId);

  const fGarantidas = Number(comissF.reduce((acc, c) => acc + (c.tipoClassificacao === "RECEBIDA" ? c.valorPago : c.valorElegivel), 0).toFixed(2));
  const fRecebidas = Number(comissF.filter((c) => c.tipoClassificacao === "RECEBIDA").reduce((acc, c) => acc + c.valorPago, 0).toFixed(2));
  const fAReceber = Number(Math.max(0, fGarantidas - fRecebidas).toFixed(2));

  const eGarantidas = Number(comissE.reduce((acc, c) => acc + (c.tipoClassificacao === "RECEBIDA" ? c.valorPago : c.valorElegivel), 0).toFixed(2));
  const eRecebidas = Number(comissE.filter((c) => c.tipoClassificacao === "RECEBIDA").reduce((acc, c) => acc + c.valorPago, 0).toFixed(2));
  const eAReceber = Number(Math.max(0, eGarantidas - eRecebidas).toFixed(2));

  const baseRespGeral = periodo.regime === "CAIXA" ? despesasPagasPeriodo : despesasTotalPeriodo;
  const fResp = Number(((baseRespGeral * (socioFernando?.percentualParticipacao || 50)) / 100).toFixed(2));
  const eResp = Number(((baseRespGeral * (socioEroni?.percentualParticipacao || 50)) / 100).toFixed(2));

  const fBolso = pagoPorFernandoPeriodo;
  const eBolso = pagoPorEroniPeriodo;

  const fEmpresa = Number(((pagoPelaEmpresaPeriodo * (socioFernando?.percentualParticipacao || 50)) / 100).toFixed(2));
  const eEmpresa = Number(((pagoPelaEmpresaPeriodo * (socioEroni?.percentualParticipacao || 50)) / 100).toFixed(2));

  const fEq = Number((fBolso - fResp).toFixed(2));
  const eEq = Number((eBolso - eResp).toFixed(2));

  const fReservas = Number(reservasDb.filter((r) => r.socio_id === socioFernando?.id && (periodo.isTodosPeriodos || (r.competencia >= compInicio && r.competencia <= compFim))).reduce((s, r) => s + Number(r.valor_reservado), 0).toFixed(2));
  const eReservas = Number(reservasDb.filter((r) => r.socio_id === socioEroni?.id && (periodo.isTodosPeriodos || (r.competencia >= compInicio && r.competencia <= compFim))).reduce((s, r) => s + Number(r.valor_reservado), 0).toFixed(2));

  const fSaques = Number(ledgerDb.filter((m) => !m.estornado && m.socio_id === socioFernando?.id && m.tipo_movimento === "SAQUE_REPASSE" && (periodo.isTodosPeriodos || (m.data_movimento >= periodo.dataInicio && m.data_movimento <= periodo.dataFim))).reduce((s, m) => s + Number(m.valor), 0).toFixed(2));
  const eSaques = Number(ledgerDb.filter((m) => !m.estornado && m.socio_id === socioEroni?.id && m.tipo_movimento === "SAQUE_REPASSE" && (periodo.isTodosPeriodos || (m.data_movimento >= periodo.dataInicio && m.data_movimento <= periodo.dataFim))).reduce((s, m) => s + Number(m.valor), 0).toFixed(2));

  const fSaldo = Number((fRecebidas + fEq - fSaques - fReservas).toFixed(2));
  const eSaldo = Number((eRecebidas + eEq - eSaques - eReservas).toFixed(2));

  const quadroGeral: QuadroComparativoGeralDTO = {
    comissoesGarantidas: { fernando: fGarantidas, eroni: eGarantidas, totalEmpresa: Number((fGarantidas + eGarantidas).toFixed(2)) },
    comissoesRecebidas: { fernando: fRecebidas, eroni: eRecebidas, totalEmpresa: Number((fRecebidas + eRecebidas).toFixed(2)) },
    comissoesAReceber: { fernando: fAReceber, eroni: eAReceber, totalEmpresa: Number((fAReceber + eAReceber).toFixed(2)) },
    responsabilidade: { fernando: fResp, eroni: eResp, totalEmpresa: baseRespGeral },
    pagoDoProprioBolso: { fernando: fBolso, eroni: eBolso, totalEmpresa: Number((fBolso + eBolso).toFixed(2)) },
    pagoPelaEmpresa: { fernando: fEmpresa, eroni: eEmpresa, totalEmpresa: pagoPelaEmpresaPeriodo },
    equalizacao: { fernando: fEq, eroni: eEq, totalEmpresa: 0 },
    reservas: { fernando: fReservas, eroni: eReservas, totalEmpresa: Number((fReservas + eReservas).toFixed(2)) },
    saques: { fernando: fSaques, eroni: eSaques, totalEmpresa: Number((fSaques + eSaques).toFixed(2)) },
    saldoAtual: { fernando: fSaldo, eroni: eSaldo, totalEmpresa: Number((fSaldo + eSaldo).toFixed(2)) },
  };

  return {
    tipoPeriodo: periodo.tipoPeriodo,
    regime: periodo.regime,
    competencia: periodo.competencia,
    rotuloPeriodo: periodo.rotuloPeriodo,
    dataInicio: periodo.dataInicio,
    dataFim: periodo.dataFim,
    isTodosPeriodos: periodo.isTodosPeriodos,
    isMesUnico: periodo.isMesUnico,

    socioSelecionado,
    todosSocios,

    saldoInicialPeriodo,
    creditosPeriodo,
    debitosPeriodo,
    saquesPeriodo,
    movimentacaoPeriodoLiquida,
    saldoAcumuladoFinal,

    totalComissoesGeral,
    totalDespesasResponsabilidadeGeral,
    totalPagoBolsoGeral,
    totalCompensacoesGeral,
    totalSaquesGeral,

    comissoesGarantidas,
    comissoesPrevistasPeriodo,
    comissoesRecebidasPeriodo,
    comissoesAReceber,
    comissoesFuturasPrevistas,
    comissoesCompensadasPeriodo: 0,

    despesasMinhaResponsabilidade,
    despesasQueEuPaguei,
    pagoPelaEmpresaMinhaResponsabilidade,
    saldoACompensar,
    saldoCreditoEqualizacao,
    reservaProximasDespesas,
    saldoInternoTotal: saldoAcumuladoFinal,
    disponivelParaSaque,
    disponivelProjetado,
    fraseStatus,
    statusTipo,

    despesasTotalPeriodo,
    despesasPagasPeriodo,
    despesasAPagarPeriodo,
    pagoPelaEmpresaPeriodo,
    pagoPorFernandoPeriodo,
    pagoPorEroniPeriodo,
    outrosPagadoresPeriodo,

    despesasPrevistasEmpresa,
    recursosGarantidosEmpresa,
    faltaCobrirEmpresa,
    percentualCoberturaEmpresa,
    taxaComissaoReferencia,
    vendasNecessariasEmpresa,
    vendasRealizadasEmpresa,
    metasSocios,
    projecao30Dias,
    projecao60Dias,
    projecao90Dias,
    despesasRateadas,
    comissoesSocio,
    ledgerExtrato,
    reservas,
    orcamento,

    conferenciaMensal,
    fechamentoGeral,

    painelDespesas,
    painelComissoes,
    quadroGeral,
  };
}

export async function usarComissaoCompensarAction(formData: FormData) {
  const { empresaAtiva, usuario } = await requireErpRouteAccess("financeiro");
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  const socioId = String(formData.get("socio_id") ?? "");
  const previsaoId = String(formData.get("previsao_id") ?? "");
  const valorACompensar = Number(String(formData.get("valor") ?? "").replace(",", "."));
  const motivo = String(formData.get("motivo") ?? "").trim() || "Compensação de despesas com comissão do sócio";

  if (!socioId || !previsaoId || isNaN(valorACompensar) || valorACompensar <= 0) {
    throw new Error("Dados inválidos para compensação de comissão.");
  }

  const admin = createAdminClient();

  // Validar sócio
  const { data: socio, error: socioErr } = await admin
    .from("empresa_socios")
    .select("id, usuario_id, nome")
    .eq("id", socioId)
    .eq("empresa_id", empresaAtiva.id)
    .single();

  if (socioErr || !socio) throw new Error("Sócio não encontrado.");

  // Validar previsão de comissão
  const { data: previsao, error: prevErr } = await admin
    .from("comissao_previsoes_participantes")
    .select("id, status, valor_previsto, valor_elegivel, valor_pago, competencia")
    .eq("id", previsaoId)
    .eq("empresa_id", empresaAtiva.id)
    .single();

  if (prevErr || !previsao) throw new Error("Previsão de comissão não encontrada.");

  const valorDisponivelNaPrevisao = Number(previsao.valor_elegivel || previsao.valor_previsto || 0) - Number(previsao.valor_pago || 0);
  if (valorACompensar > valorDisponivelNaPrevisao) {
    throw new Error(`Valor informado (R$ ${valorACompensar}) excede o saldo disponível na previsão (R$ ${valorDisponivelNaPrevisao}).`);
  }

  const idempotencyKey = `comp:${previsaoId}:${Date.now()}`;

  // Inserir registro formal em financeiro_compensacoes_comissoes
  const { error: compErr } = await admin.from("financeiro_compensacoes_comissoes").insert({
    empresa_id: empresaAtiva.id,
    socio_id: socio.id,
    previsao_participante_id: previsao.id,
    valor_compensado: valorACompensar,
    saldo_devedor_anterior: valorACompensar,
    saldo_devedor_restante: 0,
    motivo,
    idempotency_key: idempotencyKey,
    criado_por: usuario?.id ?? null,
  });

  if (compErr) throw new Error(`Erro ao registrar compensação: ${compErr.message}`);

  // Inserir movimento no Ledger (natureza DEBITO na conta do sócio, pois a comissão ficou retida para pagar sua despesa)
  await admin.from("socio_conta_corrente_movimentos").insert({
    empresa_id: empresaAtiva.id,
    socio_id: socio.id,
    usuario_id: socio.usuario_id,
    data_movimento: new Date().toISOString().slice(0, 10),
    competencia: previsao.competencia || new Date().toISOString().slice(0, 7),
    natureza: "DEBITO",
    tipo_movimento: "COMPENSACAO_COMISSAO",
    valor: valorACompensar,
    saldo_apos: 0,
    descricao: `Compensação de despesas retida na empresa (${motivo})`,
    origem_tipo: "previsao_comissao",
    origem_id: previsao.id,
    idempotency_key: `ledger:${idempotencyKey}`,
    criado_por: usuario?.id ?? null,
  });

  // Atualizar a previsão como paga/compensada
  const novoValorPago = Number(previsao.valor_pago || 0) + valorACompensar;
  const novoStatus = novoValorPago >= Number(previsao.valor_previsto) ? "paga" : "parcialmente_paga";

  await admin
    .from("comissao_previsoes_participantes")
    .update({
      valor_pago: novoValorPago,
      status: novoStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", previsao.id);

  revalidatePath("/erp/conta-corrente-socios");
  revalidatePath("/erp/financeiro");
  revalidatePath("/erp/minhas-comissoes");
}

/**
 * Operação: Salvar ou Ajustar Rateio de uma Despesa
 */
export async function salvarRateioDespesaAction(formData: FormData) {
  const { empresaAtiva } = await requireErpRouteAccess("financeiro");
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  const contaId = String(formData.get("conta_id") ?? "");
  const formaRateio = String(formData.get("forma_rateio") ?? "IGUAL_50_50");
  const quemPagou = String(formData.get("quem_pagou") ?? "EMPRESA");
  const pagoPorSocioId = String(formData.get("pago_por_socio_id") ?? "") || null;

  if (!contaId) throw new Error("ID da conta é obrigatório.");

  const admin = createAdminClient();

  const { data: conta, error: contaErr } = await admin
    .from("financeiro_contas_pagar")
    .select("id, valor, pago_pessoalmente")
    .eq("id", contaId)
    .eq("empresa_id", empresaAtiva.id)
    .single();

  if (contaErr || !conta) throw new Error("Conta a pagar não encontrada.");

  const { data: socios } = await admin
    .from("empresa_socios")
    .select("id, usuario_id, percentual_participacao")
    .eq("empresa_id", empresaAtiva.id)
    .eq("ativo", true);

  const valorTotal = Number(conta.valor);
  const totalSocios = socios?.length || 1;

  for (const s of socios ?? []) {
    let pct = Number(s.percentual_participacao) || (100 / totalSocios);
    if (formaRateio === "EXCLUSIVO_SOCIO") {
      pct = s.id === pagoPorSocioId ? 100 : 0;
    } else if (formaRateio === "EMPRESA_INTEGRAL") {
      pct = 0;
    }

    const responsabilidade = Number(((valorTotal * pct) / 100).toFixed(2));
    const pago = quemPagou === "SOCIO_PESSOAL" && s.id === pagoPorSocioId ? valorTotal : 0;
    const dif = pago - responsabilidade;

    await admin.from("financeiro_despesa_rateios").upsert(
      {
        empresa_id: empresaAtiva.id,
        conta_pagar_id: conta.id,
        socio_id: s.id,
        forma_rateio: formaRateio as any,
        percentual_atribuido: pct,
        valor_responsabilidade: responsabilidade,
        valor_pago_socio: pago,
        saldo_diferenca: dif,
        quem_pagou: quemPagou,
        pago_por_socio_id: pagoPorSocioId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "conta_pagar_id,socio_id" }
    );
  }

  // Se marcado como pago pessoalmente pelo sócio, atualiza também a conta_pagar original
  if (quemPagou === "SOCIO_PESSOAL" && pagoPorSocioId) {
    const socioPagador = socios?.find((s) => s.id === pagoPorSocioId);
    await admin
      .from("financeiro_contas_pagar")
      .update({
        pago_pessoalmente: true,
        socio_pagador_usuario_id: socioPagador?.usuario_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conta.id);
  } else if (quemPagou === "EMPRESA") {
    await admin
      .from("financeiro_contas_pagar")
      .update({
        pago_pessoalmente: false,
        socio_pagador_usuario_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conta.id);
  }

  revalidatePath("/erp/conta-corrente-socios");
  revalidatePath("/erp/contas-pagar");
}

/**
 * Operação: Cadastrar Reserva de Caixa para Despesas Futuras
 */
export async function salvarReservaFuturaAction(formData: FormData) {
  const { empresaAtiva, usuario } = await requireErpRouteAccess("financeiro");
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  const socioId = String(formData.get("socio_id") ?? "");
  const competencia = String(formData.get("competencia") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "ALUGUEL") as any;
  const valor = Number(String(formData.get("valor") ?? "").replace(",", "."));
  const descricao = String(formData.get("descricao") ?? "").trim();

  if (!socioId || !competencia || isNaN(valor) || valor <= 0 || !descricao) {
    throw new Error("Preencha todos os campos obrigatórios da reserva.");
  }

  const admin = createAdminClient();

  const { error } = await admin.from("financeiro_reservas_socios").insert({
    empresa_id: empresaAtiva.id,
    socio_id: socioId,
    competencia,
    categoria,
    valor_reservado: valor,
    descricao,
    status: "ATIVA",
    criado_por: usuario?.id ?? null,
  });

  if (error) throw new Error(`Erro ao salvar reserva: ${error.message}`);

  revalidatePath("/erp/conta-corrente-socios");
}

/**
 * Operação: Liberar Reserva de Caixa
 */
export async function liberarReservaAction(reservaId: string) {
  const { empresaAtiva } = await requireErpRouteAccess("financeiro");
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  const admin = createAdminClient();
  const { error } = await admin
    .from("financeiro_reservas_socios")
    .update({ status: "LIBERADA", updated_at: new Date().toISOString() })
    .eq("id", reservaId)
    .eq("empresa_id", empresaAtiva.id);

  if (error) throw new Error(error.message);
  revalidatePath("/erp/conta-corrente-socios");
}

/**
 * Operação: Salvar Previsão Orçamentária Administrativa
 */
export async function salvarPrevisaoOrcamentoAction(formData: FormData) {
  const { empresaAtiva, usuario } = await requireErpRouteAccess("financeiro");
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  const competencia = String(formData.get("competencia") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "FIXA") as any;
  const valorPrevistoAdmin = Number(String(formData.get("valor_previsto_admin") ?? "").replace(",", "."));
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;

  if (!competencia || !categoria || isNaN(valorPrevistoAdmin) || valorPrevistoAdmin < 0) {
    throw new Error("Preencha competência, categoria e valor válido para o orçamento.");
  }

  const admin = createAdminClient();

  const { error } = await admin.from("financeiro_previsoes_orcamento").upsert(
    {
      empresa_id: empresaAtiva.id,
      competencia,
      categoria,
      tipo,
      valor_previsto_admin: valorPrevistoAdmin,
      observacoes,
      criado_por: usuario?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "empresa_id,competencia,categoria" }
  );

  if (error) throw new Error(`Erro ao salvar orçamento: ${error.message}`);

  revalidatePath("/erp/conta-corrente-socios");
}

/**
 * Operação: Salvar Configuração de Metas de Vendas
 */
export async function salvarMetasSociosAction(formData: FormData) {
  const { empresaAtiva } = await requireErpRouteAccess("financeiro");
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  const competencia = String(formData.get("competencia") ?? "").trim();
  const taxaReferencia = Number(String(formData.get("taxa_referencia") ?? "3.5").replace(",", "."));
  const socioId = String(formData.get("socio_id") ?? "");
  const metaValor = Number(String(formData.get("meta_valor") ?? "0").replace(",", "."));
  const percentualDivisao = Number(String(formData.get("percentual_divisao") ?? "50").replace(",", "."));

  if (!competencia || !socioId) throw new Error("Competência e sócio são obrigatórios.");

  const admin = createAdminClient();

  const { error } = await admin.from("financeiro_metas_socios").upsert(
    {
      empresa_id: empresaAtiva.id,
      competencia,
      socio_id: socioId,
      meta_vendas_valor: metaValor,
      percentual_divisao: percentualDivisao,
      comissao_taxa_referencia: taxaReferencia,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "empresa_id,competencia,socio_id" }
  );

  if (error) throw new Error(`Erro ao salvar meta: ${error.message}`);

  revalidatePath("/erp/conta-corrente-socios");
}

/**
 * Operação: Estornar Movimento do Ledger (Imutável, gera estorno inverso auditado)
 */
export async function estornarMovimentoLedgerAction(movimentoId: string, motivo: string) {
  const { empresaAtiva, usuario } = await requireErpRouteAccess("financeiro");
  if (!empresaAtiva?.id) throw new Error("Empresa ativa não encontrada.");

  if (!movimentoId || !motivo.trim()) throw new Error("Informe o movimento e o motivo do estorno.");

  const admin = createAdminClient();

  const { data: orig, error: origErr } = await admin
    .from("socio_conta_corrente_movimentos")
    .select("*")
    .eq("id", movimentoId)
    .eq("empresa_id", empresaAtiva.id)
    .single();

  if (origErr || !orig) throw new Error("Movimento original não encontrado.");
  if (orig.estornado) throw new Error("Este movimento já foi estornado anteriormente.");

  const naturezaInversa = orig.natureza === "CREDITO" ? "DEBITO" : "CREDITO";
  const idempotencyKey = `estorno:${orig.id}:${Date.now()}`;

  // Inserir lançamento de estorno compensatório
  const { data: estorno, error: estornoErr } = await admin
    .from("socio_conta_corrente_movimentos")
    .insert({
      empresa_id: empresaAtiva.id,
      socio_id: orig.socio_id,
      usuario_id: orig.usuario_id,
      data_movimento: new Date().toISOString().slice(0, 10),
      competencia: orig.competencia,
      natureza: naturezaInversa,
      tipo_movimento: "ESTORNO",
      valor: orig.valor,
      saldo_apos: 0,
      descricao: `ESTORNO: ${orig.descricao} (Motivo: ${motivo})`,
      origem_tipo: "manual",
      origem_id: orig.id,
      idempotency_key: idempotencyKey,
      estorno_movimento_id: orig.id,
      criado_por: usuario?.id ?? null,
    })
    .select("id")
    .single();

  if (estornoErr) throw new Error(`Erro ao criar estorno: ${estornoErr.message}`);

  // Marcar original como estornado
  await admin
    .from("socio_conta_corrente_movimentos")
    .update({ estornado: true, estorno_movimento_id: estorno.id })
    .eq("id", orig.id);

  revalidatePath("/erp/conta-corrente-socios");
}
