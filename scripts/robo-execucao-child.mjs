import { createRequire } from 'node:module'
const req = createRequire(new URL('../gauchinho-app/package.json', import.meta.url))
const { createClient } = req('@supabase/supabase-js')
const { chromium } = req('playwright-core')
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { executarRobo3Simulador } from './robo-simulador-service.mjs'
import { executarRoboBoletos } from './robo-boletos-service.mjs'
import { executarRoboLances } from './robo-lances-service.mjs'
import { autenticarMicrosoft, selecionarContaMicrosoft, aguardarTransicaoMicrosoft, estadoLoginMicrosoft } from './robo-microsoft-login.mjs'
import { coletarAbasResultado } from './robo-contemplacoes-parser.mjs'

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
    msg = msg.replace(/https?:\/\/[^\s"<>]+/g, raw => {try{const url=new URL(raw);return url.origin+url.pathname}catch{return '[URL]'}})
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
  const isWin = process.platform === 'win32'
  const browser = await chromium.launch({
    headless: !isWin,
    channel: isWin ? 'chrome' : undefined,
    args: [
      ...(isWin ? ['--window-position=-32000,-32000'] : []),
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })

  const downloadDir = path.resolve(process.cwd(), 'tmp/robo-downloads')
  const screenshotsDir = path.resolve(process.cwd(), 'tmp/robo-screenshots')
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true })
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true })

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  const page = await context.newPage()
  page.setDefaultTimeout(60_000)

  let totalGruposAtualizados = 0
  let totalGruposNovos = 0
  let totalGruposContemplados = 0
  let totalCotadasContempladas = 0
  let resultadoBoletos = null
  const gruposProcessados = []

  try {
    const isRacon = config.portal_tipo === 'RACON' || (config.site_url && config.site_url.includes('randonconsorcios'))

    if (isRacon) {
      log('--- INICIANDO FLUXO AUTOMATIZADO RACON / NEWCON ---')
      const targetUrl = config.login_url || config.site_url || 'https://e.randonconsorcios.com.br/'
      log(`Navegando para URL inicial: ${targetUrl}`)
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.waitForURL(url => url.hostname.includes('login.microsoftonline.com'), { timeout: 15_000 }).catch(() => {})
      await page.waitForTimeout(2000)

      const textoInicial = await page.evaluate(() => (document.body?.innerText || '').trim()).catch(() => '')
      if (/acesso bloqueado|bloqueado pelo sistema de seguran/i.test(textoInicial)) {
        throw new Error('O sistema de segurança WAF do portal Randon bloqueou a sessão inicial do navegador.')
      }

      // 1. Tratamento da autenticação Microsoft Online SSO
      if (page.url().includes('login.microsoftonline.com')) {
        log('Detectada tela de autenticação Microsoft Online SSO inicial.')
        await page.screenshot({ path: path.join(screenshotsDir, `racon-01-login-ms-start-${Date.now()}.png`) }).catch(() => {})

        await autenticarMicrosoft({ page, usuario: config.usuario_login, senha, log })
      }

      // 2. Aguarda retorno ao portal Randon / Racon
      log('Aguardando carregamento do portal e.randonconsorcios.com.br...')
      await page.waitForURL(url => url.hostname.includes('randonconsorcios.com.br'), { timeout: 45_000 })
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(3000)
      log(`Portal Randon acessado: ${page.url()}`)
      await page.screenshot({ path: path.join(screenshotsDir, `racon-02-portal-dashboard-${Date.now()}.png`) }).catch(() => {})

      // 3. Tratar modal de aviso/comunicado de segurança se estiver aberto
      log('Verificando se há modal de aviso ou comunicado na tela...')
      await page.waitForTimeout(2000)
      await page.evaluate(() => {
        const overlay = document.getElementById('modal-overlay')
        if (overlay) overlay.remove()
        const dialogs = document.querySelectorAll('div[role="dialog"]')
        dialogs.forEach(d => d.remove())
      }).catch(() => {})
      await page.waitForTimeout(800)

      const isSimulador = 
        config.id === '69f080e2-5181-4d30-9ca0-37cc2755f75f' || 
        config.id === '64fa1c86-0494-4cd1-98c7-c867f7a23e11' ||
        config.configuracao_tarefas?.tipo_rotina === 'COTAS_SIMULADOR' ||
        (config.nome && /simulador|cotas/i.test(config.nome))

      if (isSimulador) {
        const simRes = await executarRobo3Simulador({
          page,
          config,
          admin,
          log,
          screenshotsDir,
          dryRun: e.dry_run,
          grupos: e.detalhes?.grupos,
        })
        totalGruposNovos = simRes.totalGruposNovos
        totalGruposAtualizados = simRes.totalGruposAtualizados
        totalCotadasContempladas = simRes.totalCotasCadastradas
      } else {
        // 4. Localizar e Clicar no Card NEWCON
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
      await activePage.screenshot({ path: path.join(screenshotsDir, `racon-03-pos-clique-newcon-${Date.now()}.png`) }).catch(() => {})

      // 5. Tratamento resiliente do SSO Microsoft para o Newcon
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

        // 1. Preenchimento de senha caso solicitada na etapa intermediária
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

        // 2. Tela de Permissões Solicitadas ("SSO - Newconweb Multitenant") -> Botão "Aceitar"
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

        // 3. Seleção de conta ("Escolha uma conta")
        const isPickerScreen = await estadoLoginMicrosoft(activePage) === 'CONTAS'

        if (isPickerScreen) {
          log('Tela de escolha de conta identificada no Newcon SSO.')
          if (!await selecionarContaMicrosoft(activePage, config.usuario_login)) {
            throw new Error('A conta configurada não foi encontrada na seleção Microsoft do Newcon.')
          }
          await aguardarTransicaoMicrosoft(activePage, 'CONTAS')
          continue
        }

        // 4. "Continuar conectado?" (KMSI)
        const stayBtn = activePage.locator('#idSIButton9:visible, input[value="Sim"]:visible, button:has-text("Sim"):visible').first()
        if (await stayBtn.isVisible().catch(() => false)) {
          log('Confirmando "Continuar conectado"...')
          await stayBtn.click()
          await activePage.waitForTimeout(3000)
          continue
        }

        await activePage.waitForTimeout(2000)
      }

      // Aguarda carregamento final do Newcon Web
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
      await activePage.waitForLoadState('domcontentloaded')
      await activePage.waitForTimeout(3000)
      log(`Newcon Web carregado com sucesso: ${activePage.url()}`)
      await activePage.screenshot({ path: path.join(screenshotsDir, `racon-04-newcon-main-${Date.now()}.png`) }).catch(() => {})

      // 5.1. Se estiver na tela de Escolha da Empresa (frmMain.aspx), seleciona a Randon Administradora
      log('Verificando se há seleção de empresa (0101 Randon Administradora)...')
      const linkEmpresa = activePage.locator('a:has-text("0101 Randon"), a:has-text("Randon Administradora")').first()
      if (await linkEmpresa.isVisible({ timeout: 6000 }).catch(() => false)) {
        log('Selecionando empresa "0101 Randon Administradora De Consorcios Ltda"...')
        await linkEmpresa.click()
        await activePage.waitForLoadState('domcontentloaded').catch(() => {})
        await activePage.waitForTimeout(3000)
        log(`Página após selecionar empresa: ${activePage.url()}`)
        await activePage.screenshot({ path: path.join(screenshotsDir, `racon-04b-pos-selecionar-empresa-${Date.now()}.png`) }).catch(() => {})
      }

      // Identifica se a execução é do Robô de Boletos, Robô de Lances, Robô 2 (Contemplações) ou Robô 1 (Grupos & Vagas)
      const isBoletos = 
        config.configuracao_tarefas?.tipo_rotina === 'FRANQUIA_DOWNLOAD_BOLETOS' ||
        (config.nome && config.nome.toLowerCase().includes('boleto'))

      const isLancesFranquia = 
        config.configuracao_tarefas?.tipo_rotina === 'FRANQUIA_LANCES_AUTOMATICOS' ||
        (config.nome && config.nome.toLowerCase().includes('lances'))

      const isContemplacao = 
        config.id === '06619f9e-1688-49f2-9d7b-f0429906476a' || 
        (config.nome && config.nome.toLowerCase().includes('contempla'))

      if (isBoletos) {
        log('--- EXECUTANDO ROBÔ DE BOLETOS DA FRANQUIA (DOWNLOAD & STORAGE) ---')
        const bolRes = await executarRoboBoletos({
          page: activePage,
          context,
          config,
          admin,
          log,
          screenshotsDir,
          downloadDir,
        })
        totalGruposAtualizados = bolRes.totalBoletosArmazenados
        totalCotadasContempladas = bolRes.cotasProcessadas
        resultadoBoletos = bolRes
      } else if (isLancesFranquia) {
        log('--- EXECUTANDO ROBÔ DE LANCES AUTOMÁTICOS DA FRANQUIA ---')
        const lancesRes = await executarRoboLances({
          page: activePage,
          context,
          config,
          admin,
          log,
          screenshotsDir,
        })
        totalGruposAtualizados = lancesRes.lancesOfertados
        totalCotadasContempladas = lancesRes.cotasProcessadas
      } else if (!isContemplacao) {
        // =========================================================================
        // ROBÔ 1: ATUALIZAÇÃO DE GRUPOS, VAGAS E DATA DE INÍCIO
        // Menu: Venda -> Venda de Proposta -> Reserva de Cotas
        // =========================================================================
        log('--- EXECUTANDO ROBÔ 1: GRUPOS, VAGAS E INÍCIO ---')
        log('Navegando no Newcon: Menu Venda -> Venda de Proposta -> Reserva de Cotas...')

        const menuVenda = activePage.locator('a:has-text("Venda"), td:has-text("Venda"), span:has-text("Venda")').filter({ hasNotText: 'Página' }).first()
        if (await menuVenda.isVisible({ timeout: 5000 }).catch(() => false)) {
          log('Clicando na aba Venda...')
          await menuVenda.click()
          await activePage.waitForTimeout(2000)
        }

        // Clica em "Venda de Proposta" no submenu superior
        log('Localizando e clicando em "Venda de Proposta"...')
        const clickedVendaProp = await activePage.evaluate(() => {
          const allA = Array.from(document.querySelectorAll('a, span, td, div'))
          const target = allA.find(el => (el.innerText || '').trim() === 'Venda de Proposta')
          if (target) {
            target.click()
            return true
          }
          return false
        }).catch(() => false)

        if (!clickedVendaProp) {
          const subVenda = activePage.locator('a:has-text("Venda de Proposta")').first()
          if (await subVenda.isVisible({ timeout: 4000 }).catch(() => false)) {
            await subVenda.click()
          }
        }

        await activePage.waitForLoadState('domcontentloaded').catch(() => {})
        await activePage.waitForTimeout(3000)
        await activePage.screenshot({ path: path.join(screenshotsDir, `racon-04c-pos-venda-proposta-${Date.now()}.png`) }).catch(() => {})

        // Se houver "Pré Venda" na árvore esquerda, clica para expandir
        const noPreVenda = activePage.locator('a:has-text("Pré Venda"), td:has-text("Pré Venda"), span:has-text("Pré Venda")').first()
        if (await noPreVenda.isVisible({ timeout: 4000 }).catch(() => false)) {
          log('Expandindo nó "Pré Venda"...')
          await noPreVenda.click()
          await activePage.waitForTimeout(1500)
        }

        // Localiza "Reserva de Cotas"
        log('Localizando link "Reserva de Cotas"...')
        const linkReservaCotas = activePage.locator('a:has-text("Reserva de Cotas")').first()
        await linkReservaCotas.waitFor({ state: 'visible', timeout: 20_000 })
        log('Clicando no link "Reserva de Cotas"...')
        await linkReservaCotas.click()

        // Aguarda navegação para frmPrcConVeReservaCota.aspx
        log('Aguardando carregamento da tela CONVE/frmPrcConVeReservaCota.aspx...')
        await activePage.waitForURL(url => url.pathname.includes('frmPrcConVeReservaCota') || url.href.includes('ReservaCota'), { timeout: 30_000 })
        await activePage.waitForLoadState('domcontentloaded').catch(() => {})
        await activePage.waitForTimeout(3000)
        log(`Tela de Reserva de Cotas carregada: ${activePage.url()}`)
        await activePage.screenshot({ path: path.join(screenshotsDir, `racon-04-reserva-cotas-${Date.now()}.png`) }).catch(() => {})

        // Filtro Pesquisa por: Grupo
        log('Configurando filtro: "Pesquisa por" -> "Grupo"...')
        const selectPesquisa = activePage.locator('select:has(option:has-text("Grupo")), select[name*="Pesquisa"], select#ddlPesquisa').first()
        if (await selectPesquisa.isVisible({ timeout: 8000 }).catch(() => false)) {
          try {
            await selectPesquisa.selectOption({ label: 'Grupo' })
          } catch {
            const options = await selectPesquisa.locator('option').allInnerTexts()
            const optGrupo = options.find(o => o.trim().toLowerCase().includes('grupo'))
            if (optGrupo) await selectPesquisa.selectOption({ label: optGrupo.trim() })
          }
          await activePage.waitForLoadState('networkidle').catch(() => {})
          await activePage.waitForTimeout(2000)
        }

        // Clicar no botão três pontinhos (...) ao lado de Grupo
        log('Localizando botão (...) do campo Grupo...')
        const lookupPopupPromise = context.waitForEvent('page', { timeout: 10_000 }).catch(() => null)
        const btnTresPontos = activePage.locator(
          'input[value="..."], button:has-text("..."), input[name*="btnGrupo"], input[id*="btnGrupo"], input[name*="Grupo"] ~ input[type="button"], input[name*="Grupo"] + input[type="button"]'
        ).first()

        await btnTresPontos.waitFor({ state: 'visible', timeout: 15_000 })
        log('Clicando no botão (...) para carregar catálogo completo de grupos...')
        await btnTresPontos.click()

        let lookupPage = (await lookupPopupPromise) || activePage
        await lookupPage.waitForTimeout(4000)
        await lookupPage.waitForLoadState('domcontentloaded').catch(() => {})
        log(`Janela de grupos aberta. Capturando screenshot...`)
        await lookupPage.screenshot({ path: path.join(screenshotsDir, `racon-05-modal-grupos-${Date.now()}.png`) }).catch(() => {})

        // Extração de linhas de dados de grupos da tabela
        log('Inspecionando estrutura de tabela de grupos no popup...')
        const extractFn = () => {
          const trs = Array.from(document.querySelectorAll('tr'))
          const valid = []
          for (const tr of trs) {
            const tds = Array.from(tr.querySelectorAll('td'))
            if (tds.length < 5) continue
            const t0 = (tds[0]?.innerText || '').trim()
            if (!/^\d{4,8}$/.test(t0)) continue
            valid.push(tds.map(td => (td.innerText || '').trim()))
          }
          return valid
        }

        let rawRows = await lookupPage.evaluate(extractFn).catch(() => [])
        if (!rawRows || rawRows.length === 0) {
          for (const f of lookupPage.frames()) {
            const fRows = await f.evaluate(extractFn).catch(() => [])
            if (fRows && fRows.length > 0) {
              rawRows = fRows
              break
            }
          }
        }

        log(`Total de linhas brutas de grupos encontradas: ${rawRows.length}`)

        if (rawRows.length > 0) {
          for (const cells of rawRows) {
            // Coluna 0: Grupo (ex: 001173)
            // Coluna 1: Prazo (ex: 180)
            // Coluna 2: Qtde Cotas (ex: 900)
            // Coluna 3: Cadastro / Início (ex: 25/07/2013)
            // Coluna 4: Cotas Ativas / Vendidas (ex: 900)
            // Coluna 5: % Vendido (ex: 100)
            // Coluna 6: Última Venda (ex: 30/09/2026)
            // Coluna 7: Produto (ex: IMÓVEIS)
            const rawGrupo = cells[0] || ''
            const codigoNum = rawGrupo.replace(/\D/g, '').replace(/^0+/, '')
            const prazo = parseInt((cells[1] || '0').replace(/\D/g, ''), 10) || 0
            const qtdCotas = parseInt((cells[2] || '0').replace(/\D/g, ''), 10) || 0
            const rawData = cells[3] || ''
            const cotasAtivas = parseInt((cells[4] || '0').replace(/\D/g, ''), 10) || 0
            const percentualVendido = parseFloat((cells[5] || '0').replace(',', '.')) || 0
            const rawUltimaVenda = cells[6] || ''
            const produto = cells[7] || ''

            // Vagas = Subtração da coluna quantidade de cotas - cotas ativas
            const vagas = Math.max(0, qtdCotas - cotasAtivas)

            // Data de cadastro / início do grupo
            let dataCadastro = null
            const matchData = rawData.match(/(\d{2})\/(\d{2})\/(\d{4})/)
            if (matchData) {
              dataCadastro = `${matchData[3]}-${matchData[2]}-${matchData[1]}`
            }

            gruposProcessados.push({
              codigo_bruto: rawGrupo,
              codigo_numerico: codigoNum,
              prazo: prazo,
              quantidade_cotas: qtdCotas,
              cotas_ativas: cotasAtivas,
              vagas: vagas,
              data_cadastro: dataCadastro,
              percentual_vendido: percentualVendido,
              ultima_venda: rawUltimaVenda,
              produto: produto,
            })
          }

          log(`Total de grupos extraídos e mapeados: ${gruposProcessados.length}`)

          // Atualização / Inserção no Supabase (grupos_consorcio)
          const raconAdminId = config.administradora_id
          if (!raconAdminId) throw new Error('Administradora do robô não configurada.')

          for (const g of gruposProcessados) {
            const { data: existentes } = await admin
              .from('grupos_consorcio')
              .select('id, codigo_grupo, data_primeira_assembleia, capacidade_total, vagas_disponiveis')
              .eq('administradora_id', raconAdminId)
              .ilike('codigo_grupo', `%${g.codigo_numerico}%`)

            const existente = (existentes || []).find(e => {
              const parts = e.codigo_grupo.split(/[\s-]+/)
              return parts.some(p => p.replace(/\D/g, '') === g.codigo_numerico)
            }) || (existentes && existentes.length > 0 ? existentes[0] : null)

            // Mapeamento semântico da modalidade com base no Produto Newcon
            let modalidade = 'Automóvel'
            const prodUp = (g.produto || '').toUpperCase()
            if (prodUp.includes('IMÓV')) modalidade = 'Imóvel'
            else if (prodUp.includes('AGRÍCOL')) modalidade = 'Máquinas Agrícolas'
            else if (prodUp.includes('RODOV')) modalidade = 'Implementos Rodoviários'
            else if (prodUp.includes('VEÍC') || prodUp.includes('CAMINH') || prodUp.includes('MICRO')) modalidade = 'Automóvel'

            const payloadEstatisticas = {
              cotas_ativas: g.cotas_ativas,
              quantidade_cotas: g.quantidade_cotas,
              vagas_calculadas: g.vagas,
              percentual_vendido: g.percentual_vendido,
              data_cadastro_newcon: g.data_cadastro,
              ultima_venda_newcon: g.ultima_venda,
              produto_newcon: g.produto,
              prazo_newcon: g.prazo,
              atualizado_por_robo: true,
              atualizado_em: new Date().toISOString(),
            }

            if (existente) {
              const updatePayload = {
                capacidade_total: g.quantidade_cotas > 0 ? g.quantidade_cotas : existente.capacidade_total,
                vagas_disponiveis: g.vagas,
                vagas_atualizado_em: new Date().toISOString(),
                dados_estatisticos: payloadEstatisticas,
                dados_estatisticos_atualizado_em: new Date().toISOString(),
              }

              if (g.data_cadastro && (!existente.data_primeira_assembleia || existente.data_primeira_assembleia !== g.data_cadastro)) {
                updatePayload.data_primeira_assembleia = g.data_cadastro
              }

              const { error: updErr } = await admin.from('grupos_consorcio').update(updatePayload).eq('id', existente.id)
              if (updErr) {
                log(`[ERRO UPDATE] Grupo ${existente.codigo_grupo}: ${updErr.message}`)
              } else {
                totalGruposAtualizados++
              }
            } else {
              let sufixoCodigo = 'VEÍCULO'
              if (modalidade === 'Imóvel') sufixoCodigo = 'IMÓVEL'
              else if (modalidade === 'Máquinas Agrícolas') sufixoCodigo = 'AGRÍCOLA'
              else if (modalidade === 'Implementos Rodoviários') sufixoCodigo = 'RODOVIÁRIO'

              const novoCodigo = `${g.codigo_numerico} ${sufixoCodigo}`
              const insertPayload = {
                codigo_grupo: novoCodigo,
                modalidade: modalidade,
                administradora_id: raconAdminId,
                administradora: 'Racon',
                capacidade_total: g.quantidade_cotas,
                vagas_disponiveis: g.vagas,
                vagas_atualizado_em: new Date().toISOString(),
                data_primeira_assembleia: g.data_cadastro || new Date().toISOString().split('T')[0],
                dados_estatisticos: payloadEstatisticas,
                dados_estatisticos_atualizado_em: new Date().toISOString(),
                origem_governanca: 'GLOBAL', // Visível para todas as unidades franqueadas
                status_governanca: 'GLOBAL',
                empresa_origem_id: null,
                status: 'ATIVO',
                ativo: true,
                prazo_total: g.prazo || 180,
                prazo_restante: g.prazo || 180,
                taxa_administrativa_percentual: 0,
                fundo_reserva_percentual: 0,
              }

              const { error: insErr } = await admin.from('grupos_consorcio').insert(insertPayload)
              if (insErr) {
                log(`[ERRO INSERT] Novo grupo ${novoCodigo}: ${insErr.message}`)
              } else {
                totalGruposNovos++
              }
            }
          }

          log(`Sincronização de Grupos concluída: ${totalGruposAtualizados} grupos atualizados, ${totalGruposNovos} novos cadastrados.`)
        } else {
          log('Aviso: Nenhuma linha de grupo encontrada na tabela.')
        }
      } else {
        // =========================================================================
        // ROBÔ 2: CONTEMPLAÇÕES, ASSEMBLEIAS E MÉDIAS DE LANCE (1M, 3M, 6M, 12M)
        // Menu: Contemplação -> Contemplação -> Resultado de Assembleia
        // =========================================================================
        log('--- EXECUTANDO ROBÔ 2: CONTEMPLAÇÕES E MÉDIAS DE LANCE ---')

        // 1. Clicar em Contemplação no menu superior
        log('Acessando aba "Contemplação"...')
        const menuContemplacao = activePage.locator('a:has-text("Contemplação"), td:has-text("Contemplação"), span:has-text("Contemplação")').filter({ hasNotText: 'Pré' }).first()
        await menuContemplacao.waitFor({ state: 'visible', timeout: 15_000 })
        await menuContemplacao.click()
        await activePage.waitForTimeout(2000)

        // 1.1 Clicar no link/ícone do submenu horizontal "Contemplação" (ao lado de Pré-Contemplação)
        log('Clicando no submenu horizontal "Contemplação" (ao lado de Pré-Contemplação)...')
        const clickedSubmenu = await activePage.evaluate(() => {
          const allLinks = Array.from(document.querySelectorAll('a, span, td, div'))
          const target = allLinks.find(el => {
            const t = (el.innerText || '').trim()
            if (t !== 'Contemplação') return false
            const parent = el.closest('tr, td, div, table')
            return parent && (parent.innerText || '').includes('Pré-Contemplação')
          })
          if (target) {
            target.click()
            return true
          }
          return false
        }).catch(() => false)

        if (!clickedSubmenu) {
          const subContemp = activePage.locator('a:has-text("Contemplação")').nth(1)
          if (await subContemp.isVisible({ timeout: 4000 }).catch(() => false)) {
            await subContemp.click()
          }
        }
        await activePage.waitForLoadState('domcontentloaded').catch(() => {})
        await activePage.waitForTimeout(2500)
        await activePage.screenshot({ path: path.join(screenshotsDir, `racon-contemp-00-pos-submenu-${Date.now()}.png`) }).catch(() => {})

        // 2. Clicar em "Resultado de Assembleia" no menu lateral
        log('Acessando item "Resultado de Assembleia" no menu lateral...')
        const linkResultado = activePage.locator('a:has-text("Resultado de Assembleia")').first()
        await linkResultado.waitFor({ state: 'visible', timeout: 20_000 })
        log('Clicando no link "Resultado de Assembleia"...')
        await linkResultado.click()

        await activePage.waitForURL(url => url.pathname.includes('ResultadoAssembleia_Filtro') || url.href.includes('ResultadoAssembleia'), { timeout: 30_000 })
        await activePage.waitForLoadState('domcontentloaded').catch(() => {})
        const urlFiltro = activePage.url()
        log(`Tela de Filtro de Resultado de Assembleia carregada: ${urlFiltro}`)
        await activePage.screenshot({ path: path.join(screenshotsDir, `racon-contemp-01-filtro-${Date.now()}.png`) }).catch(() => {})

        // 3. Selecionar Ponto de Venda 939509 (939509 - RACON SINOP - GA)
        log('Selecionando Ponto de Venda "939509"...')
        const selectPtoVenda = activePage.locator('select:has(option:has-text("939509")), select[name*="PtoVenda"], select[name*="PontoVenda"], select[id*="PontoVenda"], select[name*="ddlPtoVenda"]').first()
        if (await selectPtoVenda.isVisible({ timeout: 10_000 }).catch(() => false)) {
          const options = await selectPtoVenda.locator('option').allInnerTexts()
          const optSinop = options.find(o => o.includes('939509'))
          if (optSinop) {
            await selectPtoVenda.selectOption({ label: optSinop.trim() })
            log(`Ponto de venda selecionado: ${optSinop.trim()}`)
            // Aguarda postback do ASP.NET ser processado
            await activePage.waitForLoadState('domcontentloaded').catch(() => {})
            await activePage.waitForTimeout(3000)
          }
        }

        // 4. Selecionar Modelo "Lista Grupo"
        log('Selecionando Modelo "Lista Grupo"...')
        const modeloResult = await activePage.evaluate(() => {
          const selects = Array.from(document.querySelectorAll('select'))
          for (const s of selects) {
            const opts = Array.from(s.options).map(o => o.text.trim())
            if (opts.some(t => t.includes('Lista Grupo') || (t.includes('Grupo') && !t.includes('Cota')))) {
              const targetOpt = Array.from(s.options).find(o => o.text.includes('Lista Grupo') || (o.text.includes('Grupo') && !o.text.includes('Cota')))
              if (targetOpt) {
                s.value = targetOpt.value
                s.dispatchEvent(new Event('change', { bubbles: true }))
                return { success: true, id: s.id, name: s.name, selected: targetOpt.text, value: targetOpt.value }
              }
            }
          }
          return { success: false, selects: selects.map(s => ({ id: s.id, name: s.name, options: Array.from(s.options).map(o => o.text.trim()) })) }
        }).catch(err => ({ success: false, erro: err.message }))

        log(`Resultado da seleção de Modelo via DOM: ${JSON.stringify(modeloResult)}`)

        if (!modeloResult.success) {
          // Fallback: tenta o segundo select da página
          const selectModeloFallback = activePage.locator('select').nth(1)
          if (await selectModeloFallback.isVisible({ timeout: 5000 }).catch(() => false)) {
            const opts = await selectModeloFallback.locator('option').allInnerTexts()
            const optG = opts.find(o => o.includes('Grupo'))
            if (optG) {
              await selectModeloFallback.selectOption({ label: optG.trim() })
              log(`Modelo selecionado via fallback nth(1): ${optG.trim()}`)
            }
          }
        }
        await activePage.waitForLoadState('domcontentloaded').catch(() => {})
        await activePage.waitForTimeout(2000)

        // 5. Clicar em Buscar
        log('Clicando no botão Buscar...')
        const btnBuscar = activePage.locator('input[value="Buscar"], button:has-text("Buscar"), input[id*="btnBuscar"], input[name*="btnBuscar"]').first()
        await btnBuscar.waitFor({ state: 'visible', timeout: 10_000 })
        await btnBuscar.click()
        await activePage.waitForLoadState('domcontentloaded').catch(() => {})
        await activePage.waitForTimeout(3500)
        log('Busca de assembleias executada com sucesso!')
        await activePage.screenshot({ path: path.join(screenshotsDir, `racon-contemp-02-resultado-grupos-${Date.now()}.png`) }).catch(() => {})

        // 6. Extrair grupos disponíveis na listagem (todas as páginas)
        log('Identificando grupos disponíveis no resultado da busca...')
        const coletarGruposPagina = async () => {
          return await activePage.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tr'))
            const list = []
            for (const tr of rows) {
              const tds = Array.from(tr.querySelectorAll('td'))
              if (tds.length < 2) continue
              const t0 = (tds[0]?.innerText || '').trim()
              if (!/^\d{4,8}$/.test(t0)) continue
              list.push({
                grupo: t0,
                ultimaAssembleia: (tds[1]?.innerText || '').trim(),
              })
            }
            return list
          }).catch(() => [])
        }

        let gruposLista = await coletarGruposPagina()

        // Verifica páginas adicionais (2, 3...)
        const paginas = await activePage.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'))
          return links
            .filter(a => /^\d+$/.test((a.innerText || '').trim()) && ((a.href || '').includes('doPostBack') || (a.href || '').includes('Page$')))
            .map(a => (a.innerText || '').trim())
        }).catch(() => [])

        if (paginas.length > 0) {
          log(`Páginas de resultado detectadas: 1, ${paginas.join(', ')}`)
          for (const p of paginas) {
            if (p === '1') continue
            const linkP = activePage.locator(`a:text-is("${p}")`).first()
            if (await linkP.isVisible({ timeout: 3000 }).catch(() => false)) {
              await linkP.click()
              await activePage.waitForLoadState('domcontentloaded').catch(() => {})
              await activePage.waitForTimeout(2000)
              const extras = await coletarGruposPagina()
              for (const eg of extras) {
                if (!gruposLista.some(g => g.grupo === eg.grupo)) {
                  gruposLista.push(eg)
                }
              }
            }
          }
        }

        log(`Grupos encontrados na listagem (${gruposLista.length}): ${gruposLista.map(g => g.grupo).join(', ')}`)

        // Carrega catálogo de grupos do Supabase para correlação
        const raconAdminId = config.administradora_id
        if (!raconAdminId) throw new Error('Administradora do robô não configurada.')
        const { data: dbGrupos, error: dbGruposError } = await admin
          .from('grupos_consorcio')
          .select('id, codigo_grupo, contemplacoes_atualizado_em, ativo, status, visivel_franquia')
          .eq('administradora_id', raconAdminId)
        if (dbGruposError) throw new Error('Falha ao carregar catálogo: '+dbGruposError.message)

        const mapDbGrupos = new Map()
        for (const dbg of dbGrupos || []) {
          const num = dbg.codigo_grupo.replace(/\D/g, '').replace(/^0+/, '')
          if (num) {
            if(mapDbGrupos.has(num) && mapDbGrupos.get(num)!==dbg.id) throw new Error('Código de grupo ambíguo na administradora: '+num)
            mapDbGrupos.set(num, dbg.id)
          }
        }

        const gruposEscopo = new Set(e.detalhes?.grupos || (dbGrupos || [])
          .filter(g => g.ativo && g.visivel_franquia !== false && (!g.status || ['Disponível','ATIVO','Ativo','Em Andamento'].includes(g.status)))
          .map(g => g.codigo_grupo.replace(/\D/g, '').replace(/^0+/, '')))
        // Inclui grupos usados no ERP mesmo quando ausentes da lista por ponto de venda.
        for (const numero of gruposEscopo) {
          if (mapDbGrupos.has(numero) && !gruposLista.some(g => g.grupo.replace(/\D/g, '').replace(/^0+/, '') === numero)) {
            gruposLista.push({ grupo: numero.padStart(6, '0') })
          }
        }
        const pendenciasGrupos = []
        fs.writeFileSync(path.join(downloadDir, 'grupos-assembleias-'+execucaoId+'.json'), JSON.stringify({
          disponiveis: gruposLista.map(g=>g.grupo),
          ausentes_no_portal: [...mapDbGrupos.keys()].filter(n=>!gruposLista.some(g=>g.grupo.replace(/\D/g,'').replace(/^0+/,'')===n)),
        }, null, 2))
        // 7. Itera sobre cada grupo para extrair contemplações e histórico de lances
        for (let gIdx = 0; gIdx < gruposLista.length; gIdx++) {
          const itemGrupo = gruposLista[gIdx]
          const numGrupo = itemGrupo.grupo.replace(/\D/g, '').replace(/^0+/, '')
          log(`\n-----------------------------------------------------------`)
          log(`Processando Grupo [${gIdx + 1}/${gruposLista.length}]: ${itemGrupo.grupo} (Código Numérico: ${numGrupo})...`)

          if (!gruposEscopo.has(numGrupo)) continue
          if (!mapDbGrupos.has(numGrupo)) { log('Grupo fora do catálogo da administradora: '+numGrupo); continue }

          try {
          // Garante que está na tela de filtro para acessar o grupo
          let acessou = false
          for (let attempt = 1; attempt <= 3; attempt++) {
            if (!activePage.url().includes('ResultadoAssembleia_Filtro')) {
              await activePage.goto(urlFiltro, { waitUntil: 'domcontentloaded' }).catch(() => {})
              await activePage.waitForTimeout(2000)
            }

            const inputGrupoTop = activePage.locator('input[name*="txtCd_Grupo"], input[id*="txtCd_Grupo"], input[type="text"]').first()
            const btnConfirmarTop = activePage.locator('input[value="Confirmar"], button:has-text("Confirmar")').first()

            if (await inputGrupoTop.isVisible({ timeout: 5000 }).catch(() => false)) {
              await inputGrupoTop.click().catch(() => {})
              await inputGrupoTop.fill(itemGrupo.grupo)
              await activePage.waitForTimeout(400)
              await btnConfirmarTop.click().catch(() => {})
              await activePage.waitForURL(url => url.pathname.includes('ResultadoAssembleia.aspx') || (url.href.includes('ResultadoAssembleia') && !url.href.includes('Filtro')), { timeout: 15_000 }).catch(() => {})
              await activePage.waitForLoadState('domcontentloaded').catch(() => {})
              await activePage.waitForTimeout(2000)
              acessou = activePage.url().includes('ResultadoAssembleia.aspx') || (activePage.url().includes('ResultadoAssembleia') && !activePage.url().includes('Filtro'))
              if (acessou) break
            }
            log(`[Grupo ${itemGrupo.grupo}] Tentativa ${attempt}/3 de acesso falhou. Aguardando recarga...`)
            await activePage.waitForTimeout(2000)
          }

          if (!acessou) {
            log(`[Grupo ${itemGrupo.grupo}] Não foi possível abrir o detalhe de assembleia. Pulando para o próximo...`)
            throw new Error('Grupo indisponível no portal: '+numGrupo)
          }

          log(`Página de resultado de assembleia carregada: ${activePage.url()}`)
          await activePage.screenshot({ path: path.join(screenshotsDir, `racon-detalhe-grupo-${itemGrupo.grupo}-${Date.now()}.png`) }).catch(() => {})

          // Função de extração do cabeçalho da assembleia na tela atual
          const extrairCabecalhoAssembleia = async () => {
            return await activePage.evaluate(() => {
              const clone = document.body.cloneNode(true)
              for (const el of clone.querySelectorAll('input')) el.replaceWith(document.createTextNode(' '+el.value+' '))
              const bodyText = clone.textContent.replace(/\s+/g, ' ')
              
              // "Assembleia: 138 - 15/10/2026"
              const matchAss = bodyText.match(/Assembleia:\s*(\d+)\s*-\s*(\d{2}\/\d{2}\/\d{4})/i)
              const assNum = matchAss ? parseInt(matchAss[1], 10) : null
              let assData = null
              if (matchAss) {
                const dParts = matchAss[2].split('/')
                assData = `${dParts[2]}-${dParts[1]}-${dParts[0]}`
              }

              // Próxima Assembleia: "Número: 139 Data: 12/11/2026"
              const matchProx = bodyText.match(/pr[oó]xima\s+assembleia[\s\S]*?N[uú]mero:\s*(\d+)[\s\S]*?Data:\s*(\d{2}\/\d{2}\/\d{4})/i)
              const proxAssNum = matchProx ? parseInt(matchProx[1], 10) : null
              let proxAssData = null
              if (matchProx) {
                const pParts = matchProx[2].split('/')
                proxAssData = `${pParts[2]}-${pParts[1]}-${pParts[0]}`
              }

              // Primeira Assembleia: "Primeira assembleia: 13/05/2015"
              const matchPrim = bodyText.match(/Primeira\s+assembleia:\s*(\d{2}\/\d{2}\/\d{4})/i)
              let primAssData = null
              if (matchPrim) {
                const prParts = matchPrim[1].split('/')
                primAssData = `${prParts[2]}-${prParts[1]}-${prParts[0]}`
              }

              // Sorteio
              const matchSort = bodyText.match(/N[uú]mero\s+sorteado:\s*(\d+)/i)
              const numSorteado = matchSort ? parseInt(matchSort[1], 10) : null

              const getCounter = (regex) => {
                const m = bodyText.match(regex)
                return m ? parseInt(m[1], 10) : 0
              }

              return {
                assembleiasRealizadas: bodyText.match(/Assembleias\s+realizadas:\s*(\d+)/i) ? Number(bodyText.match(/Assembleias\s+realizadas:\s*(\d+)/i)[1]) : null,
                grupoNumero: (bodyText.match(/Grupo:\s*(\d+)/i)?.[1] || '').replace(/^0+/, ''),
                assembleiaNumero: assNum,
                assembleiaData: assData,
                proximaAssembleiaNumero: proxAssNum,
                proximaAssembleiaData: proxAssData,
                primeiraAssembleiaData: primAssData,
                numeroSorteado: numSorteado,
                contadores: {
                  sorteioAtivas: getCounter(/Sorteio\s+Ativas:\s*(\d+)/i),
                  sorteioCanceladas: getCounter(/Sorteio\s+Canceladas:\s*(\d+)/i),
                  lanceLivre: getCounter(/Lance\s+Livre:\s*(\d+)/i),
                  lanceFixo: getCounter(/Lance\s+Fixo:\s*(\d+)/i),
                  lanceFidelidade: getCounter(/Lance\s+Fidelidade:\s*(\d+)/i),
                }
              }
            }).catch(err => ({ erro: err.message }))
          }

          // Coleta histórica retrocedendo assembleias (desde a atual até a assembleia 1)
          const historicoLances = []
          const assembleiasVisitadas = new Set()
          let dadosMaisRecente = null
          let totalAssembleiasGrupo = 0
          const dbGrupoId = mapDbGrupos.get(numGrupo)

          const cacheAss = new Map()
          for (let offset=0; ; offset+=500) {
            const {data,error}=await admin.from('grupo_assembleias_resultados')
              .select('assembleia_numero,assembleia_data,cotas,criado_em').eq('grupo_id',dbGrupoId)
              .order('id').range(offset,offset+499)
            if(error) throw new Error('Histórico verificado indisponível: '+error.message)
            for(const row of data) {
              const anterior=cacheAss.get(row.assembleia_numero)
              if(!anterior||row.criado_em>anterior.criado_em)cacheAss.set(row.assembleia_numero,row)
            }
            if(data.length<500)break
          }
          log(`Iniciando varredura retroativa completa de assembleias para o grupo ${numGrupo}...`)

          while (true) {
            const headerAss = await extrairCabecalhoAssembleia()
            if (headerAss.grupoNumero !== numGrupo) throw new Error('Grupo retornado pelo portal não corresponde à consulta: '+numGrupo)
            if (headerAss.assembleiasRealizadas === 0) {
              dadosMaisRecente = headerAss
              break
            }
            const assNum = headerAss.assembleiaNumero

            if (!assNum || assembleiasVisitadas.has(assNum)) {
              log(`[Grupo ${numGrupo}] Parada: Assembleia ${assNum || 'não identificada'} já processada ou fim do histórico.`)
              throw new Error('Histórico interrompido antes da assembleia 1: '+numGrupo)
            }
            assembleiasVisitadas.add(assNum)

            if (!dadosMaisRecente) {
              dadosMaisRecente = headerAss
            }

            totalAssembleiasGrupo++

            // Reutiliza somente snapshots verificados e contíguos até a assembleia 1.
            // A assembleia mais recente é sempre relida para capturar confirmações novas.
            if(assNum < dadosMaisRecente.assembleiaNumero && Array.from({length:assNum},(_,i)=>i+1).every(n=>cacheAss.has(n))) {
              for(let n=assNum;n>=1;n--) {
                const s=cacheAss.get(n);assembleiasVisitadas.add(n)
                historicoLances.push({assembleia:n,data:s.assembleia_data,
                  lances:s.cotas.filter(c=>c.situacao_cota==='ATIVA'&&c.modalidade==='LANCE_LIVRE'&&c.percentual_lance>0).map(c=>c.percentual_lance),
                  totalContempladas:new Set(s.cotas.filter(c=>c.situacao_cota==='ATIVA').map(c=>c.cota)).size})
              }
              log('[Grupo '+numGrupo+'] Reutilizado histórico verificado de 1 a '+assNum)
              break
            }
            const todasCotasDestaAss = await coletarAbasResultado(activePage)
            const lancesDestaAss = todasCotasDestaAss
              .filter(c => c.situacao_cota === 'ATIVA' && c.modalidade === 'LANCE_LIVRE' && c.percentual_lance > 0)
              .map(c => c.percentual_lance)
            if (!headerAss.assembleiaData) throw new Error('Data da assembleia não identificada')
            const snapshot = {
              grupo_id: dbGrupoId, assembleia_numero: assNum,
              assembleia_data: headerAss.assembleiaData, execucao_id: execucaoId,
              versao: 2, cotas: todasCotasDestaAss,
            }
            const backupDir = path.resolve(downloadDir, 'contemplacoes-v2', execucaoId)
            fs.mkdirSync(backupDir, { recursive: true })
            fs.writeFileSync(path.join(backupDir, numGrupo+'-'+assNum+'.json'), JSON.stringify(snapshot, null, 2))
            if (!e.dry_run) {
              const { error } = await admin.from('grupo_assembleias_resultados').insert(snapshot)
              if (error) throw new Error('Falha ao persistir resultado verificado: '+error.message)
            }
            historicoLances.push({
              assembleia: assNum, data: headerAss.assembleiaData, lances: lancesDestaAss,
              totalContempladas: new Set(todasCotasDestaAss.filter(c=>c.situacao_cota==='ATIVA').map(c=>c.cota)).size,
            })
            totalCotadasContempladas += historicoLances.at(-1).totalContempladas
            log('[Grupo '+numGrupo+'] Assembleia '+assNum+': '+historicoLances.at(-1).totalContempladas+' contempladas ativas; '+lancesDestaAss.length+' lances livres válidos.')

            // Se for a assembleia 1, alcançamos o início do grupo!
            if (assNum <= 1) {
              log(`[Grupo ${numGrupo}] Assembleia 1 alcançada! Histórico completo de ${totalAssembleiasGrupo} assembleias concluído.`)
              break
            }

            // Clica em "« Retorna uma Assembleia"
            const btnRetorna = activePage.locator('input[value*="Retorna"], button:has-text("Retorna"), a:has-text("Retorna")').first()
            if (!(await btnRetorna.isVisible({ timeout: 2500 }).catch(() => false))) {
              log(`[Grupo ${numGrupo}] Botão "Retorna uma Assembleia" não disponível. Fim do histórico do grupo.`)
              throw new Error('Botão de retorno ausente antes da assembleia 1: '+numGrupo)
            }

            const assAtual = assNum
            await btnRetorna.click()
            await activePage.waitForLoadState('domcontentloaded').catch(() => {})
            
            // Aguarda até o número da assembleia mudar ou até 4s
            for (let w = 0; w < 8; w++) {
              await activePage.waitForTimeout(400)
              const novoH = await extrairCabecalhoAssembleia()
              if (novoH.assembleiaNumero && novoH.assembleiaNumero !== assAtual) break
            }
          }

          if (dadosMaisRecente?.assembleiasRealizadas === 0) {
            const zeroDir = path.resolve(downloadDir, 'contemplacoes-sem-assembleias', execucaoId)
            fs.mkdirSync(zeroDir, {recursive:true})
            fs.writeFileSync(path.join(zeroDir, numGrupo+'.json'), JSON.stringify({grupo_id:dbGrupoId,execucao_id:execucaoId,cabecalho:dadosMaisRecente},null,2))
            if (!e.dry_run) {
              const {error}=await admin.from('grupos_consorcio').update({
                ultima_assembleia_numero:0, ultima_assembleia_data:null,
                media_lance_1m:null,media_lance_3m:null,media_lance_6m:null,media_lance_12m:null,
                ...(dadosMaisRecente.primeiraAssembleiaData ? {data_primeira_assembleia:dadosMaisRecente.primeiraAssembleiaData} : {}),
                proxima_assembleia_numero:dadosMaisRecente.proximaAssembleiaNumero || null,
                proxima_assembleia_data:dadosMaisRecente.proximaAssembleiaData,
                contemplacoes_atualizado_em:new Date().toISOString(),
                contemplacoes_resumo:{versao:2,historico_completo:true,sem_assembleias_realizadas:true,execucao_id:execucaoId,ultima_assembleia:dadosMaisRecente},
              }).eq('id',dbGrupoId).eq('administradora_id',raconAdminId)
              if(error)throw error
            }
            totalGruposContemplados++
            log('[Grupo '+numGrupo+'] Portal confirma zero assembleias realizadas.')
            continue
          }
          if (historicoLances.length !== dadosMaisRecente.assembleiaNumero || !assembleiasVisitadas.has(1)) {
            throw new Error('Histórico incompleto para o grupo '+numGrupo)
          }
          // Cálculo das médias móveis a partir do histórico completo coletado
          // historicoLances está ordenado da mais recente para a mais antiga
          const calcMedia = (numMeses) => {
            const amostras = historicoLances.slice(0, numMeses).flatMap(h => h.lances)
            if (amostras.length === 0) return null
            const soma = amostras.reduce((acc, v) => acc + Math.round(v * 10000), 0)
            return Math.round(soma / amostras.length) / 10000
          }

          const media1m = calcMedia(1)
          const media3m = calcMedia(3)
          const media6m = calcMedia(6)
          const media12m = calcMedia(12)
          const mediaHistoricaGeral = calcMedia(historicoLances.length)

          log(`Médias de Lance Calculadas [Grupo ${numGrupo}]: 1m=${media1m}%, 3m=${media3m}%, 6m=${media6m}%, 12m=${media12m}%, Geral=${mediaHistoricaGeral}% (em ${historicoLances.length} assembleias processadas)`)

          // Atualização da tabela grupos_consorcio com as médias e histórico
          if (dbGrupoId && dadosMaisRecente && !e.dry_run) {
            const updateGrupoPayload = {
              media_lance_1m: media1m,
              media_lance_3m: media3m,
              media_lance_6m: media6m,
              media_lance_12m: media12m,
              ultima_assembleia_numero: dadosMaisRecente.assembleiaNumero,
              ultima_assembleia_data: dadosMaisRecente.assembleiaData,
              proxima_assembleia_numero: dadosMaisRecente.proximaAssembleiaNumero,
              proxima_assembleia_data: dadosMaisRecente.proximaAssembleiaData,
              contemplacoes_atualizado_em: new Date().toISOString(),
              contemplacoes_resumo: {
                versao: 2,
                historico_completo: true,
                assembleias_verificadas: [...assembleiasVisitadas],
                ultima_assembleia: dadosMaisRecente,
                total_assembleias_historicas: historicoLances.length,
                medias_lance: {
                  mes_1: media1m,
                  mes_3: media3m,
                  mes_6: media6m,
                  mes_12: media12m,
                  geral_historico: mediaHistoricaGeral,
                },
                atualizado_em: new Date().toISOString(),
              }
            }

            if (dadosMaisRecente.primeiraAssembleiaData) {
              updateGrupoPayload.data_primeira_assembleia = dadosMaisRecente.primeiraAssembleiaData
            }

            const { error: updErr } = await admin.from('grupos_consorcio').update(updateGrupoPayload).eq('id', dbGrupoId)
            if (updErr) {
              throw new Error(`Erro ao atualizar dados de contemplação do grupo ${numGrupo}: ${updErr.message}`)
            } else {
              log(`Dados de contemplação e médias atualizados com sucesso para o grupo ${numGrupo}!`)
              totalGruposContemplados++
            }
          } else if (e.dry_run) {
            totalGruposContemplados++
            log(`Grupo ${numGrupo} validado sem escrita de catálogo.`)
          } else {
            log(`Aviso: Grupo ${numGrupo} não associado a registro prévio na tabela grupos_consorcio.`)
          }

          // 5. Retornar para a tela de filtro de assembleias
          log('Retornando para tela de filtro de assembleias...')
          await activePage.goto(urlFiltro, { waitUntil: 'domcontentloaded' }).catch(() => {})
          await activePage.waitForTimeout(2000)
          } catch (error) {
            pendenciasGrupos.push({ grupo: numGrupo, erro: error.message })
            log('[Grupo '+numGrupo+'] PENDENTE: '+error.message)
            await activePage.goto(urlFiltro, {waitUntil:'domcontentloaded'}).catch(()=>{})
          }
        }
        fs.writeFileSync(path.join(downloadDir, 'pendencias-assembleias-'+execucaoId+'.json'), JSON.stringify(pendenciasGrupos,null,2))
        if (pendenciasGrupos.length) throw new Error('Histórico incompleto em '+pendenciasGrupos.length+' grupo(s): '+pendenciasGrupos.map(p=>p.grupo).join(', '))

        log(`=== PROCESSAMENTO ROBÔ 2 FINALIZADO ===`)
        log(`Grupos analisados: ${totalGruposContemplados}`)
        log(`Total de cotas contempladas cadastradas: ${totalCotadasContempladas}`)
      }
      }
    } else {
      // Fluxo genérico para outros portais
      const targetUrl = config.login_url || config.site_url
      log(`Acessando portal: ${targetUrl}`)
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
      log('Conexão inicial validada.')
    }

    log('Processamento do robô finalizado com sucesso!')
    await atualizacao

    await admin.from('robo_execucoes').update({
      status: 'SUCESSO',
      finalizado_em: new Date().toISOString(),
      resultado: {
        ...(resultadoBoletos ? { boletos: resultadoBoletos } : {}),
        grupos_extraidos: gruposProcessados.length,
        grupos_atualizados: totalGruposAtualizados,
        grupos_novos: totalGruposNovos,
        grupos_contemplados: totalGruposContemplados,
        cotas_contempladas: totalCotadasContempladas,
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

    // Salva screenshot do erro para diagnóstico visual da aba ativa
    const errorScreenshot = path.resolve(screenshotsDir, `erro-execucao-${Date.now()}.png`)
    const targetPage = context.pages().slice(-1)[0] || page
    await targetPage.screenshot({ path: errorScreenshot }).catch(() => {})
    log(`Screenshot do erro salvo em: ${errorScreenshot}`)

    await admin.from('robo_execucoes').update({
      status: 'ERRO',
      finalizado_em: new Date().toISOString(),
      erro_mensagem: err.message,
      erro_sanitizado: err.message.slice(0, 300),
      detalhes: {
        ...e.detalhes,
        erro: err.message,
        screenshot_erro: errorScreenshot,
        logs: logs.slice(-300),
      },
    }).eq('id', execucaoId)

    await admin.from('robo_configuracoes').update({
      ultima_execucao_em: new Date().toISOString(),
      ultimo_erro: err.message.slice(0, 300),
    }).eq('id', config.id)

    throw err
  } finally {
    await browser.close().catch(() => {})
  }
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Falha no processo-filho do robô:', err)
    process.exit(1)
  })
