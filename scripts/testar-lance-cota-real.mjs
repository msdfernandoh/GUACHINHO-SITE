/**
 * Script CLI para Teste de Oferta de Lance em Cota Real no Newcon Web.
 * 
 * Uso:
 *   node scripts/testar-lance-cota-real.mjs --grupo 1253 --cotas 898,551,529
 *   node scripts/testar-lance-cota-real.mjs --grupo 1253 --cotas 898,551,529 --headless
 */

import { createRequire } from 'node:module'
const req = createRequire(new URL('../gauchinho-app/package.json', import.meta.url))
const { createClient } = req('@supabase/supabase-js')
const { chromium } = req('playwright-core')
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { executarRoboLances } from './robo-lances-service.mjs'

// 1. Carrega variáveis de ambiente de gauchinho-app/.env.local
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

// 2. Argumentos de linha de comando
const args = process.argv.slice(2)
let grupoArg = '1273'
let cotasArg = '209'
let headless = false

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--grupo' && args[i + 1]) {
    grupoArg = args[i + 1]
    i++
  } else if ((args[i] === '--cota' || args[i] === '--cotas') && args[i + 1]) {
    cotasArg = args[i + 1]
    i++
  } else if (args[i] === '--headless') {
    headless = true
  } else if (args[i] === '--headed') {
    headless = false
  }
}

const cotasList = cotasArg.split(',').map(s => s.trim()).filter(Boolean)

// 3. Descriptografia de credenciais
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

async function main() {
  console.log('===============================================================')
  console.log(`=== TESTE OPERACIONAL DE LANCE EM COTA REAL: GRUPO ${grupoArg} / COTA(S) ${cotasList.join(', ')} ===`)
  console.log('===============================================================')
  console.log(`Modo de execução: ${headless ? 'Headless (em segundo plano)' : 'Headed (Navegador visível na tela)'}`)

  // Busca configuração do robô com credenciais válidas do portal RACON
  const { data: configs, error: errConfig } = await admin
    .from('robo_configuracoes')
    .select('*')
    .not('usuario_login', 'is', null)
    .not('senha_encrypted', 'is', null)
    .eq('ativo', true)

  if (errConfig || !configs || configs.length === 0) {
    console.error('Nenhuma credencial de robô encontrada em robo_configuracoes:', errConfig?.message)
    process.exit(1)
  }

  // Prioriza o robô que acessa a raiz do portal Racon
  const config = configs.find(c => c.nome?.includes('Contemplações') || c.site_url === 'https://e.randonconsorcios.com.br/') || configs[0]

  const usuario = config.usuario_login.trim()
  const senha = decryptCredential(config.senha_encrypted)
  console.log(`Credencial carregada: ${usuario}`)

  // Diretório de prints e relatórios de teste
  const screenshotsDir = path.resolve(process.cwd(), 'storage/robo-capturas')
  fs.mkdirSync(screenshotsDir, { recursive: true })

  const log = (msg) => {
    const ts = new Date().toLocaleTimeString('pt-BR')
    console.log(`[${ts}] ${msg}`)
  }

  // Localiza caminho do Chromium no Windows
  let executablePath = null
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe',
  ]
  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      executablePath = p
      break
    }
  }

  log(`Iniciando navegador Playwright (${executablePath ? 'Navegador Nativo' : 'Chromium padrão'})...`)

  const browser = await chromium.launch({
    headless,
    executablePath: executablePath || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,768',
    ],
  })

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'America/Cuiaba',
  })

  const page = await context.newPage()

  try {
    // 1. Acesso à URL principal do portal Racon
    const portalUrl = 'https://e.randonconsorcios.com.br/'
    log(`Acessando portal Racon: ${portalUrl}`)
    await page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(3000)

    // 2. Autenticação Microsoft SSO Inicial
    if (page.url().includes('login.microsoftonline.com')) {
      log('Detectada tela de autenticação Microsoft Online SSO inicial.')
      await page.screenshot({ path: path.join(screenshotsDir, `ms-01-login-start-${Date.now()}.png`) }).catch(() => {})

      let initialLoginAttempts = 0
      while (page.url().includes('login.microsoftonline.com') && initialLoginAttempts < 20) {
        initialLoginAttempts++
        await page.waitForLoadState('domcontentloaded').catch(() => {})
        await page.waitForTimeout(1200)

        // Passo 1: Campo de Senha (prioridade se já estiver na tela de senha)
        const passInput = page.locator('input[name="passwd"]:not(.moveOffScreen):not([aria-hidden="true"]):visible, input[type="password"]:not(.moveOffScreen):not([aria-hidden="true"]):visible').first()
        if (await passInput.isVisible().catch(() => false)) {
          log('Preenchendo senha Microsoft no campo visível...')
          await passInput.fill(senha)
          await page.waitForTimeout(600)
          const signBtn = page.locator('#idSIButton9:visible, input[type="submit"]:visible, button:has-text("Entrar"):visible').first()
          if (await signBtn.isVisible().catch(() => false)) {
            log('Clicando em Entrar no login Microsoft...')
            await signBtn.click()
            await page.waitForTimeout(3500)
            continue
          }
        }

        // Passo 2: Campo de Usuário / Email
        const emailInput = page.locator('input[name="loginfmt"]:visible, input[type="email"]:visible, #i0116:visible').first()
        if (await emailInput.isVisible().catch(() => false)) {
          log(`Preenchendo usuário Microsoft: ${usuario}`)
          await emailInput.fill(usuario)
          await page.waitForTimeout(600)
          const nextBtn = page.locator('#idSIButton9:visible, input[type="submit"]:visible, button:has-text("Avançar"):visible').first()
          if (await nextBtn.isVisible().catch(() => false)) {
            log('Clicando em Avançar no login Microsoft...')
            await nextBtn.click()
            await page.waitForTimeout(3000)
            continue
          }
        }

        // Passo 3: Seletor de conta ("Escolha uma conta")
        const isPickerScreen = await page.evaluate(() => {
          const txt = (document.body?.innerText || '').toLowerCase()
          return txt.includes('escolha uma conta') || txt.includes('pick an account') || !!document.querySelector('#tilesHolder')
        }).catch(() => false)

        if (isPickerScreen) {
          const clickedAccount = await page.evaluate(() => {
            const els = Array.from(document.querySelectorAll('*'))
            const target = els.find(e => 
              e.children.length === 0 && 
              ((e.innerText || '').includes('CX45617665') || (e.innerText || '').includes('ERONI BOLFE') || (e.innerText || '').includes('rdmz.com.br'))
            )
            if (target) {
              const btn = target.closest('[role="button"], .table, .tile, div[data-test-id], a, button') || target
              btn.click()
              return true
            }
            return false
          }).catch(() => false)

          if (clickedAccount) {
            log('Conta selecionada na lista inicial de contas. Aguardando...')
            await page.waitForTimeout(3000)
            continue
          }
        }

        // Passo 4: Erro de senha
        const passError = page.locator('#passwordError:visible, span:has-text("Sua conta ou senha"):visible').first()
        if (await passError.isVisible().catch(() => false)) {
          const errMsg = await passError.innerText().catch(() => 'Erro desconhecido na validação da senha.')
          throw new Error(`Falha no login Microsoft: ${errMsg}`)
        }

        // Passo 5: "Continuar conectado?" (KMSI)
        const stayBtn = page.locator('#idSIButton9:visible, input[value="Sim"]:visible, button:has-text("Sim"):visible').first()
        if (await stayBtn.isVisible().catch(() => false)) {
          log('Confirmando "Mantenha-se conectado"...')
          await stayBtn.click()
          await page.waitForTimeout(3000)
          continue
        }

        if (!page.url().includes('login.microsoftonline.com')) {
          break
        }
      }
    }

    // 3. Aguarda retorno ao portal Randon / Racon
    log('Aguardando carregamento do portal e.randonconsorcios.com.br...')
    await page.waitForURL(url => url.hostname.includes('randonconsorcios.com.br'), { timeout: 45_000 })
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    await page.waitForTimeout(3000)
    log(`Portal Randon acessado com sucesso: ${page.url()}`)

    // 4. Tratar modal de aviso/comunicado de segurança se aberto
    log('Verificando se há modal de aviso ou comunicado na tela...')
    await page.evaluate(() => {
      const overlay = document.getElementById('modal-overlay')
      if (overlay) overlay.remove()
      const dialogs = document.querySelectorAll('div[role="dialog"]')
      dialogs.forEach(d => d.remove())
    }).catch(() => {})
    await page.waitForTimeout(800)

    // 5. Localizar e Clicar no Card NEWCON
    log('Localizando card NEWCON no painel...')
    await page.waitForTimeout(2000)

    const cardCoords = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div, a, button, p, h1, h2, h3, h4, span'))
      const target = all.find(el => {
        const t = (el.innerText || el.textContent || '').trim()
        return t === 'NEWCON' || (t.includes('NEWCON') && t.length < 50)
      })
      if (target) {
        const card = target.closest('div[class*="Card"], div[class*="card"]') || target.parentElement || target
        const rect = card.getBoundingClientRect()
        const a = card.closest('a') || card.querySelector('a')
        return {
          found: true,
          x: Math.round(rect.x + rect.width / 2),
          y: Math.round(rect.y + rect.height / 2),
          href: a ? a.href : null,
          text: target.innerText,
        }
      }
      return { found: false }
    }).catch(err => ({ found: false, erro: err.message }))

    log(`Coordenadas do card NEWCON: ${JSON.stringify(cardCoords)}`)

    let activePage
    if (cardCoords.found && cardCoords.href && cardCoords.href.startsWith('http')) {
      log(`Navegando diretamente para URL do Newcon: ${cardCoords.href}`)
      const newPage = await context.newPage()
      await newPage.goto(cardCoords.href, { waitUntil: 'domcontentloaded' })
      activePage = newPage
    } else {
      const clickX = cardCoords.found && cardCoords.x > 0 ? cardCoords.x : 565
      const clickY = cardCoords.found && cardCoords.y > 0 ? cardCoords.y : 430
      log(`Disparando clique de mouse nas coordenadas (${clickX}, ${clickY})...`)

      const popupPromise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null)
      await page.mouse.click(clickX, clickY)
      const popup = await popupPromise
      activePage = popup || page
    }

    await activePage.waitForTimeout(3000)
    log(`Página ativa após clique no NEWCON: ${activePage.url()}`)

    // 6. Tratamento resiliente do SSO Microsoft para o Newcon
    let ssoAttempts = 0
    const maxSsoAttempts = 18
    while (ssoAttempts < maxSsoAttempts) {
      ssoAttempts++
      const isNewconHostname = (u) => {
        try {
          return new URL(u).hostname.toLowerCase().includes('nwcweb.randonconsorcios.com.br')
        } catch {
          return false
        }
      }

      // Verifica se alguma aba alcançou o Newcon Web
      for (const p of context.pages()) {
        if (isNewconHostname(p.url())) {
          activePage = p
          break
        }
      }

      const currentUrl = activePage.url()
      log(`[SSO Newcon Etapa ${ssoAttempts}] URL atual: ${currentUrl}`)

      if (isNewconHostname(currentUrl)) {
        log('Newcon Web alcançado com sucesso!')
        break
      }

      if (!currentUrl.includes('login.microsoftonline.com')) {
        log(`Aguardando redirecionamento fora do SSO... (${currentUrl})`)
        await activePage.waitForTimeout(2000)
        continue
      }

      await activePage.waitForLoadState('domcontentloaded').catch(() => {})
      await activePage.waitForTimeout(1000)

      // 6.1. Preenchimento de senha caso solicitada na etapa intermediária
      const passInput = activePage.locator('input[name="passwd"]:not(.moveOffScreen):not([aria-hidden="true"]):visible, input[type="password"]:not(.moveOffScreen):not([aria-hidden="true"]):visible').first()
      if (await passInput.isVisible().catch(() => false)) {
        log('Preenchendo senha na etapa intermediária...')
        await passInput.fill(senha)
        await activePage.waitForTimeout(600)
        const signBtn = activePage.locator('#idSIButton9:visible, input[type="submit"]:visible, button:has-text("Entrar"):visible').first()
        if (await signBtn.isVisible().catch(() => false)) {
          await signBtn.click()
          await activePage.waitForTimeout(3000)
        }
        continue
      }

      // 6.2. Tela de Permissões Solicitadas ("SSO - Newconweb Multitenant") -> Botão "Aceitar"
      const acceptClicked = await activePage.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('input[type="submit"], button, input[type="button"]'))
        const accept = btns.find(b => {
          const v = (b.value || b.innerText || b.textContent || '').trim().toLowerCase()
          return v === 'aceitar' || v === 'accept'
        })
        if (accept) {
          accept.click()
          return true
        }
        return false
      }).catch(() => false)

      if (acceptClicked) {
        log('Botão "Aceitar" clicado via evaluate na tela de permissões!')
        await activePage.waitForTimeout(4000)
        continue
      }

      const acceptLocator = activePage.locator('#idBtn_Accept:visible, input[value="Aceitar"]:visible, button:has-text("Aceitar"):visible, input[type="submit"][value="Aceitar"]:visible').first()
      if (await acceptLocator.isVisible().catch(() => false)) {
        log('Botão "Aceitar" clicado via locator na tela de permissões!')
        await acceptLocator.click({ force: true })
        await activePage.waitForTimeout(4000)
        continue
      }

      // 6.3. Seleção de conta ("Escolha uma conta")
      const isPickerScreen = await activePage.evaluate(() => {
        const txt = (document.body?.innerText || '').toLowerCase()
        return txt.includes('escolha uma conta') || txt.includes('pick an account') || !!document.querySelector('#tilesHolder')
      }).catch(() => false)

      if (isPickerScreen) {
        log('Tela de escolha de conta identificada no Newcon SSO.')
        const accountClicked = await activePage.evaluate(() => {
          const els = Array.from(document.querySelectorAll('*'))
          const target = els.find(e => {
            const t = (e.innerText || e.textContent || '').trim()
            return e.children.length === 0 && (
              t.includes('CX45617665') || 
              t.includes('ERONI BOLFE') || 
              t.includes('rdmz.com.br')
            )
          })
          if (target) {
            const btn = target.closest('[role="button"], .table, .tile, div[data-test-id], a, button') || target
            btn.click()
            return true
          }
          return false
        }).catch(() => false)

        if (accountClicked) {
          log('Conta Microsoft clicada na lista de contas. Disparando tecla Enter...')
          await activePage.keyboard.press('Enter').catch(() => {})
          await activePage.waitForTimeout(3000)
          continue
        }

        const accountLocator = activePage.locator('[role="button"]:has-text("ERONI BOLFE"), [role="button"]:has-text("CX45617665"), [data-test-id*="CX45617665"], text="ERONI BOLFE"').first()
        if (await accountLocator.isVisible().catch(() => false)) {
          log('Clicando na conta Microsoft via locator...')
          await accountLocator.click({ force: true })
          await activePage.keyboard.press('Enter').catch(() => {})
          await activePage.waitForTimeout(3000)
          continue
        }
      }

      // 6.4. "Continuar conectado?" (KMSI)
      const stayBtn = activePage.locator('#idSIButton9:visible, input[value="Sim"]:visible, button:has-text("Sim"):visible').first()
      if (await stayBtn.isVisible().catch(() => false)) {
        log('Confirmando "Continuar conectado"...')
        await stayBtn.click()
        await activePage.waitForTimeout(3000)
        continue
      }

      await activePage.waitForTimeout(2000)
    }

    // 7. Aguarda Newcon Web pronto
    log('Aguardando Newcon Web pronto...')
    const isFinalNewconReady = () => {
      try {
        return new URL(activePage.url()).hostname.toLowerCase().includes('nwcweb.randonconsorcios.com.br')
      } catch {
        return false
      }
    }
    if (!isFinalNewconReady()) {
      await activePage.waitForURL(url => isFinalNewconReady(), { timeout: 45_000 })
    }
    await activePage.waitForLoadState('domcontentloaded').catch(() => {})
    await activePage.waitForTimeout(3000)
    log(`Newcon Web carregado com sucesso: ${activePage.url()}`)
    await activePage.screenshot({ path: path.join(screenshotsDir, `test-newcon-main-${Date.now()}.png`) }).catch(() => {})

    // 8. Se estiver na tela de Escolha da Empresa (frmMain.aspx), seleciona a Randon Administradora
    log('Verificando se há seleção de empresa (0101 Randon Administradora)...')
    const linkEmpresa = activePage.locator('a:has-text("0101 Randon"), a:has-text("Randon Administradora")').first()
    if (await linkEmpresa.isVisible({ timeout: 6000 }).catch(() => false)) {
      log('Selecionando empresa "0101 Randon Administradora De Consorcios Ltda"...')
      await linkEmpresa.click()
      await activePage.waitForLoadState('domcontentloaded').catch(() => {})
      await activePage.waitForTimeout(3000)
      log(`Página após selecionar empresa: ${activePage.url()}`)
      await activePage.screenshot({ path: path.join(screenshotsDir, `test-pos-selecionar-empresa-${Date.now()}.png`) }).catch(() => {})
    }

    // 9. Execução dos Lances para a(s) Cota(s) Específica(s)
    const configTeste = {
      ...config,
      filtro_grupo: grupoArg,
      filtro_cotas: cotasList,
      limite_cotas: cotasList.length,
    }

    log(`Iniciando execução das ofertas de lance para Grupo ${grupoArg} / Cota(s) ${cotasList.join(', ')}...`)

    const resultado = await executarRoboLances({
      page: activePage,
      context,
      config: configTeste,
      admin,
      log,
      screenshotsDir,
    })

    log('===============================================================')
    log(`TESTE FINALIZADO COM SUCESSO!`)
    log(`Cotas processadas: ${resultado.cotasProcessadas}`)
    log(`Lances ofertados com confirmação: ${resultado.lancesOfertados}`)
    log('===============================================================')

  } catch (err) {
    log(`FALHA NO TESTE: ${err.message}`)
    const errImg = path.join(screenshotsDir, `falha-teste-${grupoArg}-${cotasList.join('-')}-${Date.now()}.png`)
    await page.screenshot({ path: errImg }).catch(() => {})
    log(`Screenshot do erro salvo em: ${errImg}`)
    process.exit(1)
  } finally {
    if (headless) {
      log('Encerrando navegador...')
      await browser.close().catch(() => {})
    } else {
      log('Navegador mantido aberto para inspeção visual por 25 segundos...')
      await page.waitForTimeout(25_000).catch(() => {})
      await browser.close().catch(() => {})
    }
  }
}

main().catch((e) => {
  console.error('Erro fatal:', e)
  process.exit(1)
})
