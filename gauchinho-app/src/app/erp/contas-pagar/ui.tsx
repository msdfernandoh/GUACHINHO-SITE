"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  FileUp,
  History,
  Info,
  Landmark,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, Input, Select, Textarea } from "@/components/ui/form-primitives";
import { calcularAcertoSocios } from "@/lib/financeiro/acerto-socios";
import {
  alterarConta,
  atualizarSocioPagadorContas,
  baixarConta,
  criarBanco,
  criarCentro,
  criarConta,
  estornarConta,
  excluirConta,
  importarContasCsv,
  type ContasActionResult,
} from "./actions";

type Conta = {
  id: string;
  descricao: string;
  fornecedor: string | null;
  valor: number;
  vencimento: string;
  competencia: string;
  status: "aberta" | "paga" | "cancelada";
  pago_em: string | null;
  pago_pessoalmente: boolean;
  socio_pagador_usuario_id: string | null;
  responsavel_importado?: string | null;
  necessita_revisao?: boolean;
  centro_custo_id: string | null;
  conta_bancaria_id: string | null;
  observacao: string | null;
};

type Banco = { id: string; nome: string };
type Centro = { id: string; nome: string };
type Usuario = { id: string; nome: string; email: string; socioPagador?: boolean };
type Movimento = { id: string; tipo_movimento: "entrada" | "saida"; valor: number; data_movimento: string; descricao: string };
type Tab = "conta" | "banco" | "centro" | "importar";
type Filtro = "todas" | "abertas" | "pagas";
type CardFiltro = "pagas_mes" | "a_pagar_mes" | "futuras" | "entradas_mes";
type Log = {
  id: string;
  acao: string;
  descricao: string;
  fornecedor: string | null;
  valor: number;
  motivo: string | null;
  detalhes: Record<string, unknown>;
  created_at: string;
  usuario: { nome?: string; email?: string } | null;
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");

export function ContasPagarClient({
  contas,
  bancos,
  centros,
  socios,
  caixa,
  logs,
  master,
  podeEstornar,
}: {
  contas: Conta[];
  bancos: Banco[];
  centros: Centro[];
  socios: Usuario[];
  caixa: Movimento[];
  logs: Log[];
  master: boolean;
  podeEstornar: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("conta");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [pessoal, setPessoal] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [socioLote, setSocioLote] = useState("");
  const [feedback, setFeedback] = useState<ContasActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [visao, setVisao] = useState<"despesas" | "logs">("despesas");
  const [dataTipo, setDataTipo] = useState<"vencimento" | "pagamento">("vencimento");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [bancoFiltro, setBancoFiltro] = useState("");
  const [centroFiltro, setCentroFiltro] = useState("");
  const [socioFiltro, setSocioFiltro] = useState("");
  const [cardFiltro, setCardFiltro] = useState<CardFiltro | null>(null);

  // Modais de Controle
  const [editando, setEditando] = useState<Conta | null>(null);
  const [estornando, setEstornando] = useState<Conta | null>(null);
  const [excluindo, setExcluindo] = useState<Conta | null>(null);
  const [motivoInput, setMotivoInput] = useState("");
  const [modalErro, setModalErro] = useState<string | null>(null);

  // Filtros de Auditoria (Logs)
  const [logAcaoFiltro, setLogAcaoFiltro] = useState<string>("");
  const [logBusca, setLogBusca] = useState<string>("");
  const [logDataInicio, setLogDataInicio] = useState<string>("");
  const [logDataFim, setLogDataFim] = useState<string>("");

  const saldo = caixa.reduce(
    (acc, movimento) => acc + (movimento.tipo_movimento === "entrada" ? Number(movimento.valor) : -Number(movimento.valor)),
    0,
  );

  const contasFiltradas = contas.filter((conta) => {
    const data = dataTipo === "pagamento" ? conta.pago_em : conta.vencimento;
    return (
      (filtro === "todas"
        ? conta.status !== "cancelada"
        : filtro === "abertas"
          ? conta.status === "aberta"
          : conta.status === "paga") &&
      (!inicio || Boolean(data && data >= inicio)) &&
      (!fim || Boolean(data && data <= fim)) &&
      (!bancoFiltro || conta.conta_bancaria_id === bancoFiltro) &&
      (!centroFiltro || conta.centro_custo_id === centroFiltro) &&
      (!socioFiltro || conta.socio_pagador_usuario_id === socioFiltro)
    );
  });

  const balancoSocios = useMemo(() => {
    const nomeNormalizado = (nome: string) =>
      nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const fernando = socios.find((socio) => nomeNormalizado(socio.nome).includes("fernando"));
    const eroni = socios.find((socio) => nomeNormalizado(socio.nome).includes("eroni"));
    const contasDoPeriodo = contas.filter((conta) => {
      const data = dataTipo === "pagamento" ? conta.pago_em : conta.vencimento;
      return (
        conta.status === "paga" &&
        conta.pago_pessoalmente &&
        (!inicio || Boolean(data && data >= inicio)) &&
        (!fim || Boolean(data && data <= fim)) &&
        (!bancoFiltro || conta.conta_bancaria_id === bancoFiltro) &&
        (!centroFiltro || conta.centro_custo_id === centroFiltro) &&
        (!socioFiltro || conta.socio_pagador_usuario_id === socioFiltro)
      );
    });
    const pagoFernando = contasDoPeriodo
      .filter((conta) => conta.socio_pagador_usuario_id === fernando?.id)
      .reduce((total, conta) => total + Number(conta.valor), 0);
    const pagoEroni = contasDoPeriodo
      .filter((conta) => conta.socio_pagador_usuario_id === eroni?.id)
      .reduce((total, conta) => total + Number(conta.valor), 0);
    return {
      fernandoNome: fernando?.nome ?? "Fernando",
      eroniNome: eroni?.nome ?? "Eroni",
      pagoFernando,
      pagoEroni,
      ...calcularAcertoSocios(pagoFernando, pagoEroni),
    };
  }, [bancoFiltro, centroFiltro, contas, dataTipo, fim, inicio, socioFiltro, socios]);

  const resumoMensal = useMemo(() => {
    const hoje = new Date();
    const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
    const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    const inicioProximoMes = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, "0")}-01`;
    const base = contas.filter(
      (conta) =>
        (!bancoFiltro || conta.conta_bancaria_id === bancoFiltro) &&
        (!centroFiltro || conta.centro_custo_id === centroFiltro) &&
        (!socioFiltro || conta.socio_pagador_usuario_id === socioFiltro),
    );
    const somar = (itens: Conta[]) => itens.reduce((total, conta) => total + Number(conta.valor), 0);
    const pagasContas = base.filter(
      (conta) =>
        conta.status === "paga" &&
        Boolean(conta.pago_em && conta.pago_em >= inicioMes && conta.pago_em < inicioProximoMes),
    );
    const aPagarContas = base.filter(
      (conta) =>
        conta.status === "aberta" &&
        conta.vencimento >= inicioMes &&
        conta.vencimento < inicioProximoMes,
    );
    const futurasContas = base.filter(
      (conta) => conta.status === "aberta" && conta.vencimento >= inicioProximoMes,
    );
    const entradasMovimentos = caixa
      .filter(
        (movimento) =>
          movimento.tipo_movimento === "entrada" &&
          movimento.data_movimento >= inicioMes &&
          movimento.data_movimento < inicioProximoMes,
      )
      .sort((a, b) => b.data_movimento.localeCompare(a.data_movimento));
    return {
      pagasContas,
      aPagarContas,
      futurasContas,
      entradasMovimentos,
      pagasMes: somar(pagasContas),
      aPagarMes: somar(aPagarContas),
      futuras: somar(futurasContas),
      entradasMes: entradasMovimentos.reduce((total, movimento) => total + Number(movimento.valor), 0),
    };
  }, [bancoFiltro, caixa, centroFiltro, contas, socioFiltro]);

  const contasExibidas =
    cardFiltro === "pagas_mes"
      ? resumoMensal.pagasContas
      : cardFiltro === "a_pagar_mes"
        ? resumoMensal.aPagarContas
        : cardFiltro === "futuras"
          ? resumoMensal.futurasContas
          : contasFiltradas;

  const logsFiltrados = useMemo(() => {
    return logs.filter((log) => {
      const logData = log.created_at.slice(0, 10);
      const matchAcao = !logAcaoFiltro || log.acao === logAcaoFiltro;
      const matchDataInicio = !logDataInicio || logData >= logDataInicio;
      const matchDataFim = !logDataFim || logData <= logDataFim;
      const buscaNorm = logBusca.trim().toLowerCase();
      const matchBusca =
        !buscaNorm ||
        log.descricao.toLowerCase().includes(buscaNorm) ||
        (log.fornecedor && log.fornecedor.toLowerCase().includes(buscaNorm)) ||
        (log.motivo && log.motivo.toLowerCase().includes(buscaNorm)) ||
        (log.usuario?.nome && log.usuario.nome.toLowerCase().includes(buscaNorm)) ||
        (log.usuario?.email && log.usuario.email.toLowerCase().includes(buscaNorm));
      return matchAcao && matchDataInicio && matchDataFim && matchBusca;
    });
  }, [logs, logAcaoFiltro, logBusca, logDataInicio, logDataFim]);

  const cards: Array<{ id: CardFiltro; label: string; value: number; color: string; Icon: LucideIcon }> = [
    { id: "pagas_mes", label: "Pagas no mês atual", value: resumoMensal.pagasMes, color: "bg-emerald-600", Icon: CheckCircle2 },
    { id: "a_pagar_mes", label: "A pagar no mês atual", value: resumoMensal.aPagarMes, color: "bg-rose-600", Icon: ReceiptText },
    { id: "futuras", label: "Contas futuras a pagar", value: resumoMensal.futuras, color: "bg-amber-500", Icon: WalletCards },
    { id: "entradas_mes", label: "Entradas no mês atual", value: resumoMensal.entradasMes, color: "bg-blue-700", Icon: Banknote },
  ];

  function execute(action: () => Promise<ContasActionResult>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      setFeedback(result);
      if (result.ok) {
        onSuccess?.();
        router.refresh();
      } else {
        setModalErro(result.message);
      }
    });
  }

  function submitForm(
    event: React.FormEvent<HTMLFormElement>,
    action: (form: FormData) => Promise<ContasActionResult>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    execute(
      () => action(data),
      () => {
        form.reset();
        if (action === criarConta) setPessoal(false);
      },
    );
  }

  function toggleConta(id: string) {
    setSelecionadas((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirmarEstorno() {
    if (!estornando) return;
    if (motivoInput.trim().length < 3) {
      setModalErro("O motivo do estorno é obrigatório (mínimo de 3 caracteres).");
      return;
    }
    execute(
      () => estornarConta(estornando.id, motivoInput.trim()),
      () => {
        setEstornando(null);
        setMotivoInput("");
        setModalErro(null);
      },
    );
  }

  function handleConfirmarExclusao() {
    if (!excluindo) return;
    if (excluindo.status === "paga" && !master) {
      setModalErro("Apenas o usuário Master pode excluir uma despesa que já foi paga.");
      return;
    }
    if (motivoInput.trim().length < 3) {
      setModalErro("O motivo da exclusão é obrigatório (mínimo de 3 caracteres).");
      return;
    }
    execute(
      () => excluirConta(excluindo.id, motivoInput.trim()),
      () => {
        setExcluindo(null);
        setMotivoInput("");
        setModalErro(null);
      },
    );
  }

  const tabs: Array<[Tab, string, typeof Plus]> = [
    ["conta", "Nova despesa", Plus],
    ["importar", "Importar CSV", FileUp],
    ["banco", "Cadastrar banco", Landmark],
    ["centro", "Centro de custo", ReceiptText],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Financeiro operacional</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-950">Contas a pagar e caixa</h1>
          <p className="mt-2 text-slate-500">Lance despesas, controle baixas, estornos, exclusões e auditoria completa.</p>
        </div>
        {master && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-xs">
            👑 Sessão Master / Administrador
          </div>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ id, label, value, color, Icon }) => (
          <button
            type="button"
            key={id}
            aria-pressed={cardFiltro === id}
            onClick={() => {
              setCardFiltro((atual) => (atual === id ? null : id));
              setSelecionadas(new Set());
            }}
            className={`${color} rounded-2xl p-5 text-left text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300 ${
              cardFiltro === id ? "ring-4 ring-slate-900 ring-offset-2" : ""
            }`}
          >
            <Icon className="h-7 w-7 opacity-80" />
            <p className="mt-5 text-sm font-semibold opacity-90">{label}</p>
            <p className="mt-1 text-3xl font-black">{brl(value)}</p>
            <p className="mt-2 text-[11px] font-semibold opacity-80">
              {cardFiltro === id ? "Clique para limpar o filtro" : "Clique para filtrar a lista"}
            </p>
          </button>
        ))}
      </div>
      <p className="-mt-3 text-right text-xs font-semibold text-slate-500">Saldo contábil geral de caixa: {brl(saldo)}</p>

      <section aria-label="Balanço das despesas pagas pelos sócios" className="space-y-3">
        <div>
          <h2 className="font-bold text-slate-900">Balanço entre Fernando e Eroni</h2>
          <p className="text-sm text-slate-500">
            A dívida é da empresa e a responsabilidade de cada sócio corresponde a 50% do total pago pessoalmente no período.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [`Pago por ${balancoSocios.fernandoNome}`, balancoSocios.pagoFernando, "border-blue-200 bg-blue-50 text-blue-950"],
            [`Pago por ${balancoSocios.eroniNome}`, balancoSocios.pagoEroni, "border-violet-200 bg-violet-50 text-violet-950"],
            ["Débito da empresa", balancoSocios.debitoEmpresa, "border-rose-200 bg-rose-50 text-rose-950"],
            ["Cota de cada sócio (50%)", balancoSocios.cotaIndividual, "border-amber-200 bg-amber-50 text-amber-950"],
          ].map(([label, value, color]) => (
            <div key={String(label)} className={`rounded-2xl border p-4 shadow-sm ${color}`}>
              <p className="text-xs font-bold uppercase tracking-wide opacity-75">{label}</p>
              <p className="mt-2 text-2xl font-black">{brl(Number(value))}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-5 py-3 font-bold ${
              tab === id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>

      {feedback ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <p className="font-semibold">{feedback.message}</p>
          {feedback.importacao?.erros.length ? (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {feedback.importacao.erros.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {tab === "conta" ? (
          <form onSubmit={(event) => submitForm(event, criarConta)} className="grid gap-3 md:grid-cols-3">
            <Input name="descricao" required placeholder="O que precisa ser pago? *" />
            <Input name="fornecedor" placeholder="Fornecedor" />
            <Input name="valor" required type="number" step="0.01" min="0.01" placeholder="Valor (R$) *" />
            <Input name="vencimento" required type="date" />
            <Select name="centro">
              <option value="">Centro de custo</option>
              {centros.map((centro) => (
                <option key={centro.id} value={centro.id}>
                  {centro.nome}
                </option>
              ))}
            </Select>
            <Select name="banco">
              <option value="">Conta bancária</option>
              {bancos.map((banco) => (
                <option key={banco.id} value={banco.id}>
                  {banco.nome}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 md:col-span-2">
              <input name="pessoal" type="checkbox" checked={pessoal} onChange={(event) => setPessoal(event.target.checked)} />
              Paguei pessoalmente como sócio
            </label>
            {pessoal ? (
              <Select name="socio" required>
                <option value="">Quem pagou?</option>
                {socios.map((socio) => (
                  <option key={socio.id} value={socio.id}>
                    {socio.nome}
                  </option>
                ))}
              </Select>
            ) : null}
            <Textarea name="obs" className="md:col-span-2" placeholder="Observação (opcional)" />
            <Button disabled={pending} className="min-h-12 bg-blue-700 text-base hover:bg-blue-800">
              {pending ? "Salvando…" : "Adicionar conta"}
            </Button>
          </form>
        ) : tab === "banco" ? (
          <form onSubmit={(event) => submitForm(event, criarBanco)} className="grid gap-3 md:grid-cols-4">
            <Input name="nome" required placeholder="Nome para exibir *" />
            <Input name="banco" placeholder="Banco" />
            <Input name="agencia" placeholder="Agência" />
            <Input name="conta" placeholder="Conta (ex.: **** 1234)" />
            <Button disabled={pending} className="min-h-12 md:col-span-4">
              {pending ? "Salvando…" : "Salvar banco"}
            </Button>
          </form>
        ) : tab === "centro" ? (
          <form onSubmit={(event) => submitForm(event, criarCentro)} className="grid gap-3 md:grid-cols-3">
            <Input name="nome" required placeholder="Nome do centro *" />
            <Input name="codigo" placeholder="Código" />
            <Button disabled={pending} className="min-h-12">
              {pending ? "Salvando…" : "Salvar centro"}
            </Button>
          </form>
        ) : (
          <form onSubmit={(event) => submitForm(event, importarContasCsv)} className="space-y-4">
            <div>
              <h2 className="font-bold text-slate-900">Importar contas a pagar e pagas</h2>
              <p className="mt-1 text-sm text-slate-500">CSV separado por ponto e vírgula. Reimportações não duplicam contas com o mesmo ID.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Input name="arquivo" type="file" accept=".csv,text/csv" required className="max-w-xl" />
              <a href="/modelos/modelo_importacao_contas.csv" download className="text-sm font-semibold text-blue-700 underline">
                Baixar modelo CSV
              </a>
            </div>
            <Button disabled={pending} className="min-h-11 bg-blue-700 hover:bg-blue-800">
              {pending ? "Importando…" : "Importar arquivo"}
            </Button>
          </form>
        )}
      </section>

      {/* Navegação entre Visualizações (Despesas vs Log de Utilização) */}
      <div className="flex border-b">
        <button
          type="button"
          onClick={() => setVisao("despesas")}
          className={`flex items-center gap-2 px-5 py-3 font-bold transition ${
            visao === "despesas" ? "border-b-2 border-blue-700 text-blue-700" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <span>Despesas</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-semibold">
            {contasFiltradas.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setVisao("logs")}
          className={`flex items-center gap-2 px-5 py-3 font-bold transition ${
            visao === "logs" ? "border-b-2 border-blue-700 text-blue-700" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <History className="h-4 w-4" />
          <span>Log de utilização (Auditoria)</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-semibold">
            {logs.length}
          </span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          VISÃO 1: DESPESAS OPERACIONAIS
      ───────────────────────────────────────────────────────────── */}
      {visao === "despesas" && (
        <>
          <section className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-3 xl:grid-cols-6">
            <Select value={dataTipo} onChange={(event) => setDataTipo(event.target.value as typeof dataTipo)}>
              <option value="vencimento">Por vencimento</option>
              <option value="pagamento">Por pagamento</option>
            </Select>
            <Input type="date" aria-label="Data inicial" value={inicio} onChange={(event) => setInicio(event.target.value)} />
            <Input type="date" aria-label="Data final" value={fim} onChange={(event) => setFim(event.target.value)} />
            <Select value={bancoFiltro} onChange={(event) => setBancoFiltro(event.target.value)}>
              <option value="">Todos os bancos</option>
              {bancos.map((banco) => (
                <option key={banco.id} value={banco.id}>
                  {banco.nome}
                </option>
              ))}
            </Select>
            <Select value={centroFiltro} onChange={(event) => setCentroFiltro(event.target.value)}>
              <option value="">Todos os centros</option>
              {centros.map((centro) => (
                <option key={centro.id} value={centro.id}>
                  {centro.nome}
                </option>
              ))}
            </Select>
            <Select value={socioFiltro} onChange={(event) => setSocioFiltro(event.target.value)}>
              <option value="">Todos os sócios</option>
              {socios.map((socio) => (
                <option key={socio.id} value={socio.id}>
                  {socio.nome}
                </option>
              ))}
            </Select>
            <button
              type="button"
              className="text-left text-sm font-bold text-blue-700 xl:col-span-6 hover:underline"
              onClick={() => {
                setInicio("");
                setFim("");
                setBancoFiltro("");
                setCentroFiltro("");
                setSocioFiltro("");
              }}
            >
              Limpar filtros
            </button>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
            <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="space-y-3 border-b p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-bold text-slate-900">
                    {cardFiltro === "entradas_mes"
                      ? "Entradas do mês atual"
                      : cardFiltro
                        ? cards.find((card) => card.id === cardFiltro)?.label
                        : "Despesas"}
                  </h2>
                  {cardFiltro ? (
                    <button
                      type="button"
                      onClick={() => setCardFiltro(null)}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700"
                    >
                      Limpar filtro do card
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      {(["todas", "abertas", "pagas"] as Filtro[]).map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setFiltro(item)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                            filtro === item ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {item === "todas" ? "Todas" : item === "abertas" ? "A pagar" : "Pagas"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {cardFiltro !== "entradas_mes" ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
                    <span className="text-xs font-bold text-slate-600">{selecionadas.size} selecionada(s)</span>
                    <Select value={socioLote} onChange={(event) => setSocioLote(event.target.value)} className="max-w-xs">
                      <option value="">Remover pagamento pessoal</option>
                      {socios.map((socio) => (
                        <option key={socio.id} value={socio.id}>
                          Pago pessoalmente por {socio.nome}
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || selecionadas.size === 0}
                      onClick={() =>
                        execute(
                          () => atualizarSocioPagadorContas([...selecionadas], socioLote || null),
                          () => setSelecionadas(new Set()),
                        )
                      }
                    >
                      Aplicar às selecionadas
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="divide-y">
                {cardFiltro === "entradas_mes" ? (
                  resumoMensal.entradasMovimentos.length === 0 ? (
                    <p className="p-8 text-center text-slate-500">Nenhuma entrada de caixa no mês atual.</p>
                  ) : (
                    resumoMensal.entradasMovimentos.map((movimento) => (
                      <div key={movimento.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                        <div>
                          <p className="font-bold text-slate-900">{movimento.descricao}</p>
                          <p className="text-sm text-slate-500">Entrada em {dataBr(movimento.data_movimento)}</p>
                        </div>
                        <b className="text-emerald-700">+ {brl(Number(movimento.valor))}</b>
                      </div>
                    ))
                  )
                ) : contasExibidas.length === 0 ? (
                  <p className="p-8 text-center text-slate-500">Nenhuma despesa neste filtro.</p>
                ) : (
                  contasExibidas.map((conta) => (
                    <div key={conta.id} className="grid gap-3 p-4 md:grid-cols-[auto_1fr_auto] md:items-center hover:bg-slate-50/60 transition">
                      <input
                        type="checkbox"
                        checked={selecionadas.has(conta.id)}
                        onChange={() => toggleConta(conta.id)}
                        aria-label={`Selecionar ${conta.descricao}`}
                        className="h-4 w-4 rounded text-blue-600"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-900">{conta.descricao}</p>
                          {conta.necessita_revisao ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              Revisar
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              conta.status === "paga"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {conta.status === "paga" ? "Paga" : "A pagar"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          Vence em {dataBr(conta.vencimento)}
                          {conta.fornecedor ? ` · ${conta.fornecedor}` : ""}
                        </p>
                        {conta.responsavel_importado ? (
                          <p className="text-xs text-slate-400">Responsável no CSV: {conta.responsavel_importado}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <b className="min-w-28 text-right text-slate-900">{brl(Number(conta.valor))}</b>
                        <Select
                          aria-label={`Sócio pagador de ${conta.descricao}`}
                          value={conta.socio_pagador_usuario_id ?? ""}
                          disabled={pending}
                          onChange={(event) =>
                            execute(() => atualizarSocioPagadorContas([conta.id], event.target.value || null))
                          }
                          className="min-w-52 text-xs"
                        >
                          <option value="">Não pago pessoalmente</option>
                          {socios.map((socio) => (
                            <option key={socio.id} value={socio.id}>
                              {socio.nome}
                            </option>
                          ))}
                        </Select>
                        {conta.status === "aberta" ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending}
                            onClick={() => execute(() => baixarConta(conta.id))}
                            className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                          >
                            Dar baixa
                          </Button>
                        ) : null}

                        {/* Botão de Edição / Alteração — Sempre acessível */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() => {
                            setModalErro(null);
                            setEditando(conta);
                          }}
                          className="text-xs"
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Editar
                        </Button>

                        {/* Botão de Estorno — Para contas pagas */}
                        {conta.status === "paga" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pending || !podeEstornar}
                            title={
                              !podeEstornar
                                ? "Requer permissão/autorização do Master para estornar despesas pagas."
                                : "Estornar pagamento e reabrir despesa"
                            }
                            onClick={() => {
                              setModalErro(null);
                              setMotivoInput("");
                              setEstornando(conta);
                            }}
                            className={`text-xs ${
                              !podeEstornar ? "opacity-50 cursor-not-allowed" : "hover:bg-amber-50 hover:text-amber-800"
                            }`}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            Estornar
                          </Button>
                        ) : null}

                        {/* Botão de Exclusão */}
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          disabled={pending}
                          title={
                            conta.status === "paga" && !master
                              ? "Contas pagas só podem ser excluídas por usuário Master."
                              : "Excluir conta a pagar"
                          }
                          onClick={() => {
                            setModalErro(null);
                            setMotivoInput("");
                            setExcluindo(conta);
                          }}
                          className="text-xs"
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-lg">
              <h2 className="font-bold">Fechamento entre sócios</h2>
              <p className="mt-1 text-sm text-slate-400">
                Contas pagas pessoalmente no período selecionado. A empresa assume o total e cada sócio entra com metade.
              </p>
              <div className="mt-5 space-y-3">
                <div className="rounded-xl bg-white/10 p-4">
                  <p className="font-semibold">{balancoSocios.fernandoNome}</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Pagou {brl(balancoSocios.pagoFernando)} · sua parte é {brl(balancoSocios.cotaIndividual)}.
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-4">
                  <p className="font-semibold">{balancoSocios.eroniNome}</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Pagou {brl(balancoSocios.pagoEroni)} · sua parte é {brl(balancoSocios.cotaIndividual)}.
                  </p>
                </div>
                {balancoSocios.debitoEmpresa === 0 ? (
                  <p className="rounded-xl bg-white/10 p-4 text-sm text-slate-300">Nenhuma despesa pessoal paga no período.</p>
                ) : balancoSocios.socioCredor === null ? (
                  <p className="rounded-xl bg-emerald-500/20 p-4 text-sm text-emerald-100">
                    Os dois pagaram o mesmo valor. O balanço está equilibrado.
                  </p>
                ) : (
                  <div className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                    <p className="font-semibold text-amber-200">Como equalizar</p>
                    <p className="text-sm text-slate-200">
                      {balancoSocios.socioCredor === "A" ? balancoSocios.eroniNome : balancoSocios.fernandoNome} transfere{" "}
                      <b>{brl(balancoSocios.transferenciaParaEqualizar)}</b> para{" "}
                      {balancoSocios.socioCredor === "A" ? balancoSocios.fernandoNome : balancoSocios.eroniNome}.
                    </p>
                    <p className="text-xs text-slate-400">
                      A transferência corrige os dois lados, portanto seu efeito no balanço é o dobro:{" "}
                      {brl(balancoSocios.transferenciaParaEqualizar)} × 2 = {brl(balancoSocios.diferencaPagamentos)}.
                    </p>
                    <div className="border-t border-white/10 pt-3 text-sm text-slate-200">
                      Alternativa: o sócio que pagou menos assume{" "}
                      <b>{brl(balancoSocios.despesaAdicionalParaEqualizar)}</b> em novas despesas da empresa.
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VISÃO 2: LOG DE UTILIZAÇÃO E AUDITORIA COMPLETA
      ───────────────────────────────────────────────────────────── */}
      {visao === "logs" && (
        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Histórico de Alterações e Auditoria Financeira</h2>
              <p className="text-xs text-slate-500">
                Registro detalhado de lançamentos, edições, baixas, estornos e exclusões com autor e motivo.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">
                Exibindo <strong>{logsFiltrados.length}</strong> de {logs.length} eventos
              </span>
            </div>
          </div>

          {/* Filtros da Auditoria */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar por descrição, fornecedor, motivo ou usuário..."
                value={logBusca}
                onChange={(e) => setLogBusca(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <Select
              value={logAcaoFiltro}
              onChange={(e) => setLogAcaoFiltro(e.target.value)}
              className="text-xs"
            >
              <option value="">Todas as ações</option>
              <option value="CRIACAO">Criação / Lançamento</option>
              <option value="ALTERACAO">Alteração / Edição</option>
              <option value="BAIXA">Baixa / Pagamento</option>
              <option value="ESTORNO">Estorno de Pagamento</option>
              <option value="EXCLUSAO">Exclusão de Despesa</option>
            </Select>
            <Input
              type="date"
              aria-label="Data inicial do log"
              value={logDataInicio}
              onChange={(e) => setLogDataInicio(e.target.value)}
              className="text-xs"
            />
            <Input
              type="date"
              aria-label="Data final do log"
              value={logDataFim}
              onChange={(e) => setLogDataFim(e.target.value)}
              className="text-xs"
            />
          </div>

          {(logAcaoFiltro || logBusca || logDataInicio || logDataFim) && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setLogAcaoFiltro("");
                  setLogBusca("");
                  setLogDataInicio("");
                  setLogDataFim("");
                }}
                className="text-xs font-bold text-blue-700 hover:underline"
              >
                Limpar filtros de busca
              </button>
            </div>
          )}

          {/* Tabela de Eventos */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Data / Hora</th>
                  <th className="px-4 py-3">Ação</th>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Despesa / Fornecedor</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Motivo & Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  logsFiltrados.map((log) => {
                    const badgeClass =
                      log.acao === "CRIACAO"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : log.acao === "ALTERACAO"
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : log.acao === "BAIXA"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : log.acao === "ESTORNO"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200";

                    const camposAlterados = (log.detalhes?.campos_alterados as string[] | undefined) ?? [];

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 font-medium">
                          {new Date(log.created_at).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-md border px-2 py-0.5 font-bold text-[10px] ${badgeClass}`}>
                            {log.acao}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">
                            {log.usuario?.nome || "Usuário não identificado"}
                          </div>
                          {log.usuario?.email ? (
                            <div className="text-[10px] text-slate-500">{log.usuario.email}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{log.descricao}</div>
                          {log.fornecedor ? (
                            <div className="text-[10px] text-slate-500">Fornecedor: {log.fornecedor}</div>
                          ) : (
                            <div className="text-[10px] text-slate-400">Sem fornecedor</div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-black text-slate-900">
                          {brl(Number(log.valor))}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          {log.motivo ? (
                            <div className="rounded-md bg-slate-50 border border-slate-200 p-1.5 text-[11px] text-slate-800 font-medium mb-1">
                              <strong>Motivo:</strong> “{log.motivo}”
                            </div>
                          ) : null}
                          {camposAlterados.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className="text-[10px] text-slate-500">Campos:</span>
                              {camposAlterados.map((campo) => (
                                <span
                                  key={campo}
                                  className="rounded bg-slate-100 px-1 text-[9px] font-mono text-slate-600"
                                >
                                  {campo}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {!log.motivo && camposAlterados.length === 0 && (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDITAR / ALTERAR DESPESA
      ───────────────────────────────────────────────────────────── */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Alterar Conta a Pagar</h3>
                <p className="text-xs text-slate-500">
                  {editando.status === "paga"
                    ? "Esta conta já foi paga. Ajuste de dados cadastrais preserva o lançamento financeiro."
                    : "Edite as informações da despesa pendente."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditando(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalErro && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {modalErro}
              </div>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                execute(
                  () => alterarConta(editando.id, form),
                  () => {
                    setEditando(null);
                    setModalErro(null);
                  },
                );
              }}
              className="grid gap-3 text-xs md:grid-cols-2"
            >
              <div className="md:col-span-2">
                <label className="font-bold text-slate-700">Descrição da despesa *</label>
                <Input name="descricao" required defaultValue={editando.descricao} className="mt-1" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Fornecedor</label>
                <Input name="fornecedor" defaultValue={editando.fornecedor || ""} className="mt-1" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Valor (R$) *</label>
                <Input
                  name="valor"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  defaultValue={Number(editando.valor)}
                  readOnly={editando.status === "paga" && !master}
                  className={`mt-1 ${editando.status === "paga" && !master ? "bg-slate-100 font-semibold cursor-not-allowed" : ""}`}
                />
                {editando.status === "paga" && !master && (
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Valor fixado após pagamento. Para alterar o valor, realize o estorno primeiro.
                  </p>
                )}
              </div>
              <div>
                <label className="font-bold text-slate-700">Vencimento *</label>
                <Input name="vencimento" type="date" required defaultValue={editando.vencimento} className="mt-1" />
              </div>
              <div>
                <label className="font-bold text-slate-700">Centro de custo</label>
                <Select name="centro" defaultValue={editando.centro_custo_id || ""} className="mt-1">
                  <option value="">Sem centro</option>
                  {centros.map((centro) => (
                    <option key={centro.id} value={centro.id}>
                      {centro.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="font-bold text-slate-700">Conta bancária</label>
                <Select name="banco" defaultValue={editando.conta_bancaria_id || ""} className="mt-1">
                  <option value="">Sem banco</option>
                  {bancos.map((banco) => (
                    <option key={banco.id} value={banco.id}>
                      {banco.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="font-bold text-slate-700">Sócio pagador</label>
                <Select
                  name="socio"
                  defaultValue={editando.socio_pagador_usuario_id || ""}
                  disabled={editando.status === "paga" && !master}
                  className="mt-1"
                >
                  <option value="">Não pago pessoalmente</option>
                  {socios.map((socio) => (
                    <option key={socio.id} value={socio.id}>
                      {socio.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 font-bold text-amber-900">
                  <input
                    name="pessoal"
                    type="checkbox"
                    defaultChecked={editando.pago_pessoalmente}
                    disabled={editando.status === "paga" && !master}
                  />
                  Pago pessoalmente como sócio
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="font-bold text-slate-700">Observações Operacionais</label>
                <Textarea name="obs" className="mt-1" defaultValue={editando.observacao || ""} />
              </div>
              <div className="flex justify-end gap-2 border-t pt-3 md:col-span-2">
                <Button type="button" variant="outline" onClick={() => setEditando(null)}>
                  Cancelar
                </Button>
                <Button disabled={pending} className="bg-blue-700 hover:bg-blue-800">
                  {pending ? "Salvando…" : "Salvar alterações"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ESTORNAR CONTA PAGA
      ───────────────────────────────────────────────────────────── */}
      {estornando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <RotateCcw className="h-6 w-6 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Estornar Conta Paga</h3>
                <p className="text-xs text-slate-500">Reabertura de despesa e cancelamento de pagamento</p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950 space-y-1.5">
              <p>
                <strong>Despesa:</strong> {estornando.descricao}
              </p>
              <p>
                <strong>Valor:</strong> {brl(Number(estornando.valor))}
              </p>
              <p>
                <strong>Status atual:</strong> Paga {estornando.pago_em ? `em ${dataBr(estornando.pago_em)}` : ""}
              </p>
              <p className="text-[11px] text-amber-800 pt-1">
                ⚠️ O estorno mudará o status desta despesa para <strong>A Pagar</strong> e lançará a devolução correspondente no caixa da empresa.
              </p>
            </div>

            {modalErro && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                {modalErro}
              </div>
            )}

            <div>
              <label className="font-bold text-slate-700 text-xs block mb-1">
                Motivo do Estorno * (obrigatório para auditoria)
              </label>
              <Textarea
                value={motivoInput}
                onChange={(e) => setMotivoInput(e.target.value)}
                placeholder="Informe detalhadamente por que este pagamento está sendo estornado..."
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEstornando(null);
                  setMotivoInput("");
                  setModalErro(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending || motivoInput.trim().length < 3}
                onClick={handleConfirmarEstorno}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                {pending ? "Estornando…" : "Confirmar Estorno"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EXCLUIR CONTA A PAGAR / PAGA
      ───────────────────────────────────────────────────────────── */}
      {excluindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <Trash2 className="h-6 w-6 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {excluindo.status === "paga" ? "Excluir Conta Paga (Restrito Master)" : "Excluir Conta a Pagar"}
                </h3>
                <p className="text-xs text-slate-500">{excluindo.descricao}</p>
              </div>
            </div>

            {excluindo.status === "paga" && !master ? (
              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="h-4 w-4" />
                    <span>Ação Bloqueada</span>
                  </div>
                  <p>
                    Esta conta já foi liquidada e possui lançamento financeiro associado.
                  </p>
                  <p className="font-semibold">
                    Apenas o usuário <strong>Master</strong> pode excluir diretamente uma despesa já paga.
                  </p>
                </div>
                <p className="text-slate-600">
                  Como consultor/operador, você pode utilizar a opção <strong>Estornar</strong> para reabrir a despesa caso tenha a autorização configurada pelo Master.
                </p>
                <div className="flex justify-end pt-2">
                  <Button type="button" variant="outline" onClick={() => setExcluindo(null)}>
                    Fechar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3.5 text-xs text-rose-950 space-y-1">
                  <p>
                    <strong>Valor:</strong> {brl(Number(excluindo.valor))}
                  </p>
                  <p>
                    <strong>Vencimento:</strong> {dataBr(excluindo.vencimento)}
                  </p>
                  {excluindo.status === "paga" && (
                    <p className="text-rose-700 font-bold">
                      ⚠️ Esta despesa já foi paga. A exclusão pelo Master reverterá automaticamente a saída no caixa.
                    </p>
                  )}
                </div>

                {modalErro && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
                    {modalErro}
                  </div>
                )}

                <div>
                  <label className="font-bold text-slate-700 text-xs block mb-1">
                    Motivo da Exclusão * (obrigatório para auditoria)
                  </label>
                  <Textarea
                    value={motivoInput}
                    onChange={(e) => setMotivoInput(e.target.value)}
                    placeholder="Informe detalhadamente o motivo da exclusão desta despesa..."
                    rows={3}
                    className="text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setExcluindo(null);
                      setMotivoInput("");
                      setModalErro(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={pending || motivoInput.trim().length < 3}
                    onClick={handleConfirmarExclusao}
                    className="font-bold"
                  >
                    {pending ? "Excluindo…" : "Confirmar Exclusão"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

