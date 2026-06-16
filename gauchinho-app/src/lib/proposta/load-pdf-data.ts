import type { PropostaPdfData, MarcoProjecaoPdf, GrupoCotaPdfRow } from "./pdf/types";
import { fmtDateBr, fmtMoney } from "./pdf/format";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_PROPOSTAS,
  DEFAULT_SITE,
  DEFAULT_CONTATO,
  getConfigJsonPublic,
} from "@/server/config";
import { gerarProjecaoAnoAno, resumoProjecaoAnos } from "@/lib/simulador/projecao";
import type { EntradaConsorcio } from "@/lib/simulador/consorcio";

type PropostaRow = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function resolveValidadeTexto(p: PropostaRow, validadePadraoDias: number): string | null {
  if (p.validade_data) {
    return fmtDateBr(String(p.validade_data));
  }
  const dias = num(p.validade_dias) ?? validadePadraoDias;
  if (!dias) return null;
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return fmtDateBr(d.toISOString());
}

function buildMarcosFromConsorcio(entrada: EntradaConsorcio, prazoMeses: number): MarcoProjecaoPdf[] {
  const linhas = gerarProjecaoAnoAno(entrada);
  const anosPrazo = Math.ceil(prazoMeses / 12);
  const marcosAnos = [1, 3, 5, 10].filter((a) => a <= anosPrazo);
  if (anosPrazo > 0 && !marcosAnos.includes(anosPrazo)) {
    marcosAnos.push(anosPrazo);
  }
  marcosAnos.sort((a, b) => a - b);
  return resumoProjecaoAnos(linhas, marcosAnos).map((l) => ({
    periodo: l.ano === anosPrazo && l.ano >= 10 ? `${l.ano} anos (final)` : `${l.ano} ${l.ano === 1 ? "ano" : "anos"}`,
    totalPago: l.totalPagoAcumulado,
    creditoReajustado: l.creditoEstimadoReajustado,
    valorizacao: l.valorizacaoAcumuladaCredito,
    ganhoPatrimonial: l.ganhoPatrimonialEstimado,
  }));
}

export async function buildPropostaPdfData(
  propostaId: string,
  overrides?: {
    consultor_nome?: string;
    consultor_telefone?: string;
    consultor_email?: string;
    parceiro_nome?: string;
    validade_dias?: number;
    validade_data?: string;
  },
): Promise<PropostaPdfData> {
  const admin = createAdminClient();
  const { data: proposta, error } = await admin
    .from("propostas")
    .select("*")
    .eq("id", propostaId)
    .single();
  if (error || !proposta) throw new Error(error?.message ?? "Proposta não encontrada");

  const p = proposta as PropostaRow;
  const [site, contato, propostasCfg] = await Promise.all([
    getConfigJsonPublic("site", DEFAULT_SITE),
    getConfigJsonPublic("contato", DEFAULT_CONTATO),
    getConfigJsonPublic("propostas", DEFAULT_PROPOSTAS),
  ]);

  const dadosSim = (p.dados_simulacao ?? {}) as Record<string, unknown>;
  const comparativoRaw = (p.comparativo_financiamento ?? dadosSim.comparativo ?? null) as Record<
    string,
    unknown
  > | null;

  let gruposCotas: GrupoCotaPdfRow[] = [];
  let gruposTotais: PropostaPdfData["gruposTotais"] = null;

  const simGrupoId = dadosSim.simulacao_grupo_id as string | undefined;

  if (simGrupoId || dadosSim.selecoes) {
    const simId = simGrupoId as string | undefined;
    if (simId) {
      const { data: itens } = await admin
        .from("simulacoes_grupos_itens")
        .select("*")
        .eq("simulacao_grupo_id", simId);
      gruposCotas = (itens ?? []).map((it) => ({
        codigoGrupo: String(it.codigo_grupo ?? ""),
        modalidade: String(it.modalidade ?? ""),
        valorCredito: num(it.valor_credito) ?? 0,
        parcela: num(it.primeira_parcela) ?? 0,
        saldoDevedor: num(it.saldo_devedor) ?? 0,
        lanceEmbutido: num(it.lance_embutido) ?? 0,
        recursoProprio: num(it.recurso_proprio) ?? 0,
        lanceTotal: num(it.lance_total) ?? 0,
        seguro: num(it.seguro) ?? 0,
        prazoRestante: it.parcelas_restantes ?? "—",
      }));
      const { data: sim } = await admin.from("simulacoes_grupos").select("*").eq("id", simId).maybeSingle();
      if (sim) {
        gruposTotais = {
          creditoTotal: num(sim.total_credito) ?? 0,
          lanceTotal: num(sim.total_lance) ?? 0,
          primeiraParcela: num(sim.total_primeira_parcela) ?? 0,
          creditoLiquido: num(sim.credito_liquido) ?? 0,
        };
      }
    }
  }

  const totaisGrupos = dadosSim.totais as Record<string, unknown> | undefined;
  if (gruposTotais == null && totaisGrupos) {
    gruposTotais = {
      creditoTotal: num(totaisGrupos.somaCotas) ?? num(p.valor_credito) ?? 0,
      lanceTotal: num(totaisGrupos.lanceTotal) ?? 0,
      primeiraParcela: num(totaisGrupos.primeiraParcela) ?? num(p.valor_parcela) ?? 0,
      creditoLiquido: num(totaisGrupos.creditoLiquido) ?? 0,
    };
  }

  const detalhesLinhas: Array<{ label: string; value: string }> = [];
  const tipo = String(p.tipo_proposta ?? "");
  const isFin = tipo.toLowerCase().includes("financiamento");
  const isCarta = tipo.toLowerCase().includes("carta");
  const cartaDados = (dadosSim.carta ?? null) as Record<string, unknown> | null;

  if (isCarta && cartaDados) {
    detalhesLinhas.push(
      { label: "Administradora", value: String(cartaDados.administradora ?? "—") },
      { label: "Valor do crédito", value: fmtMoney(num(p.valor_credito) ?? num(cartaDados.credito)) },
      { label: "Entrada", value: fmtMoney(num(p.entrada) ?? num(cartaDados.entrada)) },
      { label: "Prazo (parcelas)", value: String(num(p.prazo) ?? num(cartaDados.prazo_quantidade) ?? "—") },
      { label: "Parcela", value: fmtMoney(num(p.valor_parcela) ?? num(cartaDados.valor_parcela)) },
      { label: "Saldo devedor", value: fmtMoney(num(cartaDados.saldo_devedor)) },
      { label: "Próxima parcela", value: cartaDados.proxima_parcela_data ? fmtDateBr(String(cartaDados.proxima_parcela_data)) : "—" },
      { label: "Taxa de transferência", value: fmtMoney(num(cartaDados.taxa_transferencia)) },
    );
  } else if (isFin) {
    detalhesLinhas.push(
      { label: "Valor do bem", value: fmtMoney(num(p.valor_credito)) },
      { label: "Entrada", value: fmtMoney(num(p.entrada)) },
      { label: "Prazo (meses)", value: String(num(p.prazo) ?? "—") },
      { label: "Parcela estimada", value: fmtMoney(num(p.valor_parcela)) },
    );
    const fin = comparativoRaw?.financiamento as Record<string, unknown> | undefined;
    if (fin) {
      detalhesLinhas.push(
        { label: "Total pago", value: fmtMoney(num(fin.valorTotalPago ?? fin.custoFinal)) },
        { label: "Juros estimados", value: fmtMoney(num(fin.jurosTotais)) },
      );
    }
  } else {
    const res = (comparativoRaw ?? dadosSim.resultado ?? {}) as Record<string, unknown>;
    detalhesLinhas.push(
      { label: "Valor do crédito", value: fmtMoney(num(p.valor_credito)) },
      { label: "Prazo (meses)", value: String(num(p.prazo) ?? "—") },
      { label: "Parcela inicial estimada", value: fmtMoney(num(p.valor_parcela) ?? num(res.primeiraParcela)) },
      { label: "Lance próprio", value: fmtMoney(num(p.entrada) ?? num(res.entrada)) },
      { label: "Lance embutido", value: fmtMoney(num(res.lanceEmbutido)) },
      { label: "Lance total", value: fmtMoney(num(res.lanceTotal)) },
      { label: "Saldo devedor inicial", value: fmtMoney(num(res.saldoDevedorInicial)) },
      { label: "Saldo devedor final", value: fmtMoney(num(res.saldoDevedorFinal)) },
      { label: "Parcela pós-contemplação", value: fmtMoney(num(res.parcelaPosContemplacao)) },
      { label: "Parcelas restantes", value: String(num(res.parcelasRestantes) ?? "—") },
      {
        label: "Custo adm. efetivo mensal",
        value: res.custoAdmEfetivoMensalPercentual != null
          ? `${Number(res.custoAdmEfetivoMensalPercentual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}% a.m.`
          : "—",
      },
      {
        label: "Custo adm. efetivo anual",
        value: res.custoAdmEfetivoAnualPercentual != null
          ? `${Number(res.custoAdmEfetivoAnualPercentual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}% a.a.`
          : "—",
      },
      { label: "Taxa administrativa (%)", value: String(num(p.taxa_administrativa) ?? "—") },
      { label: "Fundo de reserva (%)", value: String(num(p.fundo_reserva) ?? "—") },
      { label: "Seguro prestamista (%)", value: String(num(p.seguro_prestamista) ?? "—") },
    );
  }

  let comparativo: PropostaPdfData["comparativo"] = null;
  if (comparativoRaw?.consorcio && comparativoRaw?.financiamento) {
    const c = comparativoRaw.consorcio as Record<string, unknown>;
    const f = comparativoRaw.financiamento as Record<string, unknown>;
    comparativo = {
      consorcioParcela: num(c.parcelaEstimada) ?? 0,
      consorcioTotal: num(c.valorTotalEstimado) ?? 0,
      financiamentoParcela: num(f.parcelaEstimada) ?? 0,
      financiamentoTotal: num(f.custoFinal ?? f.valorTotalPago) ?? 0,
      diferencaTotal: num(comparativoRaw.diferencaCustoTotal) ?? 0,
      diferencaParcela: num(comparativoRaw.diferencaParcela) ?? 0,
    };
  }

  let marcosProjecao: MarcoProjecaoPdf[] = [];
  const resumoStored = p.resumo_projecao as MarcoProjecaoPdf[] | null;
  if (resumoStored?.length) {
    marcosProjecao = resumoStored;
  } else if (!isFin && num(p.valor_credito) && num(p.prazo)) {
    const entradaCons: EntradaConsorcio = {
      valorCredito: num(p.valor_credito)!,
      prazoMeses: num(p.prazo)!,
      taxaAdministrativaPercentual: num(p.taxa_administrativa) ?? 20,
      fundoReservaPercentual: num(p.fundo_reserva) ?? 2,
      seguroPrestamistaPercentual: num(p.seguro_prestamista) ?? 0,
      reajusteAnualCredito: num(p.reajuste_credito_anual) ?? 8,
      correcaoAnualParcela: num(p.correcao_parcela_anual) ?? 8,
    };
    marcosProjecao = buildMarcosFromConsorcio(entradaCons, num(p.prazo)!);
  }

  const consultorNome = overrides?.consultor_nome ?? (p.consultor_nome as string) ?? null;
  const consultorTel = overrides?.consultor_telefone ?? (p.consultor_telefone as string) ?? null;
  const consultorEmail = overrides?.consultor_email ?? (p.consultor_email as string) ?? null;
  const usarConsultor = !!(consultorNome && (consultorTel || consultorEmail));

  const validadePadrao = propostasCfg.validadePadraoDias ?? 7;
  let validadeTexto = resolveValidadeTexto(p, validadePadrao);
  if (overrides?.validade_data) validadeTexto = fmtDateBr(overrides.validade_data);

  const valorTotal =
    num((comparativoRaw as Record<string, unknown>)?.saldoDevedorInicial) ??
    comparativo?.consorcioTotal ??
    num((comparativoRaw?.consorcio as Record<string, unknown>)?.valorTotalEstimado) ??
    null;

  return {
    propostaId,
    dataEmissao: fmtDateBr(String(p.created_at ?? new Date().toISOString())),
    validadeTexto,
    cliente: {
      nome: String(p.nome_cliente ?? "Cliente"),
      whatsapp: (p.whatsapp_cliente as string) ?? null,
      email: (p.email_cliente as string) ?? null,
      cidade: (p.cidade_cliente as string) ?? null,
    },
    tipoProposta: tipo || "Consórcio",
    tipoBem: (p.tipo_bem as string) ?? null,
    parceiroNome: overrides?.parceiro_nome ?? (p.parceiro_nome as string) ?? null,
    consultor: {
      nome: consultorNome,
      telefone: consultorTel,
      email: consultorEmail,
      usarConsultor,
    },
    contatoGauchinho: {
      nomeEmpresa: site.nomeEmpresa || "Gauchinho Escritório de Soluções Financeiras",
      whatsapp: contato.whatsappPrincipal || null,
      email: contato.email || null,
      site: site.siteUrl || null,
      endereco: contato.endereco || null,
    },
    resumo: {
      valorCredito: num(p.valor_credito),
      prazo: num(p.prazo),
      parcela: num(p.valor_parcela),
      entrada: num(p.entrada),
      lanceEmbutido: gruposTotais?.lanceTotal ?? null,
      valorTotal,
      creditoLiquido: gruposTotais?.creditoLiquido ?? null,
    },
    detalhesLinhas,
    gruposCotas,
    gruposTotais,
    comparativo,
    marcosProjecao,
    mostrarProjecao: !isFin && !isCarta && marcosProjecao.length > 0,
  };
}
