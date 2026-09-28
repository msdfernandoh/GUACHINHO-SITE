"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { requireTenantPermission } from "@/lib/tenant/context";
import { carregarDadosContaCorrenteSocios } from "@/app/erp/conta-corrente-socios/actions";
import { calcularFechamentoSocios, type FechamentoCalculado } from "@/lib/gestao/fechamento-socios";
import { obterHojeCuiaba } from "@/lib/erp/conta-corrente-periodos";

const numero = (valor: unknown) => Number(valor || 0);
const arredondar = (valor: number) => Math.round(valor * 100) / 100;

export type PainelFechamento = {
  inicio: string;
  hoje: string;
  despesasPagas: number;
  quantidadePagas: number;
  despesasEmpresaSemSaida: number;
  quantidadeDespesasSemSaida: number;
  saldoAposDespesasPendentes: number;
  impostosPagos: number;
  reservaImpostos: number;
  contasEmpresa: Array<{ id: string; nome: string }>;
  repassesRecebidos: number;
  margemConsultores: number;
  receitasEventos: number;
  comissoesConsultores: number;
  comissoesPorPessoa: Array<{ nome: string; papel: "SOCIO" | "CONSULTOR"; recebidaNoCaixa: number; reservada: number }>;
  despesasPorMes: Array<{ mes: string; total: number; itens: Array<{ id: string; descricao: string; fornecedor: string | null; pagoEm: string; centroId: string | null; centroNome: string; valor: number }>; categorias: Array<{ centroId: string | null; nome: string; gasto: number; teto: number | null; variacao: number | null }> }>;
  desempenhoConsultores: Array<{ mes: string; consultoresAtivos: number; novosConsultores: number; vendas: number; creditoVendido: number; repassesGerados: number }>;
  metasComerciais: { consultores: number; vendas: number; credito: number };
  bancoEmpresa: { id: string; nome: string; saldoSistema: number } | null;
  socios: Array<{ id: string; nome: string; percentual: number; comissaoGuardada: number; comissaoGuardadaMensal: Array<{ competencia: string; valor: number; itens: Array<{ descricao: string; cliente: string; valor: number; status: string }> }>; comissaoFuturaMensal: Array<{ competencia: string; valor: number; itens: Array<{ descricao: string; cliente: string; valor: number; status: string }> }>; adiantamentoPessoal: number; saldoAnterior: number }>;
  bloqueios: string[];
  fechamentos: Array<{ id: string; periodo_inicio: string; periodo_fim: string; created_at: string; demonstrativo: FechamentoCalculado }>;
};

async function lerPainel(): Promise<PainelFechamento> {
  const { empresaAtiva } = await requireErpRouteAccess("conta-corrente-socios");
  const admin = createAdminClient();
  const [sociosRes, contasRes, centrosRes, pagamentosRes, participantesRes, recebimentosRes,
    movimentosRes, bancosRes, saldosRes, cortesRes, dadosSocios, ledgerRes, recebimentoItensRes,
    previsoesFranquiaRes, previsoesParticipantesRes, vendasRes, metasRes] = await Promise.all([
    admin.from("empresa_socios").select("id,usuario_id,nome,percentual_participacao,ativo").eq("empresa_id", empresaAtiva.id).eq("ativo", true),
    admin.from("financeiro_contas_pagar").select("id,descricao,fornecedor,valor,status,pago_em,pago_pessoalmente,socio_pagador_usuario_id,retirar_reserva_impostos,centro_custo_id,caixa_movimento_id,excluida_em").eq("empresa_id", empresaAtiva.id).is("excluida_em", null),
    admin.from("financeiro_centros_custo").select("id,nome,descontado_comissao,limite_mensal").eq("empresa_id", empresaAtiva.id),
    admin.from("financeiro_pagamentos").select("id,participante_comercial_id,valor_liquido,data_pagamento,status").eq("empresa_id", empresaAtiva.id).eq("status", "confirmado"),
    admin.from("participantes_comerciais").select("id,usuario_id,nome,status,data_entrada,created_at").eq("empresa_id", empresaAtiva.id),
    admin.from("financeiro_recebimentos").select("id,valor_total,data_recebimento,status").eq("empresa_id", empresaAtiva.id).eq("status", "confirmado"),
    admin.from("financeiro_conta_movimentos").select("id,valor,data_movimento,tipo,categoria").eq("empresa_id", empresaAtiva.id),
    admin.from("financeiro_contas_bancarias").select("id,nome,ativo").eq("empresa_id", empresaAtiva.id).eq("ativo", true),
    admin.from("financeiro_contas_saldos").select("id,saldo_atual").eq("empresa_id", empresaAtiva.id),
    admin.from("financeiro_fechamentos_socios_cortes").select("id,periodo_inicio,periodo_fim,created_at,demonstrativo").eq("empresa_id", empresaAtiva.id).order("periodo_fim", { ascending: false }).limit(24),
    carregarDadosContaCorrenteSocios({ socioId: "todos" }),
    admin.from("socio_conta_corrente_movimentos").select("socio_id,valor,origem_tipo,estornado,data_movimento").eq("empresa_id", empresaAtiva.id),
    admin.from("financeiro_recebimento_itens").select("recebimento_id,previsao_franquia_id,valor_liquidado"),
    admin.from("comissao_previsoes_franquia").select("id,venda_id,valor_previsto,valor_imposto").eq("empresa_id", empresaAtiva.id),
    admin.from("comissao_previsoes_participantes").select("id,venda_id,previsao_franquia_id,participante_comercial_id,competencia,nome_etapa,valor_previsto,valor_pago,status").eq("empresa_id", empresaAtiva.id).neq("status", "cancelada"),
    admin.from("vendas").select("id,participante_comercial_id,cliente_nome,valor_credito,status,data_venda").eq("empresa_id", empresaAtiva.id),
    admin.from("metas_comerciais").select("indicador,valor_meta,data_inicio,data_fim").eq("empresa_id", empresaAtiva.id).eq("alvo_tipo", "empresa"),
  ]);
  const erro = [sociosRes, contasRes, centrosRes, pagamentosRes, participantesRes,
    recebimentosRes, movimentosRes, bancosRes, saldosRes, cortesRes, ledgerRes, recebimentoItensRes,
    previsoesFranquiaRes, previsoesParticipantesRes, vendasRes, metasRes].find((res) => res.error);
  if (erro?.error) throw new Error(`Não foi possível conferir o fechamento: ${erro.error.message}`);

  const hoje = obterHojeCuiaba();
  const cortes = (cortesRes.data || []) as Array<{ id: string; periodo_inicio: string; periodo_fim: string; created_at: string; demonstrativo: FechamentoCalculado }>;
  const ultimo = cortes[0];
  const datas = [
    ...(contasRes.data || []).filter((c) => c.status === "paga" && c.pago_em).map((c) => c.pago_em!),
    ...(recebimentosRes.data || []).map((r) => r.data_recebimento),
    ...(pagamentosRes.data || []).map((p) => p.data_pagamento),
    ...(movimentosRes.data || []).map((m) => m.data_movimento),
  ].filter(Boolean).sort();
  const inicioProximo = ultimo ? new Date(Date.parse(`${ultimo.periodo_fim}T12:00:00Z`) + 86400000).toISOString().slice(0, 10) : (datas[0] || hoje);
  const centrosFiscal = new Set((centrosRes.data || []).filter((c) => c.descontado_comissao).map((c) => c.id));
  const centros = new Map((centrosRes.data || []).map((c) => [c.id, { nome: c.nome || "Sem categoria", teto: c.limite_mensal === null ? null : numero(c.limite_mensal) }]));
  const contasPeriodo = (contasRes.data || []).filter((c) => c.status === "paga" && c.pago_em && c.pago_em >= inicioProximo && c.pago_em <= hoje);
  const operacionais = contasPeriodo.filter((c) => !c.retirar_reserva_impostos && !centrosFiscal.has(c.centro_custo_id));
  const despesasEmpresaSemSaida = contasPeriodo.filter((c) => !c.pago_pessoalmente && !c.caixa_movimento_id);
  const participantes = new Map((participantesRes.data || []).map((p) => [p.id, p.usuario_id]));
  const socios = (sociosRes.data || []).map((s) => {
    const nome = String(s.nome);
    const comissaoGuardada = (pagamentosRes.data || [])
      .filter((p) => p.data_pagamento >= inicioProximo && p.data_pagamento <= hoje && participantes.get(p.participante_comercial_id) === s.usuario_id)
      .reduce((soma, p) => soma + numero(p.valor_liquido), 0);
    const adiantamentoPessoal = operacionais
      .filter((c) => c.pago_pessoalmente && c.socio_pagador_usuario_id === s.usuario_id)
      .reduce((soma, c) => soma + numero(c.valor), 0)
      + (ledgerRes.data || []).filter((m) => !m.estornado && m.socio_id === s.id && m.origem_tipo === "aporte_dinheiro_proprio" && m.data_movimento >= inicioProximo && m.data_movimento <= hoje)
        .reduce((soma, m) => soma + numero(m.valor), 0);
    const anterior = ultimo?.demonstrativo?.socios?.find((item) => item.id === s.id);
    const saldoAnterior = arredondar(numero(anterior?.ficouNaEmpresa) - numero(anterior?.faltaCobrir));
    return { id: s.id, nome, percentual: numero(s.percentual_participacao), comissaoGuardada: arredondar(comissaoGuardada), comissaoGuardadaMensal: [] as Array<{ competencia: string; valor: number; itens: Array<{ descricao: string; cliente: string; valor: number; status: string }> }>, comissaoFuturaMensal: [] as Array<{ competencia: string; valor: number; itens: Array<{ descricao: string; cliente: string; valor: number; status: string }> }>, adiantamentoPessoal: arredondar(adiantamentoPessoal), saldoAnterior };
  });
  const banco = (bancosRes.data || []).find((b) => /empresa/i.test(b.nome)) || null;
  const saldoBanco = (saldosRes.data || []).find((s) => s.id === banco?.id);
  const recebidos = (recebimentosRes.data || []).filter((r) => r.data_recebimento >= inicioProximo && r.data_recebimento <= hoje)
    .reduce((soma, r) => soma + numero(r.valor_total), 0);
  const entradas = (movimentosRes.data || []).filter((m) => m.data_movimento >= inicioProximo && m.data_movimento <= hoje && m.tipo === "ENTRADA" && m.categoria === "REPASSE_ADMINISTRADORA")
    .reduce((soma, m) => soma + numero(m.valor), 0);
  const bloqueios: string[] = [];
  if (!banco) bloqueios.push("Identificar a conta bancária da empresa.");
  if (dadosSocios.reservaImpostosControle.saldoReserva < 0) bloqueios.push("A reserva de impostos está negativa; concilie as guias e retenções.");
  if (Math.abs(recebidos - entradas) > 0.01) bloqueios.push(`Conciliar repasses: recebimentos ${arredondar(recebidos)} e entradas na conta ${arredondar(entradas)} não batem.`);
  const saldoSistemaBanco = numero(saldoBanco?.saldo_atual);
  const totalSemSaida = arredondar(despesasEmpresaSemSaida.reduce((soma, conta) => soma + numero(conta.valor), 0));
  if (despesasEmpresaSemSaida.length) bloqueios.push(`Conciliar ${despesasEmpresaSemSaida.length} contas pagas pela empresa (${totalSemSaida}) sem saída vinculada no caixa. O saldo bancário exibido ainda não é confiável.`);
  const outrosPessoais = socios.filter((s) => /eroni/i.test(s.nome) && s.adiantamentoPessoal > 0);
  if (outrosPessoais.length) bloqueios.push("Corrigir as contas lançadas como dinheiro pessoal de Eroni; o titular informou que saíram da empresa.");
  if (dadosSocios.historicoClassificacao.classificadoFernandoComissao > 0 && !ultimo) bloqueios.push("Reverter a classificação histórica de R$ 9.300 para não duplicar o direito de Fernando.");
  if (inicioProximo > hoje) bloqueios.push("O período seguinte ainda não começou.");
  const recebimentosConfirmados = (recebimentosRes.data || []).filter((r) => r.data_recebimento >= inicioProximo && r.data_recebimento <= hoje);
  const idsRecebimentos = new Set(recebimentosConfirmados.map((r) => r.id));
  const previsoesFranquia = new Map((previsoesFranquiaRes.data || []).map((p) => [p.id, p]));
  const vendas = new Map((vendasRes.data || []).map((v) => [v.id, v]));
  const sociosUsuarios = new Set((sociosRes.data || []).map((s) => s.usuario_id));
  const previsoesParticipantes = new Map<string, Array<{ participante_comercial_id: string; valor_previsto: number }>>();
  for (const previsao of previsoesParticipantesRes.data || []) {
    const itens = previsoesParticipantes.get(previsao.previsao_franquia_id) || [];
    itens.push({ participante_comercial_id: previsao.participante_comercial_id, valor_previsto: numero(previsao.valor_previsto) });
    previsoesParticipantes.set(previsao.previsao_franquia_id, itens);
  }
  const competenciaAtual = hoje.slice(0, 7);
  for (const socio of socios) {
    const porMesGuardado = new Map<string, { valor: number; itens: Array<{ descricao: string; cliente: string; valor: number; status: string }> }>();
    for (const pagamento of pagamentosRes.data || []) {
      if (pagamento.data_pagamento < inicioProximo || pagamento.data_pagamento > hoje || participantes.get(pagamento.participante_comercial_id) !== (sociosRes.data || []).find((item) => item.id === socio.id)?.usuario_id) continue;
      const competencia = pagamento.data_pagamento.slice(0, 7);
      const atual = porMesGuardado.get(competencia) || { valor: 0, itens: [] };
      atual.valor += numero(pagamento.valor_liquido);
      atual.itens.push({ descricao: `Pagamento confirmado em ${pagamento.data_pagamento.split("-").reverse().join("/")}`, cliente: "Comissão mantida no caixa", valor: numero(pagamento.valor_liquido), status: "guardada" });
      porMesGuardado.set(competencia, atual);
    }
    socio.comissaoGuardadaMensal = Array.from(porMesGuardado, ([competencia, item]) => ({ competencia, valor: arredondar(item.valor), itens: item.itens })).sort((a, b) => a.competencia.localeCompare(b.competencia));
    const porMesFuturo = new Map<string, { valor: number; itens: Array<{ descricao: string; cliente: string; valor: number; status: string }> }>();
    for (const previsao of previsoesParticipantesRes.data || []) {
      if (previsao.competencia < competenciaAtual || participantes.get(previsao.participante_comercial_id) !== (sociosRes.data || []).find((item) => item.id === socio.id)?.usuario_id) continue;
      const disponivel = Math.max(0, numero(previsao.valor_previsto) - numero(previsao.valor_pago));
      if (disponivel > 0) {
        const atual = porMesFuturo.get(previsao.competencia) || { valor: 0, itens: [] };
        atual.valor += disponivel;
        const venda = vendas.get(previsao.venda_id);
        atual.itens.push({ descricao: previsao.nome_etapa || "Etapa da comissão", cliente: venda?.cliente_nome || "Cliente não informado", valor: arredondar(disponivel), status: previsao.status });
        porMesFuturo.set(previsao.competencia, atual);
      }
    }
    socio.comissaoFuturaMensal = Array.from(porMesFuturo, ([competencia, item]) => ({ competencia, valor: arredondar(item.valor), itens: item.itens })).sort((a, b) => a.competencia.localeCompare(b.competencia));
  }
  let margemConsultores = 0;
  let comissoesConsultores = 0;
  const comissoesPorPessoa = new Map<string, { nome: string; papel: "SOCIO" | "CONSULTOR"; recebidaNoCaixa: number; reservada: number }>();
  const adicionarComissao = (participanteId: string, recebidaNoCaixa: number, reservada: number) => {
    const participante = (participantesRes.data || []).find((p) => p.id === participanteId);
    if (!participante) return;
    const papel: "SOCIO" | "CONSULTOR" = sociosUsuarios.has(participante.usuario_id) ? "SOCIO" : "CONSULTOR";
    const atual = comissoesPorPessoa.get(participanteId) || { nome: participante.nome || "Participante", papel, recebidaNoCaixa: 0, reservada: 0 };
    atual.recebidaNoCaixa += recebidaNoCaixa;
    atual.reservada += reservada;
    comissoesPorPessoa.set(participanteId, atual);
  };
  for (const pagamento of pagamentosRes.data || []) {
    if (pagamento.data_pagamento >= inicioProximo && pagamento.data_pagamento <= hoje) {
      adicionarComissao(pagamento.participante_comercial_id, numero(pagamento.valor_liquido), 0);
    }
  }
  for (const item of recebimentoItensRes.data || []) {
    if (!idsRecebimentos.has(item.recebimento_id)) continue;
    const previsao = previsoesFranquia.get(item.previsao_franquia_id);
    if (!previsao) continue;
    const participanteVenda = vendas.get(previsao.venda_id)?.participante_comercial_id;
    const usuarioVenda = participanteVenda ? participantes.get(participanteVenda) : null;
    if (usuarioVenda && sociosUsuarios.has(usuarioVenda)) continue;
    const valorItem = numero(item.valor_liquidado);
    const base = numero(previsao.valor_previsto) || valorItem;
    const proporcao = base > 0 ? valorItem / base : 1;
    const imposto = numero(previsao.valor_imposto) * proporcao;
    const comissao = (previsoesParticipantes.get(previsao.id) || [])
      .reduce((soma, p) => soma + p.valor_previsto * proporcao, 0);
    for (const comissaoParticipante of previsoesParticipantes.get(previsao.id) || []) {
      adicionarComissao(comissaoParticipante.participante_comercial_id, 0, comissaoParticipante.valor_previsto * proporcao);
    }
    comissoesConsultores += comissao;
    margemConsultores += valorItem - imposto - comissao;
  }
  const receitasEventos = (movimentosRes.data || [])
    .filter((m) => m.tipo === "ENTRADA" && m.categoria === "RECEITA_EVENTO" && m.data_movimento >= inicioProximo && m.data_movimento <= hoje)
    .reduce((soma, m) => soma + numero(m.valor), 0);
  const porMes = new Map<string, Map<string, { centroId: string | null; gasto: number }>>();
  for (const conta of (contasRes.data || []).filter((c) => c.status === "paga" && c.pago_em && !c.retirar_reserva_impostos && !centrosFiscal.has(c.centro_custo_id))) {
    const mes = conta.pago_em!.slice(0, 7);
    const categorias = porMes.get(mes) || new Map<string, { centroId: string | null; gasto: number }>();
    const centro = centros.get(conta.centro_custo_id)?.nome || "Sem categoria";
    const atual = categorias.get(centro);
    categorias.set(centro, { centroId: conta.centro_custo_id || null, gasto: numero(atual?.gasto) + numero(conta.valor) });
    porMes.set(mes, categorias);
  }
  const mesesDespesa = Array.from(porMes.keys()).sort();
  const despesasPorMes = mesesDespesa.map((mes, indice) => {
    const anterior = indice ? porMes.get(mesesDespesa[indice - 1]) : undefined;
    const categorias = Array.from(porMes.get(mes) || []).map(([nome, item]) => {
      const anteriorGasto = numero(anterior?.get(nome)?.gasto);
      return { centroId: item.centroId, nome, gasto: arredondar(item.gasto), teto: Array.from(centros.values()).find((c) => c.nome === nome)?.teto ?? null, variacao: indice ? arredondar(item.gasto - anteriorGasto) : null };
    }).sort((a, b) => b.gasto - a.gasto);
    const itens = operacionais.filter((conta) => conta.pago_em?.slice(0, 7) === mes).map((conta) => ({ id: conta.id, descricao: conta.descricao, fornecedor: conta.fornecedor || null, pagoEm: conta.pago_em!, centroId: conta.centro_custo_id || null, centroNome: centros.get(conta.centro_custo_id)?.nome || "Sem categoria", valor: arredondar(numero(conta.valor)) })).sort((a, b) => a.pagoEm.localeCompare(b.pagoEm) || a.descricao.localeCompare(b.descricao));
    return { mes, total: arredondar(categorias.reduce((soma, categoria) => soma + categoria.gasto, 0)), itens, categorias };
  });
  const mesesComercial = new Set<string>();
  const mesEntrada = (participante: { data_entrada: string | null; created_at: string | null }) => String(participante.data_entrada || participante.created_at || "").slice(0, 7);
  for (const participante of participantesRes.data || []) if (mesEntrada(participante)) mesesComercial.add(mesEntrada(participante));
  for (const venda of vendasRes.data || []) if (venda.data_venda) mesesComercial.add(String(venda.data_venda).slice(0, 7));
  for (const recebimento of recebimentosRes.data || []) if (recebimento.data_recebimento) mesesComercial.add(String(recebimento.data_recebimento).slice(0, 7));
  const valorRepassePorRecebimento = new Map((recebimentosRes.data || []).map((r) => [r.id, 0]));
  for (const item of recebimentoItensRes.data || []) valorRepassePorRecebimento.set(item.recebimento_id, numero(valorRepassePorRecebimento.get(item.recebimento_id)) + numero(item.valor_liquidado));
  const desempenhoConsultores = Array.from(mesesComercial).sort().map((mes) => {
    const participantesAteMes = (participantesRes.data || []).filter((p) => mesEntrada(p) <= mes && p.status === "ATIVO").length;
    const novos = (participantesRes.data || []).filter((p) => mesEntrada(p) === mes).length;
    const vendasMes = (vendasRes.data || []).filter((v) => v.status !== "cancelada" && String(v.data_venda || "").slice(0, 7) === mes);
    const repasses = (recebimentosRes.data || []).filter((r) => String(r.data_recebimento || "").slice(0, 7) === mes).reduce((soma, r) => soma + numero(valorRepassePorRecebimento.get(r.id)), 0);
    return { mes, consultoresAtivos: participantesAteMes, novosConsultores: novos, vendas: vendasMes.length, creditoVendido: arredondar(vendasMes.reduce((soma, venda) => soma + numero(venda.valor_credito), 0)), repassesGerados: arredondar(repasses) };
  });
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const metasAtuais = (metasRes.data || []).filter((meta) => meta.data_inicio <= hoje && meta.data_fim >= inicioMes);
  const meta = (indicador: string) => numero(metasAtuais.find((item) => item.indicador === indicador)?.valor_meta);
  return {
    inicio: inicioProximo, hoje,
    despesasPagas: arredondar(operacionais.reduce((soma, c) => soma + numero(c.valor), 0)),
    quantidadePagas: operacionais.length,
    despesasEmpresaSemSaida: totalSemSaida,
    quantidadeDespesasSemSaida: despesasEmpresaSemSaida.length,
    saldoAposDespesasPendentes: arredondar(saldoSistemaBanco - totalSemSaida),
    impostosPagos: arredondar(contasPeriodo.filter((c) => c.retirar_reserva_impostos).reduce((soma, c) => soma + numero(c.valor), 0)),
    reservaImpostos: dadosSocios.reservaImpostosControle.saldoReserva,
    contasEmpresa: (bancosRes.data || []).map((b) => ({ id: b.id, nome: b.nome })),
    repassesRecebidos: arredondar(recebidos),
    margemConsultores: arredondar(margemConsultores),
    receitasEventos: arredondar(receitasEventos),
    comissoesConsultores: arredondar(comissoesConsultores),
    comissoesPorPessoa: Array.from(comissoesPorPessoa.values()).map((item) => ({ ...item, recebidaNoCaixa: arredondar(item.recebidaNoCaixa), reservada: arredondar(item.reservada) })).sort((a, b) => a.papel.localeCompare(b.papel) || a.nome.localeCompare(b.nome)),
    despesasPorMes,
    desempenhoConsultores,
    metasComerciais: { consultores: meta("consultores_cadastrados"), vendas: meta("quantidade_vendas"), credito: meta("valor_credito_vendido") },
    bancoEmpresa: banco ? { id: banco.id, nome: banco.nome, saldoSistema: saldoSistemaBanco } : null,
    socios,
    bloqueios,
    fechamentos: cortes,
  };
}

export async function salvarMetasComerciaisFechamento(form: FormData): Promise<void> {
  const { empresaAtiva } = await requireErpRouteAccess("conta-corrente-socios");
  const { empresaAtiva: permitida } = await requireTenantPermission("gerenciar_financeiro");
  if (permitida.id !== empresaAtiva.id) throw new Error("Empresa ativa divergente.");
  const hoje = obterHojeCuiaba();
  const inicio = `${hoje.slice(0, 7)}-01`;
  const fim = new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const metas = [
    ["consultores_cadastrados", "Consultores ativos no mês", dinheiro(form, "meta_consultores")],
    ["quantidade_vendas", "Vendas realizadas no mês", dinheiro(form, "meta_vendas")],
    ["valor_credito_vendido", "Crédito vendido no mês", dinheiro(form, "meta_credito")],
  ] as const;
  const admin = createAdminClient();
  for (const [indicador, titulo, valor_meta] of metas) {
    const { error: apagar } = await admin.from("metas_comerciais").delete().eq("empresa_id", empresaAtiva.id).eq("alvo_tipo", "empresa").eq("indicador", indicador).eq("data_inicio", inicio).eq("data_fim", fim);
    if (apagar) throw new Error(apagar.message);
    const { error } = await admin.from("metas_comerciais").insert({ empresa_id: empresaAtiva.id, titulo, alvo_tipo: "empresa", indicador, periodo_tipo: "mensal", data_inicio: inicio, data_fim: fim, valor_meta });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/erp/fechamento-socios");
}

export async function carregarPainelFechamento(): Promise<PainelFechamento> {
  return lerPainel();
}

export async function registrarAporteProprioSocio(form: FormData): Promise<void> {
  const { empresaAtiva, usuario } = await requireErpRouteAccess("conta-corrente-socios");
  const { empresaAtiva: permitida } = await requireTenantPermission("gerenciar_financeiro");
  if (permitida.id !== empresaAtiva.id) throw new Error("Empresa ativa divergente.");
  const socioId = String(form.get("aporte_socio_id") || "");
  const contaId = String(form.get("aporte_conta_id") || "");
  const data = String(form.get("aporte_data") || "");
  const descricao = String(form.get("aporte_descricao") || "").trim();
  const comprovante = String(form.get("aporte_comprovante") || "").trim();
  const valorAporte = dinheiro(form, "aporte_valor");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || descricao.length < 3 || comprovante.length < 5) {
    throw new Error("Informe data, descrição e referência do depósito.");
  }
  const admin = createAdminClient();
  const { error } = await admin.rpc("rpc_registrar_aporte_proprio_socio_servidor", {
    p_empresa_id: empresaAtiva.id,
    p_socio_id: socioId,
    p_conta_bancaria_id: contaId,
    p_valor: valorAporte,
    p_data: data,
    p_descricao: descricao,
    p_comprovante: comprovante,
    p_idempotency_key: `aporte-proprio:${socioId}:${data}:${valorAporte}:${randomUUID()}`,
    p_auth_user_id: usuario.auth_user_id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/erp/fechamento-socios");
  revalidatePath("/erp/conta-corrente-socios");
  revalidatePath("/erp/financeiro");
}

function dinheiro(form: FormData, chave: string) {
  const bruto = String(form.get(chave) || "").trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(bruto)) throw new Error(`Valor inválido em ${chave}.`);
  return Number(bruto.replace(",", "."));
}

export async function registrarFechamentoSocios(form: FormData): Promise<{ id: string }> {
  const { empresaAtiva, usuario } = await requireErpRouteAccess("conta-corrente-socios");
  const { empresaAtiva: permitida } = await requireTenantPermission("gerenciar_financeiro");
  if (permitida.id !== empresaAtiva.id) throw new Error("Empresa ativa divergente.");
  const painel = await lerPainel();
  const fim = String(form.get("fim") || "");
  if (fim !== painel.hoje || fim < painel.inicio) throw new Error("Este painel fecha somente o histórico acumulado até hoje.");
  if (painel.bloqueios.length) throw new Error(`Ainda há pendências: ${painel.bloqueios.join(" ")}`);
  const referenciaExtrato = String(form.get("referencia_extrato") || "").trim();
  const fonteLucro = String(form.get("fonte_lucro") || "").trim();
  const observacoes = String(form.get("observacoes") || "").trim();
  if (referenciaExtrato.length < 10 || fonteLucro.length < 20 || observacoes.length < 20) {
    throw new Error("Informe a referência do extrato, a origem do lucro e as observações do acerto.");
  }
  const saldoExtrato = dinheiro(form, "saldo_extrato");
  if (!painel.bancoEmpresa || Math.abs(saldoExtrato - painel.bancoEmpresa.saldoSistema) > 0.01) {
    throw new Error("O saldo conferido no extrato deve bater com a conta da empresa no sistema.");
  }
  const retirada = painel.socios.map((socio) => ({ ...socio, retirada: dinheiro(form, `retirada_${socio.id}`) }));
  const recursoAutomatico = arredondar(painel.margemConsultores + painel.receitasEventos);
  if (Math.abs(dinheiro(form, "lucro_consultores") - recursoAutomatico) > 0.01) {
    throw new Error("O valor que abate as despesas é calculado pelos repasses e pelas receitas de eventos; atualize a tela antes de fechar.");
  }
  const calculo = calcularFechamentoSocios({
    despesasPagas: painel.despesasPagas,
    lucroConsultores: recursoAutomatico,
    reservaImpostos: painel.reservaImpostos,
    caixaAntes: saldoExtrato,
    socios: retirada,
  });
  if (calculo.cobertura < 0) throw new Error("O caixa não cobre impostos, lucro restante e valores deixados pelos sócios.");
  const sociosComComprovantes = calculo.socios.map((socio) => {
    const comprovanteRetirada = String(form.get(`comprovante_${socio.id}`) || "").trim();
    if (socio.retirada > 0 && comprovanteRetirada.length < 8) {
      throw new Error(`Informe a referência do comprovante da retirada de ${socio.nome}.`);
    }
    return { ...socio, comprovanteRetirada };
  });
  if (form.get("confirmo") !== "sim") throw new Error("Confirme que conferiu o demonstrativo antes de lacrar.");
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rpc_registrar_fechamento_socios_corte_servidor", {
    p_empresa_id: empresaAtiva.id,
    p_periodo_inicio: painel.inicio,
    p_periodo_fim: fim,
    p_demonstrativo: { ...calculo, socios: sociosComComprovantes, referenciaExtrato, fonteLucro, versao: 1, contaEmpresaId: painel.bancoEmpresa.id },
    p_observacoes: observacoes,
    p_idempotency_key: `corte-socios:${painel.inicio}:${fim}:${randomUUID()}`,
    p_auth_user_id: usuario.auth_user_id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/erp/fechamento-socios");
  revalidatePath("/erp/conta-corrente-socios");
  return { id: data as string };
}
