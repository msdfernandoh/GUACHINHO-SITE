"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Coins,
  DollarSign,
  Eye,
  Info,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import type {
  ContaCorrenteResumoDTO,
  ItemContaLancadaDTO,
} from "@/app/erp/conta-corrente-socios/actions";
import {
  classificarOrigemHistoricaAction,
  deixarComissaoNaEmpresaAction,
  salvarBaixaContaComOrigemAction,
} from "@/app/erp/conta-corrente-socios/actions";

interface ContaCorrenteCentralSociosProps {
  dados: ContaCorrenteResumoDTO;
  onNavegarParaAba?: (aba: string) => void;
}

const brl = (val: number) =>
  val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDataBr = (val: string) => {
  if (!val) return "-";
  const [ano, mes, dia] = val.split("-");
  return dia ? `${dia}/${mes}/${ano}` : `${mes}/${ano}`;
};

export function ContaCorrenteCentralSocios({
  dados,
  onNavegarParaAba,
}: ContaCorrenteCentralSociosProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Mensagem de feedback
  const [feedback, setFeedback] = useState<{
    tipo: "sucesso" | "erro";
    texto: string;
  } | null>(null);

  // Estados dos Modais
  const [modalComposicaoTipo, setModalComposicaoTipo] = useState<
    "fernando" | "eroni" | "caixa" | "contas" | "impostos" | null
  >(null);

  const [modalDeixarComissaoAberto, setModalDeixarComissaoAberto] = useState(false);
  const [socioDeixarId, setSocioDeixarId] = useState<string>(
    dados.todosSocios[0]?.id || ""
  );
  const [valorDeixar, setValorDeixar] = useState<string>("5000,00");
  const [finalidadeDeixar, setFinalidadeDeixar] = useState<string>("CAPITAL_GIRO");
  const [obsDeixar, setObsDeixar] = useState<string>("");

  const [modalBaixaAberto, setModalBaixaAberto] = useState(false);
  const [contaSelecionadaBaixa, setContaSelecionadaBaixa] = useState<ItemContaLancadaDTO | null>(null);
  const [pagadorOp, setPagadorOp] = useState<"EMPRESA" | "ERONI" | "FERNANDO">("EMPRESA");
  const [origemRecurso, setOrigemRecurso] = useState<string>("CAIXA_EMPRESA");
  const [socioOrigemId, setSocioOrigemId] = useState<string>(
    dados.todosSocios[0]?.id || ""
  );
  const [dataBaixa, setDataBaixa] = useState<string>(new Date().toISOString().split("T")[0]);

  // Handler: Confirmar Classificação Histórica (R$ 9.300)
  function handleConfirmarClassificacaoHistorica() {
    startTransition(async () => {
      try {
        const res = await classificarOrigemHistoricaAction();
        setFeedback({
          tipo: "sucesso",
          texto: res.mensagem || "Classificação histórica de R$ 9.300 aplicada com sucesso!",
        });
        router.refresh();
      } catch (err: any) {
        setFeedback({
          tipo: "erro",
          texto: err.message || "Erro ao classificar origem histórica.",
        });
      }
    });
  }

  // Handler: Deixar Comissão na Empresa
  async function handleSalvarDeixarComissao(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData();
    form.set("socio_id", socioDeixarId);
    form.set("valor", valorDeixar);
    form.set("finalidade", finalidadeDeixar);
    form.set("observacoes", obsDeixar);

    startTransition(async () => {
      try {
        const res = await deixarComissaoNaEmpresaAction(form);
        setModalDeixarComissaoAberto(false);
        setFeedback({
          tipo: "sucesso",
          texto: res.mensagem || "Comissão retida na empresa registrada com sucesso!",
        });
        router.refresh();
      } catch (err: any) {
        setFeedback({
          tipo: "erro",
          texto: err.message || "Erro ao registrar comissão retida na empresa.",
        });
      }
    });
  }

  // Handler: Baixar Conta com Origem
  async function handleSalvarBaixaComOrigem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!contaSelecionadaBaixa) return;

    const form = new FormData();
    form.set("conta_id", contaSelecionadaBaixa.id);
    form.set("data_pagamento", dataBaixa);
    form.set("pagador_operacional", pagadorOp);
    form.set("origem_recurso_economico", origemRecurso);
    form.set("socio_origem_recurso_id", socioOrigemId);

    startTransition(async () => {
      try {
        const res = await salvarBaixaContaComOrigemAction(form);
        setModalBaixaAberto(false);
        setContaSelecionadaBaixa(null);
        setFeedback({
          tipo: "sucesso",
          texto: res.mensagem || "Conta baixada com segregação de origem com sucesso!",
        });
        router.refresh();
      } catch (err: any) {
        setFeedback({
          tipo: "erro",
          texto: err.message || "Erro ao baixar conta com origem.",
        });
      }
    });
  }

  // Despesas pagas por sócio para o Drill-Down analítico
  const fernandoSocio = dados.todosSocios.find((s) =>
    s.nome.toLowerCase().includes("fernando")
  );
  const eroniSocio = dados.todosSocios.find((s) =>
    s.nome.toLowerCase().includes("eroni")
  );

  const despesasPagasFernando = dados.despesasRateadas.filter(
    (d) =>
      d.status === "paga" &&
      (d.pagoPorSocioId === fernandoSocio?.id ||
        d.pagoPorSocioNome?.toLowerCase().includes("fernando"))
  );

  const despesasPagasEroni = dados.despesasRateadas.filter(
    (d) =>
      d.status === "paga" &&
      (d.pagoPorSocioId === eroniSocio?.id ||
        d.pagoPorSocioNome?.toLowerCase().includes("eroni"))
  );

  // Dois assuntos que não podem ser misturados no fechamento:
  // (1) contas abertas devem receber dinheiro na PJ; (2) conta já paga gera
  // eventual transferência entre os sócios.
  const valorTransferirParaFernando = Math.max(0, dados.acertoSocios.socioFernando.saldoAcerto);
  const valorTransferirParaEroni = Math.max(0, dados.acertoSocios.socioEroni.saldoAcerto);

  return (
    <div className="space-y-6">
      {/* Toast de Feedback */}
      {feedback && (
        <div
          className={`flex items-center justify-between rounded-2xl p-4 shadow-md transition-all ${
            feedback.tipo === "sucesso"
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-950"
              : "bg-rose-500/15 border border-rose-500/30 text-rose-950"
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.tipo === "sucesso" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            )}
            <p className="text-xs md:text-sm font-semibold">{feedback.texto}</p>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="rounded-lg p-1 hover:bg-black/5 text-slate-500 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* FAIXA DE TOPO — RESUMO EXECUTIVO (HOJE)                   */}
      {/* ========================================================= */}
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/50 p-5 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Resumo Executivo Instantâneo · Posição em Tempo Real (HOJE)
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            Regra 50% / 50% Societária
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {/* Card 1: Fernando Hugo */}
          <div className="group relative rounded-2xl border border-emerald-200/80 bg-white p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Fernando Hugo
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                  dados.resumoExecutivoHoje.fernandoTipo === "credito"
                    ? "bg-emerald-100 text-emerald-800"
                    : dados.resumoExecutivoHoje.fernandoTipo === "devedor"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {dados.resumoExecutivoHoje.fernandoStatus}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-emerald-950">
                {brl(Math.abs(dados.resumoExecutivoHoje.fernandoSaldoAcerto))}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {dados.resumoExecutivoHoje.fernandoSaldoAcerto >= 0
                ? "Crédito a receber no acerto"
                : "A compensar no acerto"}
            </p>
            <button
              type="button"
              onClick={() => setModalComposicaoTipo("fernando")}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-slate-50 hover:bg-emerald-50 py-1.5 text-[10px] font-black text-emerald-900 border border-slate-200 transition-colors"
            >
              <Eye className="h-3 w-3" />
              Ver Composição
            </button>
          </div>

          {/* Card 2: Eroni Bolfe */}
          <div className="group relative rounded-2xl border border-rose-200/80 bg-white p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Eroni Bolfe
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                  dados.resumoExecutivoHoje.eroniTipo === "credito"
                    ? "bg-emerald-100 text-emerald-800"
                    : dados.resumoExecutivoHoje.eroniTipo === "devedor"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {dados.resumoExecutivoHoje.eroniStatus}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-rose-950">
                {brl(Math.abs(dados.resumoExecutivoHoje.eroniSaldoAcerto))}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {dados.resumoExecutivoHoje.eroniSaldoAcerto >= 0
                ? "Crédito a receber no acerto"
                : "Precisa compensar a Fernando"}
            </p>
            <button
              type="button"
              onClick={() => setModalComposicaoTipo("eroni")}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-slate-50 hover:bg-rose-50 py-1.5 text-[10px] font-black text-rose-900 border border-slate-200 transition-colors"
            >
              <Eye className="h-3 w-3" />
              Ver Composição
            </button>
          </div>

          {/* Card 3: Caixa Livre da Empresa (PJ) */}
          <div className="group relative rounded-2xl border border-blue-200/80 bg-white p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Caixa Livre PJ
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-black uppercase text-blue-800">
                Empresa
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-blue-950">
                {brl(dados.resumoExecutivoHoje.caixaLivrePJ)}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Saldo bancário PJ sem reservas
            </p>
            <button
              type="button"
              onClick={() => setModalComposicaoTipo("caixa")}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-slate-50 hover:bg-blue-50 py-1.5 text-[10px] font-black text-blue-900 border border-slate-200 transition-colors"
            >
              <Eye className="h-3 w-3" />
              Ver Detalhes PJ
            </button>
          </div>

          {/* Card 4: Contas Lançadas do Mês */}
          <div className="group relative rounded-2xl border border-cyan-200/80 bg-white p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Entradas da Empresa</span>
              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[9px] font-black uppercase text-cyan-800">Comissões</span>
            </div>
            <div className="mt-2"><span className="text-2xl font-black text-cyan-950">{brl(dados.caixaEmpresa.recursosOperacionaisDeComissoes)}</span></div>
            <p className="mt-0.5 text-[10px] text-slate-400">Resultado das comissões após repasses</p>
            <button type="button" onClick={() => setModalComposicaoTipo("caixa")} className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-slate-50 hover:bg-cyan-50 py-1.5 text-[10px] font-black text-cyan-900 border border-slate-200 transition-colors">
              <Eye className="h-3 w-3" /> Ver fontes
            </button>
          </div>

          {/* Card 5: Contas Lançadas do Mês */}
          <div className="group relative rounded-2xl border border-indigo-200/80 bg-white p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Contas Mês
              </span>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-black uppercase text-indigo-800">
                A Pagar
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-indigo-950">
                {brl(dados.resumoExecutivoHoje.contasLancadasMes)}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {dados.contasLancadas.itensContasMes.length} contas no mês vigente
            </p>
            <button
              type="button"
              onClick={() => setModalComposicaoTipo("contas")}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-slate-50 hover:bg-indigo-50 py-1.5 text-[10px] font-black text-indigo-900 border border-slate-200 transition-colors"
            >
              <Eye className="h-3 w-3" />
              Ver Contas
            </button>
          </div>

          {/* Card 5: Falta Financiar */}
          <div
            className={`group relative rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all bg-white ${
              dados.resumoExecutivoHoje.faltaFinanciar > 0
                ? "border-rose-300"
                : "border-emerald-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Falta Financiar
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                  dados.resumoExecutivoHoje.faltaFinanciar > 0
                    ? "bg-rose-100 text-rose-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {dados.resumoExecutivoHoje.faltaFinanciar > 0 ? "Déficit Mês" : "Coberto"}
              </span>
            </div>
            <div className="mt-2">
              <span
                className={`text-2xl font-black ${
                  dados.resumoExecutivoHoje.faltaFinanciar > 0
                    ? "text-rose-950"
                    : "text-emerald-950"
                }`}
              >
                {brl(dados.resumoExecutivoHoje.faltaFinanciar)}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {dados.resumoExecutivoHoje.faltaFinanciar > 0
                ? `${brl(dados.resumoExecutivoHoje.faltaFinanciar / 2)} para cada sócio`
                : "100% coberto pelo caixa PJ"}
            </p>
            <button
              type="button"
              onClick={() => setModalComposicaoTipo("contas")}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-slate-50 hover:bg-slate-100 py-1.5 text-[10px] font-black text-slate-900 border border-slate-200 transition-colors"
            >
              <Eye className="h-3 w-3" />
              Rateio Necessário
            </button>
          </div>

          {/* Card 6: Reserva de Impostos */}
          <div className="group relative rounded-2xl border border-amber-200/80 bg-white p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Reserva Impostos
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase text-amber-800">
                Fiscal
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-amber-950">
                {brl(dados.resumoExecutivoHoje.reservaImpostos)}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Protegido para DAS / IRPJ
            </p>
            <button
              type="button"
              onClick={() => setModalComposicaoTipo("impostos")}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-slate-50 hover:bg-amber-50 py-1.5 text-[10px] font-black text-amber-900 border border-slate-200 transition-colors"
            >
              <Eye className="h-3 w-3" />
              Ver Controle
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* BANNER DE NOTIFICAÇÃO: CLASSIFICAÇÃO HISTÓRICA (R$ 9.300) */}
      {/* ========================================================= */}
      {dados.historicoClassificacao.pendenteClassificacao ? (
        <div className="rounded-3xl border-2 border-amber-400 bg-gradient-to-r from-amber-50 via-amber-50/60 to-orange-50 p-6 shadow-md">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-amber-500 text-white p-3 shrink-0 shadow-md shadow-amber-500/20">
                <Sparkles className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200/90 text-amber-950 px-2.5 py-0.5 rounded-full border border-amber-300">
                    Reconciliação Histórica Necessária
                  </span>
                  <span className="text-xs font-bold text-amber-800">
                    Ajuste Econômico Obrigatório
                  </span>
                </div>
                <h3 className="text-base md:text-lg font-black text-amber-950 mt-1">
                  {dados.historicoClassificacao.mensagem}
                </h3>
                <p className="text-xs text-amber-900 mt-1.5 max-w-3xl leading-relaxed">
                  Das 67 despesas pagas (<strong>R$ 36.422,98</strong>), Eroni Bolfe executou
                  operacionalmente R$ 26.632,37 utilizando <strong>R$ 9.300,00</strong> provenientes de
                  comissões de Fernando Hugo deixadas na empresa. Ao confirmar, o acerto econômico
                  reconhece Fernando com crédito líquido de{" "}
                  <strong className="text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                    +R$ 879,12
                  </strong>{" "}
                  e Eroni com débito de equalização de{" "}
                  <strong className="text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded">
                    -R$ 879,12
                  </strong>
                  .
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConfirmarClassificacaoHistorica}
              disabled={isPending}
              className="shrink-0 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 text-xs font-black shadow-lg shadow-amber-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirmar Classificação Econômica (R$ 9.300)
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-center justify-between text-xs text-emerald-950">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>
              <strong>Origem Econômica Reconciliada:</strong> {dados.historicoClassificacao.mensagem}
            </span>
          </div>
          <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full uppercase">
            Auditado & Conforme
          </span>
        </div>
      )}

      {/* ========================================================= */}
      {/* BLOCO 1 — ACERTO ENTRE SÓCIOS (CONTAS JÁ PAGAS)           */}
      {/* ========================================================= */}
      <section id="bloco-1" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 border border-indigo-200">
                Estágio 1 · Contas Pagas
              </span>
              <span className="text-xs text-slate-400 font-medium">Equalização 50% / 50%</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              BLOCO 1 — Acerto entre Sócios (Contas Já Pagas)
            </h3>
            <p className="text-xs text-slate-500">
              Calculado com base <strong>exclusiva</strong> nas despesas já pagas e liquidadas. Contas a pagar e previsões futuras NÃO entram aqui.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Total Pago Liquidado
            </span>
            <span className="text-2xl font-black text-slate-950">
              {brl(dados.acertoSocios.despesasPagasTotal)}
            </span>
            <span className="text-[10px] text-slate-500 block">
              Responsabilidade 50%: {brl(dados.acertoSocios.despesasPagasTotal / 2)} cada
            </span>
          </div>
        </div>

        {/* Instrução de Compensação */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 flex items-center gap-3">
          <Scale className="h-5 w-5 text-amber-700 shrink-0" />
          <div className="text-xs text-amber-950">
            <p className="font-bold">Instrução de Compensação Imediata:</p>
            <p className="mt-0.5">{dados.acertoSocios.instrucaoCompensacao}</p>
          </div>
        </div>

        {/* Colunas Lado a Lado: Fernando Hugo vs Eroni Bolfe */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Coluna Fernando Hugo */}
          <div
            className={`rounded-2xl border p-5 space-y-4 ${
              dados.acertoSocios.socioFernando.tipo === "credito"
                ? "border-emerald-200 bg-emerald-50/20"
                : "border-slate-200 bg-slate-50/30"
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-800">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    {dados.acertoSocios.socioFernando.nome}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Cota societária: 50%
                  </span>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                  dados.acertoSocios.socioFernando.tipo === "credito"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {dados.acertoSocios.socioFernando.statusTexto}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Cota de Responsabilidade (50%):</span>
                <span className="font-bold text-slate-900">
                  {brl(dados.acertoSocios.socioFernando.responsabilidade)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Dinheiro Próprio Desembolsado:</span>
                <span className="font-bold text-slate-900">
                  {brl(dados.acertoSocios.socioFernando.dinheiroProprio)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Comissão Utilizada na Operação:</span>
                <span className="font-black text-blue-700">
                  +{brl(dados.acertoSocios.socioFernando.comissaoUtilizada)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Aportes / Transferências:</span>
                <span className="font-bold text-slate-900">
                  {brl(dados.acertoSocios.socioFernando.transferenciasAportes)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 bg-slate-100/70 px-2.5 rounded-xl">
                <span className="font-black text-slate-900">Total Colocado na Operação:</span>
                <span className="font-black text-slate-950 text-sm">
                  {brl(dados.acertoSocios.socioFernando.totalColocado)}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block">
                  Saldo Líquido no Acerto
                </span>
                <span className="text-xl font-black text-emerald-900">
                  {brl(dados.acertoSocios.socioFernando.saldoAcerto)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalComposicaoTipo("fernando")}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-black text-slate-800 shadow-sm"
              >
                Ver Composição
              </button>
            </div>
          </div>

          {/* Coluna Eroni Bolfe */}
          <div
            className={`rounded-2xl border p-5 space-y-4 ${
              dados.acertoSocios.socioEroni.tipo === "credito"
                ? "border-emerald-200 bg-emerald-50/20"
                : "border-rose-200 bg-rose-50/20"
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-rose-100 p-2 text-rose-800">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    {dados.acertoSocios.socioEroni.nome}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Cota societária: 50%
                  </span>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                  dados.acertoSocios.socioEroni.tipo === "credito"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {dados.acertoSocios.socioEroni.statusTexto}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Cota de Responsabilidade (50%):</span>
                <span className="font-bold text-slate-900">
                  {brl(dados.acertoSocios.socioEroni.responsabilidade)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Dinheiro Próprio Efetivo Desembolsado:</span>
                <span className="font-bold text-slate-900">
                  {brl(dados.acertoSocios.socioEroni.dinheiroProprio)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Comissão de Outro Sócio Abatida:</span>
                <span className="font-black text-rose-700">
                  -{brl(dados.acertoSocios.socioFernando.comissaoUtilizada)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Aportes / Transferências:</span>
                <span className="font-bold text-slate-900">
                  {brl(dados.acertoSocios.socioEroni.transferenciasAportes)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 bg-slate-100/70 px-2.5 rounded-xl">
                <span className="font-black text-slate-900">Total Colocado na Operação:</span>
                <span className="font-black text-slate-950 text-sm">
                  {brl(dados.acertoSocios.socioEroni.totalColocado)}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 block">
                  Saldo Líquido no Acerto
                </span>
                <span className="text-xl font-black text-rose-900">
                  {brl(dados.acertoSocios.socioEroni.saldoAcerto)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalComposicaoTipo("eroni")}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-black text-slate-800 shadow-sm"
              >
                Ver Composição
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* BLOCO 2 — SALDOS MANTIDOS NA EMPRESA (COMISSÃO/APORTE)    */}
      {/* ========================================================= */}
      <section id="bloco-2" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 border border-blue-200">
                Custódia Operacional
              </span>
              <span className="text-xs text-slate-400 font-medium">Controle Interno PJ</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              BLOCO 2 — Saldos Mantidos na Empresa (Comissão / Aporte)
            </h3>
            <p className="text-xs text-slate-500">
              Recursos pertencentes aos sócios deixados dentro da empresa para bancar despesas operacionais, sem gerar transferências bancárias fictícias.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalDeixarComissaoAberto(true)}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Deixar Comissão na Empresa
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Fernando Hugo */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-900 text-sm">
                Fernando Hugo
              </span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                Saldo Mantido
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Comissões Deixadas na Empresa:</span>
                <span className="font-bold text-slate-900">
                  {brl(dados.saldosMantidos.fernando.comissoesDeixadas)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Aportes / Transferências:</span>
                <span className="font-bold text-slate-900">
                  {brl(dados.saldosMantidos.fernando.transferenciasAportes)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Já Utilizados p/ Pagar Contas:</span>
                <span className="font-bold text-rose-700">
                  -{brl(dados.saldosMantidos.fernando.jaUtilizados)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 bg-indigo-50 px-2.5 rounded-xl">
                <span className="font-black text-indigo-950">Saldo Mantido Atual Disponível:</span>
                <span className="font-black text-indigo-950 text-sm">
                  {brl(dados.saldosMantidos.fernando.saldoMantido)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-[11px] text-slate-400">
                <span>Comissões faturadas livres para saque:</span>
                <span className="font-bold text-slate-600">
                  {brl(dados.saldosMantidos.fernando.comissaoDisponivelSaque)}
                </span>
              </div>
            </div>
          </div>

          {/* Eroni Bolfe */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-900 text-sm">
                Eroni Bolfe
              </span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                Saldo Mantido
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Comissões Deixadas na Empresa:</span>
                <span className="font-bold text-slate-900">
                  {brl(dados.saldosMantidos.eroni.comissoesDeixadas)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Aportes / Transferências:</span>
                <span className="font-bold text-slate-900">
                  {brl(dados.saldosMantidos.eroni.transferenciasAportes)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Já Utilizados p/ Pagar Contas:</span>
                <span className="font-bold text-rose-700">
                  -{brl(dados.saldosMantidos.eroni.jaUtilizados)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 bg-indigo-50 px-2.5 rounded-xl">
                <span className="font-black text-indigo-950">Saldo Mantido Atual Disponível:</span>
                <span className="font-black text-indigo-950 text-sm">
                  {brl(dados.saldosMantidos.eroni.saldoMantido)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-[11px] text-slate-400">
                <span>Comissões faturadas livres para saque:</span>
                <span className="font-bold text-slate-600">
                  {brl(dados.saldosMantidos.eroni.comissaoDisponivelSaque)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-blue-50/60 p-3.5 border border-blue-200/60 flex items-start gap-2.5 text-xs text-blue-900">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <p>
            <strong>Regra Operacional:</strong> Quando o sócio decide deixar comissões na empresa, o dinheiro físico não sai da conta bancária PJ. O saldo é internalizado como capital de giro e passa a constar como crédito de saldo mantido do sócio para abater futuras contas a pagar.
          </p>
        </div>
      </section>

      {/* ========================================================= */}
      {/* BLOCO 3 — CAIXA DA EMPRESA (PJ REAL)                      */}
      {/* ========================================================= */}
      <section id="bloco-3" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200">
                Bancário Oficial PJ
              </span>
              <span className="text-xs text-slate-400 font-medium">Conta Gauchinho Consórcios</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              BLOCO 3 — Caixa da Empresa (PJ Real)
            </h3>
            <p className="text-xs text-slate-500">
              Segregação estrita entre as contas bancárias corporativas e as contas pessoais dos sócios.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Caixa Livre Real da Empresa
            </span>
            <span className="text-2xl font-black text-emerald-950">
              {brl(dados.caixaEmpresa.caixaLivreReal)}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Saldo Bancário PJ Bruto
            </span>
            <p className="text-xl font-black text-slate-950 mt-1">
              {brl(dados.caixaEmpresa.saldoBancarioControladoPJ)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Conta Gauchinho Empresa</p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">
              (-) Reserva de Impostos
            </span>
            <p className="text-xl font-black text-amber-950 mt-1">
              {brl(dados.caixaEmpresa.reservaImpostos)}
            </p>
            <p className="text-[10px] text-amber-700 mt-0.5">Retenção tributária vinculada</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              (-) Outras Reservas
            </span>
            <p className="text-xl font-black text-slate-950 mt-1">
              {brl(dados.caixaEmpresa.outrasReservas)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Aluguel, folha e contingências</p>
          </div>

          <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/60 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 block">
              (=) Caixa Livre Real
            </span>
            <p className="text-xl font-black text-emerald-950 mt-1">
              {brl(dados.caixaEmpresa.caixaLivreReal)}
            </p>
            <p className="text-[10px] text-emerald-700 mt-0.5">Disponível para pagar contas imediatas</p>
          </div>
        </div>

        {/* Contas Particulares Segregadas */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              Contas Bancárias Pessoais dos Sócios (Segregadas do Caixa da Empresa):
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 pt-1 text-xs">
            {dados.caixaEmpresa.contasParticulares.map((cp) => (
              <div
                key={cp.id}
                className="flex items-center justify-between rounded-xl bg-white p-3 border border-slate-200"
              >
                <div>
                  <p className="font-bold text-slate-800">{cp.nome}</p>
                  <p className="text-[10px] text-slate-400">Conta Particular (PF)</p>
                </div>
                <span className="font-black text-slate-950">{brl(cp.saldo)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* BLOCO 4 — CONTAS LANÇADAS (A PAGAR NO MÊS)                */}
      {/* ========================================================= */}
      <section id="bloco-4" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-700 border border-rose-200">
                Estágio 2 · Contas Lançadas
              </span>
              <span className="text-xs text-slate-400 font-medium">Obrigações Imediatas</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              BLOCO 4 — Contas Lançadas (A Pagar no Mês)
            </h3>
            <p className="text-xs text-slate-500">
              Boletos e despesas registradas que vencem no mês vigente. Estas contas <strong>NÃO afetam o Acerto de Contas Pagas</strong> até serem liquidadas.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Total Lançado no Mês
            </span>
            <span className="text-2xl font-black text-indigo-950">
              {brl(dados.contasLancadas.totalLancadoMes)}
            </span>
            <span className="text-[10px] text-slate-400 block">
              Geral em aberto (inclui futuros): {brl(dados.contasLancadas.totalLancadoGeral)}
            </span>
          </div>
        </div>

        {/* Breakdown de Vencimentos */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-900 block">
              Vencidas
            </span>
            <span className="text-lg font-black text-rose-950 mt-1 block">
              {brl(dados.contasLancadas.vencidas)}
            </span>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">
              Vencem Hoje
            </span>
            <span className="text-lg font-black text-amber-950 mt-1 block">
              {brl(dados.contasLancadas.vencemHoje)}
            </span>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3.5 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 block">
              Próximos 7 Dias
            </span>
            <span className="text-lg font-black text-blue-950 mt-1 block">
              {brl(dados.contasLancadas.proximos7Dias)}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
              Restante do Mês
            </span>
            <span className="text-lg font-black text-slate-950 mt-1 block">
              {brl(dados.contasLancadas.restanteDoMes)}
            </span>
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3.5 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 block">
              Total Mês
            </span>
            <span className="text-lg font-black text-indigo-950 mt-1 block">
              {brl(dados.contasLancadas.totalLancadoMes)}
            </span>
          </div>
        </div>

        {/* Fechamento simples: primeiro as contas abertas, depois o acerto já pago. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">
              Passo 1 · Dinheiro para pagar as contas abertas
            </span>
            <p className="mt-1 text-sm font-black text-slate-950">
              Ainda faltam {brl(dados.contasLancadas.faltaFinanciar)} na conta da empresa.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Como a divisão é 50/50, a parte de Fernando é {brl(dados.contasLancadas.necessidadeFernando)} e a de Eroni é {brl(dados.contasLancadas.necessidadeEroni)}. Este dinheiro vai para a <strong>conta PJ</strong>; não é transferência entre sócios.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-white bg-white/80 p-2.5">
                <span className="block text-[10px] font-bold text-slate-500">Falta Fernando deixar / transferir à PJ</span>
                <strong className="mt-0.5 block text-base text-indigo-950">{brl(dados.contasLancadas.coberturaFernando.faltaCobrir)}</strong>
              </div>
              <div className="rounded-xl border border-white bg-white/80 p-2.5">
                <span className="block text-[10px] font-bold text-slate-500">Falta Eroni deixar / transferir à PJ</span>
                <strong className="mt-0.5 block text-base text-indigo-950">{brl(dados.contasLancadas.coberturaEroni.faltaCobrir)}</strong>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">
              Passo 2 · Acerto de contas que já foram pagas
            </span>
            <p className="mt-1 text-sm font-black text-slate-950">
              {valorTransferirParaFernando > 0
                ? `Eroni transfere ${brl(valorTransferirParaFernando)} para Fernando.`
                : valorTransferirParaEroni > 0
                ? `Fernando transfere ${brl(valorTransferirParaEroni)} para Eroni.`
                : "Ninguém precisa transferir para o outro agora."}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Este valor considera somente despesas que foram marcadas como <strong>pagas</strong>, quem colocou o dinheiro e as comissões já usadas para elas. Contas em aberto ficam no passo 1.
            </p>
            <div className="mt-3 rounded-xl border border-white bg-white/80 p-2.5 text-xs text-slate-700">
              <span className="font-bold">Explicação do sistema: </span>{dados.acertoSocios.instrucaoCompensacao}
            </div>
          </div>
        </div>

        {/* Diagnóstico de Financiamento & Cobertura Societária */}
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/30 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">
                Plano de Financiamento das Contas do Mês
              </span>
              <h4 className="font-black text-slate-900 text-sm">
                Falta Financiar: {brl(dados.contasLancadas.faltaFinanciar)}
              </h4>
            </div>
            <div className="text-right text-xs">
              <span className="text-slate-500">Necessidade individual (50%): </span>
              <strong className="text-slate-900">{brl(dados.contasLancadas.necessidadeFernando)}</strong>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 text-xs">
            {/* Fernando */}
            <div className="rounded-xl bg-white p-4 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-900">Fernando Hugo</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    dados.contasLancadas.coberturaFernando.situacao === "COBERTO"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {dados.contasLancadas.coberturaFernando.situacao === "COBERTO"
                    ? "Coberto"
                    : "Déficit"}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Necessidade na cota (50%):</span>
                <span className="font-bold text-slate-800">
                  {brl(dados.contasLancadas.coberturaFernando.necessidade)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Saldo Mantido na Empresa:</span>
                <span className="font-bold text-slate-800">
                  {brl(dados.contasLancadas.coberturaFernando.saldoMantido)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100 font-bold">
                <span>Falta Cobrir / Transferir:</span>
                <span
                  className={
                    dados.contasLancadas.coberturaFernando.faltaCobrir > 0
                      ? "text-rose-700 font-black"
                      : "text-emerald-700 font-black"
                  }
                >
                  {brl(dados.contasLancadas.coberturaFernando.faltaCobrir)}
                </span>
              </div>
              {dados.contasLancadas.coberturaFernando.comissaoDisponivelParaRetencao > 0 && (
                <div className="mt-2 rounded-lg bg-blue-50 p-2 text-[11px] text-blue-900 flex items-center justify-between">
                  <span>Possui {brl(dados.contasLancadas.coberturaFernando.comissaoDisponivelParaRetencao)} de comissão disponível.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSocioDeixarId(fernandoSocio?.id || "");
                      setValorDeixar(dados.contasLancadas.coberturaFernando.faltaCobrir.toFixed(2));
                      setModalDeixarComissaoAberto(true);
                    }}
                    className="font-black text-blue-700 underline hover:text-blue-900"
                  >
                    Reter
                  </button>
                </div>
              )}
            </div>

            {/* Eroni */}
            <div className="rounded-xl bg-white p-4 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-900">Eroni Bolfe</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    dados.contasLancadas.coberturaEroni.situacao === "COBERTO"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {dados.contasLancadas.coberturaEroni.situacao === "COBERTO"
                    ? "Coberto"
                    : "Déficit"}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Necessidade na cota (50%):</span>
                <span className="font-bold text-slate-800">
                  {brl(dados.contasLancadas.coberturaEroni.necessidade)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Saldo Mantido na Empresa:</span>
                <span className="font-bold text-slate-800">
                  {brl(dados.contasLancadas.coberturaEroni.saldoMantido)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100 font-bold">
                <span>Falta Cobrir / Transferir:</span>
                <span
                  className={
                    dados.contasLancadas.coberturaEroni.faltaCobrir > 0
                      ? "text-rose-700 font-black"
                      : "text-emerald-700 font-black"
                  }
                >
                  {brl(dados.contasLancadas.coberturaEroni.faltaCobrir)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de Contas Lançadas do Mês */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-900 text-sm">
              Relação de Contas do Mês com Vencimento Definido
            </h4>
            <span className="text-xs text-slate-500">
              {dados.contasLancadas.itensContasMes.length} contas listadas
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider">
                <tr>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3">Descrição / Fornecedor</th>
                  <th className="p-3">Faixa Vencimento</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {dados.contasLancadas.itensContasMes.map((conta) => (
                  <tr key={conta.id} className="hover:bg-slate-50/70">
                    <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                      {formatDataBr(conta.vencimento)}
                    </td>
                    <td className="p-3">
                      <p className="font-black text-slate-900">{conta.descricao}</p>
                      <p className="text-[11px] text-slate-400">{conta.fornecedor || "-"}</p>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          conta.categoriaVencimento === "VENCIDA"
                            ? "bg-rose-100 text-rose-800"
                            : conta.categoriaVencimento === "HOJE"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {conta.categoriaVencimento.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-slate-950 whitespace-nowrap">
                      {brl(conta.valor)}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setContaSelecionadaBaixa(conta);
                          setModalBaixaAberto(true);
                        }}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 text-xs font-black shadow-sm transition-all active:scale-95"
                      >
                        Pagar / Baixar
                      </button>
                    </td>
                  </tr>
                ))}
                {!dados.contasLancadas.itensContasMes.length && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-xs text-slate-400">
                      Nenhuma conta lançada a pagar neste mês.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* BLOCO 5 — RESERVA DE IMPOSTOS                             */}
      {/* ========================================================= */}
      <section id="bloco-5" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800 border border-amber-200">
                Tributário & Fiscal
              </span>
              <span className="text-xs text-slate-400 font-medium">DAS / Simples Nacional / IRPJ</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              BLOCO 5 — Reserva de Impostos (Controle Fiscal)
            </h3>
            <p className="text-xs text-slate-500">
              Controle dos tributos retidos sobre as comissões faturadas para proteger a empresa de passivos fiscais.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Saldo em Reserva
            </span>
            <span className="text-2xl font-black text-amber-950">
              {brl(dados.reservaImpostosControle.saldoReserva)}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Retido de Comissões
            </span>
            <p className="text-xl font-black text-slate-900 mt-1">
              {brl(dados.reservaImpostosControle.retidoDeComissoes)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Retenções efetuadas</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Impostos Já Pagos
            </span>
            <p className="text-xl font-black text-slate-900 mt-1">
              {brl(dados.reservaImpostosControle.impostosPagosComReserva)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Guias liquidadas</p>
          </div>

          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/50 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 block">
              Saldo Atual Reserva
            </span>
            <p className="text-xl font-black text-amber-950 mt-1">
              {brl(dados.reservaImpostosControle.saldoReserva)}
            </p>
            <p className="text-[10px] text-amber-700 mt-0.5">Disponível para DAS</p>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-900 block">
              Guias Lançadas a Pagar
            </span>
            <p className="text-xl font-black text-rose-950 mt-1">
              {brl(dados.reservaImpostosControle.impostosLancadosAPagar)}
            </p>
            <p className="text-[10px] text-rose-700 mt-0.5">DAS a vencer</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Necessidade Adicional
            </span>
            <p className="text-xl font-black text-slate-900 mt-1">
              {brl(dados.reservaImpostosControle.necessidadeAdicional)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Complemento necessário</p>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* BLOCO 6 — PREVISÕES FUTURAS (PLANEJAMENTO 30/60/90 DIAS) */}
      {/* ========================================================= */}
      <section id="bloco-6" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-700 border border-purple-200">
                Estágio 3 · Previsão & Planejamento
              </span>
              <span className="text-xs text-slate-400 font-medium">Não é Dívida Real</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              BLOCO 6 — Previsões Futuras (30 / 60 / 90 Dias)
            </h3>
            <p className="text-xs text-slate-500">
              Estimativas de compromissos recorrentes futuros. <strong>NÃO representam dívidas líquidas imediatas</strong> nem afetam o caixa de hoje.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Total Previsões Futuras
            </span>
            <span className="text-2xl font-black text-purple-950">
              {brl(dados.previsoesFuturas.totalPrevisoesFuturas)}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-900 block">
              Próximos 30 Dias
            </span>
            <p className="text-xl font-black text-purple-950 mt-1">
              {brl(dados.previsoesFuturas.proximos30Dias)}
            </p>
            <p className="text-[10px] text-purple-700 mt-0.5">Aluguel, folha e fixos previstos</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Próximos 60 Dias
            </span>
            <p className="text-xl font-black text-slate-950 mt-1">
              {brl(dados.previsoesFuturas.proximos60Dias)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Estimativa orçamentária</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Próximos 90 Dias
            </span>
            <p className="text-xl font-black text-slate-950 mt-1">
              {brl(dados.previsoesFuturas.proximos90Dias)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Planejamento trimestral</p>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* BLOCO 7 — EXTRATO E AUDITORIA (LEDGER IMUTÁVEL)          */}
      {/* ========================================================= */}
      <section id="bloco-7" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-700 border border-slate-200">
                Auditoria Imutável
              </span>
              <span className="text-xs text-slate-400 font-medium">Double-Entry Ledger</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mt-1">
              BLOCO 7 — Extrato e Auditoria (Ledger)
            </h3>
            <p className="text-xs text-slate-500">
              Trilha de auditoria completa de cada lançamento, amortização, retenção e estorno.
            </p>
          </div>
          {onNavegarParaAba && (
            <button
              type="button"
              onClick={() => onNavegarParaAba("ledger")}
              className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2 text-xs font-black text-slate-800 transition-colors"
            >
              Ver Extrato Completo ({dados.ledgerExtrato.length}) →
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Sócio</th>
                <th className="p-3">Descrição / Operação</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-right">Saldo Após</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium">
              {dados.ledgerExtrato.slice(0, 10).map((mov) => (
                <tr key={mov.id} className="hover:bg-slate-50/70">
                  <td className="p-3 whitespace-nowrap font-bold text-slate-700">
                    {formatDataBr(mov.dataMovimento)}
                  </td>
                  <td className="p-3 whitespace-nowrap font-bold text-slate-900">
                    {mov.socioNome || "-"}
                  </td>
                  <td className="p-3 text-slate-800">{mov.descricao}</td>
                  <td
                    className={`p-3 text-right font-black whitespace-nowrap ${
                      mov.natureza === "CREDITO" ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {mov.natureza === "CREDITO" ? "+" : "-"}
                    {brl(mov.valor)}
                  </td>
                  <td className="p-3 text-right font-bold text-slate-900 whitespace-nowrap">
                    {brl(mov.saldoApos)}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                        mov.estornado
                          ? "bg-rose-100 text-rose-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {mov.estornado ? "Estornado" : "Válido"}
                    </span>
                  </td>
                </tr>
              ))}
              {!dados.ledgerExtrato.length && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-slate-400">
                    Nenhum lançamento no ledger até o momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ========================================================= */}
      {/* MODAL 1: DRILL-DOWN ANALÍTICO ("VER COMPOSIÇÃO")          */}
      {/* ========================================================= */}
      {modalComposicaoTipo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                  Composição Detalhada de Cálculo
                </span>
                <h3 className="text-lg font-black">
                  {modalComposicaoTipo === "fernando" && "Composição — Fernando Hugo (Acerto de Contas Pagas)"}
                  {modalComposicaoTipo === "eroni" && "Composição — Eroni Bolfe (Acerto de Contas Pagas)"}
                  {modalComposicaoTipo === "caixa" && "Composição — Caixa Livre da Empresa (PJ Real)"}
                  {modalComposicaoTipo === "contas" && "Composição — Contas Lançadas & Financiamento"}
                  {modalComposicaoTipo === "impostos" && "Composição — Reserva de Impostos"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalComposicaoTipo(null)}
                className="rounded-xl bg-white/10 hover:bg-white/20 p-2 text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Composição Fernando */}
              {modalComposicaoTipo === "fernando" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                    <p className="font-bold text-emerald-950">Resumo da Fórmula de Equalização:</p>
                    <div className="space-y-1 text-emerald-900">
                      <p>• Dinheiro Próprio Pago do Bolso: {brl(dados.acertoSocios.socioFernando.dinheiroProprio)} ({despesasPagasFernando.length} contas pagas pessoalmente)</p>
                      <p>• (+) Comissão de Fernando Utilizada na Operação: {brl(dados.acertoSocios.socioFernando.comissaoUtilizada)}</p>
                      <p>• (=) Total Efetivo Colocado por Fernando: <strong>{brl(dados.acertoSocios.socioFernando.totalColocado)}</strong></p>
                      <p>• (-) Cota de Responsabilidade (50% de {brl(dados.acertoSocios.despesasPagasTotal)}): <strong>{brl(dados.acertoSocios.socioFernando.responsabilidade)}</strong></p>
                      <p className="text-sm font-black text-emerald-950 pt-1">
                        • (=) Saldo Final no Acerto: +{brl(dados.acertoSocios.socioFernando.saldoAcerto)} (CRÉDITO A RECEBER)
                      </p>
                    </div>
                  </div>

                  <h5 className="font-black text-slate-900 text-sm">
                    Despesas Pagas do Próprio Bolso por Fernando ({despesasPagasFernando.length} contas):
                  </h5>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                        <tr>
                          <th className="p-2.5">Data</th>
                          <th className="p-2.5">Descrição</th>
                          <th className="p-2.5 text-right">Valor Pago</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {despesasPagasFernando.map((d) => (
                          <tr key={d.contaId}>
                            <td className="p-2.5">{formatDataBr(d.data)}</td>
                            <td className="p-2.5 font-bold text-slate-800">{d.descricao}</td>
                            <td className="p-2.5 text-right font-black text-slate-900">{brl(d.valorTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Composição Eroni */}
              {modalComposicaoTipo === "eroni" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 space-y-2">
                    <p className="font-bold text-rose-950">Resumo da Fórmula de Equalização:</p>
                    <div className="space-y-1 text-rose-900">
                      <p>• Pagamentos Operacionais Executados: {brl(26632.37)} ({despesasPagasEroni.length} contas liquidadas)</p>
                      <p>• (-) Origem Econômica Comissão Fernando: -{brl(dados.acertoSocios.socioFernando.comissaoUtilizada)}</p>
                      <p>• (=) Dinheiro Próprio Efetivo de Eroni: <strong>{brl(dados.acertoSocios.socioEroni.totalColocado)}</strong></p>
                      <p>• (-) Cota de Responsabilidade (50% de {brl(dados.acertoSocios.despesasPagasTotal)}): <strong>{brl(dados.acertoSocios.socioEroni.responsabilidade)}</strong></p>
                      <p className="text-sm font-black text-rose-950 pt-1">
                        • (=) Saldo Final no Acerto: {brl(dados.acertoSocios.socioEroni.saldoAcerto)} (PRECISA COMPENSAR A FERNANDO)
                      </p>
                    </div>
                  </div>

                  <h5 className="font-black text-slate-900 text-sm">
                    Despesas Executadas por Eroni ({despesasPagasEroni.length} contas):
                  </h5>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase sticky top-0">
                        <tr>
                          <th className="p-2.5">Data</th>
                          <th className="p-2.5">Descrição</th>
                          <th className="p-2.5 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {despesasPagasEroni.map((d) => (
                          <tr key={d.contaId}>
                            <td className="p-2.5">{formatDataBr(d.data)}</td>
                            <td className="p-2.5 font-bold text-slate-800">{d.descricao}</td>
                            <td className="p-2.5 text-right font-black text-slate-900">{brl(d.valorTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Composição Caixa */}
              {modalComposicaoTipo === "caixa" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
                    <p className="font-bold text-blue-950">Demonstrativo de Caixa PJ Real:</p>
                    <p>• Saldo em Conta Bancária PJ: {brl(dados.caixaEmpresa.saldoBancarioControladoPJ)}</p>
                    <div className="rounded-xl border border-blue-200 bg-white/70 p-3 text-sm text-slate-700">
                      <p className="font-bold text-blue-950">Fontes comerciais registradas no período:</p>
                      <p>• Impostos retidos — Fernando: {brl(dados.caixaEmpresa.impostosRetidosFernando)}</p>
                      <p>• Impostos retidos — Eroni: {brl(dados.caixaEmpresa.impostosRetidosEroni)}</p>
                      <p>• Impostos retidos — demais colaboradores: {brl(dados.caixaEmpresa.impostosRetidosDemaisColaboradores)}</p>
                      <p>• Total de impostos retidos nas comissões: {brl(dados.caixaEmpresa.impostosRetidosEmComissoes)}</p>
                      <p>• Comissões de outros vendedores recebidas/repassadas: {brl(dados.caixaEmpresa.repassesPagosOutrosVendedores)}</p>
                      <p>• Resultado operacional das comissões após repasses: {brl(dados.caixaEmpresa.recursosOperacionaisDeComissoes)}</p>
                      <p className="mt-1 text-xs text-slate-500">O saldo bancário pode ser diferente destas fontes porque inclui pagamentos e movimentações posteriores.</p>
                    </div>
                    <p>• (-) Reserva de Impostos: -{brl(dados.caixaEmpresa.reservaImpostos)}</p>
                    <p>• (-) Outras Reservas Operacionais: -{brl(dados.caixaEmpresa.outrasReservas)}</p>
                    <p className="text-sm font-black text-blue-950 pt-1">
                      • (=) Caixa Livre Disponível Real: {brl(dados.caixaEmpresa.caixaLivreReal)}
                    </p>
                  </div>
                </div>
              )}

              {/* Composição Contas */}
              {modalComposicaoTipo === "contas" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-2">
                    <p className="font-bold text-indigo-950">Demonstrativo do Financiamento das Contas do Mês:</p>
                    <p>• Total de Contas a Pagar no Mês: {brl(dados.contasLancadas.totalLancadoMes)}</p>
                    <p>• (-) Caixa Livre PJ da Empresa: -{brl(dados.caixaEmpresa.caixaLivreReal)}</p>
                    <p className="text-sm font-black text-indigo-950 pt-1">
                      • (=) Falta Financiar: {brl(dados.contasLancadas.faltaFinanciar)}
                    </p>
                    <p className="text-slate-600">
                      Divisão 50/50 entre os sócios: {brl(dados.contasLancadas.necessidadeFernando)} para Fernando Hugo e {brl(dados.contasLancadas.necessidadeEroni)} para Eroni Bolfe.
                    </p>
                  </div>
                </div>
              )}

              {/* Composição Impostos */}
              {modalComposicaoTipo === "impostos" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-2">
                    <p className="font-bold text-amber-950">Demonstrativo da Reserva Tributária:</p>
                    <p>• Retido de Comissões: {brl(dados.reservaImpostosControle.retidoDeComissoes)}</p>
                    <p>• (-) Guias de Impostos Já Liquidadas: -{brl(dados.reservaImpostosControle.impostosPagosComReserva)}</p>
                    <p className="text-sm font-black text-amber-950 pt-1">
                      • (=) Saldo Atual em Reserva: {brl(dados.reservaImpostosControle.saldoReserva)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setModalComposicaoTipo(null)}
                className="rounded-xl bg-slate-950 text-white px-5 py-2 text-xs font-black shadow hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: DEIXAR COMISSÃO NA EMPRESA                       */}
      {/* ========================================================= */}
      {modalDeixarComissaoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-700">
                <Coins className="h-5 w-5" />
                <h3 className="text-base font-black text-slate-900">
                  Deixar Comissão / Recurso na Empresa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalDeixarComissaoAberto(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarDeixarComissao} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Sócio Proprietário da Comissão:
                </label>
                <select
                  value={socioDeixarId}
                  onChange={(e) => setSocioDeixarId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-indigo-600 focus:outline-none"
                >
                  {dados.todosSocios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} ({s.percentualParticipacao}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Valor a Deixar na Empresa (R$):
                </label>
                <input
                  type="text"
                  value={valorDeixar}
                  onChange={(e) => setValorDeixar(e.target.value)}
                  placeholder="0,00"
                  required
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-black text-sm focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Finalidade / Destinação do Recurso:
                </label>
                <select
                  value={finalidadeDeixar}
                  onChange={(e) => setFinalidadeDeixar(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-indigo-600 focus:outline-none"
                >
                  <option value="CAPITAL_GIRO">Capital de Giro / Despesas Operacionais</option>
                  <option value="RESERVA_IMPOSTOS">Reserva de Impostos (DAS)</option>
                  <option value="CONTINGENCIA">Contingência e Segurança de Caixa</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Observações (Opcional):
                </label>
                <input
                  type="text"
                  value={obsDeixar}
                  onChange={(e) => setObsDeixar(e.target.value)}
                  placeholder="Ex: Retenção para cobrir despesas de software e aluguel"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-blue-50 p-3 text-[11px] text-blue-900 border border-blue-200">
                <strong>Sem PIX Fictício:</strong> O valor não gera movimentação bancária falsa. O dinheiro físico permanece na conta da empresa e constará como crédito mantido pelo sócio para abater suas obrigações.
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalDeixarComissaoAberto(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 text-xs font-black shadow-md disabled:opacity-50"
                >
                  {isPending ? "Gravando..." : "Confirmar Retenção"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: BAIXA DE CONTA COM ORIGEM DO RECURSO             */}
      {/* ========================================================= */}
      {modalBaixaAberto && contaSelecionadaBaixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <DollarSign className="h-5 w-5" />
                <h3 className="text-base font-black text-slate-900">
                  Baixa de Conta com Segregação de Origem
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalBaixaAberto(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarBaixaComOrigem} className="space-y-4 text-xs">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-1">
                <p className="font-bold text-slate-900">{contaSelecionadaBaixa.descricao}</p>
                <p className="text-slate-500">Fornecedor: {contaSelecionadaBaixa.fornecedor || "-"}</p>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-500">Vencimento: {formatDataBr(contaSelecionadaBaixa.vencimento)}</span>
                  <span className="text-sm font-black text-slate-950">{brl(contaSelecionadaBaixa.valor)}</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Data do Pagamento:
                </label>
                <input
                  type="date"
                  value={dataBaixa}
                  onChange={(e) => setDataBaixa(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Quem Executou o Pagamento (Pagador Operacional):
                </label>
                <select
                  value={pagadorOp}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setPagadorOp(val);
                    if (val === "EMPRESA") {
                      setOrigemRecurso("CAIXA_EMPRESA");
                    } else {
                      setOrigemRecurso("DINHEIRO_PROPRIO");
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-indigo-600 focus:outline-none"
                >
                  <option value="EMPRESA">Empresa (Conta Bancária PJ Gauchinho)</option>
                  <option value="ERONI">Eroni Bolfe (Pagamento Operacional)</option>
                  <option value="FERNANDO">Fernando Hugo (Pagamento Operacional)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Qual a Origem Econômica do Recurso:
                </label>
                <select
                  value={origemRecurso}
                  onChange={(e) => setOrigemRecurso(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-indigo-600 focus:outline-none"
                >
                  <option value="CAIXA_EMPRESA">Caixa Livre da Empresa (PJ)</option>
                  <option value="DINHEIRO_PROPRIO">Dinheiro Próprio do Pagador (Bolso)</option>
                  <option value="COMISSAO_RETIDA">Comissão de Sócio Retida na Empresa</option>
                  <option value="SALDO_MANTIDO">Saldo Mantido do Sócio na Empresa</option>
                  <option value="RESERVA_IMPOSTOS">Reserva de Impostos da Empresa</option>
                </select>
              </div>

              {(origemRecurso === "COMISSAO_RETIDA" ||
                origemRecurso === "SALDO_MANTIDO" ||
                origemRecurso === "DINHEIRO_PROPRIO") && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Sócio Titular do Recurso:
                  </label>
                  <select
                    value={socioOrigemId}
                    onChange={(e) => setSocioOrigemId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-bold focus:border-indigo-600 focus:outline-none"
                  >
                    {dados.todosSocios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome} ({s.percentualParticipacao}%)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalBaixaAberto(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 text-xs font-black shadow-md disabled:opacity-50"
                >
                  {isPending ? "Processando..." : "Confirmar Baixa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
