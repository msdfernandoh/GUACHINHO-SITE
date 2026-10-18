'use client'

import React, { useState, useEffect } from 'react'
import {
  Bot,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ExternalLink,
  KeyRound,
  Play,
  Compass,
  Settings2,
  Clock,
  Eye,
  EyeOff,
  Building2,
  Loader2,
  Search,
  X,
  History,
  Terminal,
  FileCode,
  Check,
  AlertTriangle,
} from 'lucide-react'
import {
  RoboConfigOutput,
  PortalTipo,
  SalvarRoboConfigInput,
  ResumoExecucoesDia,
} from '@/lib/automacoes/robos/types'
import { acompanharExecucaoRobo } from '@/lib/automacoes/robos/roboPolling'

export type RobosImportacaoContentProps = {
  empresas: { id: string; nome: string }[]
  administradoras: { id: string; nome: string; slug?: string }[]
}

export function RobosImportacaoContent({
  empresas,
  administradoras,
}: RobosImportacaoContentProps) {
  const [robos, setRobos] = useState<RoboConfigOutput[]>([])
  const [resumoDia, setResumoDia] = useState<ResumoExecucoesDia | null>(null)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  // Modal de Criação / Edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editandoRobo, setEditandoRobo] = useState<RoboConfigOutput | null>(null)
  const [salvando, setSalvando] = useState(false)

  // Form State
  const [nome, setNome] = useState('')
  const [portalTipo, setPortalTipo] = useState<PortalTipo>('RACON')
  const [empresaId, setEmpresaId] = useState('')
  const [administradoraId, setAdministradoraId] = useState('')
  const [siteUrl, setSiteUrl] = useState('')
  const [loginUrl, setLoginUrl] = useState('')
  const [usuarioLogin, setUsuarioLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [senhaSecundaria, setSenhaSecundaria] = useState('')
  const [showSenhaSecundaria, setShowSenhaSecundaria] = useState(false)
  const [ativo, setAtivo] = useState(false)
  const [modo, setModo] = useState<'DRY_RUN' | 'PRODUCAO'>('DRY_RUN')
  const [tarefasJson, setTarefasJson] = useState('{\n  "passos": []\n}')

  // Modal de Logs e Execução em Tempo Real
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [execucaoAtual, setExecucaoAtual] = useState<any>(null)
  const [executando, setExecutando] = useState(false)

  // Modal de Mapeamento de Tarefas
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [roboParaMapear, setRoboParaMapear] = useState<RoboConfigOutput | null>(null)
  const [mapeando, setMapeando] = useState(false)
  const [mapResult, setMapResult] = useState<any>(null)

  // Histórico Modal
  const [histModalOpen, setHistModalOpen] = useState(false)
  const [roboHistorico, setRoboHistorico] = useState<RoboConfigOutput | null>(null)

  // Mensagens e Notificações locais
  const [notificacao, setNotificacao] = useState<{ tipo: 'ok' | 'erro' | 'info'; texto: string } | null>(null)

  const carregarRobos = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/automacoes/robos', { cache: 'no-store' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setRobos(data.robos || [])
        setResumoDia(data.resumo_dia || null)
      } else {
        setNotificacao({ tipo: 'erro', texto: data.error || 'Falha ao carregar robôs' })
      }
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message || 'Erro de conexão' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarRobos()
  }, [])

  const abrirModalCriacao = () => {
    setEditandoRobo(null)
    setNome('')
    setPortalTipo('RACON')
    setEmpresaId(empresas[0]?.id || '')
    setAdministradoraId(administradoras[0]?.id || '')
    setSiteUrl('https://admin.gauchinhoconsorcios.com.br/')
    setLoginUrl('https://admin.gauchinhoconsorcios.com.br/login')
    setUsuarioLogin('')
    setSenha('')
    setSenhaSecundaria('')
    setAtivo(true)
    setModo('DRY_RUN')
    setTarefasJson('{\n  "passos": []\n}')
    setModalOpen(true)
  }

  const abrirModalEdicao = (robo: RoboConfigOutput) => {
    setEditandoRobo(robo)
    setNome(robo.nome)
    setPortalTipo(robo.portal_tipo)
    setEmpresaId(robo.empresa_id || '')
    setAdministradoraId(robo.administradora?.id || '')
    setSiteUrl(robo.site_url)
    setLoginUrl(robo.login_url)
    setUsuarioLogin(robo.usuario_login)
    setSenha('')
    setSenhaSecundaria('')
    setAtivo(robo.ativo)
    setModo(robo.modo)
    setTarefasJson(JSON.stringify(robo.configuracao_tarefas || { passos: [] }, null, 2))
    setModalOpen(true)
  }

  const salvarConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)

    let parsedTarefas = {}
    try {
      parsedTarefas = JSON.parse(tarefasJson)
    } catch {
      setNotificacao({ tipo: 'erro', texto: 'JSON de tarefas inválido. Verifique a sintaxe.' })
      setSalvando(false)
      return
    }

    const payload: SalvarRoboConfigInput = {
      id: editandoRobo?.id,
      nome,
      portal_tipo: portalTipo,
      empresa_id: empresaId || null,
      administradora_id: administradoraId || null,
      site_url: siteUrl,
      login_url: loginUrl,
      usuario_login: usuarioLogin,
      senha: senha || undefined,
      senha_secundaria: senhaSecundaria || undefined,
      ativo,
      modo,
      configuracao_tarefas: parsedTarefas,
    }

    try {
      const url = editandoRobo ? `/api/automacoes/robos/${editandoRobo.id}` : '/api/automacoes/robos'
      const method = editandoRobo ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (res.ok && data.ok) {
        setNotificacao({ tipo: 'ok', texto: editandoRobo ? 'Robô atualizado com sucesso!' : 'Robô criado com sucesso!' })
        setModalOpen(false)
        carregarRobos()
      } else {
        setNotificacao({ tipo: 'erro', texto: data.error || 'Erro ao salvar robô' })
      }
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message || 'Erro ao conectar à API' })
    } finally {
      setSalvando(false)
    }
  }

  const alternarAtivo = async (id: string, novoAtivo: boolean) => {
    try {
      const res = await fetch(`/api/automacoes/robos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: novoAtivo }),
      })
      if (res.ok) {
        setRobos(prev => prev.map(r => r.id === id ? { ...r, ativo: novoAtivo, status_visual: novoAtivo ? 'ATIVO' : 'INATIVO' } : r))
      }
    } catch {}
  }

  const testarLogin = async (id: string) => {
    setNotificacao({ tipo: 'info', texto: 'Iniciando teste de conexão e login via Playwright...' })
    try {
      const res = await fetch(`/api/automacoes/robos/${id}/testar`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setNotificacao({ tipo: 'ok', texto: data.mensagem || 'Login validado com sucesso!' })
      } else {
        setNotificacao({ tipo: 'erro', texto: data.erro || 'Falha na validação de login.' })
      }
      carregarRobos()
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message || 'Erro ao testar robô' })
    }
  }

  const executarRobo = async (robo: RoboConfigOutput, forcar = false) => {
    setLogModalOpen(true)
    setExecutando(true)
    setExecucaoAtual({ status: 'PENDENTE', logs: [{ ts: new Date().toISOString(), msg: 'Solicitando execução...' }] })

    try {
      const res = await fetch(`/api/automacoes/robos/${robo.id}/executar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forcarReexecucao: forcar }),
      })
      const data = await res.json()

      if (!res.ok) {
        setExecucaoAtual((prev: any) => ({
          ...prev,
          status: 'ERRO',
          logs: [...(prev?.logs || []), { ts: new Date().toISOString(), msg: `Erro: ${data.error}` }],
        }))
        setExecutando(false)
        return
      }

      const execucaoId = data.execucao?.id
      if (!execucaoId) {
        setExecutando(false)
        return
      }

      setExecucaoAtual(data.execucao)

      // Acompanhamento em tempo real via polling
      acompanharExecucaoRobo({
        roboId: robo.id,
        execucaoId,
        onUpdate: (atualizada) => {
          setExecucaoAtual(atualizada)
        },
      }).then((res) => {
        setExecutando(false)
        carregarRobos()
      })
    } catch (err: any) {
      setExecucaoAtual((prev: any) => ({
        ...prev,
        status: 'ERRO',
        logs: [...(prev?.logs || []), { ts: new Date().toISOString(), msg: `Falha: ${err.message}` }],
      }))
      setExecutando(false)
    }
  }

  const iniciarMapeamento = async (robo: RoboConfigOutput) => {
    setRoboParaMapear(robo)
    setMapModalOpen(true)
    setMapeando(true)
    setMapResult(null)

    try {
      const res = await fetch(`/api/automacoes/robos/${robo.id}/mapear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'executar' }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setMapResult(data)
      } else {
        setNotificacao({ tipo: 'erro', texto: data.erro || 'Falha ao mapear portal' })
      }
    } catch (err: any) {
      setNotificacao({ tipo: 'erro', texto: err.message })
    } finally {
      setMapeando(false)
    }
  }

  const robosFiltrados = robos.filter(r =>
    r.nome.toLowerCase().includes(busca.toLowerCase()) ||
    r.portal_tipo.toLowerCase().includes(busca.toLowerCase()) ||
    (r.administradora?.nome || '').toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Central de Robôs de Importação</h1>
              <p className="text-sm text-zinc-500">
                Automação Playwright para portais de consórcios (Racon, Administradoras, SAAS).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={carregarRobos}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={abrirModalCriacao}
            className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" />
            Novo Robô
          </button>
        </div>
      </div>

      {/* Alerta de Notificação */}
      {notificacao && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 text-sm font-medium transition ${
            notificacao.tipo === 'ok'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
              : notificacao.tipo === 'erro'
              ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
          }`}
        >
          <span>{notificacao.texto}</span>
          <button onClick={() => setNotificacao(null)}>
            <X className="h-4 w-4 opacity-70 hover:opacity-100" />
          </button>
        </div>
      )}

      {/* Cards de Métricas Diárias */}
      {resumoDia && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total de Robôs</p>
            <p className="mt-2 text-2xl font-bold">{resumoDia.total_robos}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Robôs Ativos</p>
            <p className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{resumoDia.total_ativos}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Executados Hoje</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{resumoDia.executados_ok}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Pendentes / Atenção</p>
            <p className={`mt-2 text-2xl font-bold ${resumoDia.com_erro > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-600'}`}>
              {resumoDia.com_erro > 0 ? `${resumoDia.com_erro} com erro` : `${resumoDia.pendentes} pendentes`}
            </p>
          </div>
        </div>
      )}

      {/* Barra de Busca */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Buscar robô por nome, portal ou administradora..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-zinc-800 dark:bg-zinc-900"
        />
      </div>

      {/* Grid de Robôs */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : robosFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-800">
          <Bot className="mx-auto h-12 w-12 text-zinc-400" />
          <h3 className="mt-4 text-base font-semibold">Nenhum robô configurado</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Cadastre o primeiro robô para iniciar automações de importação.
          </p>
          <button
            onClick={abrirModalCriacao}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" />
            Cadastrar Robô
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {robosFiltrados.map((robo) => (
            <div
              key={robo.id}
              className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="space-y-4">
                {/* Top Row: Nome, Portal & Toggle Ativo */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{robo.nome}</span>
                      <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                        {robo.portal_tipo}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${robo.modo === 'PRODUCAO' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-zinc-500/10 text-zinc-500'}`}>
                        {robo.modo}
                      </span>
                    </div>
                    {robo.administradora && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                        <Building2 className="h-3 w-3" />
                        Administradora: <span className="font-medium text-zinc-700 dark:text-zinc-300">{robo.administradora.nome}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">{robo.ativo ? 'Ativo' : 'Inativo'}</span>
                    <button
                      type="button"
                      onClick={() => alternarAtivo(robo.id, !robo.ativo)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${robo.ativo ? 'bg-amber-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${robo.ativo ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                </div>

                {/* URLs & Credenciais Status */}
                <div className="space-y-1.5 rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-800/50">
                  <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Portal:</span>
                    <a
                      href={robo.login_url || robo.site_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-amber-600 hover:underline"
                    >
                      {robo.login_url || robo.site_url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Usuário:</span>
                    <span className="font-mono font-medium text-zinc-900 dark:text-zinc-200">{robo.usuario_login || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Segurança:</span>
                    {robo.credencial_configurada ? (
                      <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Cifrada (AES-256-GCM)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-medium text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Sem senha salva
                      </span>
                    )}
                  </div>
                </div>

                {/* Status da Execução Hoje */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Execução Hoje:</span>
                  {robo.status_hoje === 'SUCESSO' || robo.status_hoje === 'JA_IMPORTADO' ? (
                    <span className="flex items-center gap-1 font-medium text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Concluído
                    </span>
                  ) : robo.status_hoje === 'ERRO' ? (
                    <span className="flex items-center gap-1 font-medium text-rose-600">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Falha na Execução
                    </span>
                  ) : robo.status_hoje === 'PROCESSANDO' ? (
                    <span className="flex items-center gap-1 font-medium text-amber-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Em Execução
                    </span>
                  ) : (
                    <span className="text-zinc-400">Aguardando janela diária (04:00 / 20:00)</span>
                  )}
                </div>
              </div>

              {/* Ações do Robô */}
              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <button
                  onClick={() => executarRobo(robo)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700"
                >
                  <Play className="h-3.5 w-3.5" />
                  Executar Agora
                </button>

                <button
                  onClick={() => testarLogin(robo.id)}
                  title="Testar Conexão e Credenciais"
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Testar Login
                </button>

                <button
                  onClick={() => iniciarMapeamento(robo)}
                  title="Mapear Telas e Seletores com Playwright"
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Compass className="h-3.5 w-3.5" />
                  Mapear Tarefas
                </button>

                <button
                  onClick={() => {
                    setRoboHistorico(robo)
                    setHistModalOpen(true)
                  }}
                  title="Ver Histórico de Execuções"
                  className="rounded-xl border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <History className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => abrirModalEdicao(robo)}
                  title="Editar Configurações"
                  className="rounded-xl border border-zinc-200 p-2 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <h2 className="text-xl font-bold">
                {editandoRobo ? 'Editar Configuração do Robô' : 'Novo Robô de Importação'}
              </h2>
              <button onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" />
              </button>
            </div>

            <form onSubmit={salvarConfig} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Nome do Robô</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Robô Racon - Extrato Diário"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Tipo de Portal</label>
                  <select
                    value={portalTipo}
                    onChange={(e) => setPortalTipo(e.target.value as PortalTipo)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="RACON">Racon Consórcios</option>
                    <option value="ADEMICON">Ademicon</option>
                    <option value="RODOBENS">Rodobens</option>
                    <option value="PORTO_SEGURO">Porto Seguro</option>
                    <option value="CUSTOM">Customizado / SAAS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Administradora Conectada</label>
                  <select
                    value={administradoraId}
                    onChange={(e) => setAdministradoraId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="">Nenhuma / Global</option>
                    {administradoras.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Empresa / Franquia</label>
                  <select
                    value={empresaId}
                    onChange={(e) => setEmpresaId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="">Todas as Empresas</option>
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">URL do Site</label>
                  <input
                    type="url"
                    required
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="https://admin.gauchinhoconsorcios.com.br/"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">URL de Login Direta</label>
                  <input
                    type="url"
                    required
                    value={loginUrl}
                    onChange={(e) => setLoginUrl(e.target.value)}
                    placeholder="https://admin.gauchinhoconsorcios.com.br/login"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  />
                </div>
              </div>

              {/* Credenciais */}
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Credenciais de Autenticação Segura</p>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Usuário / Email / CPF</label>
                    <input
                      type="text"
                      required
                      value={usuarioLogin}
                      onChange={(e) => setUsuarioLogin(e.target.value)}
                      placeholder="usuario@dominio.com.br"
                      className="mt-1 w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      Senha {editandoRobo && '(deixe em branco para manter a atual)'}
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={showSenha ? 'text' : 'password'}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 pr-10 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSenha(!showSenha)}
                        className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600"
                      >
                        {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Senha Secundária / Financeira (se aplicável ao portal)
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showSenhaSecundaria ? 'text' : 'password'}
                      value={senhaSecundaria}
                      onChange={(e) => setSenhaSecundaria(e.target.value)}
                      placeholder="Senha secundária ou PIN"
                      className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 pr-10 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenhaSecundaria(!showSenhaSecundaria)}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600"
                    >
                      {showSenhaSecundaria ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Configuração de Tarefas (JSON) */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Mapeamento de Tarefas & Passos (JSON)
                  </label>
                  <span className="text-xs text-zinc-400">Suporta passos: navegar, clicar, preencher, esperar, baixar</span>
                </div>
                <textarea
                  rows={5}
                  value={tarefasJson}
                  onChange={(e) => setTarefasJson(e.target.value)}
                  className="mt-1 w-full font-mono text-xs rounded-xl border border-zinc-200 bg-zinc-900 p-3 text-zinc-200 dark:border-zinc-800 focus:outline-none"
                />
              </div>

              {/* Opções e Status */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={ativo}
                      onChange={(e) => setAtivo(e.target.checked)}
                      className="h-4 w-4 rounded text-amber-600"
                    />
                    Robô Ativo
                  </label>

                  <label className="flex items-center gap-2 text-sm font-medium">
                    <select
                      value={modo}
                      onChange={(e) => setModo(e.target.value as any)}
                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <option value="DRY_RUN">Modo Dry Run (Simulação)</option>
                      <option value="PRODUCAO">Modo Produção</option>
                    </select>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvando}
                    className="flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                  >
                    {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar Robô
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE LOGS EM TEMPO REAL */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-base">Terminal de Execução do Robô</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  execucaoAtual?.status === 'SUCESSO'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : execucaoAtual?.status === 'ERRO'
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {execucaoAtual?.status || 'PROCESSANDO'}
                </span>
              </div>
              <button onClick={() => setLogModalOpen(false)}>
                <X className="h-5 w-5 text-zinc-400 hover:text-white" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto rounded-xl bg-black p-4 font-mono text-xs text-emerald-400 shadow-inner">
              {(execucaoAtual?.detalhes?.logs || execucaoAtual?.logs || []).map((l: any, i: number) => (
                <div key={i} className="mb-1 leading-relaxed">
                  <span className="text-zinc-500">[{l.ts ? new Date(l.ts).toLocaleTimeString() : 'LOG'}]</span>{' '}
                  <span className="text-zinc-200">{l.msg || JSON.stringify(l)}</span>
                </div>
              ))}
              {executando && (
                <div className="flex items-center gap-2 text-amber-400 pt-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Aguardando resposta do runner em segundo plano...</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4 text-xs text-zinc-400">
              <span>Execução ID: {execucaoAtual?.id || '—'}</span>
              <button
                onClick={() => setLogModalOpen(false)}
                className="rounded-lg bg-zinc-800 px-4 py-2 font-medium text-white hover:bg-zinc-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE MAPEAMENTO DE TAREFAS */}
      {mapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-amber-600" />
                <h3 className="font-bold text-base">Mapeamento de Telas & Seletores: {roboParaMapear?.nome}</h3>
              </div>
              <button onClick={() => setMapModalOpen(false)}>
                <X className="h-5 w-5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" />
              </button>
            </div>

            {mapeando ? (
              <div className="flex h-64 flex-col items-center justify-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                <p className="text-sm font-medium">Navegando no portal com Playwright e capturando telas...</p>
              </div>
            ) : mapResult ? (
              <div className="mt-4 space-y-6">
                {/* Screenshots Capturados */}
                <div>
                  <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Capturas de Tela Inspecionadas:</h4>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {(mapResult.screenshots || []).map((s: any, idx: number) => (
                      <div key={idx} className="rounded-xl border border-zinc-200 overflow-hidden dark:border-zinc-800">
                        <div className="bg-zinc-100 p-2 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {s.titulo}
                        </div>
                        <img src={s.base64} alt={s.titulo} className="w-full object-contain max-h-56 bg-zinc-950" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Campos Detectados */}
                {mapResult.camposDetectados?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Elementos Detectados na Página:</h4>
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950 font-mono">
                      {mapResult.camposDetectados.map((c: any, i: number) => (
                        <div key={i} className="mb-1">
                          <span className="text-amber-600 font-bold">&lt;{c.tag}&gt;</span>{' '}
                          {c.id && <span className="text-emerald-600">id="#{c.id}"</span>}{' '}
                          {c.name && <span className="text-cyan-600">name="{c.name}"</span>}{' '}
                          {c.type && <span className="text-zinc-500">type="{c.type}"</span>}{' '}
                          {c.placeholder && <span className="text-zinc-400">placeholder="{c.placeholder}"</span>}{' '}
                          {c.texto && <span className="text-zinc-700 dark:text-zinc-300">"{c.texto}"</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 text-center py-8">
                <p className="text-sm text-zinc-500">Clique para iniciar inspeção automatizada do portal.</p>
                <button
                  onClick={() => roboParaMapear && iniciarMapeamento(roboParaMapear)}
                  className="mt-4 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Iniciar Inspeção
                </button>
              </div>
            )}

            <div className="mt-6 flex justify-end border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <button
                onClick={() => setMapModalOpen(false)}
                className="rounded-xl bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO */}
      {histModalOpen && roboHistorico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
              <h3 className="font-bold text-base">Histórico de Execuções: {roboHistorico.nome}</h3>
              <button onClick={() => setHistModalOpen(false)}>
                <X className="h-5 w-5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {(roboHistorico.ultimas_execucoes || []).length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500">Nenhuma execução registrada até o momento.</p>
              ) : (
                roboHistorico.ultimas_execucoes?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-100 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          item.status === 'SUCESSO' || item.status === 'JA_IMPORTADO'
                            ? 'bg-emerald-500'
                            : item.status === 'ERRO'
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        }`} />
                        <span className="font-semibold">{item.status}</span>
                        <span className="text-xs text-zinc-500">({item.origem || 'UI'})</span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-400">{item.iniciado_em_formatado}</p>
                      {item.erro && <p className="mt-1 text-xs text-rose-500">{item.erro}</p>}
                    </div>

                    <button
                      onClick={async () => {
                        const res = await fetch(`/api/automacoes/robos/${roboHistorico.id}/executar?execucaoId=${item.id}`)
                        const data = await res.json()
                        if (data.execucoes?.[0]) {
                          setExecucaoAtual(data.execucoes[0])
                          setLogModalOpen(true)
                        }
                      }}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                    >
                      Ver Logs
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setHistModalOpen(false)}
                className="rounded-xl bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
