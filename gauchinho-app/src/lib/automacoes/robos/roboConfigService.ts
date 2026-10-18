/**
 * Servico de Gerenciamento e Configuracao de Robos de Importacao no Gauchinho Site.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  RoboConfigOutput,
  RoboConfigRow,
  SalvarRoboConfigInput,
  StatusVisualRobo,
  ResumoExecucoesDia,
  UltimaExecucaoItem,
} from './types'
import { encryptCredential, decryptCredential } from './cryptoService'
import { createManagedBrowserSession } from './browser'
import { RaconAdapter } from './adapters/raconAdapter'
import { GenericConsorcioAdapter } from './adapters/genericConsorcioAdapter'

export function getAdapterForPortal(portalTipo: string) {
  switch (portalTipo) {
    case 'RACON':
      return new RaconAdapter()
    default:
      return new GenericConsorcioAdapter(portalTipo as any)
  }
}

export function calcularStatusVisual(config: RoboConfigRow): StatusVisualRobo {
  if (!config.senha_encrypted || !config.usuario_login) {
    return 'NAO_CONFIGURADO'
  }
  if (!config.ativo) {
    return 'INATIVO'
  }
  if (config.ultimo_erro && (!config.ultimo_sucesso_em || config.ultimo_erro > (config.ultimo_sucesso_em || ''))) {
    return 'ERRO_DE_CONFIGURACAO'
  }
  return 'ATIVO'
}

export function calcularResumoExecucoesDia(robos: RoboConfigOutput[]): ResumoExecucoesDia {
  const agora = new Date()
  const dataCuiaba = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' })

  let totalAtivos = 0
  let executadosOk = 0
  let pendentes = 0
  let comErro = 0

  for (const r of robos) {
    if (r.ativo) totalAtivos++
    if (r.status_hoje === 'SUCESSO' || r.status_hoje === 'JA_IMPORTADO') {
      executadosOk++
    } else if (r.status_hoje === 'ERRO') {
      comErro++
    } else if (r.ativo) {
      pendentes++
    }
  }

  return {
    data_cuiaba: dataCuiaba,
    total_robos: robos.length,
    total_ativos: totalAtivos,
    executados_ok: executadosOk,
    pendentes: pendentes,
    com_erro: comErro,
    todos_executados_ok: totalAtivos > 0 && executadosOk === totalAtivos,
  }
}

export async function listarRobosConfig(
  supabase: SupabaseClient,
  empresaId?: string | null
): Promise<RoboConfigOutput[]> {
  let query = supabase
    .from('robo_configuracoes')
    .select(`
      *,
      administradora:administradoras(id, nome, slug)
    `)
    .order('created_at', { ascending: true })

  if (empresaId) {
    query = query.or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
  }

  const { data: rows, error } = await query
  if (error) {
    throw new Error(`Falha ao listar configuracoes de robos: ${error.message}`)
  }

  if (!rows || rows.length === 0) return []

  // Busca ultimas 5 execucoes de cada robo para resumo
  const roboIds = rows.map((r) => r.id)
  const { data: execucoes } = await supabase
    .from('robo_execucoes')
    .select('id, robo_config_id, status, iniciado_em, finalizado_em, erro_mensagem, erro_sanitizado, origem, resultado')
    .in('robo_config_id', roboIds)
    .order('iniciado_em', { ascending: false })
    .limit(50)

  const hojeStr = new Date().toISOString().split('T')[0]

  return rows.map((row) => {
    const statusVisual = calcularStatusVisual(row)
    const execsDoRobo = (execucoes || []).filter((e) => e.robo_config_id === row.id)
    const ultimas: UltimaExecucaoItem[] = execsDoRobo.slice(0, 5).map((e) => ({
      id: e.id,
      status: e.status,
      iniciado_em: e.iniciado_em,
      iniciado_em_formatado: new Date(e.iniciado_em).toLocaleString('pt-BR', {
        timeZone: 'America/Cuiaba',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      finalizado_em: e.finalizado_em,
      erro: e.erro_sanitizado || e.erro_mensagem,
      origem: e.origem,
      resultado: e.resultado,
    }))

    const execHoje = execsDoRobo.find((e) => e.iniciado_em.startsWith(hojeStr))
    const statusHoje = execHoje ? execHoje.status : 'NAO_EXECUTADO'

    return {
      id: row.id,
      empresa_id: row.empresa_id,
      administradora: row.administradora,
      nome: row.nome,
      portal_tipo: row.portal_tipo,
      site_url: row.site_url,
      login_url: row.login_url,
      usuario_login: row.usuario_login,
      credencial_configurada: Boolean(row.senha_encrypted),
      credencial_secundaria_configurada: Boolean(row.senha_secundaria_encrypted),
      ativo: row.ativo,
      modo: row.modo,
      configuracao_tarefas: row.configuracao_tarefas || {},
      status_visual: statusVisual,
      ultima_execucao_em: row.ultima_execucao_em,
      ultimo_sucesso_em: row.ultimo_sucesso_em,
      ultimo_erro: row.ultimo_erro,
      created_at: row.created_at,
      updated_at: row.updated_at,
      ultimas_execucoes: ultimas,
      executado_hoje: Boolean(execHoje && ['SUCESSO', 'JA_IMPORTADO'].includes(execHoje.status)),
      status_hoje: statusHoje as any,
    }
  })
}

export async function obterRoboConfigPorId(
  supabase: SupabaseClient,
  id: string
): Promise<RoboConfigOutput | null> {
  const { data, error } = await supabase
    .from('robo_configuracoes')
    .select(`
      *,
      administradora:administradoras(id, nome, slug)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !data) return null

  const list = await listarRobosConfig(supabase)
  return list.find((r) => r.id === id) || null
}

export async function salvarRoboConfig(
  supabase: SupabaseClient,
  input: SalvarRoboConfigInput,
  userId?: string | null
): Promise<{ ok: boolean; id?: string; erro?: string }> {
  try {
    const payload: Partial<RoboConfigRow> = {
      nome: input.nome.trim(),
      portal_tipo: input.portal_tipo,
      site_url: input.site_url.trim(),
      login_url: input.login_url.trim(),
      usuario_login: input.usuario_login.trim(),
      ativo: input.ativo !== undefined ? input.ativo : false,
      modo: input.modo || 'DRY_RUN',
      configuracao_tarefas: input.configuracao_tarefas || {},
      unidades_config: input.unidades_config || [],
      empresa_id: input.empresa_id || null,
      administradora_id: input.administradora_id || null,
      updated_at: new Date().toISOString(),
    }

    if (userId) {
      payload.updated_by = userId
    }

    if (input.senha && input.senha.trim() !== '') {
      payload.senha_encrypted = encryptCredential(input.senha.trim())
      payload.senha_updated_at = new Date().toISOString()
    }

    if (input.senha_secundaria && input.senha_secundaria.trim() !== '') {
      payload.senha_secundaria_encrypted = encryptCredential(input.senha_secundaria.trim())
      payload.senha_secundaria_updated_at = new Date().toISOString()
    }

    if (input.id) {
      // Edição
      const { data, error } = await supabase
        .from('robo_configuracoes')
        .update(payload)
        .eq('id', input.id)
        .select('id')
        .single()

      if (error) throw new Error(error.message)
      return { ok: true, id: data.id }
    } else {
      // Criação
      if (userId) payload.created_by = userId
      payload.created_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('robo_configuracoes')
        .insert(payload)
        .select('id')
        .single()

      if (error) throw new Error(error.message)
      return { ok: true, id: data.id }
    }
  } catch (err: any) {
    return { ok: false, erro: err?.message || 'Erro ao gravar dados do robô.' }
  }
}

export async function alterarStatusAtivoRobo(
  supabase: SupabaseClient,
  id: string,
  ativo: boolean,
  userId?: string | null
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const { error } = await supabase
      .from('robo_configuracoes')
      .update({
        ativo,
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, erro: err?.message }
  }
}

export async function excluirRoboConfig(
  supabase: SupabaseClient,
  id: string
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const { error } = await supabase
      .from('robo_configuracoes')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)
    return { ok: true }
  } catch (err: any) {
    return { ok: false, erro: err?.message }
  }
}

export async function testarConfiguracaoRobo(
  supabase: SupabaseClient,
  id: string,
  options?: { testarLoginReal?: boolean }
): Promise<{ ok: boolean; mensagem?: string; erro?: string }> {
  try {
    const { data: config, error } = await supabase
      .from('robo_configuracoes')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !config) {
      return { ok: false, erro: 'Configuração do robô não encontrada.' }
    }

    if (!config.senha_encrypted || !config.usuario_login) {
      return { ok: false, erro: 'Credenciais de acesso ainda não foram cadastradas neste robô.' }
    }

    if (!options?.testarLoginReal) {
      // Teste estático de descriptografia
      decryptCredential(config.senha_encrypted)
      return { ok: true, mensagem: 'Credenciais verificadas com sucesso na chave de segurança.' }
    }

    // Teste Playwright real
    const session = await createManagedBrowserSession({ headless: true })
    try {
      const senha = decryptCredential(config.senha_encrypted)
      const senhaSecundaria = config.senha_secundaria_encrypted
        ? decryptCredential(config.senha_secundaria_encrypted)
        : undefined

      const adapter = getAdapterForPortal(config.portal_tipo)
      const res = await adapter.login(
        session.page,
        {
          usuario: config.usuario_login,
          senha,
          senhaSecundaria,
        },
        config.site_url,
        config.login_url
      )

      if (res.ok) {
        await supabase
          .from('robo_configuracoes')
          .update({
            ultimo_sucesso_em: new Date().toISOString(),
            ultimo_erro: null,
          })
          .eq('id', id)
        return { ok: true, mensagem: 'Autenticação no portal realizada com sucesso!' }
      } else {
        await supabase
          .from('robo_configuracoes')
          .update({
            ultimo_erro: res.erro,
          })
          .eq('id', id)
        return { ok: false, erro: res.erro }
      }
    } finally {
      await session.close()
    }
  } catch (err: any) {
    return { ok: false, erro: err?.message || 'Erro durante teste do robô' }
  }
}
