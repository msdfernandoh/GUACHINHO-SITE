"use client";

import { useState, useTransition } from "react";
import {
  Bot,
  Play,
  Settings2,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  Layers,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Download,
  TicketCheck,
  KeyRound,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  type FranquiaRoboDTO,
  type RobosDashboardStats,
  type RoboExecucaoItemDTO,
  salvarConfiguracaoRoboFranquiaAction,
  executarRoboFranquiaAction,
} from "@/app/erp/robos/actions";

interface ErpRobosHubProps {
  empresaId: string;
  empresaNome: string;
  initialRobos: FranquiaRoboDTO[];
  initialStats: RobosDashboardStats;
  initialHistorico: RoboExecucaoItemDTO[];
}

export function ErpRobosHub({
  empresaId,
  empresaNome,
  initialRobos,
  initialStats,
  initialHistorico,
}: ErpRobosHubProps) {
  const [robos, setRobos] = useState<FranquiaRoboDTO[]>(initialRobos);
  const [stats, setStats] = useState<RobosDashboardStats>(initialStats);
  const [historico, setHistorico] = useState<RoboExecucaoItemDTO[]>(initialHistorico);
  const [abaAtiva, setAbaAtiva] = useState<"robos" | "mapeamento" | "historico">("robos");

  const [isPending, startTransition] = useTransition();
  const [executandoRoboId, setExecutandoRoboId] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  // Modal de Configuração
  const [roboEditando, setRoboEditando] = useState<FranquiaRoboDTO | null>(null);
  const [formUsuario, setFormUsuario] = useState("");
  const [formSenha, setFormSenha] = useState("");
  const [formPontoVenda, setFormPontoVenda] = useState("");
  const [formModo, setFormModo] = useState<"DRY_RUN" | "PRODUCAO">("PRODUCAO");
  const [formAtivo, setFormAtivo] = useState(true);

  // Modal de Mapeamento
  const [roboMapeamentoModal, setRoboMapeamentoModal] = useState<FranquiaRoboDTO | null>(null);

  const roboLances = robos.find((r) => r.tipoRotina === "FRANQUIA_LANCES_AUTOMATICOS");
  const roboBoletos = robos.find((r) => r.tipoRotina === "FRANQUIA_DOWNLOAD_BOLETOS");

  function abrirModalConfig(robo: FranquiaRoboDTO) {
    setRoboEditando(robo);
    setFormUsuario(robo.usuarioLogin || "");
    setFormSenha("");
    setFormPontoVenda((robo.configuracaoTarefas.ponto_venda as string) || "939509");
    setFormModo(robo.modo);
    setFormAtivo(robo.ativo);
    setMensagemErro(null);
    setMensagemSucesso(null);
  }

  function handleSalvarConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!roboEditando) return;

    startTransition(async () => {
      try {
        await salvarConfiguracaoRoboFranquiaAction({
          id: roboEditando.id,
          usuarioLogin: formUsuario,
          senha: formSenha || undefined,
          ativo: formAtivo,
          modo: formModo,
          pontoVenda: formPontoVenda,
        });

        setRobos((prev) =>
          prev.map((r) =>
            r.id === roboEditando.id
              ? {
                  ...r,
                  usuarioLogin: formUsuario,
                  temSenha: Boolean(formSenha || r.temSenha),
                  ativo: formAtivo,
                  modo: formModo,
                  configuracaoTarefas: {
                    ...r.configuracaoTarefas,
                    ponto_venda: formPontoVenda,
                  },
                }
              : r
          )
        );

        setMensagemSucesso("Configuração do robô salva com sucesso!");
        setRoboEditando(null);
      } catch (err: any) {
        setMensagemErro(err.message || "Erro ao salvar configuração.");
      }
    });
  }

  function handleDispararExecucao(roboId: string) {
    setExecutandoRoboId(roboId);
    setMensagemErro(null);
    setMensagemSucesso(null);

    startTransition(async () => {
      try {
        const res = await executarRoboFranquiaAction(roboId);
        if (res.success) {
          setMensagemSucesso("Execução enfileirada com sucesso! O robô iniciará o processamento.");
          // Adiciona item temporário no histórico
          const robo = robos.find((r) => r.id === roboId);
          setHistorico((prev) => [
            {
              id: res.execucaoId,
              roboConfigId: roboId,
              roboNome: robo?.nome || "Robô da Franquia",
              status: "PENDENTE",
              origem: "UI_MANUAL",
              iniciadoEm: new Date().toISOString(),
              finalizadoEm: null,
              erroMensagem: null,
              detalhes: { tipo: robo?.tipoRotina },
            },
            ...prev,
          ]);
        }
      } catch (err: any) {
        setMensagemErro(err.message || "Erro ao disparar robô.");
      } finally {
        setExecutandoRoboId(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              <Bot className="h-3.5 w-3.5" /> ERP Franquia
            </span>
            <span className="text-xs font-semibold text-slate-500">• {empresaNome}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Robôs e Automações da Franquia
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Automações inteligentes para oferta de lances automáticos e download mensal de boletos de cotas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>
      </header>

      {/* FEEDBACK MESSAGES */}
      {mensagemSucesso && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{mensagemSucesso}</span>
          <button onClick={() => setMensagemSucesso(null)} className="ml-auto text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {mensagemErro && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{mensagemErro}</span>
          <button onClick={() => setMensagemErro(null)} className="ml-auto text-rose-600 hover:text-rose-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* CARDS DE RESUMO (KPIS) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cotas da Carteira
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.totalCotasCarteira}</p>
          <p className="mt-1 text-xs text-slate-500">Cotas ativas sob gestão da franquia</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Lances Automáticos
            </span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <TicketCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.cotasComLanceDefinido}</p>
          <p className="mt-1 text-xs text-slate-500">
            {stats.cotasAguardandoLance} aguardando lance na próxima assembleia
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Boletos do Mês
            </span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <Download className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.boletosCompetenciaTotal}</p>
          <p className="mt-1 text-xs text-slate-500">Parcelas na competência atual</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ciclo de Execução
            </span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-sm font-bold text-slate-900">Mensal + Semestral</p>
          <p className="mt-1 text-xs text-slate-500">Lances: todo dia 10 | 6 em 6 meses</p>
        </div>
      </div>

      {/* NAVEGAÇÃO ENTRE ABAS */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setAbaAtiva("robos")}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
              abaAtiva === "robos"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <Bot className="h-4 w-4" /> Robôs da Franquia (2)
          </button>
          <button
            onClick={() => setAbaAtiva("mapeamento")}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
              abaAtiva === "mapeamento"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <MapPin className="h-4 w-4" /> Mapeamento de Rotas & Telas
          </button>
          <button
            onClick={() => setAbaAtiva("historico")}
            className={`flex items-center gap-2 border-b-2 py-3 text-sm font-medium transition-colors ${
              abaAtiva === "historico"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <Clock className="h-4 w-4" /> Histórico de Execuções ({historico.length})
          </button>
        </nav>
      </div>

      {/* ABA 1: ROBÔS DA FRANQUIA */}
      {abaAtiva === "robos" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* CARD ROBÔ 1: LANCES */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <TicketCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                      ROBÔ 1
                    </span>
                    <h3 className="mt-0.5 text-lg font-bold text-slate-900">
                      Lances Automáticos (Novas Vendas & Semestral)
                    </h3>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                    roboLances?.ativo
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${roboLances?.ativo ? "bg-emerald-600" : "bg-slate-400"}`} />
                  {roboLances?.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Aplica lances automáticos <strong>uma vez por mês a cada nova venda</strong> e atualiza
                as estratégias de lance de <strong>6 em 6 meses</strong> para toda a carteira de cotas
                da franquia no portal Newcon/Racon.
              </p>

              {/* Informações Operacionais */}
              <div className="mt-5 space-y-2.5 rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Destino no ERP:</span>
                  <span className="font-bold text-blue-700">Módulo /erp/lances</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Periodicidade 1:</span>
                  <span className="font-bold text-slate-900">Mensal (Novas vendas - todo dia 10)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Periodicidade 2:</span>
                  <span className="font-bold text-slate-900">Semestral (Reavaliação a cada 6 meses)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Ponto de Venda:</span>
                  <span className="font-bold text-slate-900">
                    {(roboLances?.configuracaoTarefas.ponto_venda as string) || "939509"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Última Execução:</span>
                  <span className="text-slate-600">
                    {roboLances?.ultimaExecucaoEm
                      ? new Date(roboLances.ultimaExecucaoEm).toLocaleString("pt-BR")
                      : "Aguardando 1ª execução"}
                  </span>
                </div>
              </div>
            </div>

            {/* Ações do Card */}
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
              <button
                disabled={isPending || executandoRoboId === roboLances?.id}
                onClick={() => roboLances && handleDispararExecucao(roboLances.id)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {executandoRoboId === roboLances?.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Enfileirando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Executar Lances Agora
                  </>
                )}
              </button>

              <button
                onClick={() => roboLances && setRoboMapeamentoModal(roboLances)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <MapPin className="h-4 w-4 text-slate-500" /> Mapear Rota
              </button>

              <button
                onClick={() => roboLances && abrirModalConfig(roboLances)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Settings2 className="h-4 w-4 text-slate-500" /> Configurar
              </button>
            </div>
          </div>

          {/* CARD ROBÔ 2: BOLETOS */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Download className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                      ROBÔ 2
                    </span>
                    <h3 className="mt-0.5 text-lg font-bold text-slate-900">
                      Boletos Mensais (Download & Armazenamento)
                    </h3>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                    roboBoletos?.ativo
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${roboBoletos?.ativo ? "bg-emerald-600" : "bg-slate-400"}`} />
                  {roboBoletos?.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                Baixa e salva automaticamente os boletos em PDF <strong>mês a mês</strong> das parcelas
                de todas as cotas ativas da franquia, vinculando-os ao histórico financeiro do cliente no ERP
                e permitindo envio via WhatsApp.
              </p>

              {/* Informações Operacionais */}
              <div className="mt-5 space-y-2.5 rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Destino no ERP:</span>
                  <span className="font-bold text-indigo-700">Carteira de Clientes & Financeiro</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Periodicidade:</span>
                  <span className="font-bold text-slate-900">Mensal (após fechamento da fatura)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Armazenamento:</span>
                  <span className="font-bold text-slate-900">Supabase Storage Seguro</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Ponto de Venda:</span>
                  <span className="font-bold text-slate-900">
                    {(roboBoletos?.configuracaoTarefas.ponto_venda as string) || "939509"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">Última Execução:</span>
                  <span className="text-slate-600">
                    {roboBoletos?.ultimaExecucaoEm
                      ? new Date(roboBoletos.ultimaExecucaoEm).toLocaleString("pt-BR")
                      : "Aguardando 1ª execução"}
                  </span>
                </div>
              </div>
            </div>

            {/* Ações do Card */}
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
              <button
                disabled={isPending || executandoRoboId === roboBoletos?.id}
                onClick={() => roboBoletos && handleDispararExecucao(roboBoletos.id)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {executandoRoboId === roboBoletos?.id ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Enfileirando...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Baixar Boletos Agora
                  </>
                )}
              </button>

              <button
                onClick={() => roboBoletos && setRoboMapeamentoModal(roboBoletos)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <MapPin className="h-4 w-4 text-slate-500" /> Mapear Rota
              </button>

              <button
                onClick={() => roboBoletos && abrirModalConfig(roboBoletos)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Settings2 className="h-4 w-4 text-slate-500" /> Configurar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: MAPEAMENTO DE ROTAS & TELAS */}
      {abaAtiva === "mapeamento" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold">Estrutura de Mapeamento dos Robôs</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Conforme instrução, estas são as rotas e telas a serem navegadas pelo Playwright para cada robô.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Rota Robô 1 */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    ROBÔ 1
                  </span>
                  <h3 className="font-bold text-slate-900">Lances Automáticos Newcon</h3>
                </div>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <p><strong>1. URL Base:</strong> https://e.randonconsorcios.com.br/</p>
                  <p><strong>2. Rota Newcon:</strong> frmMain.aspx &gt; Contemplação &gt; Oferta de Lance</p>
                  <p><strong>3. Tela de Filtro:</strong> frmConCpPrcOfertaLance.aspx</p>
                  <p><strong>4. Periodicidade:</strong> Mensal (novas vendas) + Semestral (reavaliação a cada 6 meses)</p>
                  <p><strong>5. Ação no ERP:</strong> Atualiza a tela de lances (/erp/lances) e registra comprovante.</p>
                </div>
                <div className="mt-4 border-t border-blue-100 pt-3">
                  <ol className="list-inside list-decimal space-y-1.5 text-xs text-slate-700">
                    <li>Autenticação SSO Microsoft</li>
                    <li>Seleção do Ponto de Venda da Franquia</li>
                    <li>Acesso à tela de Oferta de Lance</li>
                    <li>Localização de Grupo e Cota</li>
                    <li>Inserção do Lance e Confirmação</li>
                    <li>Captura de Recibo e Sincronização ERP</li>
                  </ol>
                </div>
              </div>

              {/* Rota Robô 2 */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    ROBÔ 2
                  </span>
                  <h3 className="font-bold text-slate-900">Download Mensal de Boletos</h3>
                </div>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <p><strong>1. URL Base:</strong> https://e.randonconsorcios.com.br/</p>
                  <p><strong>2. Rota Newcon:</strong> frmMain.aspx &gt; Financeiro &gt; 2ª Via de Boleto</p>
                  <p><strong>3. Tela de Filtro:</strong> frmConCpPrc2ViaBoleto.aspx</p>
                  <p><strong>4. Periodicidade:</strong> Mensal (ciclo de vencimento das parcelas)</p>
                  <p><strong>5. Ação no ERP:</strong> Anexa PDF do boleto na carteira de clientes (/erp/clientes).</p>
                </div>
                <div className="mt-4 border-t border-indigo-100 pt-3">
                  <ol className="list-inside list-decimal space-y-1.5 text-xs text-slate-700">
                    <li>Autenticação SSO Microsoft</li>
                    <li>Seleção do Ponto de Venda da Franquia</li>
                    <li>Consulta por Cota / CPF do Cliente</li>
                    <li>Download do PDF do Boleto da Competência</li>
                    <li>Upload no Supabase Storage Seguro</li>
                    <li>Disponibilização no ERP e Disparo WhatsApp</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: HISTÓRICO DE EXECUÇÕES */}
      {abaAtiva === "historico" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Histórico de Execuções dos Robôs</h2>
          <p className="mt-1 text-sm text-slate-500">
            Registro de auditoria de todas as execuções manuais e agendadas na franquia.
          </p>

          {historico.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
              <Bot className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-semibold">Nenhuma execução registrada ainda.</p>
              <p className="mt-1 text-xs text-slate-400">
                Clique em "Executar Agora" em um dos robôs acima para iniciar.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Robô</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Origem</th>
                    <th className="px-4 py-3 font-semibold">Iniciado Em</th>
                    <th className="px-4 py-3 font-semibold">Finalizado Em</th>
                    <th className="px-4 py-3 font-semibold">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historico.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-slate-900">{item.roboNome}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.status === "SUCESSO"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "PROCESSANDO"
                              ? "bg-blue-100 text-blue-800"
                              : item.status === "ERRO"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.origem}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {new Date(item.iniciadoEm).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.finalizadoEm
                          ? new Date(item.finalizadoEm).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 truncate max-w-xs">
                        {item.erroMensagem ? (
                          <span className="text-rose-600">{item.erroMensagem}</span>
                        ) : (
                          JSON.stringify(item.detalhes)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CONFIGURAÇÃO */}
      {roboEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Configurar {roboEditando.nome}
              </h3>
              <button
                onClick={() => setRoboEditando(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarConfig} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Ponto de Venda</label>
                <input
                  type="text"
                  value={formPontoVenda}
                  onChange={(e) => setFormPontoVenda(e.target.value)}
                  placeholder="Ex: 939509"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Usuário Microsoft / Newcon</label>
                <input
                  type="text"
                  value={formUsuario}
                  onChange={(e) => setFormUsuario(e.target.value)}
                  placeholder="Ex: CX45617665@rdmz.com.br"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">
                  Senha {roboEditando.temSenha ? "(Deixe em branco para manter a atual)" : ""}
                </label>
                <input
                  type="password"
                  value={formSenha}
                  onChange={(e) => setFormSenha(e.target.value)}
                  placeholder={roboEditando.temSenha ? "••••••••••••" : "Digite a senha"}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Modo de Execução</label>
                <select
                  value={formModo}
                  onChange={(e) => setFormModo(e.target.value as any)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-slate-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="PRODUCAO">Produção (Efetua ações reais no portal)</option>
                  <option value="DRY_RUN">Dry Run (Apenas simula e gera logs)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chkAtivo"
                  checked={formAtivo}
                  onChange={(e) => setFormAtivo(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="chkAtivo" className="font-semibold text-slate-700">
                  Robô Ativo para execuções e agendamentos
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setRoboEditando(null)}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? "Salvando..." : "Salvar Configuração"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DE ETAPAS DE MAPEAMENTO */}
      {roboMapeamentoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Mapeamento de Rotas — {roboMapeamentoModal.nome}
                </h3>
              </div>
              <button
                onClick={() => setRoboMapeamentoModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-600">
              <p>
                Este robô executa a rotina automatizada seguindo rigorosamente os passos abaixo no portal Newcon / Racon:
              </p>

              <div className="space-y-2 rounded-xl bg-slate-50 p-4">
                {(roboMapeamentoModal.configuracaoTarefas.etapas_mapeamento || []).map(
                  (etapa: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-slate-700">
                      <ChevronRight className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <span>{etapa}</span>
                    </div>
                  )
                )}
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-blue-900">
                <p className="font-semibold">Próximo passo:</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-blue-800">
                  No próximo passo faremos a gravação detalhada dos seletores de campo, radio buttons e cliques de confirmação no Newcon.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-3">
              <button
                onClick={() => setRoboMapeamentoModal(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
