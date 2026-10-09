"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Pencil,
  Trash2,
  Ban,
  ShieldAlert,
  CheckCircle2,
  Trophy,
  Zap,
  Hash,
  Search,
  Calendar,
  UserCheck,
  Tag,
  Filter,
  RotateCcw,
  FileText,
  Send,
  Download,
  CheckCheck,
  Clock,
  History,
  MessageSquare,
  ExternalLink,
  Layers,
  Undo2,
} from "lucide-react";
import {
  masterAtualizarVendaAction,
  cancelarCotaEstornoAction,
  masterExcluirOuEstornarVendaAction,
  atualizarNumeroCotaAction,
  registrarContemplacaoAction,
  registrarStatusBoletoAction,
} from "@/app/erp/vendas/actions";

export type BoletoEnvioItem = {
  id: string;
  empresa_id: string;
  venda_id: string;
  cota_id: string | null;
  competencia: string;
  status_boleto: "aguardando" | "baixado" | "enviado";
  baixado_em: string | null;
  baixado_por_id: string | null;
  baixado_por_nome: string | null;
  enviado_em: string | null;
  enviado_por_id: string | null;
  enviado_por_nome: string | null;
  canal: string;
  observacao: string | null;
  created_at: string;
  updated_at?: string;
};

export type ModalidadeSimples = {
  id: string;
  administradora_id?: string;
  codigo: string;
  nome: string;
  ativo?: boolean;
};

export type VendaItem = {
  id: string;
  cliente_nome: string;
  cliente_cpf_cnpj: string | null;
  cliente_email: string | null;
  cliente_telefone: string | null;
  valor_credito: number;
  prazo: number;
  parcela: number;
  quantidade_cotas?: number;
  tipo_negociacao?: string;
  status: string;
  data_venda: string;
  created_at: string;
  data_primeira_parcela: string | null;
  data_segunda_parcela: string | null;
  modalidade_comissao_id?: string | null;
  participante_comercial_id: string | null;
  participante_secundario_id: string | null;
  participante_secundario_fracao_percentual: number | null;
  perfil_principal_id?: string | null;
  perfil_secundario_id?: string | null;
  snapshot_venda: any;
  consultor_nome?: string;
  secundario_nome?: string;
  cota_numero?: string | null;
  cota_id?: string | null;
  grupo_codigo?: string;
  cota_status?: string;
  comissoes_geradas?: number;
  valor_empresa?: number;
};

export type CotaItem = {
  id: string;
  venda_id: string;
  numero_grupo: string;
  numero_cota: string | null;
  valor_credito: number;
  prazo: number;
  parcela: number;
  status: string;
  contemplada?: boolean;
  cliente_nome?: string;
  consultor_nome?: string;
  ordem_cota?: number;
};

export type ParticipanteSimples = {
  id: string;
  nome: string;
  nome_exibicao: string | null;
};

export type VinculoPerfilSimples = {
  id: string;
  participante_id: string;
  papel_tipo: string;
  perfil_id: string;
  override_percentual: number | null;
  perfil: {
    id: string;
    nome: string;
    papel_base: string;
  } | null;
};

export type RegraParticipanteSimples = {
  id: string;
  perfil_id: string | null;
  programa_id?: string | null;
  percentual_comissao: number;
};

export type RegraFranquiaSimples = {
  id: string;
  programa_id: string;
  percentual_total_comissao: number;
  tipo_administradora_id: string | null;
  modalidade_comissao_id: string | null;
  ativa: boolean;
};

interface ErpVendasHubViewProps {
  vendas: VendaItem[];
  cotas: CotaItem[];
  participantes: ParticipanteSimples[];
  vinculosPerfis: VinculoPerfilSimples[];
  modalidades?: ModalidadeSimples[];
  regrasParticipantes?: RegraParticipanteSimples[];
  regrasFranquia?: RegraFranquiaSimples[];
  empresaNome: string;
  isMaster: boolean;
  metas: Array<{ valor:number;inicio:string;fim:string }>;
  boletosEnvios?: BoletoEnvioItem[];
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatarDataHoraBR(dataStr?: string | null) {
  if (!dataStr) return "—";
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return dataStr;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dataStr;
  }
}

function gerarLinkWhatsAppBoleto(clienteNome: string, telefone: string | null, grupo: string, cota: string | null, competenciaStr: string) {
  if (!telefone) return null;
  const telLimpo = telefone.replace(/\D/g, "");
  if (!telLimpo) return null;
  const [ano, mes] = competenciaStr.split("-");
  const mesExtenso = `${mes}/${ano}`;
  const cotaTexto = cota ? `#${cota}` : "em processamento";
  const texto = `Olá, ${clienteNome}! Tudo bem? Segue o boleto do seu consórcio Racon (Grupo ${grupo} - Cota ${cotaTexto}) referente à competência de ${mesExtenso}. Qualquer dúvida, estamos à total disposição!`;
  return `https://wa.me/55${telLimpo}?text=${encodeURIComponent(texto)}`;
}

function formatarDataBR(dataStr?: string | null) {
  if (!dataStr) return "—";
  const clean = dataStr.trim();
  if (/^\d{4}-\d{2}$/.test(clean)) {
    const [ano, mes] = clean.split("-");
    return `${mes}/${ano}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const [ano, mes, dia] = clean.slice(0, 10).split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return clean;
}

function obterInfoPerfilPrincipal(v: VendaItem, vinculosPerfis: VinculoPerfilSimples[]) {
  if (v.perfil_principal_id) {
    const vinc = vinculosPerfis.find((vp) => vp.perfil_id === v.perfil_principal_id);
    if (vinc) {
      const pct = vinc.override_percentual !== null ? `${vinc.override_percentual}%` : (vinc.papel_tipo === "SOCIO" || vinc.papel_tipo === "GESTOR" ? "100%" : "50%");
      return `${vinc.perfil?.nome || vinc.papel_tipo} (${pct})`;
    }
  }
  if (v.participante_comercial_id) {
    const vinc = vinculosPerfis.find((vp) => vp.participante_id === v.participante_comercial_id);
    if (vinc) {
      const pct = vinc.override_percentual !== null ? `${vinc.override_percentual}%` : (vinc.papel_tipo === "SOCIO" || vinc.papel_tipo === "GESTOR" ? "100%" : "50%");
      return `${vinc.perfil?.nome || vinc.papel_tipo} (${pct})`;
    }
  }
  return "Consultor (50%)";
}

export function ErpVendasHubView({
  vendas,
  cotas,
  participantes,
  vinculosPerfis,
  modalidades = [],
  regrasParticipantes = [],
  regrasFranquia = [],
  empresaNome,
  isMaster,
  metas,
  boletosEnvios = [],
}: ErpVendasHubViewProps) {
  const [isPending, startTransition] = useTransition();
  const [abaAtiva, setAbaAtiva] = useState<"vendas" | "boletos">("vendas");
  const [filtroStatusBoleto, setFiltroStatusBoleto] = useState<"todos" | "aguardando" | "baixado" | "enviado">("todos");
  const [cotaHistoricoBoleto, setCotaHistoricoBoleto] = useState<{ venda: VendaItem; cota: CotaItem | null } | null>(null);
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroConsultor, setFiltroConsultor] = useState("todos");
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [filtroCota, setFiltroCota] = useState("");
  const competencias = useMemo(()=>[...new Set(vendas.map((v)=>(v.data_primeira_parcela||v.data_venda).slice(0,7)))].sort().reverse(),[vendas]);
  const [competencia,setCompetencia]=useState(competencias[0]??"todos");

  const consultoresDisponiveis = useMemo(() => {
    // Agrupa e deduplica apenas consultores que possuem vendas ou cotas reais
    const map = new Map<string, { id: string; nome: string; ids: Set<string>; nomes: Set<string> }>();

    for (const v of vendas) {
      // 1. Consultor / SDR Principal
      const nomePrincipal = (
        v.consultor_nome ||
        (v.participante_comercial_id ? participantes.find((p) => p.id === v.participante_comercial_id)?.nome_exibicao : null) ||
        (v.participante_comercial_id ? participantes.find((p) => p.id === v.participante_comercial_id)?.nome : null)
      )?.trim();

      if (nomePrincipal) {
        const key = normalizarBusca(nomePrincipal);
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            nome: nomePrincipal,
            ids: new Set<string>(),
            nomes: new Set<string>(),
          });
        }
        const item = map.get(key)!;
        if (v.participante_comercial_id) item.ids.add(v.participante_comercial_id);
        item.nomes.add(nomePrincipal);
      }

      // 2. Participante Secundário
      const nomeSecundario = (
        v.secundario_nome ||
        (v.participante_secundario_id ? participantes.find((p) => p.id === v.participante_secundario_id)?.nome_exibicao : null) ||
        (v.participante_secundario_id ? participantes.find((p) => p.id === v.participante_secundario_id)?.nome : null)
      )?.trim();

      if (nomeSecundario) {
        const key = normalizarBusca(nomeSecundario);
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            nome: nomeSecundario,
            ids: new Set<string>(),
            nomes: new Set<string>(),
          });
        }
        const item = map.get(key)!;
        if (v.participante_secundario_id) item.ids.add(v.participante_secundario_id);
        item.nomes.add(nomeSecundario);
      }
    }

    // 3. Checar também em cotas
    for (const c of cotas) {
      if (c.consultor_nome?.trim()) {
        const nome = c.consultor_nome.trim();
        const key = normalizarBusca(nome);
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            nome,
            ids: new Set<string>(),
            nomes: new Set<string>(),
          });
        }
        map.get(key)!.nomes.add(nome);
      }
    }

    return Array.from(map.values())
      .map((item) => ({
        id: item.id,
        nome: item.nome,
        ids: Array.from(item.ids),
        nomes: Array.from(item.nomes),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
  }, [vendas, cotas, participantes]);

  const gruposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const v of vendas) {
      if (v.grupo_codigo) set.add(v.grupo_codigo.trim());
    }
    for (const c of cotas) {
      if (c.numero_grupo) set.add(c.numero_grupo.trim());
    }
    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [vendas, cotas]);

  // Modais
  const [editandoVenda, setEditandoVenda] = useState<VendaItem | null>(null);
  const [cancelandoCota, setCancelandoCota] = useState<CotaItem | null>(null);
  const [excluindoVenda, setExcluindoVenda] = useState<VendaItem | null>(null);
  const [editandoCotaNum, setEditandoCotaNum] = useState<CotaItem | null>(null);
  const [contemplandoCota, setContemplandoCota] = useState<CotaItem | null>(null);

  const [modalErro, setModalErro] = useState<string | null>(null);
  const [modalSucesso, setModalSucesso] = useState<string | null>(null);

  // Estados para Modal de Exclusão Master
  const [textoConfirmacao, setTextoConfirmacao] = useState("");
  const [acaoMaster, setAcaoMaster] = useState<"EXCLUIR" | "ESTORNAR">("ESTORNAR");
  const [cancelarPagas, setCancelarPagas] = useState(false);
  const [motivoMaster, setMotivoMaster] = useState("");

  // Estados para Modal de Cancelamento com Estorno
  const [motivoCancelamento, setMotivoCancelamento] = useState("Cancelamento formal solicitado pelo cliente.");

  // Estados para Modal de Edição de Venda
  const [editNumGrupo, setEditNumGrupo] = useState("");
  const [editNumCota, setEditNumCota] = useState("");
  const [editQtdCotas, setEditQtdCotas] = useState<number>(1);
  const [editValorCredito, setEditValorCredito] = useState<number>(0);
  const [editValorParcela, setEditValorParcela] = useState<number>(0);
  const [editPrazo, setEditPrazo] = useState<number>(0);
  const [editPrincipalId, setEditPrincipalId] = useState("");
  const [editPerfilPrincipalId, setEditPerfilPrincipalId] = useState("");
  const [editModalidadeId, setEditModalidadeId] = useState<string>("");
  const [editTipoVenda, setEditTipoVenda] = useState<string>("INTEGRAL");
  const [editSecundarioId, setEditSecundarioId] = useState("");
  const [editPerfilSecundarioId, setEditPerfilSecundarioId] = useState("");
  const [editFracaoSec, setEditFracaoSec] = useState<number>(20);
  const [editData1, setEditData1] = useState("");
  const [editData2, setEditData2] = useState("");
  const [editRecalcular, setEditRecalcular] = useState(true);

  // Estados para Modal de Contemplação
  const [tipoContemplacao, setTipoContemplacao] = useState("SORTEIO");
  const [dataContemplacao, setDataContemplacao] = useState(new Date().toISOString().slice(0, 10));
  const [anteciparComissoes, setAnteciparComissoes] = useState(true);
  const [competenciaAntecipada, setCompetenciaAntecipada] = useState(new Date().toISOString().slice(0, 7));

  // Perfis do consultor selecionado no modal de edição
  const perfisDoPrincipal = useMemo(() => {
    if (!editPrincipalId) return [];
    return (vinculosPerfis ?? []).filter((v) => v.participante_id === editPrincipalId && v.perfil);
  }, [vinculosPerfis, editPrincipalId]);

  const perfisDoSecundario = useMemo(() => {
    if (!editSecundarioId) return [];
    return (vinculosPerfis ?? []).filter((v) => v.participante_id === editSecundarioId && v.perfil);
  }, [vinculosPerfis, editSecundarioId]);

  const regraEditPrincipal = useMemo(() => {
    const perfilId = editPerfilPrincipalId || perfisDoPrincipal[0]?.perfil_id;
    if (!perfilId) return null;
    return regrasParticipantes.find((r) => r.perfil_id === perfilId) || null;
  }, [regrasParticipantes, editPerfilPrincipalId, perfisDoPrincipal]);

  const programaEditId = useMemo(() => {
    return regraEditPrincipal?.programa_id || null;
  }, [regraEditPrincipal]);

  const percentualFranqueadoraEditAtivo = useMemo(() => {
    const matchMod = modalidades.find((m) => m.codigo.toUpperCase() === editTipoVenda);
    const r = regrasFranquia.find(
      (rf) => (programaEditId ? rf.programa_id === programaEditId : true) && (rf.modalidade_comissao_id === matchMod?.id || !rf.modalidade_comissao_id)
    ) || (programaEditId ? regrasFranquia.find((rf) => rf.programa_id === programaEditId) : null)
      || regrasFranquia[0];
    if (r?.percentual_total_comissao !== undefined && r?.percentual_total_comissao !== null) {
      return Number(r.percentual_total_comissao);
    }
    return programaEditId ? 2.0 : 4.0;
  }, [programaEditId, modalidades, regrasFranquia, editTipoVenda]);

  const normalizarBusca = (texto: string) =>
    texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const palavrasBusca = normalizarBusca(termoBusca).trim().split(/\s+/).filter(Boolean);
  const termoCotaLimpo = normalizarBusca(filtroCota).trim();

  // Filtragem de vendas com suporte a consultor, grupo, cota, mês e busca livre
  const vendasFiltradas = useMemo(() => {
    return vendas.filter((v) => {
      // 1. Mês de referência (Competência)
      if (competencia !== "todos" && (v.data_primeira_parcela || v.data_venda).slice(0, 7) !== competencia) {
        return false;
      }

      // 2. Filtro por Consultor / SDR (Apenas quem tem vendas)
      if (filtroConsultor !== "todos") {
        const consultorSelecionado = consultoresDisponiveis.find((c) => c.id === filtroConsultor);
        const matchPrincipalId = v.participante_comercial_id === filtroConsultor;
        const matchSecundarioId = v.participante_secundario_id === filtroConsultor;
        const matchPrincipal = matchPrincipalId || (consultorSelecionado?.ids.includes(v.participante_comercial_id || "") ?? false);
        const matchSecundario = matchSecundarioId || (consultorSelecionado?.ids.includes(v.participante_secundario_id || "") ?? false);
        const matchNome = (
          (v.consultor_nome && normalizarBusca(v.consultor_nome) === filtroConsultor) ||
          (v.secundario_nome && normalizarBusca(v.secundario_nome) === filtroConsultor) ||
          (consultorSelecionado?.nomes.some((n) =>
            (v.consultor_nome && normalizarBusca(v.consultor_nome) === normalizarBusca(n)) ||
            (v.secundario_nome && normalizarBusca(v.secundario_nome) === normalizarBusca(n))
          ) ?? false)
        );
        if (!matchPrincipal && !matchSecundario && !matchNome) return false;
      }

      // 3. Filtro por Grupo
      const cotasDaVenda = cotas.filter((c) => c.venda_id === v.id);
      if (filtroGrupo !== "todos") {
        const matchGrupoVenda = v.grupo_codigo?.trim() === filtroGrupo;
        const matchGrupoCota = cotasDaVenda.some((c) => c.numero_grupo?.trim() === filtroGrupo);
        if (!matchGrupoVenda && !matchGrupoCota) return false;
      }

      // 4. Filtro por Cota
      if (termoCotaLimpo) {
        const matchCotaVenda = v.cota_numero && normalizarBusca(v.cota_numero).includes(termoCotaLimpo);
        const matchCotaDef = cotasDaVenda.some((c) => c.numero_cota && normalizarBusca(c.numero_cota).includes(termoCotaLimpo));
        if (!matchCotaVenda && !matchCotaDef) return false;
      }

      // 5. Busca Geral / Livre
      if (palavrasBusca.length > 0) {
        const textoVenda = normalizarBusca(
          `${v.cliente_nome} ${v.cliente_cpf_cnpj || ""} ${v.cliente_email || ""} ${v.cliente_telefone || ""} ${v.grupo_codigo || ""} ${v.cota_numero || ""} ${v.consultor_nome || ""} ${v.secundario_nome || ""} ${v.tipo_negociacao || ""}`
        );
        const textoCotas = cotasDaVenda.map((c) => normalizarBusca(`${c.numero_grupo} ${c.numero_cota || ""} ${c.status}`)).join(" ");
        const combinacao = `${textoVenda} ${textoCotas}`;
        const match = palavrasBusca.every((p) => combinacao.includes(p));
        if (!match) return false;
      }

      return true;
    });
  }, [vendas, cotas, competencia, filtroConsultor, consultoresDisponiveis, filtroGrupo, termoCotaLimpo, palavrasBusca]);

  const cotasFiltradas = useMemo(() => {
    return cotas.filter((c) => {
      if (filtroConsultor !== "todos") {
        const consultorSelecionado = consultoresDisponiveis.find((cons) => cons.id === filtroConsultor);
        const v = vendas.find((venda) => venda.id === c.venda_id);
        const matchId = (consultorSelecionado && v) ? consultorSelecionado.ids.some(
          (id) => id === v.participante_comercial_id || id === v.participante_secundario_id
        ) : false;
        const matchNome = (
          (c.consultor_nome && normalizarBusca(c.consultor_nome) === filtroConsultor) ||
          (v?.consultor_nome && normalizarBusca(v.consultor_nome) === filtroConsultor) ||
          (v?.secundario_nome && normalizarBusca(v.secundario_nome) === filtroConsultor) ||
          (consultorSelecionado?.nomes.some((n) =>
            (c.consultor_nome && normalizarBusca(c.consultor_nome) === normalizarBusca(n)) ||
            (v?.consultor_nome && normalizarBusca(v.consultor_nome) === normalizarBusca(n)) ||
            (v?.secundario_nome && normalizarBusca(v.secundario_nome) === normalizarBusca(n))
          ) ?? false)
        );
        if (!matchId && !matchNome) return false;
      }
      if (filtroGrupo !== "todos" && c.numero_grupo?.trim() !== filtroGrupo) return false;
      if (termoCotaLimpo && !(c.numero_cota && normalizarBusca(c.numero_cota).includes(termoCotaLimpo))) return false;
      if (palavrasBusca.length > 0) {
        const texto = normalizarBusca(`${c.cliente_nome || ""} ${c.consultor_nome || ""} ${c.numero_grupo} ${c.numero_cota || ""} ${c.status}`);
        if (!palavrasBusca.every((p) => texto.includes(p))) return false;
      }
      return true;
    });
  }, [cotas, vendas, filtroConsultor, consultoresDisponiveis, filtroGrupo, termoCotaLimpo, palavrasBusca]);

  const valorVendido = vendasFiltradas.filter((v) => !["cancelada", "suspensa"].includes(v.status)).reduce((s, v) => s + Number(v.valor_credito), 0);
  const metaPeriodo = competencia === "todos" ? metas.reduce((s, m) => s + m.valor, 0) : metas.filter((m) => m.inicio.slice(0, 7) <= competencia && m.fim.slice(0, 7) >= competencia).reduce((s, m) => s + m.valor, 0);
  const comissoesGeradas = vendasFiltradas.reduce((s, v) => s + Number(v.comissoes_geradas ?? 0), 0);
  const valorEmpresa = vendasFiltradas.reduce((s, v) => s + Number(v.valor_empresa ?? 0), 0);

  const operacoesPorCota = useMemo(() => {
    return vendasFiltradas.flatMap<{
      venda: VendaItem;
      cota: CotaItem | null;
      indice: number;
      total: number;
    }>((v) => {
      const cotasDaVenda = cotas
        .filter((c) => c.venda_id === v.id)
        .sort((a, b) => (a.ordem_cota || 1) - (b.ordem_cota || 1));

      let cotasExibidas = cotasDaVenda;
      if (filtroGrupo !== "todos") {
        cotasExibidas = cotasExibidas.filter((c) => c.numero_grupo?.trim() === filtroGrupo || v.grupo_codigo?.trim() === filtroGrupo);
      }
      if (termoCotaLimpo) {
        cotasExibidas = cotasExibidas.filter((c) => (c.numero_cota && normalizarBusca(c.numero_cota).includes(termoCotaLimpo)) || (v.cota_numero && normalizarBusca(v.cota_numero).includes(termoCotaLimpo)));
      }

      if (cotasExibidas.length > 0) {
        return cotasExibidas.map((cota, indice) => ({
          venda: v,
          cota,
          indice,
          total: cotasDaVenda.length,
        }));
      }

      if (cotasDaVenda.length === 0) {
        return [{ venda: v, cota: null, indice: 0, total: 1 }];
      }

      return [];
    });
  }, [vendasFiltradas, cotas, filtroGrupo, termoCotaLimpo]);


  // Cálculos e dados para a aba de Controle de Boletos
  const competenciaBoletoAtual = competencia !== "todos" ? competencia : (competencias[0] || new Date().toISOString().slice(0, 7));

  const operacoesBoletos = useMemo(() => {
    return operacoesPorCota.map((op) => {
      const envio = boletosEnvios.find(
        (b) =>
          b.venda_id === op.venda.id &&
          (op.cota?.id ? b.cota_id === op.cota.id : true) &&
          b.competencia === competenciaBoletoAtual
      );
      const historico = boletosEnvios
        .filter((b) => b.venda_id === op.venda.id && (op.cota?.id ? b.cota_id === op.cota.id : true))
        .sort((a, b) => b.competencia.localeCompare(a.competencia) || (b.enviado_em || "").localeCompare(a.enviado_em || ""));

      return {
        ...op,
        competencia: competenciaBoletoAtual,
        envio,
        historico,
        statusBoleto: envio?.status_boleto || "aguardando",
      };
    });
  }, [operacoesPorCota, boletosEnvios, competenciaBoletoAtual]);

  const operacoesBoletosFiltradas = useMemo(() => {
    if (filtroStatusBoleto === "todos") return operacoesBoletos;
    return operacoesBoletos.filter((op) => op.statusBoleto === filtroStatusBoleto);
  }, [operacoesBoletos, filtroStatusBoleto]);

  const totalBoletosMes = operacoesBoletos.length;
  const totalBoletosAguardando = operacoesBoletos.filter((op) => op.statusBoleto === "aguardando").length;
  const totalBoletosBaixados = operacoesBoletos.filter((op) => op.statusBoleto === "baixado").length;
  const totalBoletosEnviados = operacoesBoletos.filter((op) => op.statusBoleto === "enviado").length;
  const taxaConclusaoBoletos = totalBoletosMes > 0 ? Math.round((totalBoletosEnviados / totalBoletosMes) * 100) : 0;

  function handleRegistrarBoleto(
    vendaId: string,
    cotaId: string | null,
    comp: string,
    acao: "BAIXAR" | "ENVIAR" | "DESFAZER",
    canal = "whatsapp",
    observacao = ""
  ) {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("venda_id", vendaId);
        if (cotaId) fd.append("cota_id", cotaId);
        fd.append("competencia", comp);
        fd.append("acao", acao);
        fd.append("canal", canal);
        if (observacao) fd.append("observacao", observacao);

        await registrarStatusBoletoAction(fd);
        setModalSucesso(
          acao === "BAIXAR"
            ? "Boleto registrado como Baixado com sucesso!"
            : acao === "ENVIAR"
            ? "Boleto registrado como Enviado ao cliente!"
            : "Status de boleto desfeito com sucesso!"
        );
      } catch (err: any) {
        setModalErro(err.message || "Erro ao registrar status do boleto.");
      }
    });
  }

  const temFiltroAtivo = competencia !== "todos" || filtroConsultor !== "todos" || filtroGrupo !== "todos" || filtroCota.trim() !== "" || termoBusca.trim() !== "";

  function limparFiltros() {
    setCompetencia("todos");
    setFiltroConsultor("todos");
    setFiltroGrupo("todos");
    setFiltroCota("");
    setTermoBusca("");
  }

  function abrirEditarVenda(v: VendaItem) {
    setEditandoVenda(v);
    setEditNumGrupo(v.grupo_codigo || "");
    setEditNumCota(v.cota_numero || "");
    setEditQtdCotas(v.quantidade_cotas || 1);
    setEditValorCredito(v.valor_credito || 0);
    setEditValorParcela(v.parcela || 0);
    setEditPrazo(v.prazo || 0);
    setEditPrincipalId(v.participante_comercial_id || "");
    setEditPerfilPrincipalId(v.perfil_principal_id || (v.snapshot_venda as any)?.perfil_principal_id || "");

    const modId = v.modalidade_comissao_id || (v.snapshot_venda as any)?.modalidade_comissao_id || "";
    const tipo = (v.snapshot_venda as any)?.tipo_venda || (v.tipo_negociacao?.toLowerCase().includes("60") ? "REDUZIDA_60_99" : v.tipo_negociacao?.toLowerCase().includes("59") ? "REDUZIDA_ABAIXO_59" : "INTEGRAL");
    setEditModalidadeId(modId);
    setEditTipoVenda(tipo);

    setEditSecundarioId(v.participante_secundario_id || "");
    setEditPerfilSecundarioId(v.perfil_secundario_id || (v.snapshot_venda as any)?.perfil_secundario_id || "");
    setEditFracaoSec(v.participante_secundario_fracao_percentual ? Number(v.participante_secundario_fracao_percentual) : 20);
    setEditData1(v.data_primeira_parcela || v.data_venda.slice(0, 10));
    setEditData2(v.data_segunda_parcela || "");
    setEditRecalcular(true);
    setModalErro(null);
  }

  function abrirExcluirVenda(v: VendaItem) {
    setExcluindoVenda(v);
    setTextoConfirmacao("");
    setAcaoMaster("ESTORNAR");
    setCancelarPagas(false);
    setMotivoMaster("");
    setModalErro(null);
  }

  function abrirContemplarCota(c: CotaItem) {
    setContemplandoCota(c);
    setTipoContemplacao("SORTEIO");
    const hj = new Date().toISOString().slice(0, 10);
    setDataContemplacao(hj);
    setCompetenciaAntecipada(hj.slice(0, 7));
    setAnteciparComissoes(true);
    setModalErro(null);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Operacional &amp; Gestão</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">Vendas &amp; Cotas Definitivas</h1>
          <p className="mt-1 text-xs text-slate-500">
            Empresa: <strong className="text-slate-800 dark:text-slate-200">{empresaNome}</strong>
          </p>
        </div>
        {isMaster && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-900 shadow-2xs">
            👑 Permissão Master / Gestão Total Ativa
          </div>
        )}
      </header>

      {/* Seletor de Abas: Vendas & Cotas vs Controle de Boletos */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setAbaAtiva("vendas")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition cursor-pointer ${
            abaAtiva === "vendas"
              ? "border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <Layers className="h-4 w-4" />
          Vendas &amp; Cotas ({operacoesPorCota.length})
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva("boletos")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-black uppercase tracking-wider transition cursor-pointer ${
            abaAtiva === "boletos"
              ? "border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <FileText className="h-4 w-4" />
          Controle de Boletos ({operacoesBoletosFiltradas.length})
          {totalBoletosEnviados > 0 && (
            <span className="ml-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold dark:bg-emerald-950 dark:text-emerald-300">
              {totalBoletosEnviados}/{totalBoletosMes} ({taxaConclusaoBoletos}%)
            </span>
          )}
        </button>
      </div>

      {/* Painel Unificado de Filtros Operacionais */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Filtros de Vendas &amp; Cotas
            </span>
            {temFiltroAtivo && (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                Filtros ativos
              </span>
            )}
          </div>
          {temFiltroAtivo && (
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              Limpar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Mês de Referência */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              <Calendar className="inline h-3 w-3 mr-1 text-slate-400" />
              Mês de Referência
            </label>
            <select
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="todos">Todos</option>
              {competencias.map((mes) => (
                <option key={mes} value={mes}>
                  {formatarDataBR(mes)} ({mes})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Filtro por Consultor */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              <UserCheck className="inline h-3 w-3 mr-1 text-slate-400" />
              Consultor / SDR
            </label>
            <select
              value={filtroConsultor}
              onChange={(e) => setFiltroConsultor(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="todos">Todos os consultores</option>
              {consultoresDisponiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Filtro por Grupo */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              <Tag className="inline h-3 w-3 mr-1 text-slate-400" />
              Grupo
            </label>
            <select
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
            >
              <option value="todos" className="font-sans">Todos os grupos</option>
              {gruposDisponiveis.map((grp) => (
                <option key={grp} value={grp}>
                  Grupo {grp}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Filtro por Cota */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              <Hash className="inline h-3 w-3 mr-1 text-slate-400" />
              Número da Cota
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: 1337, 0032..."
                value={filtroCota}
                onChange={(e) => setFiltroCota(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-mono font-semibold text-slate-800 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {filtroCota && (
                <button
                  type="button"
                  onClick={() => setFiltroCota("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 5. Busca Geral (Cliente, CPF, etc.) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              <Search className="inline h-3 w-3 mr-1 text-slate-400" />
              Busca Livre
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Cliente, CPF..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {termoBusca && (
                <button
                  type="button"
                  onClick={() => setTermoBusca("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filtro específico de status do boleto quando na aba de boletos */}
        {abaAtiva === "boletos" && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mr-1">
                Status do Boleto:
              </span>
              {[
                { id: "todos", label: "Todos os status", count: totalBoletosMes },
                { id: "aguardando", label: "⏳ Aguardando Baixa", count: totalBoletosAguardando },
                { id: "baixado", label: "📥 Baixado (Aguardando Envio)", count: totalBoletosBaixados },
                { id: "enviado", label: "✅ Boleto Enviado", count: totalBoletosEnviados },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setFiltroStatusBoleto(st.id as any)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition cursor-pointer ${
                    filtroStatusBoleto === st.id
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <span>{st.label}</span>
                  <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    filtroStatusBoleto === st.id ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                  }`}>
                    {st.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-800">
          <span>
            Exibindo <strong>{operacoesPorCota.length}</strong> {operacoesPorCota.length === 1 ? "operação" : "operações"} ({vendasFiltradas.length} {vendasFiltradas.length === 1 ? "venda" : "vendas"})
          </span>
          <div className="flex items-center gap-3 font-semibold">
            <span>Ativas: <strong className="text-emerald-700 dark:text-emerald-400">{operacoesPorCota.filter(({ cota, venda }) => (cota?.status || venda.status) === "ativa").length}</strong></span>
            <span>·</span>
            <span>Contempladas: <strong className="text-blue-700 dark:text-blue-400">{operacoesPorCota.filter(({ cota }) => cota?.status === "contemplada").length}</strong></span>
            <span>·</span>
            <span>Canceladas: <strong className="text-rose-700 dark:text-rose-400">{operacoesPorCota.filter(({ cota, venda }) => (cota?.status || venda.status) === "cancelada").length}</strong></span>
          </div>
        </div>
      </div>

{abaAtiva === "vendas" ? (
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[
        ["Valor vendido",valorVendido,"border-blue-200 bg-blue-50 text-blue-950"],
        ["Meta",metaPeriodo,"border-violet-200 bg-violet-50 text-violet-950"],
        ["Falta para meta",Math.max(0,metaPeriodo-valorVendido),"border-amber-200 bg-amber-50 text-amber-950"],
        ["Comissões geradas",comissoesGeradas,"border-emerald-200 bg-emerald-50 text-emerald-950"],
        ["Valor para empresa",valorEmpresa,"border-cyan-200 bg-cyan-50 text-cyan-950"],
      ].map(([titulo,valor,classe])=><div key={String(titulo)} className={`rounded-2xl border p-5 ${classe}`}><p className="text-xs font-black uppercase">{titulo}</p><p className="mt-2 text-2xl font-black">{brl(Number(valor))}</p></div>)}</section>
      ) : (
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-black uppercase text-slate-500">Total de Cotas no Mês ({formatarDataBR(competenciaBoletoAtual)})</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{totalBoletosMes}</p>
          <p className="mt-1 text-[11px] text-slate-400">Cotas elegíveis na competência</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-2xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          <p className="text-xs font-black uppercase">⏳ Aguardando Baixa</p>
          <p className="mt-2 text-3xl font-black">{totalBoletosAguardando}</p>
          <p className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-300/80">Pendentes de emissão/baixa</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-2xs text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
          <p className="text-xs font-black uppercase">📥 Baixados (Aguardando Envio)</p>
          <p className="mt-2 text-3xl font-black">{totalBoletosBaixados}</p>
          <p className="mt-1 text-[11px] text-blue-800/80 dark:text-blue-300/80">Prontos para envio ao cliente</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-2xs text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase">✅ Boletos Enviados</p>
            <span className="rounded-full bg-emerald-200/80 px-2 py-0.5 text-[10px] font-black text-emerald-900">{taxaConclusaoBoletos}%</span>
          </div>
          <p className="mt-2 text-3xl font-black">{totalBoletosEnviados}</p>
          <p className="mt-1 text-[11px] text-emerald-800/80 dark:text-emerald-300/80">Entregues aos clientes no mês</p>
        </div>
      </section>
      )}

      {modalSucesso && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4 text-xs font-bold text-emerald-900 border border-emerald-300">
          <span>{modalSucesso}</span>
          <button type="button" onClick={() => setModalSucesso(null)} className="text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
      )}



      {/* SEÇÃO DA TABELA DE ACORDO COM A ABA ATIVA */}
      {abaAtiva === "vendas" ? (
      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Vendas individualizadas por cota ({operacoesPorCota.length})
            </h2>
          </div>

        {operacoesPorCota.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">Nenhuma venda encontrada para os filtros aplicados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Grupo &amp; Cota</th>
                  <th className="p-3 text-center">Qtd.</th>
                  <th className="p-3">Crédito</th>
                  <th className="p-3">Parcela / Negociação</th>
                  <th className="p-3">Consultor / SDR</th>
                  <th className="p-3">1ª Parcela</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {operacoesPorCota.map(({ venda: v, cota, indice, total }) => {
                  return (
                    <tr key={`${v.id}-${cota?.id || "sem-cota"}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">
                        <div className="font-bold">{v.cliente_nome}</div>
                        {v.cliente_cpf_cnpj && <div className="text-[10px] text-slate-400 font-mono">{v.cliente_cpf_cnpj}</div>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-extrabold text-blue-900 dark:bg-blue-950/60 dark:text-blue-200 border border-blue-200 dark:border-blue-800 font-mono">
                            Grupo {cota?.numero_grupo || v.grupo_codigo || "1463"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-col gap-1">
                          {cota?.numero_cota ? (
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs">🎯 Cota {cota.ordem_cota || indice + 1}: #{cota.numero_cota}</span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-200 dark:border-amber-800">⏳ Cota {cota?.ordem_cota || indice + 1}: SIF pendente</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-black text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          Cota {cota?.ordem_cota || indice + 1} de {total}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-950 dark:text-white">{brl(cota?.valor_credito ?? v.valor_credito)}</td>
                      <td className="p-3">
                        <div className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                          {brl(cota?.parcela ?? v.parcela)} <span className="text-[10px] text-slate-500">({cota?.prazo ?? v.prazo}m)</span>
                        </div>
                        <div className="mt-1">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {v.tipo_negociacao || "Integral"}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {v.consultor_nome || "Consultor Principal"}
                        </div>
                        <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400">
                          {obterInfoPerfilPrincipal(v, vinculosPerfis)}
                        </div>
                        {v.secundario_nome && (
                          <div className="text-[10px] text-amber-600 font-semibold mt-0.5">
                            🤝 SDR: {v.secundario_nome} ({v.participante_secundario_fracao_percentual || 20}%)
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {formatarDataBR(v.data_primeira_parcela || v.data_venda)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            cota?.status === "contemplada"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : cota?.status === "ativa" || (!cota && v.status === "confirmada")
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          {cota?.status === "contemplada" ? "🏆 CONTEMPLADA" : cota?.status || v.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex flex-col items-end gap-1 min-w-[125px]">
                          {cota && cota.status !== "contemplada" && cota.status !== "cancelada" && (
                            <button
                              type="button"
                              onClick={() => abrirContemplarCota(cota)}
                              title="Registrar Contemplação e Antecipar Comissões"
                              className="w-full text-left rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 transition cursor-pointer"
                            >
                              <Trophy className="inline h-3 w-3 mr-1" />
                              Contemplar cota {cota.ordem_cota || indice + 1}
                            </button>
                          )}
                          {cota && (
                            <button type="button" onClick={() => { setEditandoCotaNum(cota); setEditNumCota(cota.numero_cota || ""); setModalErro(null); }} className="w-full text-left rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer">
                              <Hash className="inline h-3 w-3 mr-1" />{cota.numero_cota ? "Alterar número" : "Definir número da cota"}
                            </button>
                          )}
                          {isMaster && (
                            <button
                              type="button"
                              onClick={() => abrirEditarVenda(v)}
                              title="Editar venda e comissões (Master)"
                              className="w-full text-left rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 transition cursor-pointer"
                            >
                              <Pencil className="inline h-3 w-3 mr-1" />
                              Editar Venda
                            </button>
                          )}
                          {cota && cota.status !== "cancelada" && <button
                            type="button" onClick={() => { setCancelandoCota(cota); setModalErro(null); }}
                            title="Cancelar somente esta cota com aplicação de curva de estorno"
                            className="w-full text-left rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 transition cursor-pointer"
                          ><Ban className="inline h-3 w-3 mr-1" />Cancelar cota {cota.ordem_cota || indice + 1}</button>}
                          {isMaster && indice === 0 && (
                            <button
                              type="button"
                              onClick={() => abrirExcluirVenda(v)}
                              title="Excluir ou Estornar Venda (Master)"
                              className="w-full text-left rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition cursor-pointer"
                            >
                              <Trash2 className="inline h-3 w-3 mr-1" />
                              Estornar/Excluir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* SEÇÃO 2: Cotas Definitivas */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            Cotas Definitivas ({cotasFiltradas.length})
          </h2>
        </div>

        {cotas.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">Nenhuma cota registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="p-3">Grupo</th>
                  <th className="p-3">Número da Cota</th>
                  <th className="p-3">Crédito</th>
                  <th className="p-3">Parcela</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cotasFiltradas.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">Grupo {c.numero_grupo}</td>
                    <td className="p-3">
                      <div>
                        {c.numero_cota ? (
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            Cota #{c.numero_cota}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            Pendente SIF (Em definição)
                          </span>
                        )}
                        <div className="mt-1 text-[10px] leading-4 text-slate-600 dark:text-slate-300">
                          <span className="block font-bold">{c.cliente_nome || "Cliente não identificado"}</span>
                          <span className="block">Consultor: {c.consultor_nome || "Não informado"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-950 dark:text-white">{brl(c.valor_credito)}</td>
                    <td className="p-3 font-mono text-slate-700 dark:text-slate-300">{brl(c.parcela)}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          c.status === "contemplada"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : c.status === "ativa"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        }`}
                      >
                        {c.status === "contemplada" ? "🏆 Contemplada" : c.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex flex-col items-end gap-1 min-w-[125px]">
                        {c.status !== "contemplada" && (
                          <button
                            type="button"
                            onClick={() => abrirContemplarCota(c)}
                            className="w-full text-left rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 transition cursor-pointer"
                          >
                            <Trophy className="inline h-3 w-3 mr-1" />
                            Contemplar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoCotaNum(c);
                            setEditNumCota(c.numero_cota || "");
                            setModalErro(null);
                          }}
                          className="w-full text-left rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition cursor-pointer"
                        >
                          <Hash className="inline h-3 w-3 mr-1" />
                          {c.numero_cota ? "Alterar cota" : "Definir cota oficial"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!cotasFiltradas.length && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-sm text-slate-500">
                      Nenhuma cota encontrada para esta busca.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>
      ) : (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-2">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Controle de Boletos — Competência {formatarDataBR(competenciaBoletoAtual)} ({operacoesBoletosFiltradas.length})
              </h2>
              <p className="text-xs text-slate-500">
                Registre com 1 clique a baixa e o envio aos clientes com gravação de data, horário e responsável.
              </p>
            </div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Conclusão: <strong className="text-emerald-600">{totalBoletosEnviados} de {totalBoletosMes} ({taxaConclusaoBoletos}%)</strong>
            </div>
          </div>

          {operacoesBoletosFiltradas.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500">Nenhum boleto encontrado para os filtros aplicados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Grupo &amp; Cota</th>
                    <th className="p-3">Consultor / SDR</th>
                    <th className="p-3 text-center">Status do Boleto</th>
                    <th className="p-3">Data/Hora Baixa</th>
                    <th className="p-3">Data/Hora Envio</th>
                    <th className="p-3 text-right">Ações Rápidas (1 Clique)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {operacoesBoletosFiltradas.map(({ venda: v, cota, indice, total, envio, historico, statusBoleto }) => {
                    const zapLink = gerarLinkWhatsAppBoleto(
                      v.cliente_nome,
                      v.cliente_telefone,
                      cota?.numero_grupo || v.grupo_codigo || "1463",
                      cota?.numero_cota || v.cota_numero || null,
                      competenciaBoletoAtual
                    );

                    return (
                      <tr key={`boleto-${v.id}-${cota?.id || "sem-cota"}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          <div className="font-bold">{v.cliente_nome}</div>
                          {v.cliente_cpf_cnpj && <div className="text-[10px] text-slate-400 font-mono">{v.cliente_cpf_cnpj}</div>}
                          {v.cliente_telefone && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                              <span>📱 {v.cliente_telefone}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-extrabold text-blue-900 dark:bg-blue-950/60 dark:text-blue-200 border border-blue-200 dark:border-blue-800 font-mono">
                              Grupo {cota?.numero_grupo || v.grupo_codigo || "1463"}
                            </span>
                          </div>
                          <div className="mt-1">
                            {cota?.numero_cota ? (
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs">🎯 Cota {cota.ordem_cota || indice + 1}: #{cota.numero_cota}</span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 border border-amber-200 dark:border-amber-800">⏳ Cota {cota?.ordem_cota || indice + 1}: SIF pendente</span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            Parcela: <strong>{brl(cota?.parcela ?? v.parcela)}</strong>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {v.consultor_nome || "Consultor Principal"}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {obterInfoPerfilPrincipal(v, vinculosPerfis)}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {statusBoleto === "enviado" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black uppercase text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                              <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                              Boleto Enviado
                            </span>
                          ) : statusBoleto === "baixado" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black uppercase text-blue-900 dark:bg-blue-950/80 dark:text-blue-200 border border-blue-300 dark:border-blue-800">
                              <Download className="h-3.5 w-3.5 text-blue-600" />
                              Baixado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black uppercase text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                              <Clock className="h-3.5 w-3.5 text-amber-600" />
                              Aguardando Baixa
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {envio?.baixado_em ? (
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200">
                                {formatarDataHoraBR(envio.baixado_em)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Por: {envio.baixado_por_nome || "Consultor"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {envio?.enviado_em ? (
                            <div>
                              <div className="font-bold text-emerald-700 dark:text-emerald-400">
                                {formatarDataHoraBR(envio.enviado_em)}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Via {envio.canal || "whatsapp"} por: {envio.enviado_por_nome || "Consultor"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex flex-col items-end gap-1.5 min-w-[200px]">
                            <div className="flex items-center gap-1 w-full justify-end">
                              {/* Botão Baixado */}
                              <button
                                type="button"
                                onClick={() => handleRegistrarBoleto(v.id, cota?.id || null, competenciaBoletoAtual, "BAIXAR")}
                                disabled={isPending}
                                title="Registrar que o boleto foi baixado da administradora"
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                                  statusBoleto === "baixado" || statusBoleto === "enviado"
                                    ? "bg-blue-100 text-blue-900 border border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                                    : "bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300"
                                }`}
                              >
                                <Download className="h-3 w-3" />
                                {statusBoleto === "baixado" || statusBoleto === "enviado" ? "Baixado ✓" : "Baixar"}
                              </button>

                              {/* Botão Enviado */}
                              <button
                                type="button"
                                onClick={() => handleRegistrarBoleto(v.id, cota?.id || null, competenciaBoletoAtual, "ENVIAR")}
                                disabled={isPending}
                                title="Registrar que o boleto foi enviado ao cliente (marca baixado + enviado)"
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                                  statusBoleto === "enviado"
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                                }`}
                              >
                                <Send className="h-3 w-3" />
                                {statusBoleto === "enviado" ? "Enviado ✓" : "Enviar"}
                              </button>

                              {/* Botão WhatsApp */}
                              {zapLink && (
                                <a
                                  href={zapLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => handleRegistrarBoleto(v.id, cota?.id || null, competenciaBoletoAtual, "ENVIAR", "whatsapp")}
                                  title="Abrir WhatsApp com mensagem pronta do boleto e registrar envio automático"
                                  className="rounded-lg bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200 px-2.5 py-1 text-[11px] font-bold transition flex items-center gap-1 border border-emerald-300"
                                >
                                  <MessageSquare className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
                                  WhatsApp
                                </a>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[10px]">
                              {/* Histórico Geral */}
                              <button
                                type="button"
                                onClick={() => setCotaHistoricoBoleto({ venda: v, cota })}
                                className="text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
                              >
                                <History className="h-3 w-3" />
                                Histórico ({historico.length})
                              </button>

                              {/* Desfazer */}
                              {envio && (
                                <button
                                  type="button"
                                  onClick={() => handleRegistrarBoleto(v.id, cota?.id || null, competenciaBoletoAtual, "DESFAZER")}
                                  disabled={isPending}
                                  className="text-slate-400 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer"
                                  title="Desfazer envio/baixa deste mês"
                                >
                                  <Undo2 className="h-3 w-3" />
                                  Desfazer
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* MODAL 5: HISTÓRICO GERAL DE BOLETOS DA COTA */}
      {cotaHistoricoBoleto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-blue-700" />
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white">
                    Histórico Geral de Boletos — {cotaHistoricoBoleto.venda.cliente_nome}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Grupo {cotaHistoricoBoleto.cota?.numero_grupo || cotaHistoricoBoleto.venda.grupo_codigo} · Cota {cotaHistoricoBoleto.cota?.numero_cota ? `#${cotaHistoricoBoleto.cota.numero_cota}` : "SIF pendente"}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setCotaHistoricoBoleto(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {boletosEnvios
                .filter(
                  (b) =>
                    b.venda_id === cotaHistoricoBoleto.venda.id &&
                    (cotaHistoricoBoleto.cota?.id ? b.cota_id === cotaHistoricoBoleto.cota.id : true)
                )
                .sort((a, b) => b.competencia.localeCompare(a.competencia) || (b.enviado_em || "").localeCompare(a.enviado_em || "")).length === 0 ? (
                <p className="p-8 text-center text-xs text-slate-500">
                  Nenhum registro de boleto realizado para esta cota até o momento.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl overflow-hidden">
                  {boletosEnvios
                    .filter(
                      (b) =>
                        b.venda_id === cotaHistoricoBoleto.venda.id &&
                        (cotaHistoricoBoleto.cota?.id ? b.cota_id === cotaHistoricoBoleto.cota.id : true)
                    )
                    .sort((a, b) => b.competencia.localeCompare(a.competencia) || (b.enviado_em || "").localeCompare(a.enviado_em || ""))
                    .map((item) => (
                      <div key={item.id} className="p-3 text-xs flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                              {formatarDataBR(item.competencia)}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                item.status_boleto === "enviado"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {item.status_boleto === "enviado" ? "Enviado" : "Baixado"}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                            {item.baixado_em && (
                              <div>📥 Baixado em: <strong>{formatarDataHoraBR(item.baixado_em)}</strong> por {item.baixado_por_nome || "Consultor"}</div>
                            )}
                            {item.enviado_em && (
                              <div>🚀 Enviado em: <strong>{formatarDataHoraBR(item.enviado_em)}</strong> ({item.canal}) por {item.enviado_por_nome || "Consultor"}</div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            handleRegistrarBoleto(item.venda_id, item.cota_id, item.competencia, "DESFAZER");
                          }}
                          className="text-[11px] text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                        >
                          Excluir registro
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t pt-3">
              <button
                type="button"
                onClick={() => setCotaHistoricoBoleto(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 0: REGISTRAR CONTEMPLAÇÃO & ANTECIPAÇÃO DE COMISSÕES */}
      {contemplandoCota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-indigo-200 bg-white p-6 shadow-2xl dark:border-indigo-900 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                <Trophy className="h-6 w-6" />
                <h3 className="font-black text-slate-900 dark:text-white text-base">
                  Registrar Contemplação da Cota #{contemplandoCota.numero_cota || "Pendente"}
                </h3>
              </div>
              <button type="button" onClick={() => setContemplandoCota(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {modalErro && <p className="rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{modalErro}</p>}

            <form
              action={(formData) => {
                startTransition(async () => {
                  try {
                    await registrarContemplacaoAction(formData);
                    setContemplandoCota(null);
                    setModalSucesso("Contemplação registrada e comissões liberadas com sucesso!");
                  } catch (err: any) {
                    setModalErro(err.message || "Erro ao registrar contemplação.");
                  }
                });
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="cota_id" value={contemplandoCota.id} />

              <div className="rounded-xl bg-indigo-50/70 p-3 text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-200">
                <p className="font-bold">
                  Grupo {contemplandoCota.numero_grupo} · Cota {contemplandoCota.numero_cota || "SIF"} · Crédito: {brl(contemplandoCota.valor_credito)}
                </p>
                <p className="text-[11px] mt-0.5 text-indigo-700 dark:text-indigo-300">
                  Na contemplação, a Administradora (Racon) libera o saldo integral da comissão de venda.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Tipo de Contemplação:</label>
                  <select
                    name="tipo_contemplacao"
                    value={tipoContemplacao}
                    onChange={(e) => setTipoContemplacao(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="SORTEIO">Sorteio (Loteria Federal)</option>
                    <option value="LANCE">Lance Livre</option>
                    <option value="LANCE_FIXO">Lance Fixo</option>
                    <option value="LANCE_EMBUTIDO">Lance Embutido</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Data da Contemplação:</label>
                  <input
                    name="data_contemplacao"
                    type="date"
                    value={dataContemplacao}
                    onChange={(e) => {
                      setDataContemplacao(e.target.value);
                      setCompetenciaAntecipada(e.target.value.slice(0, 7));
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Regra de Antecipação de Comissões */}
              <div className="space-y-2 rounded-xl border border-indigo-200 bg-linear-to-br from-indigo-50/50 to-blue-50/30 p-4 dark:border-indigo-900/50 dark:from-indigo-950/20 dark:to-blue-950/20">
                <div className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-200">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>Liberação &amp; Antecipação de Comissões:</span>
                </div>

                <div className="space-y-2 mt-2">
                  <label className="flex items-start gap-2.5 rounded-xl border border-indigo-300 bg-white p-3 cursor-pointer shadow-2xs dark:border-indigo-800 dark:bg-slate-800">
                    <input
                      type="radio"
                      name="antecipar_comissoes"
                      value="true"
                      checked={anteciparComissoes}
                      onChange={() => setAnteciparComissoes(true)}
                      className="mt-1"
                    />
                    <div>
                      <span className="font-black text-indigo-950 dark:text-indigo-200">
                        ⚡ Antecipar todas as parcelas restantes para o próximo pagamento (Recomendado)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Todas as parcelas futuras da Franqueadora, do Consultor e do SDR serão unificadas e liberadas para recebimento na competência <strong>{competenciaAntecipada}</strong>.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer dark:border-slate-700 dark:bg-slate-800">
                    <input
                      type="radio"
                      name="antecipar_comissoes"
                      value="false"
                      checked={!anteciparComissoes}
                      onChange={() => setAnteciparComissoes(false)}
                      className="mt-1"
                    />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        📅 Manter cronograma original mês a mês
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Mantém as parcelas distribuídas nas datas originais sem antecipação de competência.
                      </p>
                    </div>
                  </label>
                </div>

                {anteciparComissoes && (
                  <div className="mt-3 pt-2 border-t border-indigo-100 dark:border-indigo-900 flex items-center justify-between">
                    <label className="font-bold text-indigo-900 dark:text-indigo-300">Competência de Liberação:</label>
                    <input
                      type="month"
                      name="competencia_antecipada"
                      value={competenciaAntecipada}
                      onChange={(e) => setCompetenciaAntecipada(e.target.value)}
                      className="rounded-lg border border-indigo-300 bg-white px-3 py-1 font-bold text-indigo-950 dark:border-indigo-800 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setContemplandoCota(null)}
                  className="rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-indigo-700 px-6 py-2.5 font-bold text-white shadow-md hover:bg-indigo-800 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Processando Contemplação…" : "Confirmar Contemplação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: EDITAR VENDA (MASTER) */}
      {editandoVenda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-blue-700" />
                <h3 className="font-black text-slate-900 dark:text-white">Editar Venda &amp; Comissões (Master)</h3>
              </div>
              <button type="button" onClick={() => setEditandoVenda(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {modalErro && <p className="rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{modalErro}</p>}

            <form
              action={(formData) => {
                startTransition(async () => {
                  try {
                    await masterAtualizarVendaAction(formData);
                    setEditandoVenda(null);
                    setModalSucesso("Venda e modelo de comissão atualizados com sucesso!");
                  } catch (err: any) {
                    setModalErro(err.message || "Erro ao atualizar.");
                  }
                });
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="venda_id" value={editandoVenda.id} />

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Grupo:</label>
                  <input
                    name="numero_grupo"
                    type="text"
                    placeholder="Ex: 1453"
                    value={editNumGrupo}
                    onChange={(e) => setEditNumGrupo(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Número da Cota:</label>
                  <input
                    name="numero_cota"
                    type="text"
                    placeholder="Ex: 0452"
                    value={editNumCota}
                    onChange={(e) => setEditNumCota(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Qtd. de Cotas:</label>
                  <input
                    name="quantidade_cotas"
                    type="number"
                    min="1"
                    max="100"
                    value={editQtdCotas}
                    onChange={(e) => setEditQtdCotas(parseInt(e.target.value) || 1)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Crédito Total (R$):</label>
                  <input
                    name="valor_credito"
                    type="number"
                    step="0.01"
                    min="1"
                    value={editValorCredito}
                    onChange={(e) => setEditValorCredito(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-bold text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Valor da Parcela (R$):</label>
                  <input
                    name="valor_parcela"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editValorParcela}
                    onChange={(e) => setEditValorParcela(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Prazo (meses):</label>
                  <input
                    name="prazo"
                    type="number"
                    min="1"
                    max="600"
                    value={editPrazo}
                    onChange={(e) => setEditPrazo(parseInt(e.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Consultor Principal:</label>
                <select
                  name="participante_principal_id"
                  value={editPrincipalId}
                  onChange={(e) => {
                    setEditPrincipalId(e.target.value);
                    setEditPerfilPrincipalId("");
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-semibold dark:border-slate-700 dark:bg-slate-800"
                >
                  {participantes.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome_exibicao || p.nome}</option>
                  ))}
                </select>
              </div>

              {/* TIPO DE VENDA / MODALIDADE DA PARCELA */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 dark:border-indigo-900/40 dark:bg-indigo-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-indigo-950 dark:text-indigo-200 text-xs">
                    Tipo de Venda &amp; Modalidade da Parcela:
                  </label>
                  <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300">
                    Comissão Franqueadora: {percentualFranqueadoraEditAtivo.toFixed(2)}%
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { codigo: "INTEGRAL", nome: "Integral (100%)", desc: "Comissão Cheia" },
                    { codigo: "REDUZIDA_60_99", nome: "Reduzida 60%", desc: "60% a 99%" },
                    { codigo: "REDUZIDA_ABAIXO_59", nome: "Abaixo de 59%", desc: "Super Reduzida" },
                  ].map((op) => {
                    const matchMod = modalidades.find((m) => m.codigo.toUpperCase() === op.codigo);
                    const isSelected = editTipoVenda === op.codigo;
                    const refPct = (() => {
                      const r = regrasFranquia.find(
                        (rf) => (programaEditId ? rf.programa_id === programaEditId : true) && (rf.modalidade_comissao_id === matchMod?.id || !rf.modalidade_comissao_id)
                      ) || (programaEditId ? regrasFranquia.find((rf) => rf.programa_id === programaEditId) : null)
                        || regrasFranquia[0];
                      if (r?.percentual_total_comissao !== undefined && r?.percentual_total_comissao !== null) {
                        return Number(r.percentual_total_comissao);
                      }
                      return programaEditId ? 2.0 : 4.0;
                    })();

                    return (
                      <label
                        key={op.codigo}
                        className={`flex flex-col justify-between rounded-xl border p-2.5 cursor-pointer transition text-xs ${
                          isSelected
                            ? "border-indigo-600 bg-white shadow-sm ring-2 ring-indigo-600/30 text-indigo-950 dark:bg-slate-800 dark:text-white font-bold"
                            : "border-slate-200 bg-white/70 hover:bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="tipo_venda_radio_edit"
                            checked={isSelected}
                            onChange={() => {
                              setEditTipoVenda(op.codigo);
                              if (matchMod?.id) setEditModalidadeId(matchMod.id);
                            }}
                            className="mt-0.5 text-indigo-600"
                          />
                          <div>
                            <p className="font-extrabold">{op.nome}</p>
                            <p className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">{op.desc}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] text-slate-500">
                          <span>Ref:</span>
                          <strong className="text-indigo-700 font-bold">{refPct.toFixed(2)}%</strong>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <input type="hidden" name="modalidade_comissao_id" value={editModalidadeId} />
                <input type="hidden" name="tipo_venda" value={editTipoVenda} />
                <input type="hidden" name="percentual_franqueadora" value={percentualFranqueadoraEditAtivo} />
              </div>

              {/* SELEÇÃO DO MODELO DE COMISSÃO DO PRINCIPAL */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-1.5">
                <label className="font-bold text-blue-950 dark:text-blue-200 text-xs">
                  Modelo de Comissão do Consultor Principal:
                </label>
                {perfisDoPrincipal.length > 0 ? (
                  <select
                    name="perfil_principal_id"
                    value={editPerfilPrincipalId || perfisDoPrincipal[0]?.perfil_id}
                    onChange={(e) => setEditPerfilPrincipalId(e.target.value)}
                    className="w-full rounded-lg border border-blue-300 bg-white p-2 font-bold text-slate-900 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {perfisDoPrincipal.map((p: any) => (
                      <option key={p.id} value={p.perfil_id}>
                        {p.perfil?.nome} ({p.papel_tipo}) {p.override_percentual !== null ? "— " + p.override_percentual + "%" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[11px] text-blue-800/80">
                    Consultor Padrão (50% da Franqueadora)
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Participante Secundário (SDR):</label>
                  <select
                    name="participante_secundario_id"
                    value={editSecundarioId}
                    onChange={(e) => {
                      setEditSecundarioId(e.target.value);
                      setEditPerfilSecundarioId("");
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Sem secundário</option>
                    {participantes.filter((p) => p.id !== editPrincipalId).map((p) => (
                      <option key={p.id} value={p.id}>{p.nome_exibicao || p.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Fração do SDR (% sobre o Principal):</label>
                  <input
                    name="fracao_secundario"
                    type="number"
                    min="0.1"
                    max="99.9"
                    step="0.1"
                    value={editFracaoSec}
                    onChange={(e) => setEditFracaoSec(parseFloat(e.target.value) || 0)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              {editSecundarioId && perfisDoSecundario.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <label className="font-bold text-[11px] text-amber-900 dark:text-amber-300">Modelo do Secundário / SDR:</label>
                  <select
                    name="perfil_secundario_id"
                    value={editPerfilSecundarioId || perfisDoSecundario[0]?.perfil_id}
                    onChange={(e) => setEditPerfilSecundarioId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-amber-300 bg-white p-1.5 font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {perfisDoSecundario.map((p: any) => (
                      <option key={p.id} value={p.perfil_id}>
                        {p.perfil?.nome} ({p.papel_tipo})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Data da 1ª Parcela (Adesão):</label>
                  <input
                    name="data_primeira_parcela"
                    type="date"
                    value={editData1}
                    onChange={(e) => setEditData1(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Data da 2ª Parcela (Início das demais):</label>
                  <input
                    name="data_segunda_parcela"
                    type="date"
                    value={editData2}
                    onChange={(e) => setEditData2(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-[11px] text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                <label className="flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    name="recalcular_futuras"
                    checked={editRecalcular}
                    onChange={(e) => setEditRecalcular(e.target.checked)}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  Recalcular comissões futuras em aberto com base nestas alterações
                </label>
                <p className="mt-1 ml-6 text-blue-700/80">
                  As parcelas que já foram pagas/conferidas serão preservadas integralmente para manter a integridade fiscal.
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setEditandoVenda(null)}
                  className="rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-blue-700 px-5 py-2 font-bold text-white shadow-md hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Salvando…" : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CANCELAR COTA COM ESTORNO */}
      {cancelandoCota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-amber-600" />
                <h3 className="font-black text-slate-900 dark:text-white">Cancelar Cota &amp; Aplicar Curva de Estorno</h3>
              </div>
              <button type="button" onClick={() => setCancelandoCota(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {modalErro && <p className="rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{modalErro}</p>}

            <form
              action={(formData) => {
                startTransition(async () => {
                  try {
                    await cancelarCotaEstornoAction(formData);
                    setCancelandoCota(null);
                    setModalSucesso("Cota cancelada e curva de estorno aplicada com sucesso!");
                  } catch (err: any) {
                    setModalErro(err.message || "Erro ao cancelar cota.");
                  }
                });
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="cota_id" value={cancelandoCota.id} />

              <p className="text-slate-600 dark:text-slate-300">
                Você está cancelando a cota do Grupo <strong>{cancelandoCota.numero_grupo}</strong> (Crédito: {brl(cancelandoCota.valor_credito)}).
              </p>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Motivo do Cancelamento:</label>
                <textarea
                  name="motivo"
                  rows={3}
                  required
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 font-medium dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-bold">Efeito Operacional:</p>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  <li>Todas as previsões futuras em aberto serão canceladas.</li>
                  <li>O sistema apurará a % de estorno sobre as parcelas já pagas conforme o tempo de vigência da cota.</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setCancelandoCota(null)}
                  className="rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-amber-600 px-5 py-2 font-bold text-white shadow-md hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Processando…" : "Confirmar Cancelamento &amp; Estorno"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EXCLUIR OU ESTORNAR VENDA (MASTER) */}
      {excluindoVenda && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-rose-300 bg-white p-6 shadow-2xl dark:border-rose-900 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-rose-700">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="font-black">Ação Administrativa Master: Venda #{excluindoVenda.id.slice(0, 8)}</h3>
              </div>
              <button type="button" onClick={() => setExcluindoVenda(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {modalErro && <p className="rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{modalErro}</p>}

            <form
              action={(formData) => {
                startTransition(async () => {
                  try {
                    await masterExcluirOuEstornarVendaAction(formData);
                    setExcluindoVenda(null);
                    setModalSucesso("Operação executada com sucesso!");
                  } catch (err: any) {
                    setModalErro(err.message || "Erro na operação.");
                  }
                });
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="venda_id" value={excluindoVenda.id} />

              <p className="text-slate-700 dark:text-slate-300">
                Cliente: <strong>{excluindoVenda.cliente_nome}</strong> · Crédito: <strong>{brl(excluindoVenda.valor_credito)}</strong>
              </p>

              <div className="space-y-2">
                <label className="font-bold text-slate-800 dark:text-slate-200">Escolha o tipo de operação:</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                    <input
                      type="radio"
                      name="acao"
                      value="ESTORNAR"
                      checked={acaoMaster === "ESTORNAR"}
                      onChange={() => setAcaoMaster("ESTORNAR")}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">Estornar Venda (Recomendado)</span>
                      <p className="text-[11px] text-slate-500">Mantém o histórico gravado e marca a venda/cota como cancelada.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/40 p-3 cursor-pointer hover:bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20">
                    <input
                      type="radio"
                      name="acao"
                      value="EXCLUIR"
                      checked={acaoMaster === "EXCLUIR"}
                      onChange={() => setAcaoMaster("EXCLUIR")}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-bold text-rose-900 dark:text-rose-300">Excluir cadastro incorreto (Apenas em Erros Extremos)</span>
                      <p className="text-[11px] text-rose-700/80">Remove a venda da operação e libera a contratação. Se houver vínculo em relatório, registra a reversão financeira, reabre a linha como não encontrada e preserva o histórico auditável.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <label className="font-bold text-slate-800 dark:text-slate-200">Tratamento das Comissões:</label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                    <input
                      type="radio"
                      name="cancelar_pagas"
                      value="false"
                      checked={!cancelarPagas}
                      onChange={() => setCancelarPagas(false)}
                    />
                    Cancelar apenas as comissões em aberto (preserva as já pagas)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                    <input
                      type="radio"
                      name="cancelar_pagas"
                      value="true"
                      checked={cancelarPagas}
                      onChange={() => setCancelarPagas(true)}
                    />
                    Cancelar todas as comissões geradas (inclusive as já liquidadas/pagas)
                  </label>
                </div>
              </div>

              {acaoMaster === "EXCLUIR" && (
                <div className="space-y-1.5 rounded-xl border border-rose-300 bg-rose-50 p-3">
                  <label className="font-bold text-rose-900">
                    Digite "EXCLUIR" para confirmar esta ação irreversível:
                  </label>
                  <input
                    type="text"
                    name="confirmacao_texto"
                    required
                    value={textoConfirmacao}
                    onChange={(e) => setTextoConfirmacao(e.target.value)}
                    placeholder="EXCLUIR"
                    className="w-full rounded-xl border border-rose-400 bg-white p-2 font-mono font-bold uppercase text-rose-900"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setExcluindoVenda(null)}
                  className="rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || (acaoMaster === "EXCLUIR" && textoConfirmacao !== "EXCLUIR")}
                  className="rounded-xl bg-rose-700 px-5 py-2 font-bold text-white shadow-md hover:bg-rose-800 disabled:opacity-50 cursor-pointer"
                >
                    {isPending ? "Processando…" : acaoMaster === "EXCLUIR" ? "Excluir cadastro incorreto" : "Confirmar Estorno"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DEFINIR/ALTERAR COTA OFICIAL */}
      {editandoCotaNum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-blue-700" />
                <h3 className="font-black text-slate-900 dark:text-white">Número Oficial da Cota</h3>
              </div>
              <button type="button" onClick={() => setEditandoCotaNum(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form
              action={(formData) => {
                startTransition(async () => {
                  try {
                    await atualizarNumeroCotaAction(formData);
                    setEditandoCotaNum(null);
                    setModalSucesso("Número da cota atualizado com sucesso!");
                  } catch (err: any) {
                    setModalErro(err.message || "Erro ao atualizar cota.");
                  }
                });
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="cota_id" value={editandoCotaNum.id} />

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Número da Cota emitido pela Racon:</label>
                <input
                  name="numero_cota"
                  type="text"
                  required
                  placeholder="Ex: 0452"
                  value={editNumCota}
                  onChange={(e) => setEditNumCota(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setEditandoCotaNum(null)}
                  className="rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-blue-700 px-5 py-2 font-bold text-white shadow-md hover:bg-blue-800 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? "Salvando…" : "Salvar Cota Oficial"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
