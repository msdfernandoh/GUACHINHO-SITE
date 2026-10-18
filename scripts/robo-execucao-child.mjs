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
  const screenshotsDir = path.resolve(process.cwd(), 'tmp/robo-screenshots')
  if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true })
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true })

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  })

  const page = await context.newPage()
  page.setDefaultTimeout(60_000)

  let totalGruposAtualizados = 0
  let totalGruposNovos = 0
  const gruposProcessados = []

  try {
    const isRacon = config.portal_tipo === 'RACON' || (config.site_url && config.site_url.includes('randonconsorcios'))

    if (isRacon) {
      log('--- INICIANDO FLUXO AUTOMATIZADO RACON / NEWCON ---')
      const targetUrl = config.login_url || config.site_url || 'https://e.randonconsorcios.com.br/'
      log(`Navegando para URL inicial: ${targetUrl}`)
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.waitForTimeout(3000)

      // 1. Tratamento da autenticação Microsoft Online SSO
      await page.waitForTimeout(2000)
      if (page.url().includes('login.microsoftonline.com')) {
        log('Detectada tela de autenticação Microsoft Online SSO.')
        await page.screenshot({ path: path.join(screenshotsDir, `racon-01-login-ms-start-${Date.now()}.png`) }).catch(() => {})

        // Se houver seletor de conta prévia salva
        const accountTile = page.locator(`div:has-text("${config.usuario_login}"), div:has-text("ERONI BOLFE")`).first()
        if (await accountTile.isVisible({ timeout: 3000 }).catch(() => false)) {
          log('Conta encontrada no seletor de contas. Selecionando...')
          await accountTile.click()
          await page.waitForTimeout(2000)
        }

        // Aguarda campo de email estar pronto
        const emailInput = page.locator('input[name="loginfmt"], #i0116, input[type="email"]').first()
        const emailVisible = await emailInput.isVisible({ timeout: 15_000 }).catch(() => false)
        if (emailVisible) {
          log(`Preenchendo usuário Microsoft: ${config.usuario_login}`)
          await emailInput.click()
          await emailInput.fill(config.usuario_login.trim())
          await page.waitForTimeout(600)

          const nextBtn = page.locator('#idSIButton9, input[type="submit"], button:has-text("Avançar"), button:has-text("Next")').first()
          log('Clicando em Avançar no login Microsoft...')
          await nextBtn.click()
          await page.waitForTimeout(2500)
        }

        // Preenche Senha
        log('Aguardando campo de senha Microsoft...')
        const passInput = page.locator('input[name="passwd"], #i0118, input[type="password"]').first()
        await passInput.waitFor({ state: 'visible', timeout: 30_000 })
        await page.waitForTimeout(1000)

        log('Preenchendo senha Microsoft...')
        await passInput.click({ delay: 100 })
        await passInput.fill(senha)
        let val = await passInput.inputValue().catch(() => '')
        if (!val || val.length === 0) {
          log('Preenchendo senha via digitação sequencial...')
          await passInput.pressSequentially(senha, { delay: 60 })
          val = await passInput.inputValue().catch(() => '')
        }
        log(`Status campo de senha: ${val ? 'Preenchido (' + val.length + ' chars)' : 'Atenção: Vazio'}`)
        await page.waitForTimeout(1000)

        const signBtn = page.locator('#idSIButton9, input[type="submit"], button:has-text("Entrar"), button:has-text("Sign in")').first()
        log('Clicando em Entrar...')
        await signBtn.click()
        await page.waitForTimeout(3500)

        // Verifica se houve erro de senha incorreta
        const passError = page.locator('#passwordError, #passwordError:has-text("incorret"), span:has-text("Sua conta ou senha")').first()
        if (await passError.isVisible({ timeout: 2000 }).catch(() => false)) {
          const errMsg = await passError.innerText().catch(() => 'Erro desconhecido na validação da senha.')
          log(`Erro no login Microsoft: ${errMsg}`)
          throw new Error(`Falha no login Microsoft: ${errMsg}`)
        }

        // Tela de confirmação "Continuar conectado?" / "Mantenha-se conectado?" (KMSI)
        const staySignedBtn = page.locator('#idSIButton9, input[value="Sim"], button:has-text("Sim"), button:has-text("Yes")').first()
        if (await staySignedBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
          log('Confirmando "Mantenha-se conectado"...')
          await staySignedBtn.click()
          await page.waitForTimeout(2500)
        }
      }

      // 2. Aguarda retorno ao portal Randon / Racon
      log('Aguardando carregamento do portal e.randonconsorcios.com.br...')
      await page.waitForURL(url => url.hostname.includes('randonconsorcios.com.br'), { timeout: 45_000 })
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(3000)
      log(`Portal Randon acessado: ${page.url()}`)
      await page.screenshot({ path: path.join(screenshotsDir, `racon-02-portal-dashboard-${Date.now()}.png`) }).catch(() => {})

      // 3. Localizar e Clicar no Card NEWCON
      log('Localizando card NEWCON no painel...')
      const popupPromise = context.waitForEvent('page', { timeout: 15_000 }).catch(() => null)
      const newconCard = page.locator('div:has-text("NEWCON"):has-text("Consultar serviços"), a:has-text("Acessar"), div:has-text("NEWCON") a').first()

      if (await newconCard.isVisible({ timeout: 10_000 }).catch(() => false)) {
        log('Clicando no card NEWCON...')
        await newconCard.click()
      } else {
        log('Buscando link direto para NEWCON...')
        const fallback = page.locator('text="NEWCON"').first()
        await fallback.click()
      }

      let activePage = (await popupPromise) || page
      await activePage.waitForTimeout(3000)

      // 4. Se aparecer tela de Permissões Solicitadas (SSO - Newconweb)
      const acceptBtn = activePage.locator('#idBtn_Accept, button:has-text("Aceitar"), input[value="Aceitar"]').first()
      if (await acceptBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
        log('Tela de permissões Newconweb detectada. Clicando em "Aceitar"...')
        await acceptBtn.click()
        await activePage.waitForTimeout(4000)
      }

      // 5. Aguarda Newcon Web (nwcweb.randonconsorcios.com.br)
      log('Aguardando carregamento do Newcon Web...')
      await activePage.waitForURL(url => url.hostname.includes('nwcweb.randonconsorcios.com.br'), { timeout: 45_000 })
      await activePage.waitForLoadState('domcontentloaded')
      await activePage.waitForTimeout(3000)
      log(`Newcon Web carregado com sucesso: ${activePage.url()}`)
      await activePage.screenshot({ path: path.join(screenshotsDir, `racon-03-newcon-main-${Date.now()}.png`) }).catch(() => {})

      // 6. Navegação no Menu: Venda -> Venda de Proposta -> Reserva de Cotas
      log('Navegando no Newcon: Menu Venda -> Venda de Proposta -> Reserva de Cotas...')
      const menuVenda = activePage.locator('a:has-text("Venda"), td:has-text("Venda"), span:has-text("Venda")').filter({ hasNotText: 'Página' }).first()
      await menuVenda.click()
      await activePage.waitForTimeout(1500)

      const subVenda = activePage.locator('a:has-text("Venda de Proposta"), span:has-text("Venda de Proposta")').first()
      if (await subVenda.isVisible({ timeout: 5000 }).catch(() => false)) {
        await subVenda.click()
        await activePage.waitForTimeout(1500)
      }

      const reservaCotas = activePage.locator('a:has-text("Reserva de Cotas"), span:has-text("Reserva de Cotas")').first()
      await reservaCotas.waitFor({ state: 'visible', timeout: 15_000 })
      log('Acessando tela de Reserva de Cotas...')
      await reservaCotas.click()
      await activePage.waitForTimeout(4000)
      await activePage.waitForLoadState('domcontentloaded')
      log(`Tela de Reserva de Cotas carregada: ${activePage.url()}`)
      await activePage.screenshot({ path: path.join(screenshotsDir, `racon-04-reserva-cotas-${Date.now()}.png`) }).catch(() => {})

      // 7. Filtro Pesquisa por: Grupo
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

      // 8. Clicar no botão três pontinhos (...) ao lado de Grupo
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

      // 9. Extração de Grupos da Tabela
      log('Inspecionando estrutura de tabela de grupos...')
      let table = lookupPage.locator('table:has(th), table:has(td:has-text("Grupo")), table.grid, table[id*="Grid"]').first()
      if (!(await table.isVisible({ timeout: 5000 }).catch(() => false))) {
        for (const frame of lookupPage.frames()) {
          const fTable = frame.locator('table:has(th), table:has(td:has-text("Grupo"))').first()
          if (await fTable.isVisible().catch(() => false)) {
            table = fTable
            break
          }
        }
      }

      const rows = await table.locator('tr').all()
      log(`Total de linhas encontradas na tabela de grupos: ${rows.length}`)

      if (rows.length > 1) {
        // Mapeia colunas pelo cabeçalho
        const headers = await rows[0].locator('th, td').allInnerTexts()
        log(`Cabeçalhos detectados: ${headers.map(h => h.trim()).join(' | ')}`)

        let colGrupo = headers.findIndex(h => /grupo/i.test(h))
        let colQtd = headers.findIndex(h => /quantidade|qtd/i.test(h))
        let colAtivas = headers.findIndex(h => /ativa|vendida/i.test(h))
        let colData = headers.findIndex(h => /cadastro|in[ií]cio|data/i.test(h))

        if (colGrupo === -1) colGrupo = 0
        if (colQtd === -1) colQtd = 1
        if (colAtivas === -1) colAtivas = 2

        log(`Índices mapeados: Grupo=${colGrupo}, Qtd=${colQtd}, Ativas=${colAtivas}, Data=${colData}`)

        for (let i = 1; i < rows.length; i++) {
          const cells = await rows[i].locator('td').allInnerTexts()
          if (!cells || cells.length < 2) continue

          const rawGrupo = (cells[colGrupo] || '').trim()
          if (!rawGrupo || !/\d/.test(rawGrupo)) continue

          const codigoNum = rawGrupo.replace(/\D/g, '').replace(/^0+/, '')
          const qtdCotas = parseInt((cells[colQtd] || '0').replace(/\D/g, ''), 10) || 0
          const cotasAtivas = parseInt((cells[colAtivas] || '0').replace(/\D/g, ''), 10) || 0
          const vagas = Math.max(0, qtdCotas - cotasAtivas)

          let dataCadastro = null
          if (colData !== -1 && cells[colData]) {
            const rawData = cells[colData].trim()
            const matchData = rawData.match(/(\d{2})\/(\d{2})\/(\d{4})/)
            if (matchData) {
              dataCadastro = `${matchData[3]}-${matchData[2]}-${matchData[1]}`
            }
          }

          gruposProcessados.push({
            codigo_bruto: rawGrupo,
            codigo_numerico: codigoNum,
            quantidade_cotas: qtdCotas,
            cotas_ativas: cotasAtivas,
            vagas: vagas,
            data_cadastro: dataCadastro,
          })
        }

        log(`Total de grupos extraídos: ${gruposProcessados.length}`)

        // 10. Atualização / Inserção no Supabase (grupos_consorcio)
        const raconAdminId = config.administradora_id || 'c5f8ecb4-cb5a-5014-b567-50484719b404'

        for (const g of gruposProcessados) {
          // Busca grupo existente pelo número no código_grupo
          const { data: existentes } = await admin
            .from('grupos_consorcio')
            .select('id, codigo_grupo, data_primeira_assembleia, capacidade_total, vagas_disponiveis')
            .eq('administradora_id', raconAdminId)
            .ilike('codigo_grupo', `%${g.codigo_numerico}%`)

          const existente = existentes && existentes.length > 0 ? existentes[0] : null

          const payloadEstatisticas = {
            cotas_ativas: g.cotas_ativas,
            quantidade_cotas: g.quantidade_cotas,
            vagas_calculadas: g.vagas,
            data_cadastro_newcon: g.data_cadastro,
            atualizado_por_robo: true,
            atualizado_em: new Date().toISOString(),
          }

          if (existente) {
            // Atualiza vagas e dados estatísticos
            const updatePayload = {
              capacidade_total: g.quantidade_cotas > 0 ? g.quantidade_cotas : existente.capacidade_total,
              vagas_disponiveis: g.vagas,
              vagas_atualizado_em: new Date().toISOString(),
              dados_estatisticos: payloadEstatisticas,
              dados_estatisticos_atualizado_em: new Date().toISOString(),
            }

            if (!existente.data_primeira_assembleia && g.data_cadastro) {
              updatePayload.data_primeira_assembleia = g.data_cadastro
            }

            await admin.from('grupos_consorcio').update(updatePayload).eq('id', existente.id)
            totalGruposAtualizados++
          } else {
            // Insere novo grupo
            const novoCodigo = `${g.codigo_numerico} RACON`
            const insertPayload = {
              codigo_grupo: novoCodigo,
              administradora_id: raconAdminId,
              administradora: 'Racon',
              capacidade_total: g.quantidade_cotas,
              vagas_disponiveis: g.vagas,
              vagas_atualizado_em: new Date().toISOString(),
              data_primeira_assembleia: g.data_cadastro,
              dados_estatisticos: payloadEstatisticas,
              dados_estatisticos_atualizado_em: new Date().toISOString(),
              origem_governanca: 'LOCAL',
              status_governanca: 'LOCAL',
              status: 'ATIVO',
              ativo: true,
              prazo_total: 0,
              taxa_administrativa_percentual: 0,
              fundo_reserva_percentual: 0,
            }

            await admin.from('grupos_consorcio').insert(insertPayload)
            totalGruposNovos++
          }
        }

        log(`Sincronização concluída: ${totalGruposAtualizados} grupos atualizados, ${totalGruposNovos} grupos novos cadastrados.`)
      } else {
        log('Aviso: Tabela de grupos vazia ou estrutura diferente da esperada.')
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
        grupos_extraidos: gruposProcessados.length,
        grupos_atualizados: totalGruposAtualizados,
        grupos_novos: totalGruposNovos,
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

    // Salva screenshot do erro para diagnóstico visual
    const errorScreenshot = path.resolve(screenshotsDir, `erro-execucao-${Date.now()}.png`)
    await page.screenshot({ path: errorScreenshot }).catch(() => {})
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

run().catch(err => {
  console.error('Falha no processo-filho do robô:', err)
  process.exit(1)
})
