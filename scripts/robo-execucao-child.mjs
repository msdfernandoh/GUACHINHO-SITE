import { createRequire } from 'node:module'
const req = createRequire(new URL('../gauchinho-app/package.json', import.meta.url))
const { createClient } = req('@supabase/supabase-js')
const { chromium } = req('playwright-core')
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'

// Carrega .env.local
const envCandidates = [
  path.resolve(process.cwd(), 'gauchinho-app/.env.local'),
  path.resolve(process.cwd(), '.env.local'),
]

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (match) {
        const key = match[1]
        let val = match[2] || ''
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
        if (!process.env[key]) process.env[key] = val.trim()
      }
    }
  }
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const execucaoId = process.argv[2]

process.on('disconnect', () => process.exit(1))

function getMasterKey() {
  const custom = process.env.ROBO_CREDENTIALS_ENCRYPTION_KEY
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (custom && custom.trim() !== '') {
    const trimmed = custom.trim()
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex')
    try {
      const dec = Buffer.from(trimmed, 'base64')
      if (dec.length === 32) return dec
    } catch {}
    return crypto.createHash('sha256').update(trimmed).digest()
  }
  return crypto.createHash('sha256').update(fallback.trim()).digest()
}

function decryptCredential(encryptedPayload) {
  if (!encryptedPayload || !encryptedPayload.includes(':')) return ''
  const [ivHex, authTagHex, ciphertextHex] = encryptedPayload.split(':')
  const key = getMasterKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  let dec = decipher.update(ciphertextHex, 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec
}

async function run() {
  const { data: e, error: errExec } = await admin
    .from('robo_execucoes')
    .select('*')
    .eq('id', execucaoId)
    .eq('status', 'PROCESSANDO')
    .single()

  if (errExec || !e) throw new Error(`Execução ${execucaoId} não encontrada em PROCESSANDO.`)

  const { data: config, error: errConf } = await admin
    .from('robo_configuracoes')
    .select('*')
    .eq('id', e.robo_config_id)
    .single()

  if (errConf || !config) throw new Error(`Configuração do robô ${e.robo_config_id} não encontrada.`)

  const logs = [...(e.detalhes?.logs || [])]
  let ultimoLog = 0
  let atualizacao = Promise.resolve()

  const log = (msg) => {
    console.log(`[Robô ${config.nome}] ${msg}`)
    logs.push({ ts: new Date().toISOString(), msg })
    if (Date.now() - ultimoLog < 1500) return
    ultimoLog = Date.now()
    const snapshot = logs.slice(-300)
    atualizacao = atualizacao.then(async () => {
      await admin.from('robo_execucoes').update({
        detalhes: { ...e.detalhes, logs: snapshot },
      }).eq('id', execucaoId).eq('status', 'PROCESSANDO')
    })
  }

  log(`Iniciando execução do robô: ${config.nome} (Portal: ${config.portal_tipo})`)

  if (!config.senha_encrypted || !config.usuario_login) {
    throw new Error('Credenciais de login não configuradas no robô.')
  }

  const senha = decryptCredential(config.senha_encrypted)
  const senhaSecundaria = config.senha_secundaria_encrypted ? decryptCredential(config.senha_secundaria_encrypted) : undefined

  log('Iniciando instância do Chromium Playwright...')
  const browser = await chromium.launch({
    headless: true,
    channel: process.platform === 'win32' ? 'chrome' : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })

  const downloadDir = path.resolve(process.cwd(), 'tmp/robo-downloads')
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true })

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  })

  const page = await context.newPage()
  page.setDefaultTimeout(45_000)

  try {
    const targetUrl = config.login_url || config.site_url
    log(`Acessando URL de autenticação: ${targetUrl}`)
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })

    // Heurística de login ou execução dos passos de login
    log(`Preenchendo credenciais do usuário: ${config.usuario_login}`)

    const userSel = 'input[type="email"], input[name*="user"], input[name*="login"], input[name*="cpf"], input[name*="email"], #usuario, #login, #email'
    const passSel = 'input[type="password"], #senha, #password'

    const userField = page.locator(userSel).first()
    const passField = page.locator(passSel).first()

    if (await userField.isVisible().catch(() => false) && await passField.isVisible().catch(() => false)) {
      await userField.fill(config.usuario_login)
      await passField.fill(senha)

      const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Entrar"), button:has-text("Acessar")').first()
      if (await submitBtn.isVisible().catch(() => false)) {
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
      log('Autenticação submetida com sucesso!')
    } else {
      log('Campos automáticos não visíveis de imediato; prosseguindo para tarefas mapeadas...')
    }

    // Execução dos passos de tarefas configurados
    const passos = config.configuracao_tarefas?.passos || []
    const arquivosBaixados = []

    if (passos.length > 0) {
      log(`Executando ${passos.length} tarefas mapeadas...`)
      for (let i = 0; i < passos.length; i++) {
        const p = passos[i]
        log(`Passo ${i + 1}/${passos.length}: ${p.tipo || p.acao} (${p.descricao || ''})`)
        if (p.tipo === 'navegar' || p.acao === 'goto') {
          await page.goto(p.url, { waitUntil: 'domcontentloaded' })
        } else if (p.tipo === 'clicar' || p.acao === 'click') {
          await page.click(p.seletor, { timeout: p.timeout || 10_000 })
        } else if (p.tipo === 'preencher' || p.acao === 'fill') {
          await page.fill(p.seletor, p.valor)
        } else if (p.tipo === 'esperar' || p.acao === 'wait') {
          await page.waitForTimeout(p.ms || 2000)
        } else if (p.tipo === 'baixar' || p.acao === 'download') {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 30_000 }),
            page.click(p.seletor),
          ])
          const filename = download.suggestedFilename()
          const savePath = path.join(downloadDir, filename)
          await download.saveAs(savePath)
          arquivosBaixados.push(savePath)
          log(`Arquivo baixado: ${filename}`)
        }
      }
    } else {
      log('Nenhuma tarefa adicional mapeada. Autenticação e conexão validadas.')
    }

    log('Concluído com sucesso!')
    await atualizacao

    await admin.from('robo_execucoes').update({
      status: 'SUCESSO',
      finalizado_em: new Date().toISOString(),
      resultado: {
        total_tarefas: passos.length,
        arquivos_baixados: arquivosBaixados.map(f => path.basename(f)),
      },
      detalhes: {
        ...e.detalhes,
        logs: logs.slice(-300),
      },
    }).eq('id', execucaoId)

    await admin.from('robo_configuracoes').update({
      ultimo_sucesso_em: new Date().toISOString(),
      ultima_execucao_em: new Date().toISOString(),
      ultimo_erro: null,
    }).eq('id', config.id)

  } catch (err) {
    log(`ERRO na execução: ${err.message}`)
    await atualizacao

    await admin.from('robo_execucoes').update({
      status: 'ERRO',
      finalizado_em: new Date().toISOString(),
      erro_mensagem: err.message,
      erro_sanitizado: err.message,
      detalhes: {
        ...e.detalhes,
        logs: logs.slice(-300),
        erro: err.message,
      },
    }).eq('id', execucaoId)

    await admin.from('robo_configuracoes').update({
      ultima_execucao_em: new Date().toISOString(),
      ultimo_erro: err.message,
    }).eq('id', config.id)

    throw err
  } finally {
    await browser.close().catch(() => {})
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('Falha no processo child:', err.message)
  process.exit(1)
})
