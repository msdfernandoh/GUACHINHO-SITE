/**
 * Servico de Mapeamento Guiado de Telas e Tarefas dos Portais Externos.
 * Executa navegacao assistida, captura screenshots e inspeciona arvore de seletores.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createManagedBrowserSession } from './browser'
import { decryptCredential } from './cryptoService'
import { getAdapterForPortal } from './roboConfigService'

export async function prepararMapeamentoPortal(
  supabase: SupabaseClient,
  options: { roboConfigId: string; usuarioId?: string }
): Promise<{ ok: boolean; mapeamento_id?: string; erro?: string }> {
  try {
    const { data: config, error: errConf } = await supabase
      .from('robo_configuracoes')
      .select('*')
      .eq('id', options.roboConfigId)
      .single()

    if (errConf || !config) {
      return { ok: false, erro: 'Configuração do robô não encontrada.' }
    }

    const { data: sessao, error } = await supabase
      .from('robo_mapeamentos')
      .insert({
        robo_config_id: options.roboConfigId,
        empresa_id: config.empresa_id,
        iniciado_por: options.usuarioId || null,
        status: 'AGUARDANDO',
        detalhes: {
          site_url: config.site_url,
          login_url: config.login_url,
          usuario_login: config.usuario_login,
        },
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)
    return { ok: true, mapeamento_id: sessao.id }
  } catch (err: any) {
    return { ok: false, erro: err.message }
  }
}

export async function executarMapeamentoPortal(
  supabase: SupabaseClient,
  options: { roboConfigId: string; usuarioId?: string }
): Promise<{
  ok: boolean
  screenshots?: Array<{ titulo: string; base64: string }>
  camposDetectados?: Array<{ tag: string; id?: string; name?: string; placeholder?: string; type?: string }>
  erro?: string
}> {
  const { data: config, error: errConf } = await supabase
    .from('robo_configuracoes')
    .select('*')
    .eq('id', options.roboConfigId)
    .single()

  if (errConf || !config) {
    return { ok: false, erro: 'Robô não encontrado.' }
  }

  const session = await createManagedBrowserSession({ headless: true })
  const screenshots: Array<{ titulo: string; base64: string }> = []
  let camposDetectados: Array<any> = []

  try {
    const targetUrl = config.login_url || config.site_url
    await session.page.goto(targetUrl, { waitUntil: 'domcontentloaded' })

    // 1. Screenshot da tela inicial / login
    const screenLogin = await session.page.screenshot({ fullPage: false, type: 'jpeg', quality: 75 })
    screenshots.push({
      titulo: 'Tela Inicial / Login',
      base64: `data:image/jpeg;base64,${screenLogin.toString('base64')}`,
    })

    // 2. Inspecao de campos de entrada
    camposDetectados = await session.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, button, select, a'))
      return inputs.slice(0, 30).map((el: any) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        name: el.name || undefined,
        type: el.type || undefined,
        placeholder: el.placeholder || undefined,
        texto: el.innerText ? el.innerText.trim().slice(0, 50) : undefined,
        href: el.href || undefined,
      }))
    })

    // 3. Se tiver credenciais, tenta autenticar e capturar tela interna
    if (config.senha_encrypted && config.usuario_login) {
      try {
        const senha = decryptCredential(config.senha_encrypted)
        const adapter = getAdapterForPortal(config.portal_tipo)
        const loginRes = await adapter.login(
          session.page,
          { usuario: config.usuario_login, senha },
          config.site_url,
          config.login_url
        )

        if (loginRes.ok) {
          await session.page.waitForTimeout(3000)
          const screenInterno = await session.page.screenshot({ fullPage: false, type: 'jpeg', quality: 75 })
          screenshots.push({
            titulo: 'Painel Interno Pós-Login',
            base64: `data:image/jpeg;base64,${screenInterno.toString('base64')}`,
          })
        }
      } catch (loginErr) {
        console.warn('[Mapeamento] Falha opcional no login durante inspeção:', loginErr)
      }
    }

    // Grava resultado na tabela de mapeamentos
    await supabase.from('robo_mapeamentos').insert({
      robo_config_id: config.id,
      empresa_id: config.empresa_id,
      status: 'CONCLUIDO',
      screenshots: screenshots.map((s) => ({ titulo: s.titulo })),
      detalhes: {
        url_final: session.page.url(),
        campos_detectados: camposDetectados,
      },
      finalizado_em: new Date().toISOString(),
    })

    return {
      ok: true,
      screenshots,
      camposDetectados,
    }
  } catch (err: any) {
    return { ok: false, erro: err?.message || 'Erro durante mapeamento do portal' }
  } finally {
    await session.close()
  }
}

export async function obterUltimoMapeamentoPortal(
  supabase: SupabaseClient,
  roboConfigId: string
) {
  const { data } = await supabase
    .from('robo_mapeamentos')
    .select('*')
    .eq('robo_config_id', roboConfigId)
    .order('iniciado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data || null
}
