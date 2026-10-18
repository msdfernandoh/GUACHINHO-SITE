import type { Page } from 'playwright-core'
import type { IPortalAdapter } from '../portalAdapter'
import type { PortalCredentials, ResultadoAuth, PortalTipo } from '../types'
import path from 'path'
import fs from 'fs'

export class GenericConsorcioAdapter implements IPortalAdapter {
  readonly portalTipo: PortalTipo
  readonly nome: string

  constructor(portalTipo: PortalTipo = 'CUSTOM', nome: string = 'Consórcio Genérico') {
    this.portalTipo = portalTipo
    this.nome = nome
  }

  async login(
    page: Page,
    creds: PortalCredentials,
    siteUrl?: string,
    loginUrl?: string
  ): Promise<ResultadoAuth> {
    const targetUrl = loginUrl || siteUrl
    if (!targetUrl) {
      return { ok: false, erro: 'URL de login não configurada.' }
    }

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })

      // Heurística de busca de campos de login
      const userSelectors = [
        'input[type="email"]',
        'input[name*="user"]',
        'input[name*="login"]',
        'input[name*="cpf"]',
        'input[name*="email"]',
        '#usuario',
        '#login',
        '#email',
      ]
      const passSelectors = [
        'input[type="password"]',
        '#senha',
        '#password',
      ]
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Entrar")',
        'button:has-text("Acessar")',
        'button:has-text("Login")',
      ]

      let userField = null
      for (const sel of userSelectors) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) {
          userField = page.locator(sel).first()
          break
        }
      }

      let passField = null
      for (const sel of passSelectors) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) {
          passField = page.locator(sel).first()
          break
        }
      }

      if (!userField || !passField) {
        // Tenta aguardar mais alguns segundos
        await page.waitForTimeout(2000)
        return {
          ok: false,
          erro: 'Campos de formulário de login não detectados automaticamente. Utilize a função Mapear Tarefas para configurar os seletores específicos.',
        }
      }

      await userField.fill(creds.usuario)
      await passField.fill(creds.senha)

      let submitBtn = null
      for (const sel of submitSelectors) {
        if (await page.locator(sel).first().isVisible().catch(() => false)) {
          submitBtn = page.locator(sel).first()
          break
        }
      }

      if (submitBtn) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15_000 }).catch(() => {}),
          submitBtn.click(),
        ])
      } else {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15_000 }).catch(() => {}),
          passField.press('Enter'),
        ])
      }

      // Verifica se houve redirecionamento ou mensagem de erro
      const currentUrl = page.url()
      const content = await page.content()

      if (
        content.includes('Senha incorreta') ||
        content.includes('Usuário ou senha inválidos') ||
        content.includes('Credenciais inválidas')
      ) {
        return { ok: false, erro: 'Credenciais de acesso rejeitadas pelo portal.' }
      }

      return { ok: true }
    } catch (err: any) {
      return { ok: false, erro: err?.message || 'Falha durante o processo de autenticação.' }
    }
  }

  async executarTarefas(
    page: Page,
    tarefasConfig: Record<string, any>,
    downloadDir: string,
    onLog?: (msg: string) => void
  ): Promise<{ ok: boolean; resultados?: any; erro?: string }> {
    const passos = tarefasConfig?.passos || []
    onLog?.(`Iniciando execução de tarefas mapeadas: ${passos.length} passos configurados`)

    try {
      const arquivosBaixados: string[] = []

      for (let i = 0; i < passos.length; i++) {
        const passo = passos[i]
        onLog?.(`Passo ${i + 1}/${passos.length}: ${passo.tipo || passo.acao} - ${passo.descricao || ''}`)

        if (passo.tipo === 'navegar' || passo.acao === 'goto') {
          await page.goto(passo.url, { waitUntil: 'domcontentloaded' })
        } else if (passo.tipo === 'clicar' || passo.acao === 'click') {
          await page.click(passo.seletor, { timeout: passo.timeout || 10_000 })
        } else if (passo.tipo === 'preencher' || passo.acao === 'fill') {
          await page.fill(passo.seletor, passo.valor)
        } else if (passo.tipo === 'esperar' || passo.acao === 'wait') {
          await page.waitForTimeout(passo.ms || 2000)
        } else if (passo.tipo === 'baixar' || passo.acao === 'download') {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 30_000 }),
            page.click(passo.seletor),
          ])
          const filename = download.suggestedFilename()
          const savePath = path.join(downloadDir, filename)
          await download.saveAs(savePath)
          arquivosBaixados.push(savePath)
          onLog?.(`Arquivo baixado com sucesso: ${filename} (${(fs.statSync(savePath).size / 1024).toFixed(1)} KB)`)
        }
      }

      return {
        ok: true,
        resultados: {
          total_passos: passos.length,
          arquivos_baixados: arquivosBaixados.map(f => path.basename(f)),
        },
      }
    } catch (err: any) {
      onLog?.(`Erro ao executar passo de tarefa: ${err.message}`)
      return { ok: false, erro: err.message }
    }
  }
}
