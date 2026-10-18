/**
 * Tipos e Interfaces do Modulo de Automacao de Robos de Importacao - Gauchinho Consorcios
 */

import type { Page } from 'playwright-core'

export type PortalTipo = 'RACON' | 'ADEMICON' | 'RODOBENS' | 'PORTO_SEGURO' | 'CUSTOM'

export type EstadoExecucaoRobo =
  | 'PENDENTE'
  | 'AUTENTICANDO'
  | 'AUTENTICADO'
  | 'LOCALIZANDO_RELATORIO'
  | 'GERANDO_RELATORIO'
  | 'BAIXANDO'
  | 'VALIDANDO_ARQUIVO'
  | 'ARQUIVO_DUPLICADO'
  | 'IMPORTANDO'
  | 'CONCLUIDO'
  | 'ERRO'
  | 'INTERVENCAO_HUMANA'

export type PortalCredentials = {
  usuario: string
  senha: string
  senhaSecundaria?: string
  urlLogin?: string
}

export type ResultadoAuth = {
  ok: boolean
  erro?: string
  precisaIntervencaoHumana?: boolean
  motivoIntervencao?: 'CAPTCHA' | 'MFA_INESPERADO' | 'TROCA_SENHA' | 'CONTA_BLOQUEADA' | 'OUTRO'
}

export type ResultadoDownload = {
  ok: boolean
  filePath?: string
  fileName?: string
  fileSize?: number
  erro?: string
}

export interface PortalRelatorioAdapter {
  readonly portalId: string
  readonly portalTipo: PortalTipo
  readonly nome: string
  readonly baseUrl: string

  login(page: Page, creds: PortalCredentials): Promise<ResultadoAuth>
  executarMapeamentoTarefas?(page: Page, tarefasConfig: Record<string, unknown>, downloadDir: string): Promise<{ ok: boolean; resultados?: unknown; erro?: string }>
  logout?(page: Page): Promise<void>
}

export type RoboConfigRow = {
  id: string
  empresa_id?: string | null
  administradora_id?: string | null
  nome: string
  portal_tipo: PortalTipo
  site_url: string
  login_url: string
  usuario_login: string
  senha_encrypted?: string | null
  senha_updated_at?: string | null
  senha_secundaria_encrypted?: string | null
  senha_secundaria_updated_at?: string | null
  ativo: boolean
  modo: 'DRY_RUN' | 'PRODUCAO'
  configuracao_tarefas?: Record<string, unknown>
  unidades_config?: Array<Record<string, unknown>>
  ultima_execucao_em?: string | null
  ultimo_sucesso_em?: string | null
  ultimo_erro?: string | null
  created_at: string
  updated_at: string
  created_by?: string | null
  updated_by?: string | null
}

export type StatusVisualRobo =
  | 'ATIVO'
  | 'INATIVO'
  | 'PORTAL_NAO_MAPEADO'
  | 'PRONTO_PARA_TESTE'
  | 'NAO_CONFIGURADO'
  | 'ERRO_DE_CONFIGURACAO'

export type UltimaExecucaoItem = {
  id: string
  status: 'SUCESSO' | 'JA_IMPORTADO' | 'ERRO' | 'PROCESSANDO' | 'PENDENTE'
  iniciado_em: string
  iniciado_em_formatado: string
  finalizado_em?: string | null
  erro?: string | null
  origem?: string | null
  resultado?: Record<string, unknown> | null
}

export type RoboConfigOutput = {
  id: string
  empresa_id?: string | null
  administradora?: { id: string; nome: string; slug?: string } | null
  nome: string
  portal_tipo: PortalTipo
  site_url: string
  login_url: string
  usuario_login: string
  credencial_configurada: boolean
  credencial_secundaria_configurada?: boolean
  ativo: boolean
  modo: 'DRY_RUN' | 'PRODUCAO'
  configuracao_tarefas?: Record<string, unknown>
  status_visual: StatusVisualRobo
  ultima_execucao_em?: string | null
  ultimo_sucesso_em?: string | null
  ultimo_erro?: string | null
  created_at: string
  updated_at: string
  ultimas_execucoes?: UltimaExecucaoItem[]
  executado_hoje?: boolean
  status_hoje?: 'SUCESSO' | 'JA_IMPORTADO' | 'ERRO' | 'NAO_EXECUTADO' | 'PROCESSANDO' | 'PENDENTE'
}

export type SalvarRoboConfigInput = {
  id?: string
  empresa_id?: string | null
  administradora_id?: string | null
  nome: string
  portal_tipo: PortalTipo
  site_url: string
  login_url: string
  usuario_login: string
  senha?: string
  senha_secundaria?: string
  ativo?: boolean
  modo?: 'DRY_RUN' | 'PRODUCAO'
  configuracao_tarefas?: Record<string, unknown>
  unidades_config?: Array<Record<string, unknown>>
}

export type ResumoExecucoesDia = {
  data_cuiaba: string
  total_robos: number
  total_ativos: number
  executados_ok: number
  pendentes: number
  com_erro: number
  todos_executados_ok: boolean
}
