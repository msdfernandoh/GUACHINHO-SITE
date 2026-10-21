/**
 * Servico de Automacao do Robo de Boletos da Franquia (Newcon Web / Racon)
 * Mapeamento completo:
 * 1. Entrada no Newcon Web
 * 2. Clique no icone dos dois bonequinhos (Consorciado / Atendimento) -> CONAT/frmConAtSrcConsorciado.aspx
 * 3. Itera sobre cotas ativas: preenche Grupo e Cota -> clica [Localizar]
 * 4. Na tela de Atendimento (CONAT/frmConAtCnsAtendimento.aspx) -> clica em "Emissao de Cobranca" no menu lateral
 * 5. Na tela de Boleto Avulso (CONCO/frmConCoRelBoletoAvulso.aspx) -> marca pendencia e clica [Emitir Cobranca]
 * 6. Captura PDF / HTML do boleto
 * 7. Extrai QR Code Pix Copia e Cola (texto) e Linha Digitavel
 * 8. Faz upload no Supabase Storage (bucket boletos-cotas)
 * 9. Sincroniza cotas_boletos e vendas_boletos_envios no ERP
 */

import path from 'node:path'
import { capturarPdfBoleto } from './robo-boletos-captura.mjs'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { carregarCotasBoletos, competenciaBoletos, salvarBoletoCota, selecionarPendenciaBoleto } from './robo-boletos-dados.mjs'

const req = createRequire(new URL('../gauchinho-app/package.json', import.meta.url))

// Tenta importar unpdf para extracao de texto do PDF
let unpdf = null
try {
  unpdf = req('unpdf')
} catch (err) {
  console.warn('[Robo Boletos] unpdf nao disponivel via require, tentando import dinamico:', err?.message)
}

/**
 * Funcao auxiliar de extracao de Pix Copia e Cola, Linha Digitavel e dados financeiros de texto puro
 */
export function extrairDadosBoletoTexto(rawText) {
  let qrCodePix = null
  let linhaDigitavel = null
  let vencimento = null
  let valor = null

  if (!rawText) return { qrCodePix, linhaDigitavel, vencimento, valor }

  const cleanText = rawText.replace(/[\r\n\t]+/g, ' ')

  // 1. Chave Pix Copia e Cola (padrao EMV QRCode)
  // Inicia com 000201 e termina com 6304[4 hexadecimais]
  const pixRegex = /(000201[A-Za-z0-9$.+/%:\-_*\s]{15,450}6304[A-Fa-f0-9]{4})/i
  const matchPix = cleanText.match(pixRegex)
  if (matchPix) {
    qrCodePix = matchPix[1].trim()
  }

  // 2. Linha digitavel bancaria (formato formatado ou continuo)
  const linhaFormatadaRegex = /(\d{5}[.\s]\d{5}\s+\d{5}[.\s]\d{6}\s+\d{5}[.\s]\d{6}\s+\d\s+\d{14})/
  const matchLinha = cleanText.match(linhaFormatadaRegex)
  if (matchLinha) {
    linhaDigitavel = matchLinha[1].trim()
  } else {
    const numContinuoRegex = /\b(\d{47,48})\b/
    const matchNum = cleanText.match(numContinuoRegex)
    if (matchNum) linhaDigitavel = matchNum[1].trim()
  }

  // 3. Vencimento
  const vencRegex = /(?:vencimento|venc)[\s:]*([0-3]?\d\/[0-1]?\d\/\d{4})/i
  const matchVenc = cleanText.match(vencRegex) || rawText.match(/PAG[ÁA]VEL[^\r\n]*?(\d{2}\/\d{2}\/\d{4})/i)
  if (matchVenc) {
    const parts = matchVenc[1].split('/')
    if (parts.length === 3) {
      vencimento = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
  }

  // 4. Valor do boleto
  const valRegex = /(?:valor\s+do\s+documento|valor\s+cobrado|valor\s+parcela|valor)[\s:]*(?:r\$)?\s*([\d.]+,\d{2})/i
  const matchVal = cleanText.match(valRegex)
  if (matchVal) {
    const limpo = matchVal[1].replace(/\./g, '').replace(',', '.')
    const parsed = parseFloat(limpo)
    if (!isNaN(parsed) && parsed > 0) valor = parsed
  }

  // No PDF bancário os rótulos podem vir antes de todos os valores. A linha
  // de 47 dígitos contém o valor nominal em centavos nos últimos dez dígitos.
  const linhaNumerica = linhaDigitavel?.replace(/\D/g, '')
  if (valor === null && linhaNumerica?.length === 47) {
    const nominal = Number(linhaNumerica.slice(-10)) / 100
    if (nominal > 0) valor = nominal
  }

  return { qrCodePix, linhaDigitavel, vencimento, valor }
}

export function normalizarNumeroPortal(valor, tamanho) {
  const numero = String(valor || '').match(/\d+/)?.[0]
  return numero ? numero.padStart(tamanho, '0') : ''
}

/**
 * Funcao principal de execucao do Robo de Boletos
 */
export async function executarRoboBoletos({
  page,
  context,
  config,
  admin,
  log,
  screenshotsDir,
  downloadDir,
}) {
  log('=== INICIANDO ROBÔ DE BOLETOS DA FRANQUIA (DOWNLOAD & STORAGE) ===')

  const competencia = competenciaBoletos()
  const competenciaAtual = competencia.brasileira
  const listaCotas = await carregarCotasBoletos(admin, config)
  log(`Competência de processamento: ${competenciaAtual}`)
  if (config.modo === 'DRY_RUN') {
    log('DRY_RUN: carteira consultada; emissão e armazenamento não executados.')
    return { cotasProcessadas: 0, cotasEncontradas: listaCotas.length, totalBoletosBaixados: 0, totalBoletosArmazenados: 0 }
  }

  log(`Total de cotas localizadas para download de boletos: ${listaCotas.length}`)

  if (listaCotas.length === 0) {
    log('Nenhuma cota com número definitivo encontrada para a franquia. Processo concluído.')
    return { totalBoletosBaixados: 0, totalBoletosArmazenados: 0, cotasProcessadas: 0 }
  }

  let totalBoletosBaixados = 0
  let totalBoletosArmazenados = 0
  let totalErros = 0
  let semCobranca = 0

  // 3. Navegação inicial para Atendimento / Consorciado
  // O usuário solicitou: "DEPOIS QUE ENTROU CLICA NOS BONECOS (CLIENTE)"
  log('Localizando e clicando no botão com ícone dos dois bonecos (Consorciado / Atendimento)...')

  let telaConsorciadoAberta = false

  // Tenta localizar o botão dos bonecos no cabeçalho ou menu Newcon
  const bonecosSelectors = [
    'a[href*="frmConAtSrcConsorciado"]',
    'img[src*="consorciado" i]',
    'img[title*="Consorciado" i]',
    'a[title*="Consorciado" i]',
    'input[id*="Consorciado"]',
    '#ctl00_imgConsorciado',
    '#ctl00_btnConsorciado',
  ]

  for (const sel of bonecosSelectors) {
    const el = page.locator(sel).first()
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      log(`Ícone de consorciados encontrado via seletor: ${sel}. Clicando...`)
      await el.click().catch(() => {})
      telaConsorciadoAberta = true
      break
    }
  }

  if (!telaConsorciadoAberta) {
    log('Ícone não acionado diretamente. Navegando diretamente para CONAT/frmConAtSrcConsorciado.aspx...')
    await page.goto('https://nwcweb.randonconsorcios.com.br/CONAT/frmConAtSrcConsorciado.aspx', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
  }

  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(screenshotsDir, `racon-boletos-01-localizar-consorciado-${Date.now()}.png`) }).catch(() => {})

  // 4. Itera sobre cada cota
  for (let i = 0; i < listaCotas.length; i++) {
    const item = listaCotas[i]
    log(`[${i + 1}/${listaCotas.length}] Processando cota Grupo ${item.numero_grupo} / Cota ${item.numero_cota} (${item.cliente_nome})...`)

    try {
      // Garante que estamos na tela de busca frmConAtSrcConsorciado
      if (!page.url().includes('frmConAtSrcConsorciado')) {
        log('Retornando à tela de localização de consorciado (frmConAtSrcConsorciado.aspx)...')
        await page.goto('https://nwcweb.randonconsorcios.com.br/CONAT/frmConAtSrcConsorciado.aspx', {
          waitUntil: 'domcontentloaded',
          timeout: 25_000,
        })
        await page.waitForTimeout(2000)
      }

      // Preenche Grupo
      const inputGrupo = page.locator('input[name*="txtST_Grupo"], input[id*="txtST_Grupo"], input[name*="Grupo"]').first()
      await inputGrupo.waitFor({ state: 'visible', timeout: 10_000 })
      await inputGrupo.fill(normalizarNumeroPortal(item.numero_grupo, 6))
      await page.waitForTimeout(400)

      // Preenche Cota
      const inputCota = page.locator('input[name*="txtST_Cota"], input[id*="txtST_Cota"], input[name*="Cota"]').first()
      await inputCota.waitFor({ state: 'visible', timeout: 8_000 })
      await inputCota.fill(normalizarNumeroPortal(item.numero_cota, 4))
      await page.waitForTimeout(400)

      // Clica em [Localizar]
      log('Clicando em [Localizar]...')
      const btnLocalizar = page.locator('input[value="Localizar"], input[id*="btnLocalizar"], button:has-text("Localizar")').first()
      await btnLocalizar.click()
      await page.waitForLoadState('domcontentloaded').catch(() => {})
      await page.waitForTimeout(3000)

      if (await page.getByText('Consorciado inválido.', { exact: true }).isVisible().catch(() => false)) {
        throw new Error('Portal retornou Consorciado inválido para o grupo/cota informado; situação financeira não comprovada.')
      }

      // Verifica se abriu a tela de atendimento ou se houve resultado
      const telaAtendimentoCarregada = page.url().includes('frmConAtCnsAtendimento') ||
        await page.locator('text=Operações').isVisible({ timeout: 5000 }).catch(() => false)

      if (!telaAtendimentoCarregada) {
        log(`Aviso: Cota ${item.numero_grupo}/${item.numero_cota} não abriu tela de atendimento. Tentando clicar no resultado da lista...`)
        const linkResultado = page.locator('table a:has-text("' + item.numero_cota + '"), table tr td a').first()
        if (await linkResultado.isVisible({ timeout: 3000 }).catch(() => false)) {
          await linkResultado.click()
          await page.waitForLoadState('domcontentloaded').catch(() => {})
          await page.waitForTimeout(3000)
        } else {
          log(`Cota ${item.numero_grupo}/${item.numero_cota} não localizada no Newcon. Pulando...`)
          await page.screenshot({ path: path.join(screenshotsDir, `cota-nao-encontrada-${item.numero_grupo}-${item.numero_cota}.png`) }).catch(() => {})
          throw new Error('Cota não localizada no portal; boleto não baixado.')
        }
      }

      await page.screenshot({ path: path.join(screenshotsDir, `racon-boletos-02-atendimento-${item.numero_grupo}-${item.numero_cota}.png`) }).catch(() => {})

      // 5. Clica em "Emissão de Cobrança" no menu lateral Operações
      log('Localizando e clicando em "Emissão de Cobrança" no menu Operações...')
      const linkEmissao = page.getByRole('link', { name: /^Emiss[ãa]o de Cobran[çc]a$/i }).filter({ visible: true }).first()
      await linkEmissao.waitFor({ state: 'visible', timeout: 15_000 })
      await linkEmissao.click()

      // Aguarda carregamento de frmConCoRelBoletoAvulso.aspx
      await page.waitForURL(url => url.pathname.includes('frmConCoRelBoletoAvulso') || url.href.includes('BoletoAvulso'), { timeout: 25_000 })
      await page.waitForLoadState('domcontentloaded').catch(() => {})
      await page.waitForTimeout(3000)
      log(`Tela de Emissão de Boleto Avulso carregada: ${page.url()}`)
      await page.screenshot({ path: path.join(screenshotsDir, `racon-boletos-03-pendencias-${item.numero_grupo}-${item.numero_cota}.png`) }).catch(() => {})

      // 6. Na tela de Boleto Avulso: seleciona a cobrança pendente
      log('Selecionando pendência de cobrança...')
      // Não selecionar diferenças negativas nem reunir parcelas de meses distintos.
      const pendencias = await page.locator('tr').evaluateAll(rows => rows.flatMap(row => {
        const checkbox = row.querySelector('input[type="image"][id*="imgEmite_Boleto"], input[type="checkbox"]')
        if (checkbox?.closest('tr') !== row) return []
        if (!checkbox) return []
        return [{ id: checkbox.id, desabilitado: checkbox.disabled, texto: [row.innerText, ...Array.from(row.querySelectorAll('input:not([type="checkbox"])')).map(el => el.value)].join(" ") }]
      }))
      const pendencia = selecionarPendenciaBoleto(pendencias, competencia.iso)
      if (!pendencia) {
        log(`Nenhuma cobrança pendente encontrada para a cota ${item.numero_grupo}/${item.numero_cota}.`)
        semCobranca++
        continue
      }
      const seletorPendencia = page.locator(`[id="${pendencia.id}"]`)
      if (await seletorPendencia.getAttribute("type") === "image") await seletorPendencia.click()
      else await seletorPendencia.check()
      await page.waitForLoadState("domcontentloaded").catch(() => {})
      await page.waitForTimeout(1000)

      // 7. Clica em [Emitir Cobrança] e captura o boleto (PDF ou Popup)
      log('Clicando no botão [Emitir Cobrança] e aguardando geração do boleto...')
      const btnEmitir = page.getByRole('button', { name: /^Emitir Cobrança$/i }).filter({ visible: true }).and(page.locator(':enabled')).first()
      await btnEmitir.waitFor({ state: 'visible', timeout: 10_000 })

      let { pdfBuffer, textoBoleto } = await capturarPdfBoleto({
        page, context, log, emitir: () => btnEmitir.click({ timeout: 15000 }),
      })

      // 8. Extração de texto via unpdf se tivermos o buffer de PDF
      if (pdfBuffer && (!textoBoleto || textoBoleto.length < 50)) {
        try {
          if (unpdf && unpdf.extractText) {
            const { text } = await unpdf.extractText(new Uint8Array(pdfBuffer))
            if (Array.isArray(text)) textoBoleto = text.join('\n')
            else if (typeof text === 'string') textoBoleto = text
          }
        } catch (pdfErr) {
          log(`Aviso ao extrair texto do PDF via unpdf: ${pdfErr.message}`)
        }
      }

      const identidadePdf = textoBoleto.match(/Grupo\s*\/\s*Cota\s*\/\s*Vers[aã]o\s*:\s*(\d+)[-\/]([0-9]+)/i)
      if (identidadePdf && (Number(identidadePdf[1]) !== Number(normalizarNumeroPortal(item.numero_grupo, 6)) || Number(identidadePdf[2]) !== Number(normalizarNumeroPortal(item.numero_cota, 4)))) {
        throw new Error('O PDF retornado pertence a outro grupo/cota; documento não será vinculado.')
      }

      // 9. Extrai QR Code Pix Copia e Cola e Linha Digitável
      const dadosExtraidos = extrairDadosBoletoTexto(textoBoleto)
      log(`Dados extraídos da cota ${item.numero_grupo}/${item.numero_cota}:`)
      log(`- Pix Copia e Cola detectado: ${dadosExtraidos.qrCodePix ? 'SIM (' + dadosExtraidos.qrCodePix.substring(0, 30) + '...)' : 'NÃO'}`)
      log(`- Linha Digitável: ${dadosExtraidos.linhaDigitavel || 'NÃO DETECTADA'}`)
      log(`- Vencimento: ${dadosExtraidos.vencimento || 'NÃO DETECTADO'} | Valor: ${dadosExtraidos.valor ?? "NÃO DETECTADO"}`)

      await salvarBoletoCota({ admin, item, competencia, pdfBuffer, dados: dadosExtraidos })
      totalBoletosBaixados++
      totalBoletosArmazenados++
      log(`Boleto da cota ${item.numero_grupo}/${item.numero_cota} salvo e vinculado em Vendas & Cotas.`)

      await page.waitForTimeout(1500)
    } catch (cotaErr) {
      totalErros++
      log(`Erro no processamento da cota ${item.numero_grupo}/${item.numero_cota}: ${cotaErr.message}`)
      await page.screenshot({ path: path.join(screenshotsDir, `erro-cota-${item.numero_grupo}-${item.numero_cota}-${Date.now()}.png`) }).catch(() => {})
    }
  }

  log('=== EXECUÇÃO DO ROBÔ DE BOLETOS FINALIZADA ===')
  log(`Total de cotas analisadas: ${listaCotas.length}`)
  log(`Total de boletos baixados: ${totalBoletosBaixados}`)
  log(`Total de boletos armazenados no Storage: ${totalBoletosArmazenados}`)

  if (totalErros) {
    throw new Error(`Boletos: ${totalBoletosArmazenados}/${listaCotas.length} salvos; ${totalErros} cotas com erro; ${semCobranca} sem cobrança disponível. Confira os logs por cota.`)
  }

  return {
    totalErros,
    semCobranca,
    cotasProcessadas: listaCotas.length,
    totalBoletosBaixados,
    totalBoletosArmazenados,
    competencia: competenciaAtual,
  }
}
