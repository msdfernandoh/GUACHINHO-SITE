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
  Building2,
  FileText,
  Paperclip,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, Input, Select, Textarea } from "@/components/ui/form-primitives";
import { calcularAcertoSocios } from "@/lib/financeiro/acerto-socios";
import {
  alterarBanco,
  alterarCentro,
  alterarConta,
  alterarFornecedor,
  alternarStatusBanco,
  alternarStatusCentro,
  alternarStatusFornecedor,
  anexarNotaFiscalConta,
  atualizarSocioPagadorContas,
  baixarConta,
  criarBanco,
  criarCentro,
  criarConta,
  criarFornecedor,
  estornarConta,
  excluirConta,
  importarContasCsv,
  removerNotaFiscalConta,
  unificarFornecedores,
  type ContasActionResult,
} from "./actions";

type Conta = {
  id: string;
  descricao: string;
  fornecedor: string | null;
  fornecedor_id?: string | null;
  comprovante_url?: string | null;
  nota_fiscal_nome?: string | null;
  nota_fiscal_uploaded_at?: string | null;
  valor: number;
  vencimento: string;
  competencia: string;
  status: "aberta" | "paga" | "cancelada";
  pago_em: string | null;
  pago_pessoalmente: boolean;
  socio_pagador_usuario_id: string | null;
  descontado_comissao?: boolean;
  responsavel_importado?: string | null;
  necessita_revisao?: boolean;
  centro_custo_id: string | null;
  conta_bancaria_id: string | null;
  observacao: string | null;
};

export type Fornecedor = {
  id: string;
  nome: string;
  razao_social?: string | null;
  cnpj_cpf?: string | null;
  email?: string | null;
  telefone?: string | null;
  chave_pix?: string | null;
  tipo_chave_pix?: string | null;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  observacao?: string | null;
  ativo: boolean;
  totalContas?: number;
  isFromContas?: boolean;
};

export type Banco = {
  id: string;
  nome: string;
  banco?: string | null;
  agencia?: string | null;
  conta_mascarada?: string | null;
  tipo_conta?: string | null;
  chave_pix?: string | null;
  observacao?: string | null;
  ativo: boolean;
};

export type Centro = {
  id: string;
  nome: string;
  codigo?: string | null;
  departamento?: string | null;
  descricao?: string | null;
  descontado_comissao?: boolean;
  ativo: boolean;
};

type Usuario = { id: string; nome: string; email: string; socioPagador?: boolean };
type Movimento = { id: string; tipo_movimento: "entrada" | "saida"; valor: number; data_movimento: string; descricao: string };
type Tab = "conta" | "fornecedor" | "banco" | "centro" | "importar";
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


function normStr(str: string) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function FornecedorAutocomplete({
  fornecedores,
  defaultValue = "",
  name = "fornecedor",
  placeholder = "Buscar ou digitar fornecedor...",
  className = "",
}: {
  fornecedores: Fornecedor[];
  defaultValue?: string;
  name?: string;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);

  const filtrados = useMemo(() => {
    const q = normStr(query);
    if (!q) return fornecedores.filter((f) => f.ativo !== false).slice(0, 10);
    return fornecedores
      .filter(
        (f) =>
          f.ativo !== false &&
          (normStr(f.nome).includes(q) ||
            (f.razao_social && normStr(f.razao_social).includes(q)) ||
            (f.cnpj_cpf && f.cnpj_cpf.includes(q)))
      )
      .slice(0, 10);
  }, [fornecedores, query]);

  const matchExato = fornecedores.some(
    (f) => normStr(f.nome) === normStr(query)
  );

  return (
    <div className="relative w-full">
      <input
        type="hidden"
        name={name}
        value={query}
      />
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 250)}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-600 ${className}`}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setIsOpen(true);
            }}
            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {filtrados.length > 0 ? (
            filtrados.map((f) => (
              <button
                key={f.id || f.nome}
                type="button"
                onMouseDown={() => {
                  setQuery(f.nome);
                  setIsOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-blue-50 cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-slate-900">{f.nome}</p>
                    {Boolean(f.totalContas) && (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600 font-medium">
                        {f.totalContas} conta(s)
                      </span>
                    )}
                  </div>
                  {f.razao_social && f.razao_social !== f.nome && (
                    <p className="text-[10px] text-slate-500">{f.razao_social}</p>
                  )}
                  {f.cnpj_cpf && <p className="text-[10px] text-slate-400">{f.cnpj_cpf}</p>}
                </div>
                {f.chave_pix && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">PIX</span>}
              </button>
            ))
          ) : query.trim().length > 0 ? (
            <div className="p-2 text-center text-xs text-slate-500">
              Nenhum fornecedor encontrado com esse termo.
            </div>
          ) : (
            <div className="p-2 text-center text-xs text-slate-400">
              Digite para buscar ou incluir fornecedor...
            </div>
          )}

          {query.trim().length > 0 && !matchExato && (
            <button
              type="button"
              onMouseDown={() => {
                setIsOpen(false);
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-slate-100 bg-blue-50/80 px-3 py-2 text-left text-xs font-bold text-blue-700 hover:bg-blue-100 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Usar &quot;{query.trim()}&quot; (vincular como fornecedor)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ContasPagarClient({
  contas,
  bancos,
  centros,
  fornecedores = [],
  socios,
  caixa,
  logs,
  master,
  podeEstornar,
}: {
  contas: Conta[];
  bancos: Banco[];
  centros: Centro[];
  fornecedores?: Fornecedor[];
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
  const [buscaLivre, setBuscaLivre] = useState("");
  const [ordenacao, setOrdenacao] = useState<string>("vencimento_asc");
  const [pagina, setPagina] = useState<number>(1);
  const [itensPorPagina, setItensPorPagina] = useState<number>(25);
  const [anexandoNfConta, setAnexandoNfConta] = useState<Conta | null>(null);

  // Modais de Controle
  const [editando, setEditando] = useState<Conta | null>(null);
  const [editandoFornecedor, setEditandoFornecedor] = useState<Fornecedor | null>(null);
  const [editandoBanco, setEditandoBanco] = useState<Banco | null>(null);
  const [editandoCentro, setEditandoCentro] = useState<Centro | null>(null);
  const [buscaFornecedor, setBuscaFornecedor] = useState("");
  const [fornecedoresSelecionados, setFornecedoresSelecionados] = useState<Set<string>>(new Set());
  const [modalUnificar, setModalUnificar] = useState(false);
  const [fornecedorDestinoNome, setFornecedorDestinoNome] = useState("");
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
    const buscaNorm = buscaLivre.trim().toLowerCase();
    const matchBusca =
      !buscaNorm ||
      conta.descricao.toLowerCase().includes(buscaNorm) ||
      (conta.fornecedor && conta.fornecedor.toLowerCase().includes(buscaNorm)) ||
      (conta.observacao && conta.observacao.toLowerCase().includes(buscaNorm));

    return (
      matchBusca &&
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

    const centrosDescontadosSet = new Set(
      centros.filter((c) => c.descontado_comissao).map((c) => c.id)
    );

    // Contas pagas no período selecionado
    const contasPagasDoPeriodo = contas.filter((conta) => {
      if (conta.status !== "paga") return false;
      const data = dataTipo === "pagamento" ? (conta.pago_em || conta.vencimento) : conta.vencimento;
      return (
        (!inicio || Boolean(data && data >= inicio)) &&
        (!fim || Boolean(data && data <= fim)) &&
        (!bancoFiltro || conta.conta_bancaria_id === bancoFiltro) &&
        (!centroFiltro || conta.centro_custo_id === centroFiltro) &&
        (!socioFiltro || conta.socio_pagador_usuario_id === socioFiltro)
      );
    });

    // 1. Impostos e deduções que já foram descontados na comissão (não duplicam no balanço)
    const contasDescontadas = contasPagasDoPeriodo.filter(
      (c) => Boolean(c.descontado_comissao) || (c.centro_custo_id && centrosDescontadosSet.has(c.centro_custo_id))
    );
    const totalImpostosDescontados = contasDescontadas.reduce((sum, c) => sum + Number(c.valor), 0);

    // 2. Contas pagas com recursos da Empresa (Caixa Geral / Comissões - Dinheiro dos dois sócios)
    const contasPagasEmpresa = contasPagasDoPeriodo.filter((c) => {
      const isDesc = Boolean(c.descontado_comissao) || (c.centro_custo_id && centrosDescontadosSet.has(c.centro_custo_id));
      if (isDesc) return false;
      return !c.pago_pessoalmente && !c.socio_pagador_usuario_id;
    });
    const totalPagoEmpresa = contasPagasEmpresa.reduce((sum, c) => sum + Number(c.valor), 0);

    // 3. Contas pagas pessoalmente pelos Sócios (entram no acerto 50/50)
    const contasPagasSocios = contasPagasDoPeriodo.filter((c) => {
      const isDesc = Boolean(c.descontado_comissao) || (c.centro_custo_id && centrosDescontadosSet.has(c.centro_custo_id));
      if (isDesc) return false;
      return c.pago_pessoalmente || Boolean(c.socio_pagador_usuario_id);
    });

    const pagoFernando = contasPagasSocios
      .filter((conta) => conta.socio_pagador_usuario_id === fernando?.id)
      .reduce((total, conta) => total + Number(conta.valor), 0);
    const pagoEroni = contasPagasSocios
      .filter((conta) => conta.socio_pagador_usuario_id === eroni?.id)
      .reduce((total, conta) => total + Number(conta.valor), 0);

    const totalGastoSocios = pagoFernando + pagoEroni;
    const cotaIndividual = totalGastoSocios / 2;
    const totalGeralPagoOperacional = totalPagoEmpresa + totalGastoSocios;

    return {
      fernandoNome: fernando?.nome ?? "Fernando",
      eroniNome: eroni?.nome ?? "Eroni",
      pagoFernando,
      pagoEroni,
      totalGastoSocios,
      totalPagoEmpresa,
      totalContasPagasEmpresa: contasPagasEmpresa.length,
      totalGeralPagoOperacional,
      totalImpostosDescontados,
      totalContasDescontadas: contasDescontadas.length,
      totalContasPagas: contasPagasSocios.length,
      ...calcularAcertoSocios(pagoFernando, pagoEroni),
    };
  }, [bancoFiltro, centroFiltro, centros, contas, dataTipo, fim, inicio, socioFiltro, socios]);

  const contasAbertasSocios = useMemo(() => {
    const nomeNormalizado = (nome: string) =>
      nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const fernando = socios.find((socio) => nomeNormalizado(socio.nome).includes("fernando"));
    const eroni = socios.find((socio) => nomeNormalizado(socio.nome).includes("eroni"));

    const abertas = contas.filter((conta) => {
      if (conta.status !== "aberta") return false;
      if (!conta.pago_pessoalmente && !conta.socio_pagador_usuario_id) return false;

      const data = conta.vencimento;
      return (
        (!inicio || Boolean(data && data >= inicio)) &&
        (!fim || Boolean(data && data <= fim)) &&
        (!bancoFiltro || conta.conta_bancaria_id === bancoFiltro) &&
        (!centroFiltro || conta.centro_custo_id === centroFiltro) &&
        (!socioFiltro || conta.socio_pagador_usuario_id === socioFiltro)
      );
    });

    const abertaFernando = abertas
      .filter((conta) => conta.socio_pagador_usuario_id === fernando?.id)
      .reduce((total, conta) => total + Number(conta.valor), 0);

    const abertaEroni = abertas
      .filter((conta) => conta.socio_pagador_usuario_id === eroni?.id)
      .reduce((total, conta) => total + Number(conta.valor), 0);

    const totalAberto = abertaFernando + abertaEroni;

    return {
      fernandoNome: fernando?.nome ?? "Fernando",
      eroniNome: eroni?.nome ?? "Eroni",
      abertaFernando,
      abertaEroni,
      totalAberto,
      totalContasAbertas: abertas.length,
    };
  }, [bancoFiltro, centroFiltro, contas, fim, inicio, socioFiltro, socios]);

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

  function filtrarMesAtual() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate();
    setInicio(`${ano}-${mes}-01`);
    setFim(`${ano}-${mes}-${String(ultimoDia).padStart(2, "0")}`);
    setPagina(1);
  }

  function filtrarProximoMes() {
    const hoje = new Date();
    const proximo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    const ano = proximo.getFullYear();
    const mes = String(proximo.getMonth() + 1).padStart(2, "0");
    const ultimoDia = new Date(ano, proximo.getMonth() + 1, 0).getDate();
    setInicio(`${ano}-${mes}-01`);
    setFim(`${ano}-${mes}-${String(ultimoDia).padStart(2, "0")}`);
    setPagina(1);
  }

  function limparDatas() {
    setInicio("");
    setFim("");
    setPagina(1);
  }

  const contasBaseFiltro =
    cardFiltro === "pagas_mes"
      ? resumoMensal.pagasContas
      : cardFiltro === "a_pagar_mes"
        ? resumoMensal.aPagarContas
        : cardFiltro === "futuras"
          ? resumoMensal.futurasContas
          : contasFiltradas;

  const contasOrdenadas = useMemo(() => {
    const lista = [...contasBaseFiltro];
    lista.sort((a, b) => {
      switch (ordenacao) {
        case "vencimento_asc":
          return (a.vencimento || "").localeCompare(b.vencimento || "");
        case "vencimento_desc":
          return (b.vencimento || "").localeCompare(a.vencimento || "");
        case "pagamento_desc":
          return (b.pago_em || b.vencimento || "").localeCompare(a.pago_em || a.vencimento || "");
        case "pagamento_asc":
          return (a.pago_em || a.vencimento || "").localeCompare(b.pago_em || b.vencimento || "");
        case "nome_asc":
          return a.descricao.localeCompare(b.descricao, "pt-BR", { sensitivity: "base" });
        case "nome_desc":
          return b.descricao.localeCompare(a.descricao, "pt-BR", { sensitivity: "base" });
        case "fornecedor_asc":
          return (a.fornecedor || "").localeCompare(b.fornecedor || "", "pt-BR", { sensitivity: "base" });
        case "fornecedor_desc":
          return (b.fornecedor || "").localeCompare(a.fornecedor || "", "pt-BR", { sensitivity: "base" });
        case "valor_desc":
          return Number(b.valor) - Number(a.valor);
        case "valor_asc":
          return Number(a.valor) - Number(b.valor);
        default:
          return (a.vencimento || "").localeCompare(b.vencimento || "");
      }
    });
    return lista;
  }, [contasBaseFiltro, ordenacao]);

  const totalItens = contasOrdenadas.length;
  const totalPaginas = itensPorPagina === 0 ? 1 : Math.max(1, Math.ceil(totalItens / itensPorPagina));
  const paginaAtual = Math.min(Math.max(1, pagina), totalPaginas);

  const contasExibidas = useMemo(() => {
    if (itensPorPagina === 0) return contasOrdenadas;
    const start = (paginaAtual - 1) * itensPorPagina;
    return contasOrdenadas.slice(start, start + itensPorPagina);
  }, [contasOrdenadas, itensPorPagina, paginaAtual]);

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
    ["fornecedor", "Fornecedores", Building2],
    ["banco", "Bancos & Contas", Landmark],
    ["centro", "Centros de custo", ReceiptText],
    ["importar", "Importar CSV", FileUp],
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

      <section aria-label="Balanço das despesas pagas pelos sócios" className="space-y-4">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-slate-900 text-base">Balanço e Fechamento entre Sócios</h2>
            <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
              Cálculo baseado exclusivamente em contas liquidadas/pagas
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Total gasto pelos sócios pessoalmente, divisão de 50% para cada e transferência direta de equalização.
          </p>
        </div>

        {/* 1. CARDS DE CONTAS PAGAS (EMPRESA + SÓCIOS) */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-2xl border border-teal-200 bg-teal-50/90 p-4 shadow-sm text-teal-950">
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">🏢 Pago pela Empresa</p>
            <p className="mt-2 text-2xl font-black">{brl(balancoSocios.totalPagoEmpresa)}</p>
            <p className="mt-1 text-[10px] text-teal-800 font-medium">
              {balancoSocios.totalContasPagasEmpresa} conta(s) · Caixa geral / Comissões
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/90 p-4 shadow-sm text-blue-950">
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">Pago por {balancoSocios.fernandoNome}</p>
            <p className="mt-2 text-2xl font-black">{brl(balancoSocios.pagoFernando)}</p>
            <p className="mt-1 text-[10px] text-blue-800 font-medium">Pessoalmente no período</p>
          </div>

          <div className="rounded-2xl border border-violet-200 bg-violet-50/90 p-4 shadow-sm text-violet-950">
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">Pago por {balancoSocios.eroniNome}</p>
            <p className="mt-2 text-2xl font-black">{brl(balancoSocios.pagoEroni)}</p>
            <p className="mt-1 text-[10px] text-violet-800 font-medium">Pessoalmente no período</p>
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/90 p-4 shadow-sm text-indigo-950">
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">👥 Total Sócios (50/50)</p>
            <p className="mt-2 text-2xl font-black">{brl(balancoSocios.totalGastoSocios)}</p>
            <p className="mt-1 text-[10px] text-indigo-800 font-medium">
              Cota 50%: {brl(balancoSocios.cotaIndividual)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-slate-100 p-4 shadow-sm text-slate-900">
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">🌐 Total Geral Pago</p>
            <p className="mt-2 text-2xl font-black">{brl(balancoSocios.totalGeralPagoOperacional)}</p>
            <p className="mt-1 text-[10px] text-slate-600 font-medium">Empresa + Sócios</p>
          </div>

          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 shadow-sm text-emerald-950">
            <p className="text-xs font-bold uppercase tracking-wide opacity-80">Acerto entre Sócios</p>
            <p className="mt-2 text-lg font-black leading-tight text-emerald-900">
              {balancoSocios.totalGastoSocios === 0
                ? "Sem despesas"
                : balancoSocios.socioCredor === null
                  ? "Quites (0,00)"
                  : `${balancoSocios.socioCredor === "A" ? balancoSocios.eroniNome.split(" ")[0] : balancoSocios.fernandoNome.split(" ")[0]} paga ${brl(balancoSocios.transferenciaParaEqualizar)}`}
            </p>
            <p className="mt-1 text-[10px] text-emerald-700 font-medium">
              {balancoSocios.socioCredor !== null
                ? `Para ${balancoSocios.socioCredor === "A" ? balancoSocios.fernandoNome.split(" ")[0] : balancoSocios.eroniNome.split(" ")[0]}`
                : "Balanço 100% equilibrado"}
            </p>
          </div>
        </div>

        {/* Badge de Impostos descontados na comissão */}
        {balancoSocios.totalImpostosDescontados > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <span className="font-bold">🏷️ Impostos / Deduções Descontadas na Comissão:</span>
              <strong className="text-sm font-black">{brl(balancoSocios.totalImpostosDescontados)}</strong>
              <span className="text-[11px] text-amber-700 font-medium">({balancoSocios.totalContasDescontadas} lançamentos)</span>
            </div>
            <span className="text-[11px] font-semibold text-amber-800 bg-amber-200/60 px-2.5 py-0.5 rounded-full">
              Isolados do balanço para evitar duplicidade com o desconto das comissões
            </span>
          </div>
        )}

        {/* 2. CARD DE CONTAS EM ABERTO DOS SÓCIOS */}
        {contasAbertasSocios.totalContasAbertas > 0 && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-rose-950 font-bold">
              <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] text-rose-900">
                {contasAbertasSocios.totalContasAbertas} em aberto
              </span>
              <span>Contas a Pagar Atribuídas aos Sócios (Ainda não entram no acerto):</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 font-semibold text-slate-800">
              <span>{contasAbertasSocios.fernandoNome}: <strong className="text-rose-700">{brl(contasAbertasSocios.abertaFernando)}</strong></span>
              <span>{contasAbertasSocios.eroniNome}: <strong className="text-rose-700">{brl(contasAbertasSocios.abertaEroni)}</strong></span>
              <span className="border-l border-rose-200 pl-4">Total a Pagar: <strong className="text-slate-950">{brl(contasAbertasSocios.totalAberto)}</strong></span>
            </div>
          </div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────
          DEMONSTRATIVO HORIZONTAL: FECHAMENTO E ACERTO ENTRE SÓCIOS
      ───────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold">⚖️</span>
            <div>
              <h3 className="text-base font-bold text-white">Fechamento & Equalização entre Sócios</h3>
              <p className="text-xs text-slate-400">
                Cálculo baseado nas despesas pagas no período selecionado (cada sócio assume 50% das despesas pessoais).
              </p>
            </div>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
            {balancoSocios.totalContasPagas} conta(s) pessoalmente paga(s)
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Coluna 1: Total e Divisão */}
          <div className="rounded-xl bg-white/5 p-3.5 space-y-2 border border-white/5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Total e Divisão 50%</p>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300">Total Gasto Sócios:</span>
              <strong className="text-white text-sm">{brl(balancoSocios.totalGastoSocios)}</strong>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-white/10 pt-1.5">
              <span className="text-slate-300">Cota 50% de Cada Sócio:</span>
              <strong className="text-amber-300 text-sm">{brl(balancoSocios.cotaIndividual)}</strong>
            </div>
            {balancoSocios.totalPagoEmpresa > 0 && (
              <div className="flex justify-between items-center text-[11px] text-teal-300 border-t border-white/10 pt-1.5">
                <span>Pago pela Empresa:</span>
                <span className="font-bold">{brl(balancoSocios.totalPagoEmpresa)}</span>
              </div>
            )}
          </div>

          {/* Coluna 2: Demonstrativo Individual */}
          <div className="rounded-xl bg-white/5 p-3.5 space-y-2 border border-white/5 text-xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Demonstrativo por Sócio</p>
            <div className="rounded-lg bg-black/30 p-2 space-y-0.5">
              <div className="flex justify-between font-semibold text-blue-300">
                <span>{balancoSocios.fernandoNome}</span>
                <span>Pagou {brl(balancoSocios.pagoFernando)}</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Cota: {brl(balancoSocios.cotaIndividual)} − Pagou: {brl(balancoSocios.pagoFernando)} ={" "}
                {balancoSocios.pagoFernando >= balancoSocios.cotaIndividual ? (
                  <strong className="text-emerald-400">Recebe {brl(balancoSocios.pagoFernando - balancoSocios.cotaIndividual)}</strong>
                ) : (
                  <strong className="text-rose-300">Falta {brl(balancoSocios.cotaIndividual - balancoSocios.pagoFernando)}</strong>
                )}
              </p>
            </div>

            <div className="rounded-lg bg-black/30 p-2 space-y-0.5">
              <div className="flex justify-between font-semibold text-violet-300">
                <span>{balancoSocios.eroniNome}</span>
                <span>Pagou {brl(balancoSocios.pagoEroni)}</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Cota: {brl(balancoSocios.cotaIndividual)} − Pagou: {brl(balancoSocios.pagoEroni)} ={" "}
                {balancoSocios.pagoEroni >= balancoSocios.cotaIndividual ? (
                  <strong className="text-emerald-400">Recebe {brl(balancoSocios.pagoEroni - balancoSocios.cotaIndividual)}</strong>
                ) : (
                  <strong className="text-rose-300">Falta {brl(balancoSocios.cotaIndividual - balancoSocios.pagoEroni)}</strong>
                )}
              </p>
            </div>
          </div>

          {/* Coluna 3: Conclusão do Acerto */}
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/15 p-3.5 space-y-2 flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">3. Como Equalizar</p>
            {balancoSocios.totalGastoSocios === 0 ? (
              <p className="text-xs text-slate-300">Nenhuma despesa pessoal paga no período selecionado.</p>
            ) : balancoSocios.socioCredor === null ? (
              <p className="text-xs font-bold text-emerald-200">
                Os dois sócios pagaram exatamente o mesmo valor. Contas 100% equilibradas.
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-white font-medium">
                  👉 <strong>{balancoSocios.socioCredor === "A" ? balancoSocios.eroniNome : balancoSocios.fernandoNome}</strong> deve transferir{" "}
                  <strong className="text-amber-200 text-base">{brl(balancoSocios.transferenciaParaEqualizar)}</strong> diretamente para{" "}
                  <strong>{balancoSocios.socioCredor === "A" ? balancoSocios.fernandoNome : balancoSocios.eroniNome}</strong>.
                </p>
                <p className="text-[10px] text-slate-300 border-t border-amber-400/20 pt-1">
                  Ambos ficam com exatamente {brl(balancoSocios.cotaIndividual)} desembolsados (50%).
                </p>
              </div>
            )}
          </div>
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
            <FornecedorAutocomplete fornecedores={fornecedores} placeholder="Fornecedor (busca ou digita)" />
            <Input name="valor" required type="number" step="0.01" min="0.01" placeholder="Valor (R$) *" />
            <Input name="vencimento" required type="date" />
            <Select name="centro">
              <option value="">Centro de custo</option>
              {centros.filter((c) => c.ativo !== false).map((centro) => (
                <option key={centro.id} value={centro.id}>
                  {centro.nome}
                </option>
              ))}
            </Select>
            <Select name="banco">
              <option value="">Conta bancária</option>
              {bancos.filter((b) => b.ativo !== false).map((banco) => (
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
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold text-slate-700">Anexar Nota Fiscal / Comprovante (PDF ou Imagem)</label>
              <Input name="arquivo_nf" type="file" accept=".pdf,image/*,.png,.jpg,.jpeg,.xml" className="text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-blue-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100" />
            </div>
            <Button disabled={pending} className="min-h-12 bg-blue-700 text-base hover:bg-blue-800 md:col-span-3">
              {pending ? "Salvando…" : "Adicionar conta"}
            </Button>
          </form>
        ) : tab === "fornecedor" ? (
          <div className="space-y-6">
            <form onSubmit={(event) => submitForm(event, criarFornecedor)} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Novo Fornecedor</h3>
                <span className="text-xs text-slate-500">* Apenas o nome é obrigatório</span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Input name="nome" required placeholder="Nome do Fornecedor *" />
                <Input name="razao_social" placeholder="Razão Social (opcional)" />
                <Input name="cnpj_cpf" placeholder="CNPJ / CPF" />
                <Input name="telefone" placeholder="Telefone / WhatsApp" />
                <Input name="email" type="email" placeholder="E-mail" />
                <div className="flex gap-2">
                  <Select name="tipo_chave_pix" className="w-1/3 text-xs">
                    <option value="CNPJ">CNPJ</option>
                    <option value="CPF">CPF</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="TELEFONE">Telefone</option>
                    <option value="ALEATORIA">Aleatória</option>
                  </Select>
                  <Input name="chave_pix" placeholder="Chave PIX" className="w-2/3" />
                </div>
                <Input name="banco" placeholder="Banco" />
                <Input name="agencia" placeholder="Agência" />
                <Input name="conta" placeholder="Conta corrente" />
                <Textarea name="observacao" className="md:col-span-3" placeholder="Observações do fornecedor (opcional)" />
              </div>
              <div className="flex justify-end">
                <Button disabled={pending} className="bg-blue-700 text-xs font-bold hover:bg-blue-800">
                  {pending ? "Cadastrando…" : "Cadastrar Fornecedor"}
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Fornecedores Cadastrados e Vinculados ({fornecedores.length})
                  </h4>
                  <p className="text-xs text-slate-500">
                    Inclui fornecedores da tabela e nomes registrados nas despesas. Selecione para unificar duplicados.
                  </p>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar fornecedor..."
                    value={buscaFornecedor}
                    onChange={(e) => setBuscaFornecedor(e.target.value)}
                    className="pl-8 text-xs"
                  />
                </div>
              </div>

              {/* Barra de Ação de Unificação */}
              {fornecedoresSelecionados.size >= 2 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      {fornecedoresSelecionados.size}
                    </span>
                    <span className="font-bold text-blue-950">
                      fornecedores selecionados para unificação
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const listaSelecionados = fornecedores.filter((f) =>
                          fornecedoresSelecionados.has(f.id || f.nome)
                        );
                        if (listaSelecionados.length > 0) {
                          setFornecedorDestinoNome(listaSelecionados[0].nome);
                        }
                        setModalUnificar(true);
                      }}
                      className="bg-blue-700 text-xs font-bold hover:bg-blue-800 cursor-pointer"
                    >
                      🔗 Unificar Fornecedores Selecionados
                    </Button>
                    <button
                      type="button"
                      onClick={() => setFornecedoresSelecionados(new Set())}
                      className="text-slate-500 hover:text-slate-800 font-semibold underline cursor-pointer ml-1"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos os fornecedores"
                          className="h-4 w-4 rounded text-blue-600 cursor-pointer"
                          checked={
                            fornecedores.length > 0 &&
                            fornecedores.every((f) => fornecedoresSelecionados.has(f.id || f.nome))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFornecedoresSelecionados(
                                new Set(fornecedores.map((f) => f.id || f.nome))
                              );
                            } else {
                              setFornecedoresSelecionados(new Set());
                            }
                          }}
                        />
                      </th>
                      <th className="p-3">Nome / Razão</th>
                      <th className="p-3">Contas Vinculadas</th>
                      <th className="p-3">Documento</th>
                      <th className="p-3">Contato</th>
                      <th className="p-3">PIX / Banco</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fornecedores
                      .filter((f) => {
                        const q = normStr(buscaFornecedor);
                        return (
                          !q ||
                          normStr(f.nome).includes(q) ||
                          (f.razao_social && normStr(f.razao_social).includes(q)) ||
                          (f.cnpj_cpf && f.cnpj_cpf.includes(q))
                        );
                      })
                      .map((f) => {
                        const key = f.id || f.nome;
                        const isSelected = fornecedoresSelecionados.has(key);
                        return (
                          <tr key={key} className={`hover:bg-slate-50/80 ${isSelected ? "bg-blue-50/40" : ""}`}>
                            <td className="p-3">
                              <input
                                type="checkbox"
                                aria-label={`Selecionar ${f.nome}`}
                                checked={isSelected}
                                onChange={() => {
                                  const next = new Set(fornecedoresSelecionados);
                                  if (next.has(key)) next.delete(key);
                                  else next.add(key);
                                  setFornecedoresSelecionados(next);
                                }}
                                className="h-4 w-4 rounded text-blue-600 cursor-pointer"
                              />
                            </td>
                            <td className="p-3 font-semibold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <span>{f.nome}</span>
                                {f.isFromContas && (
                                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-normal text-slate-500">
                                    via despesas
                                  </span>
                                )}
                              </div>
                              {f.razao_social && f.razao_social !== f.nome && (
                                <p className="text-[10px] text-slate-500 font-normal">{f.razao_social}</p>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                                {f.totalContas || 0} conta(s)
                              </span>
                            </td>
                            <td className="p-3 text-slate-600">{f.cnpj_cpf || "—"}</td>
                            <td className="p-3 text-slate-600">
                              {f.telefone && <p>{f.telefone}</p>}
                              {f.email && <p className="text-[10px] text-slate-500">{f.email}</p>}
                              {!f.telefone && !f.email && "—"}
                            </td>
                            <td className="p-3 text-slate-600">
                              {f.chave_pix && <p className="font-mono text-emerald-700 font-bold">PIX: {f.chave_pix}</p>}
                              {f.banco && <p className="text-[10px] text-slate-500">{f.banco} Ag:{f.agencia} Cc:{f.conta}</p>}
                              {!f.chave_pix && !f.banco && "—"}
                            </td>
                            <td className="p-3">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${f.ativo !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                                {f.ativo !== false ? "Ativo" : "Inativo"}
                              </span>
                            </td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                onClick={() => setEditandoFornecedor(f)}
                                className="font-semibold text-blue-700 hover:underline cursor-pointer"
                              >
                                Editar
                              </button>
                              {f.id && !f.id.startsWith("temp-") && (
                                <button
                                  onClick={() => execute(() => alternarStatusFornecedor(f.id, f.ativo === false))}
                                  className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                                >
                                  {f.ativo !== false ? "Inativar" : "Ativar"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : tab === "banco" ? (
          <div className="space-y-6">
            <form onSubmit={(event) => submitForm(event, criarBanco)} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="text-sm font-bold text-slate-900">Cadastrar Conta Bancária</h3>
              <div className="grid gap-3 md:grid-cols-4">
                <Input name="nome" required placeholder="Nome para exibição (ex: Itaú Principal) *" />
                <Input name="banco" placeholder="Instituição (ex: Itaú, Bradesco, Nubank)" />
                <Input name="agencia" placeholder="Agência" />
                <Input name="conta" placeholder="Número da Conta" />
                <Select name="tipo_conta">
                  <option value="CORRENTE">Conta Corrente</option>
                  <option value="POUPANCA">Poupança</option>
                  <option value="PAGAMENTO">Conta Pagamento</option>
                  <option value="INVESTIMENTO">Investimento</option>
                </Select>
                <Input name="chave_pix" placeholder="Chave PIX vinculada" />
                <Textarea name="observacao" className="md:col-span-2" placeholder="Observações..." />
              </div>
              <div className="flex justify-end">
                <Button disabled={pending} className="bg-blue-700 text-xs font-bold hover:bg-blue-800">
                  {pending ? "Salvando…" : "Salvar Banco / Conta"}
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900">Contas Bancárias ({bancos.length})</h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="p-3">Nome de Exibição</th>
                      <th className="p-3">Banco / Agência / Conta</th>
                      <th className="p-3">PIX</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bancos.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-semibold text-slate-900">{b.nome}</td>
                        <td className="p-3 text-slate-600">
                          {b.banco || "—"} {b.agencia ? `Ag: ${b.agencia}` : ""} {b.conta_mascarada ? `Cc: ${b.conta_mascarada}` : ""}
                        </td>
                        <td className="p-3 font-mono text-slate-600">{b.chave_pix || "—"}</td>
                        <td className="p-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${b.ativo !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                            {b.ativo !== false ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => setEditandoBanco(b)}
                            className="font-semibold text-blue-700 hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => execute(() => alternarStatusBanco(b.id, b.ativo === false))}
                            className="text-slate-500 hover:text-slate-700 font-medium"
                          >
                            {b.ativo !== false ? "Inativar" : "Ativar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : tab === "centro" ? (
          <div className="space-y-6">
            <form onSubmit={(event) => submitForm(event, criarCentro)} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="text-sm font-bold text-slate-900">Cadastrar Centro de Custo</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <Input name="nome" required placeholder="Nome do centro de custo *" />
                <Input name="codigo" placeholder="Código identificador (ex: CC-001)" />
                <Input name="departamento" placeholder="Departamento (ex: Vendas, Adm, TI)" />
                <Textarea name="descricao" className="md:col-span-3" placeholder="Descrição / finalidade..." />
                <div className="md:col-span-3">
                  <label className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs font-bold text-amber-900 cursor-pointer">
                    <input name="descontado_comissao" type="checkbox" className="rounded text-amber-600 h-4 w-4" />
                    <span>Descontado na comissão (Impostos e deduções que já são abatidos nas comissões — não duplicar no balanço dos sócios)</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end">
                <Button disabled={pending} className="bg-blue-700 text-xs font-bold hover:bg-blue-800">
                  {pending ? "Salvando…" : "Salvar Centro de Custo"}
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900">Centros de Custo ({centros.length})</h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-slate-50 font-bold text-slate-600">
                    <tr>
                      <th className="p-3">Código</th>
                      <th className="p-3">Nome</th>
                      <th className="p-3">Departamento</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {centros.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-mono font-bold text-slate-600">{c.codigo || "—"}</td>
                        <td className="p-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{c.nome}</span>
                            {c.descontado_comissao && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                Descontado na comissão
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600">{c.departamento || "—"}</td>
                        <td className="p-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.ativo !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                            {c.ativo !== false ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => setEditandoCentro(c)}
                            className="font-semibold text-blue-700 hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => execute(() => alternarStatusCentro(c.id, c.ativo === false))}
                            className="text-slate-500 hover:text-slate-700 font-medium"
                          >
                            {c.ativo !== false ? "Inativar" : "Ativar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
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
          <section className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
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
            </div>

            {/* Campo de Busca por Nome (Descrição ou Fornecedor) embaixo dos filtros */}
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
              <div className="relative flex-1 min-w-[280px]">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={buscaLivre}
                  onChange={(e) => setBuscaLivre(e.target.value)}
                  placeholder="🔍 Buscar por descrição ou nome do fornecedor..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/70 py-2.5 pl-10 pr-9 text-xs text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-600 font-medium"
                />
                {buscaLivre && (
                  <button
                    type="button"
                    onClick={() => setBuscaLivre("")}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    title="Limpar busca"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {(inicio || fim || bancoFiltro || centroFiltro || socioFiltro || buscaLivre) && (
                <button
                  type="button"
                  className="text-xs font-bold text-rose-600 hover:underline"
                  onClick={() => {
                    setInicio("");
                    setFim("");
                    setBancoFiltro("");
                    setCentroFiltro("");
                    setSocioFiltro("");
                    setBuscaLivre("");
                  }}
                >
                  Limpar todos os filtros
                </button>
              )}
            </div>
          </section>

          <div className="w-full">
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
                          {conta.descontado_comissao && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800" title="Imposto/Dedução já descontada na comissão — não duplica no balanço">
                              Descontado na comissão
                            </span>
                          )}
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
                        {/* Nota Fiscal / Comprovante */}
                        {conta.comprovante_url ? (
                          <div className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/80 px-2 py-1 text-xs">
                            <a
                              href={conta.comprovante_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 font-bold text-blue-700 hover:underline"
                              title={conta.nota_fiscal_nome || "Ver arquivo"}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>Ver NF</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => execute(() => removerNotaFiscalConta(conta.id))}
                              title="Remover anexo"
                              className="text-slate-400 hover:text-rose-600 ml-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAnexandoNfConta(conta)}
                            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-700 transition-colors"
                            title="Anexar Nota Fiscal ou comprovante"
                          >
                            <Paperclip className="h-3 w-3" />
                            <span>Anexar NF</span>
                          </button>
                        )}
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

              {/* PAGINAÇÃO DE CONTAS */}
              {totalItens > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50/90 px-4 py-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-slate-600 font-medium">
                    <span>
                      Mostrando <strong>{itensPorPagina === 0 ? 1 : (paginaAtual - 1) * itensPorPagina + 1}</strong> a{" "}
                      <strong>{itensPorPagina === 0 ? totalItens : Math.min(paginaAtual * itensPorPagina, totalItens)}</strong> de{" "}
                      <strong>{totalItens}</strong> despesa(s)
                    </span>

                    <div className="flex items-center gap-1.5 border-l pl-3">
                      <span>Por página:</span>
                      <select
                        aria-label="Itens por página"
                        value={itensPorPagina}
                        onChange={(e) => {
                          setItensPorPagina(Number(e.target.value));
                          setPagina(1);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 cursor-pointer"
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={0}>Todas ({totalItens})</option>
                      </select>
                    </div>
                  </div>

                  {itensPorPagina > 0 && totalPaginas > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={paginaAtual === 1}
                        onClick={() => setPagina(1)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title="Primeira página"
                      >
                        ⏮️
                      </button>
                      <button
                        type="button"
                        disabled={paginaAtual === 1}
                        onClick={() => setPagina((p) => Math.max(1, p - 1))}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        ◀ Anterior
                      </button>

                      <span className="px-2 font-bold text-slate-800">
                        Página {paginaAtual} de {totalPaginas}
                      </span>

                      <button
                        type="button"
                        disabled={paginaAtual >= totalPaginas}
                        onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Próxima ▶
                      </button>
                      <button
                        type="button"
                        disabled={paginaAtual >= totalPaginas}
                        onClick={() => setPagina(totalPaginas)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title="Última página"
                      >
                        ⏭️
                      </button>
                    </div>
                  )}
                </div>
              )}
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
                <FornecedorAutocomplete
                  fornecedores={fornecedores}
                  defaultValue={editando.fornecedor || ""}
                  className="mt-1"
                />
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
              <div className="md:col-span-2 grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 p-2.5 font-bold text-blue-950">
                  <input
                    name="pessoal"
                    type="checkbox"
                    defaultChecked={editando.pago_pessoalmente}
                    disabled={editando.status === "paga" && !master}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  Pago pessoalmente como sócio
                </label>
                <label className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5 font-bold text-amber-950">
                  <input
                    name="descontado_comissao"
                    type="checkbox"
                    defaultChecked={Boolean(editando.descontado_comissao)}
                    className="h-4 w-4 text-amber-600 rounded"
                  />
                  Já descontado na comissão (Não duplicar)
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="font-bold text-slate-700">Observações Operacionais</label>
                <Textarea name="obs" className="mt-1" defaultValue={editando.observacao || ""} />
              </div>
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 md:col-span-2">
                <label className="font-bold text-slate-700 block">Nota Fiscal / Comprovante</label>
                {editando.comprovante_url ? (
                  <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs">
                    <a
                      href={editando.comprovante_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 font-bold text-blue-700 hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      <span>{editando.nota_fiscal_nome || "Visualizar Nota Fiscal Anexada"}</span>
                    </a>
                    <label className="flex items-center gap-1 text-[11px] font-bold text-rose-700 cursor-pointer">
                      <input type="checkbox" name="remover_nf" value="true" className="rounded text-rose-600" />
                      Remover arquivo
                    </label>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">Nenhum documento anexado a esta despesa.</p>
                )}
                <div className="pt-1">
                  <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                    {editando.comprovante_url ? "Substituir por novo arquivo:" : "Anexar arquivo:"}
                  </label>
                  <Input name="arquivo_nf" type="file" accept=".pdf,image/*,.png,.jpg,.jpeg,.xml" className="text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-blue-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100" />
                </div>
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
          MODAL: EDITAR CENTRO DE CUSTO
      ───────────────────────────────────────────────────────────── */}
      {editandoCentro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Editar Centro de Custo</h3>
              <button
                type="button"
                onClick={() => setEditandoCentro(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                execute(
                  () => alterarCentro(editandoCentro.id, form),
                  () => setEditandoCentro(null)
                );
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700">Nome do centro de custo *</label>
                <Input name="nome" required defaultValue={editandoCentro.nome} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700">Código</label>
                  <Input name="codigo" defaultValue={editandoCentro.codigo || ""} className="mt-1" />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Departamento</label>
                  <Input name="departamento" defaultValue={editandoCentro.departamento || ""} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700">Descrição / Finalidade</label>
                <Textarea name="descricao" defaultValue={editandoCentro.descricao || ""} className="mt-1" />
              </div>
              <div>
                <label className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-2.5 font-bold text-amber-900 cursor-pointer">
                  <input
                    name="descontado_comissao"
                    type="checkbox"
                    defaultChecked={Boolean(editandoCentro.descontado_comissao)}
                    className="h-4 w-4 text-amber-600 rounded"
                  />
                  <span>Descontado na comissão (Impostos e deduções já abatidos — não duplicar no balanço)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="outline" onClick={() => setEditandoCentro(null)}>
                  Cancelar
                </Button>
                <Button disabled={pending} className="bg-blue-700 hover:bg-blue-800 font-bold">
                  {pending ? "Salvando…" : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDITAR BANCO / CONTA BANCÁRIA
      ───────────────────────────────────────────────────────────── */}
      {editandoBanco && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Editar Conta Bancária</h3>
              <button
                type="button"
                onClick={() => setEditandoBanco(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                execute(
                  () => alterarBanco(editandoBanco.id, form),
                  () => setEditandoBanco(null)
                );
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700">Nome para exibição *</label>
                <Input name="nome" required defaultValue={editandoBanco.nome} className="mt-1" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700">Instituição</label>
                  <Input name="banco" defaultValue={editandoBanco.banco || ""} className="mt-1" />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Agência</label>
                  <Input name="agencia" defaultValue={editandoBanco.agencia || ""} className="mt-1" />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Conta</label>
                  <Input name="conta" defaultValue={editandoBanco.conta_mascarada || ""} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700">Tipo de Conta</label>
                  <Select name="tipo_conta" defaultValue={editandoBanco.tipo_conta || "CORRENTE"} className="mt-1">
                    <option value="CORRENTE">Conta Corrente</option>
                    <option value="POUPANCA">Poupança</option>
                    <option value="PAGAMENTO">Conta Pagamento</option>
                    <option value="INVESTIMENTO">Investimento</option>
                  </Select>
                </div>
                <div>
                  <label className="font-bold text-slate-700">Chave PIX</label>
                  <Input name="chave_pix" defaultValue={editandoBanco.chave_pix || ""} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700">Observações</label>
                <Textarea name="observacao" defaultValue={editandoBanco.observacao || ""} className="mt-1" />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="outline" onClick={() => setEditandoBanco(null)}>
                  Cancelar
                </Button>
                <Button disabled={pending} className="bg-blue-700 hover:bg-blue-800 font-bold">
                  {pending ? "Salvando…" : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDITAR FORNECEDOR
      ───────────────────────────────────────────────────────────── */}
      {editandoFornecedor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-slate-900">Editar Fornecedor</h3>
              <button
                type="button"
                onClick={() => setEditandoFornecedor(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                execute(
                  () => alterarFornecedor(editandoFornecedor.id, form),
                  () => setEditandoFornecedor(null)
                );
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700">Nome / Razão Social *</label>
                <Input name="nome" required defaultValue={editandoFornecedor.nome} className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700">CNPJ ou CPF</label>
                  <Input name="cnpj_cpf" defaultValue={editandoFornecedor.cnpj_cpf || ""} className="mt-1" />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Telefone / WhatsApp</label>
                  <Input name="telefone" defaultValue={editandoFornecedor.telefone || ""} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700">E-mail</label>
                  <Input name="email" type="email" defaultValue={editandoFornecedor.email || ""} className="mt-1" />
                </div>
                <div>
                  <label className="font-bold text-slate-700">Chave PIX</label>
                  <Input name="chave_pix" defaultValue={editandoFornecedor.chave_pix || ""} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700">Observações / Dados Bancários</label>
                <Textarea name="observacao" defaultValue={editandoFornecedor.observacao || ""} className="mt-1" />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button type="button" variant="outline" onClick={() => setEditandoFornecedor(null)}>
                  Cancelar
                </Button>
                <Button disabled={pending} className="bg-blue-700 hover:bg-blue-800 font-bold">
                  {pending ? "Salvando…" : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ANEXAR NOTA FISCAL / COMPROVANTE
      ───────────────────────────────────────────────────────────── */}
      {anexandoNfConta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-blue-700 font-bold">
                <FileText className="h-5 w-5" />
                <h3 className="text-base text-slate-900">Anexar Nota Fiscal / Comprovante</h3>
              </div>
              <button
                type="button"
                onClick={() => setAnexandoNfConta(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1 text-slate-800">
              <p><strong>Despesa:</strong> {anexandoNfConta.descricao}</p>
              {anexandoNfConta.fornecedor && <p><strong>Fornecedor:</strong> {anexandoNfConta.fornecedor}</p>}
              <p><strong>Valor:</strong> {brl(Number(anexandoNfConta.valor))}</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                execute(
                  () => anexarNotaFiscalConta(anexandoNfConta.id, form),
                  () => setAnexandoNfConta(null)
                );
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Selecione o arquivo da NF ou Comprovante (PDF, PNG, JPG, XML) *
                </label>
                <Input
                  name="arquivo_nf"
                  type="file"
                  required
                  accept=".pdf,image/*,.png,.jpg,.jpeg,.xml"
                  className="file:mr-2 file:rounded-lg file:border-0 file:bg-blue-50 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAnexandoNfConta(null)}
                >
                  Cancelar
                </Button>
                <Button disabled={pending} className="bg-blue-700 hover:bg-blue-800 font-bold">
                  {pending ? "Enviando arquivo…" : "Salvar Nota Fiscal"}
                </Button>
              </div>
            </form>
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

