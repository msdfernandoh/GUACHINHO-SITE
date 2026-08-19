"use client";

import { useState, useTransition } from "react";
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  FileText,
  Upload,
  Calendar,
  Layers,
  ChevronRight,
  X,
  History,
  ShieldCheck,
  UserCheck,
  ExternalLink,
  Loader2,
  Info,
  DollarSign,
  Percent,
} from "lucide-react";
import {
  salvarEstrategiaLanceCompletaAction,
  confirmarLanceOperacionalAction,
  revogarConfirmacaoLanceOperacionalAction,
  type CotaLanceOperacionalDTO,
  type LancesDashboardStats,
} from "@/app/erp/lances/actions";

interface ErpLancesViewProps {
  empresaId: string;
  initialStats: LancesDashboardStats;
  initialRows: CotaLanceOperacionalDTO[];
}

export function ErpLancesView({
  empresaId,
  initialStats,
  initialRows,
}: ErpLancesViewProps) {
  const [rows, setRows] = useState<CotaLanceOperacionalDTO[]>(initialRows);
  const [stats, setStats] = useState<LancesDashboardStats>(initialStats);
  const [busca, setBusca] = useState("");
  const [filtroAdministradora, setFiltroAdministradora] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("");
  const [filtroStatusCota, setFiltroStatusCota] = useState("");
  const [selectedCota, setSelectedCota] = useState<CotaLanceOperacionalDTO | null>(null);
  const [isPending, startTransition] = useTransition();

  // Estados do Formulário de Lance
  const [formLanceFixo, setFormLanceFixo] = useState(false);
  const [formSegundoFixo, setFormSegundoFixo] = useState(false);
  const [formFidelidade, setFormFidelidade] = useState(false);
  const [formLivre, setFormLivre] = useState(false);
  const [formLivrePercentual, setFormLivrePercentual] = useState<string>("");
  const [formLivreValor, setFormLivreValor] = useState<string>("");

  // Modais de Ação
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmObs, setConfirmObs] = useState("");
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [revokeMotivo, setRevokeMotivo] = useState("");

  // Administradoras únicas
  const administradoras = Array.from(new Set(rows.map((r) => r.administradora.nome).filter(Boolean)));

  // Filtragem em memória
  const filteredRows = rows.filter((r) => {
    if (filtroAdministradora && r.administradora.nome !== filtroAdministradora) return false;
    if (filtroSituacao && r.situacaoOperacional !== filtroSituacao) return false;
    if (filtroStatusCota && r.statusCota !== filtroStatusCota) return false;
    if (busca) {
      const term = busca.toLowerCase();
      const match =
        r.cliente.nome.toLowerCase().includes(term) ||
        r.cliente.cpfCnpj?.toLowerCase().includes(term) ||
        r.numeroGrupo.toLowerCase().includes(term) ||
        r.numeroCota?.toLowerCase().includes(term) ||
        r.consultor.nome.toLowerCase().includes(term);
      if (!match) return false;
    }
    return true;
  });

  const handleOpenCota = (cota: CotaLanceOperacionalDTO) => {
    setSelectedCota(cota);
    setFormLanceFixo(cota.estrategia?.lanceFixoAtivo ?? false);
    setFormSegundoFixo(cota.estrategia?.segundoLanceFixoAtivo ?? false);
    setFormFidelidade(cota.estrategia?.lanceFidelidadeAtivo ?? false);
    setFormLivre(cota.estrategia?.lanceLivreAtivo ?? false);
    setFormLivrePercentual(cota.estrategia?.lanceLivrePercentual?.toString() ?? "");
    setFormLivreValor(cota.estrategia?.lanceLivreValor?.toString() ?? "");
  };

  // Cálculo auxiliar de Lance Livre (Percentual <-> Valor)
  const handleLivrePercentualChange = (valStr: string, credito: number) => {
    setFormLivrePercentual(valStr);
    const n = Number(valStr.replace(",", "."));
    if (!isNaN(n) && n > 0 && credito > 0) {
      setFormLivreValor(((credito * n) / 100).toFixed(2));
    }
  };

  const handleLivreValorChange = (valStr: string, credito: number) => {
    setFormLivreValor(valStr);
    const n = Number(valStr.replace(",", "."));
    if (!isNaN(n) && n > 0 && credito > 0) {
      setFormLivrePercentual(((n / credito) * 100).toFixed(2));
    }
  };

  // Sugestão de datas: Hoje e Hoje + 5 meses
  const hojeStr = new Date().toISOString().slice(0, 10);
  const dataMais5Meses = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 5);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="space-y-6">
      {/* ───────────────────────────────────────────────────────────
          1. CARDS DE RESUMO SUPERIOR
      ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total de Cotas</span>
          <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{stats.totalCotas}</p>
          <span className="text-[10px] text-slate-500">Cotas da franquia</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">Com Lance Ativo</span>
          <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">{stats.comLanceAtivo}</p>
          <span className="text-[10px] text-emerald-600/80">Estratégias vigentes</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-800/40">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">Sem Estratégia</span>
          <p className="mt-1 text-2xl font-black text-slate-700 dark:text-slate-200">{stats.semEstrategia}</p>
          <span className="text-[10px] text-slate-500">Aguardando definição</span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/20">
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">Vencendo em 30d</span>
          <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-300">{stats.vencendoTrintaDias}</p>
          <span className="text-[10px] text-amber-600/80">Renovação necessária</span>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-2xs dark:border-rose-900/40 dark:bg-rose-950/20">
          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider block">Vencidos</span>
          <p className="mt-1 text-2xl font-black text-rose-700 dark:text-rose-300">{stats.vencidos}</p>
          <span className="text-[10px] text-rose-600/80">Revisar com cliente</span>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-2xs dark:border-indigo-900/40 dark:bg-indigo-950/20">
          <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">Contempladas</span>
          <p className="mt-1 text-2xl font-black text-indigo-700 dark:text-indigo-300">{stats.contempladas}</p>
          <span className="text-[10px] text-indigo-600/80">Status canônico</span>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────
          2. FILTROS E BUSCA
      ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, documento, grupo, cota ou consultor..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <select
          value={filtroAdministradora}
          onChange={(e) => setFiltroAdministradora(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="">Todas Administradoras</option>
          {administradoras.map((adm) => (
            <option key={adm} value={adm}>
              {adm}
            </option>
          ))}
        </select>

        <select
          value={filtroSituacao}
          onChange={(e) => setFiltroSituacao(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="">Todas Situações de Lance</option>
          <option value="SEM_ESTRATEGIA">Sem Estratégia</option>
          <option value="ATIVO">Lance Ativo</option>
          <option value="VENCENDO">Vencendo (&lt;= 30 dias)</option>
          <option value="VENCIDO">Vencido</option>
          <option value="CONFIRMADO">Confirmado em Assembleia</option>
          <option value="INATIVO">Inativo</option>
        </select>

        <select
          value={filtroStatusCota}
          onChange={(e) => setFiltroStatusCota(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="">Todos Status da Cota</option>
          <option value="ativa">Ativa</option>
          <option value="contemplada">Contemplada</option>
          <option value="cancelada">Cancelada</option>
          <option value="quitada">Quitada</option>
        </select>
      </div>

      {/* ───────────────────────────────────────────────────────────
          3. TABELA OPERACIONAL DE TODAS AS COTAS
      ─────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-850">
              <tr>
                <th className="px-4 py-3">Cliente / Consultor</th>
                <th className="px-4 py-3">Grupo &amp; Cota</th>
                <th className="px-4 py-3">Crédito</th>
                <th className="px-4 py-3">Status Cota</th>
                <th className="px-4 py-3">Estratégia Atual</th>
                <th className="px-4 py-3">Validade / Vencimento</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Comprovante</th>
                <th className="px-4 py-3">Confirmação</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    Nenhuma cota encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredRows.map((cota) => {
                  const est = cota.estrategia;
                  return (
                    <tr
                      key={cota.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => handleOpenCota(cota)}
                    >
                      <td className="px-4 py-3">
                        <strong className="font-bold text-slate-900 dark:text-white block">{cota.cliente.nome}</strong>
                        <span className="text-[11px] text-slate-400 block">
                          {cota.cliente.cpfCnpj || "Doc não informado"}
                        </span>
                        <span className="text-[10px] text-blue-600 font-medium block">
                          Consultor: {cota.consultor.nome}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {cota.administradora.nome} • {cota.numeroGrupo} / {cota.numeroCota || "S/N"}
                        </span>
                        <span className="text-[10px] text-slate-400 block">{cota.grupo.tipoNome}</span>
                      </td>

                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                        {cota.valorCredito.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                            cota.statusCota === "contemplada"
                              ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                              : cota.statusCota === "ativa"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {cota.statusCota}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {est ? (
                          <div className="space-y-0.5 text-[11px]">
                            {est.lanceFixoAtivo && (
                              <span className="inline-block mr-1 rounded bg-slate-100 px-1 py-0.2 text-[10px] font-bold text-slate-700">
                                Fixo {est.lanceFixoPercentual ? `${est.lanceFixoPercentual}%` : ""}
                              </span>
                            )}
                            {est.segundoLanceFixoAtivo && (
                              <span className="inline-block mr-1 rounded bg-slate-100 px-1 py-0.2 text-[10px] font-bold text-slate-700">
                                2º Fixo {est.segundoLanceFixoPercentual ? `${est.segundoLanceFixoPercentual}%` : ""}
                              </span>
                            )}
                            {est.lanceFidelidadeAtivo && (
                              <span className="inline-block mr-1 rounded bg-blue-50 px-1 py-0.2 text-[10px] font-bold text-blue-700">
                                Fidelidade
                              </span>
                            )}
                            {est.lanceLivreAtivo && (
                              <span className="inline-block rounded bg-amber-50 px-1 py-0.2 text-[10px] font-bold text-amber-700">
                                Livre {est.lanceLivrePercentual ? `${est.lanceLivrePercentual}%` : ""}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Sem lance registrado</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {est?.dataVencimento ? (
                          <div>
                            <span className="font-mono text-slate-700 dark:text-slate-300">
                              {new Date(est.dataVencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                            </span>
                            {cota.diasParaVencimento !== null && (
                              <span
                                className={`block text-[10px] font-bold ${
                                  cota.diasParaVencimento < 0
                                    ? "text-rose-600"
                                    : cota.diasParaVencimento <= 30
                                    ? "text-amber-600"
                                    : "text-slate-400"
                                }`}
                              >
                                {cota.diasParaVencimento < 0
                                  ? "Vencido"
                                  : `Renovar em ${cota.diasParaVencimento}d`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                            cota.situacaoOperacional === "CONFIRMADO"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : cota.situacaoOperacional === "VENCENDO"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : cota.situacaoOperacional === "VENCIDO"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : cota.situacaoOperacional === "ATIVO"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {cota.situacaoOperacional === "SEM_ESTRATEGIA"
                            ? "SEM LANCE"
                            : cota.situacaoOperacional}
                        </span>
                      </td>

                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {est?.comprovanteUrl ? (
                          <a
                            href={est.comprovanteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Ver
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">Sem arq.</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {est?.confirmado ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              {est.confirmadoPorNome || "Confirmado"}
                            </span>
                            {est.confirmadoEm && (
                              <span className="block text-[9px] text-slate-400">
                                {new Date(est.confirmadoEm).toLocaleDateString("pt-BR")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">Pendente</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenCota(cota)}
                          className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
                        >
                          Detalhes / Lance
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────
          4. DRAWER / MODAL: DETALHE DA COTA & REGISTRO DE ESTRATÉGIA
      ─────────────────────────────────────────────────────────── */}
      {selectedCota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-5 max-h-[92vh] overflow-y-auto">
            {/* CABEÇALHO DO DRAWER */}
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedCota.cliente.nome} — Grupo {selectedCota.numeroGrupo} / Cota {selectedCota.numeroCota || "S/N"}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedCota.administradora.nome} • Crédito:{" "}
                  <strong className="font-mono text-slate-800 dark:text-slate-200">
                    {selectedCota.valorCredito.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </strong>
                </p>
              </div>
              <button onClick={() => setSelectedCota(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* PAINEL DE CONTEXTO DO GRUPO (INFORMATIVO OPERACIONAL) */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Regras de Apoio do Grupo:</p>
                <p>
                  Lance Embutido:{" "}
                  {selectedCota.grupo.lanceEmbutidoPermitido
                    ? `Permitido até ${selectedCota.grupo.lanceEmbutidoPercentual ?? 0}%`
                    : "Não permitido neste grupo"}
                </p>
                <p className="text-[10px] text-blue-800/80 dark:text-blue-300/80">
                  O registro de lance apoia a estratégia levada à assembleia e NÃO contempla a cota automaticamente.
                </p>
              </div>
            </div>

            {/* FORMULÁRIO DE ESTRATÉGIA / RENOVAÇÃO */}
            <form
              action={async (fd) => {
                await salvarEstrategiaLanceCompletaAction(fd);
                setSelectedCota(null);
                window.location.reload();
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="cota_id" value={selectedCota.id} />

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Data do Lance */}
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Data do Lance *</label>
                  <input
                    type="date"
                    name="data_lance"
                    defaultValue={selectedCota.estrategia?.dataLance || hojeStr}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                {/* Validade / Vencimento */}
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Vencimento Sugerido (Padrão: +5 Meses) *
                  </label>
                  <input
                    type="date"
                    name="data_vencimento"
                    defaultValue={selectedCota.estrategia?.dataVencimento || dataMais5Meses}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* MODALIDADES DE LANCE */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  Modalidades Habilitadas para a Assembleia:
                </span>

                {/* 1. Lance Fixo */}
                <div className="space-y-2 border-b pb-2.5 dark:border-slate-700">
                  <label className="flex items-center gap-2 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      name="lance_fixo_ativo"
                      checked={formLanceFixo}
                      onChange={(e) => setFormLanceFixo(e.target.checked)}
                      className="h-4 w-4 rounded text-blue-600"
                    />
                    <span>Lance Fixo</span>
                  </label>
                  {formLanceFixo && (
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      <input
                        name="lance_fixo_percentual"
                        placeholder="% Fixo (Ex: 25)"
                        defaultValue={selectedCota.estrategia?.lanceFixoPercentual ?? ""}
                        className="rounded-lg border border-slate-300 p-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                      <input
                        name="lance_fixo_valor"
                        placeholder="Valor R$ (Opcional)"
                        defaultValue={selectedCota.estrategia?.lanceFixoValor ?? ""}
                        className="rounded-lg border border-slate-300 p-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  )}
                </div>

                {/* 2. Segundo Lance Fixo */}
                <div className="space-y-2 border-b pb-2.5 dark:border-slate-700">
                  <label className="flex items-center gap-2 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      name="segundo_lance_fixo_ativo"
                      checked={formSegundoFixo}
                      onChange={(e) => setFormSegundoFixo(e.target.checked)}
                      className="h-4 w-4 rounded text-blue-600"
                    />
                    <span>2º Lance Fixo</span>
                  </label>
                  {formSegundoFixo && (
                    <div className="grid grid-cols-2 gap-2 pl-6">
                      <input
                        name="segundo_lance_fixo_percentual"
                        placeholder="% 2º Fixo (Ex: 50)"
                        defaultValue={selectedCota.estrategia?.segundoLanceFixoPercentual ?? ""}
                        className="rounded-lg border border-slate-300 p-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                      <input
                        name="segundo_lance_fixo_valor"
                        placeholder="Valor R$ (Opcional)"
                        defaultValue={selectedCota.estrategia?.segundoLanceFixoValor ?? ""}
                        className="rounded-lg border border-slate-300 p-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Lance Fidelidade */}
                <div className="space-y-2 border-b pb-2.5 dark:border-slate-700">
                  <label className="flex items-center gap-2 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      name="lance_fidelidade_ativo"
                      checked={formFidelidade}
                      onChange={(e) => setFormFidelidade(e.target.checked)}
                      className="h-4 w-4 rounded text-blue-600"
                    />
                    <span>Lance Fidelidade</span>
                  </label>
                  {formFidelidade && (
                    <div className="space-y-2 pl-6">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          name="lance_fidelidade_percentual"
                          placeholder="% Fidelidade"
                          defaultValue={selectedCota.estrategia?.lanceFidelidadePercentual ?? ""}
                          className="rounded-lg border border-slate-300 p-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                        <input
                          name="lance_fidelidade_valor"
                          placeholder="Valor R$"
                          defaultValue={selectedCota.estrategia?.lanceFidelidadeValor ?? ""}
                          className="rounded-lg border border-slate-300 p-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                      <input
                        name="lance_fidelidade_observacao"
                        placeholder="Observação da administradora para fidelidade"
                        defaultValue={selectedCota.estrategia?.lanceFidelidadeObservacao ?? ""}
                        className="w-full rounded-lg border border-slate-300 p-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  )}
                </div>

                {/* 4. Lance Livre com Cálculo Auxiliar */}
                <div className="space-y-2 border-b pb-2.5 dark:border-slate-700">
                  <label className="flex items-center gap-2 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      name="lance_livre_ativo"
                      checked={formLivre}
                      onChange={(e) => setFormLivre(e.target.checked)}
                      className="h-4 w-4 rounded text-blue-600"
                    />
                    <span>Lance Livre</span>
                  </label>
                  {formLivre && (
                    <div className="space-y-1.5 pl-6">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold">Percentual Ofertado (%)</span>
                          <input
                            name="lance_livre_percentual"
                            value={formLivrePercentual}
                            onChange={(e) =>
                              handleLivrePercentualChange(e.target.value, selectedCota.valorCredito)
                            }
                            placeholder="Ex: 42.50"
                            className="w-full rounded-lg border border-slate-300 p-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold">Valor Ofertado (R$)</span>
                          <input
                            name="lance_livre_valor"
                            value={formLivreValor}
                            onChange={(e) =>
                              handleLivreValorChange(e.target.value, selectedCota.valorCredito)
                            }
                            placeholder="Ex: 85000.00"
                            className="w-full rounded-lg border border-slate-300 p-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Lance Embutido & Recursos Próprios */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Lance Embutido (%)
                    </label>
                    <input
                      name="lance_embutido_percentual"
                      placeholder="Ex: 20"
                      defaultValue={selectedCota.estrategia?.lanceEmbutidoPercentual ?? ""}
                      className="w-full rounded-lg border border-slate-300 p-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Recurso Próprio (R$)
                    </label>
                    <input
                      name="recurso_proprio_valor"
                      placeholder="Ex: 15000.00"
                      defaultValue={selectedCota.estrategia?.recursoProprioValor ?? ""}
                      className="w-full rounded-lg border border-slate-300 p-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* UPLOAD DE COMPROVANTE */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Comprovante do Lance (PDF, JPG, PNG):
                </label>
                <input
                  type="file"
                  name="comprovante_file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="w-full rounded-lg border border-slate-300 p-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                {selectedCota.estrategia?.comprovanteUrl && (
                  <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                    <FileText className="h-3 w-3 text-blue-600" />
                    Arquivo atual:{" "}
                    <a
                      href={selectedCota.estrategia.comprovanteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline font-bold"
                    >
                      {selectedCota.estrategia.comprovanteNome || "Ver Comprovante"}
                    </a>
                  </p>
                )}
              </div>

              {/* MOTIVO DA RENOVAÇÃO / OBSERVAÇÕES */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Observações Operacionais</label>
                <textarea
                  name="observacoes"
                  rows={2}
                  defaultValue={selectedCota.estrategia?.observacoes || ""}
                  placeholder="Informações adicionais para a assembleia..."
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              {/* BOTÕES DE SALVAR */}
              <div className="flex justify-end gap-2 border-t pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedCota(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700"
                >
                  Salvar / Renovar Estratégia
                </button>
              </div>
            </form>

            {/* ───────────────────────────────────────────────────────────
                CONFIRMAÇÃO OPERACIONAL DO LANCE (AUDITADO)
            ─────────────────────────────────────────────────────────── */}
            {selectedCota.estrategia && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Confirmação Operacional de Lance</h4>
                    <p className="text-[11px] text-slate-500">
                      Registre formalmente a participação efetiva desta cota na assembleia.
                    </p>
                  </div>

                  {selectedCota.estrategia.confirmado ? (
                    <button
                      type="button"
                      onClick={() => setIsRevokeModalOpen(true)}
                      className="rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 border border-rose-200 hover:bg-rose-100"
                    >
                      Revogar Confirmação
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsConfirmModalOpen(true)}
                      className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      Confirmar Lance Realizado
                    </button>
                  )}
                </div>

                {selectedCota.estrategia.confirmado && (
                  <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-900 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200">
                    <p className="font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Lance confirmado por: {selectedCota.estrategia.confirmadoPorNome}
                    </p>
                    {selectedCota.estrategia.confirmadoEm && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                        Em: {new Date(selectedCota.estrategia.confirmadoEm).toLocaleString("pt-BR")}
                      </p>
                    )}
                    {selectedCota.estrategia.confirmadoObservacao && (
                      <p className="mt-1 text-[11px] italic">"{selectedCota.estrategia.confirmadoObservacao}"</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ───────────────────────────────────────────────────────────
                HISTÓRICO DE ESTRATÉGIAS PRESERVADO
            ─────────────────────────────────────────────────────────── */}
            {selectedCota.historico.length > 0 && (
              <div className="border-t pt-3 dark:border-slate-800 space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
                  <History className="h-3.5 w-3.5 text-slate-500" />
                  Histórico de Renovações e Lances ({selectedCota.historico.length})
                </h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedCota.historico.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-[11px] dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div className="flex items-center justify-between text-slate-500 font-mono text-[10px]">
                        <span>{new Date(h.createdAt).toLocaleString("pt-BR")}</span>
                        <span>{h.motivo || "Atualização"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          MODAL: CONFIRMAR LANCE
      ─────────────────────────────────────────────────────────── */}
      {isConfirmModalOpen && selectedCota && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-3 text-xs">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Confirmar Lance em Assembleia</h4>
            <p className="text-slate-600 dark:text-slate-300">
              Confirme que o lance desta cota foi formalmente registrado e submetido para a assembleia.
            </p>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Observação Opcional</label>
              <textarea
                value={confirmObs}
                onChange={(e) => setConfirmObs(e.target.value)}
                placeholder="Ex: Registrado no sistema da administradora às 14:00"
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await confirmarLanceOperacionalAction(selectedCota.id, confirmObs);
                  setIsConfirmModalOpen(false);
                  setSelectedCota(null);
                  window.location.reload();
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          MODAL: REVOGAR CONFIRMAÇÃO
      ─────────────────────────────────────────────────────────── */}
      {isRevokeModalOpen && selectedCota && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-3 text-xs">
            <h4 className="text-sm font-bold text-rose-600">Revogar Confirmação de Lance</h4>
            <p className="text-slate-600 dark:text-slate-300">
              Informe o motivo da correção para registrar formalmente na auditoria.
            </p>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300">Motivo da Revogação *</label>
              <textarea
                value={revokeMotivo}
                onChange={(e) => setRevokeMotivo(e.target.value)}
                placeholder="Ex: Cota não participou desta assembleia / Erro de lançamento"
                rows={2}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsRevokeModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!revokeMotivo.trim()}
                onClick={async () => {
                  await revogarConfirmacaoLanceOperacionalAction(selectedCota.id, revokeMotivo);
                  setIsRevokeModalOpen(false);
                  setSelectedCota(null);
                  window.location.reload();
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Revogar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
