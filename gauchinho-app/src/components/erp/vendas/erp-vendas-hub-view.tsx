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
} from "lucide-react";
import {
  masterAtualizarVendaAction,
  cancelarCotaEstornoAction,
  masterExcluirOuEstornarVendaAction,
  atualizarNumeroCotaAction,
  registrarContemplacaoAction,
} from "@/app/erp/vendas/actions";

export type VendaItem = {
  id: string;
  cliente_nome: string;
  cliente_cpf_cnpj: string | null;
  cliente_email: string | null;
  cliente_telefone: string | null;
  valor_credito: number;
  prazo: number;
  parcela: number;
  tipo_negociacao?: string;
  status: string;
  data_venda: string;
  created_at: string;
  data_primeira_parcela: string | null;
  data_segunda_parcela: string | null;
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

interface ErpVendasHubViewProps {
  vendas: VendaItem[];
  cotas: CotaItem[];
  participantes: ParticipanteSimples[];
  vinculosPerfis: VinculoPerfilSimples[];
  empresaNome: string;
  isMaster: boolean;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  empresaNome,
  isMaster,
}: ErpVendasHubViewProps) {
  const [isPending, startTransition] = useTransition();
  const [termoBusca, setTermoBusca] = useState("");

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
  const [editNumCota, setEditNumCota] = useState("");
  const [editPrincipalId, setEditPrincipalId] = useState("");
  const [editPerfilPrincipalId, setEditPerfilPrincipalId] = useState("");
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

  // Filtragem de vendas
  const vendasFiltradas = vendas.filter((v) => {
    if (!termoBusca) return true;
    const t = termoBusca.toLowerCase();
    return (
      v.cliente_nome.toLowerCase().includes(t) ||
      (v.cliente_cpf_cnpj && v.cliente_cpf_cnpj.includes(t)) ||
      (v.cota_numero && v.cota_numero.includes(t)) ||
      (v.grupo_codigo && v.grupo_codigo.includes(t))
    );
  });

  function abrirEditarVenda(v: VendaItem) {
    setEditandoVenda(v);
    setEditNumCota(v.cota_numero || "");
    setEditPrincipalId(v.participante_comercial_id || "");
    setEditPerfilPrincipalId(v.perfil_principal_id || (v.snapshot_venda as any)?.perfil_principal_id || "");
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

      {modalSucesso && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4 text-xs font-bold text-emerald-900 border border-emerald-300">
          <span>{modalSucesso}</span>
          <button type="button" onClick={() => setModalSucesso(null)} className="text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
      )}

      {/* Barra de Busca e Indicadores */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, CPF, cota ou grupo..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2 text-xs font-semibold shadow-2xs focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
          <span>Total de Vendas: <strong>{vendas.length}</strong></span>
          <span>·</span>
          <span>Cotas Ativas: <strong>{cotas.filter((c) => c.status === "ativa").length}</strong></span>
          <span>·</span>
          <span>Contempladas: <strong className="text-blue-600">{cotas.filter((c) => c.status === "contemplada").length}</strong></span>
        </div>
      </div>

      {/* SEÇÃO 1: Vendas Efetivadas */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            Vendas Efetivadas ({vendasFiltradas.length})
          </h2>
        </div>

        {vendasFiltradas.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">Nenhuma venda encontrada para os filtros aplicados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Crédito</th>
                  <th className="p-3">Parcela / Negociação</th>
                  <th className="p-3">Consultor / SDR</th>
                  <th className="p-3">1ª Parcela</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vendasFiltradas.map((v) => {
                  const cotaCorrespondente = cotas.find((c) => c.venda_id === v.id) || null;
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">
                        <div>{v.cliente_nome}</div>
                        {v.cliente_cpf_cnpj && <div className="text-[10px] text-slate-400">{v.cliente_cpf_cnpj}</div>}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-950 dark:text-white">{brl(v.valor_credito)}</td>
                      <td className="p-3">
                        <div className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                          {brl(v.parcela)} <span className="text-[10px] text-slate-500">({v.prazo}m)</span>
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
                            cotaCorrespondente?.status === "contemplada"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : v.status === "confirmada"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          {cotaCorrespondente?.status === "contemplada" ? "🏆 CONTEMPLADA" : v.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex flex-col items-end gap-1 min-w-[125px]">
                          {cotaCorrespondente && cotaCorrespondente.status !== "contemplada" && (
                            <button
                              type="button"
                              onClick={() => abrirContemplarCota(cotaCorrespondente)}
                              title="Registrar Contemplação e Antecipar Comissões"
                              className="w-full text-left rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 transition cursor-pointer"
                            >
                              <Trophy className="inline h-3 w-3 mr-1" />
                              Contemplar
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
                          <button
                            type="button"
                            onClick={() => {
                              setCancelandoCota(cotaCorrespondente);
                              setModalErro(null);
                            }}
                            title="Cancelar cota com aplicação de curva de estorno"
                            className="w-full text-left rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 transition cursor-pointer"
                          >
                            <Ban className="inline h-3 w-3 mr-1" />
                            Cancelar (Estorno)
                          </button>
                          {isMaster && (
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
            Cotas Definitivas ({cotas.length})
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
                {cotas.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">Grupo {c.numero_grupo}</td>
                    <td className="p-3">
                      {c.numero_cota ? (
                        <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          Cota #{c.numero_cota}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          Pendente SIF (Em definição)
                        </span>
                      )}
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
              </tbody>
            </table>
          </div>
        )}
      </section>

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

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Número Oficial da Cota:</label>
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
                      <span className="font-bold text-rose-900 dark:text-rose-300">Excluir Definitivamente (Apenas em Erros Extremos)</span>
                      <p className="text-[11px] text-rose-700/80">Apaga permanentemente a venda, cota e previsões, liberando a contratação para ser refeita.</p>
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
                  {isPending ? "Processando…" : acaoMaster === "EXCLUIR" ? "Excluir Definitivamente" : "Confirmar Estorno"}
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
