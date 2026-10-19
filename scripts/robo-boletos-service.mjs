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
import fs from 'node:fs'
import { createRequire } from 'node:module'

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
  const matchVenc = cleanText.match(vencRegex)
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

  return { qrCodePix, linhaDigitavel, vencimento, valor }
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

  const empresaId = config.empresa_id
  if (!empresaId) {
    log('Aviso: Robô sem empresa_id explícito. Buscando empresa padrão da franquia...')
  }

  // 1. Identifica a empresa alvo
  let targetEmpresaId = empresaId
  if (!targetEmpresaId) {
    const { data: emp } = await admin
      .from('empresas')
      .select('id, nome_fantasia')
      .eq('ativo', true)
      .limit(1)
      .single()
    targetEmpresaId = emp?.id
  }

  // Determina competencia atual (formato YYYY-MM e MM/YYYY)
  const agora = new Date()
  const compMes = String(agora.getMonth() + 1).padStart(2, '0')
  const compAno = agora.getFullYear()
  const competenciaAtual = `${compMes}/${compAno}`
  const competenciaIso = `${compAno}-${compMes}`

  log(`Competência de processamento: ${competenciaAtual}`)

  // 2. Busca cotas a processar
  let listaCotas = []

  const { data: cotasDb, error: errCotas } = await admin
    .from('cotas_definitivas')
    .select(`
      id,
      venda_id,
      empresa_id,
      numero_grupo,
      numero_cota,
      valor_credito,
      parcela,
      status,
      venda:vendas(id, cliente_nome, cliente_cpf_cnpj, cliente_telefone)
    `)
    .eq('empresa_id', targetEmpresaId)
    .neq('status', 'cancelada')
    .not('numero_cota', 'is', null)
    .order('numero_grupo', { ascending: true })

  if (cotasDb && cotasDb.length > 0) {
    listaCotas = cotasDb.map((c) => ({
      cota_definitiva_id: c.id,
      venda_id: c.venda_id || c.venda?.id,
      empresa_id: c.empresa_id,
      numero_grupo: String(c.numero_grupo || '').trim(),
      numero_cota: String(c.numero_cota || '').trim(),
      cliente_nome: c.venda?.cliente_nome || 'Consorciado',
      cliente_cpf_cnpj: c.venda?.cliente_cpf_cnpj || null,
      cliente_telefone: c.venda?.cliente_telefone || null,
      parcela: c.parcela,
    }))
  } else {
    // Fallback para vendas que tenham cota preenchida
    log('Buscando cotas na tabela vendas como fallback...')
    const { data: vendasDb } = await admin
      .from('vendas')
      .select('id, numero_grupo, cliente_nome, cliente_cpf_cnpj, cliente_telefone, parcela, snapshot_venda')
      .eq('empresa_id', targetEmpresaId)
      .neq('status', 'cancelada')

    if (vendasDb && vendasDb.length > 0) {
      for (const v of vendasDb) {
        const numCota = v.snapshot_venda?.numero_cota || v.snapshot_venda?.cota
        if (numCota && v.numero_grupo) {
          listaCotas.push({
            cota_definitiva_id: null,
            venda_id: v.id,
            empresa_id: targetEmpresaId,
            numero_grupo: String(v.numero_grupo).trim(),
            numero_cota: String(numCota).trim(),
            cliente_nome: v.cliente_nome,
            cliente_cpf_cnpj: v.cliente_cpf_cnpj,
            cliente_telefone: v.cliente_telefone,
            parcela: v.parcela,
          })
        }
      }
    }
  }

  log(`Total de cotas localizadas para download de boletos: ${listaCotas.length}`)

  if (listaCotas.length === 0) {
    log('Nenhuma cota com número definitivo encontrada para a franquia. Processo concluído.')
    return { totalBoletosBaixados: 0, totalBoletosArmazenados: 0, cotasProcessadas: 0 }
  }

  let totalBoletosBaixados = 0
  let totalBoletosArmazenados = 0

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
      await inputGrupo.fill(item.numero_grupo)
      await page.waitForTimeout(400)

      // Preenche Cota
      const inputCota = page.locator('input[name*="txtST_Cota"], input[id*="txtST_Cota"], input[name*="Cota"]').first()
      await inputCota.waitFor({ state: 'visible', timeout: 8_000 })
      await inputCota.fill(item.numero_cota)
      await page.waitForTimeout(400)

      // Clica em [Localizar]
      log('Clicando em [Localizar]...')
      const btnLocalizar = page.locator('input[value="Localizar"], input[id*="btnLocalizar"], button:has-text("Localizar")').first()
      await btnLocalizar.click()
      await page.waitForLoadState('domcontentloaded').catch(() => {})
      await page.waitForTimeout(3000)

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
          continue
        }
      }

      await page.screenshot({ path: path.join(screenshotsDir, `racon-boletos-02-atendimento-${item.numero_grupo}-${item.numero_cota}.png`) }).catch(() => {})

      // 5. Clica em "Emissão de Cobrança" no menu lateral Operações
      log('Localizando e clicando em "Emissão de Cobrança" no menu Operações...')
      const linkEmissao = page.locator('a:has-text("Emissão de Cobrança"), a[href*="frmConCoRelBoletoAvulso"]').first()
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
      const btnSelTodas = page.locator('input[value="Selecionar Todas"], input[id*="btnSelecionarTodas"]').first()
      const chkPendencia = page.locator('input[type="checkbox"][name*="chk"], input[type="checkbox"][id*="chk"]').first()

      if (await btnSelTodas.isVisible({ timeout: 3000 }).catch(() => false)) {
        log('Clicando em [Selecionar Todas]...')
        await btnSelTodas.click()
        await page.waitForTimeout(1000)
      } else if (await chkPendencia.isVisible({ timeout: 3000 }).catch(() => false)) {
        log('Marcando checkbox da pendência...')
        await chkPendencia.check().catch(() => chkPendencia.click())
        await page.waitForTimeout(1000)
      } else {
        log(`Nenhuma cobrança pendente encontrada para a cota ${item.numero_grupo}/${item.numero_cota}.`)
        continue
      }

      // 7. Clica em [Emitir Cobrança] e captura o boleto (PDF ou Popup)
      log('Clicando no botão [Emitir Cobrança] e aguardando geração do boleto...')
      const btnEmitir = page.locator('input[value="Emitir Cobrança"], input[id*="btnEmitirCobranca"], input[id*="btnEmitir"]').first()
      await btnEmitir.waitFor({ state: 'visible', timeout: 10_000 })

      // Prepara listeners para popup e download
      const popupPromise = context.waitForEvent('page', { timeout: 20_000 }).catch(() => null)
      const downloadPromise = page.waitForEvent('download', { timeout: 20_000 }).catch(() => null)

      await btnEmitir.click()

      const [popupPage, download] = await Promise.all([popupPromise, downloadPromise])

      let pdfBuffer = null
      let textoBoleto = ''

      if (download) {
        log('Download direto de boleto disparado pelo portal!')
        const downloadPath = path.join(downloadDir, `boleto_${item.numero_grupo}_${item.numero_cota}_${Date.now()}.pdf`)
        await download.saveAs(downloadPath)
        pdfBuffer = fs.readFileSync(downloadPath)
      } else if (popupPage) {
        log(`Popup de boleto aberto: ${popupPage.url()}`)
        await popupPage.waitForLoadState('domcontentloaded').catch(() => {})
        await popupPage.waitForTimeout(3000)

        // Se for PDF direto na URL do popup
        if (popupPage.url().endsWith('.pdf') || popupPage.url().includes('pdf')) {
          log('Popup carregou PDF diretamente.')
          const response = await popupPage.goto(popupPage.url())
          pdfBuffer = await response.body()
        } else {
          // Se for página HTML de boleto, extrai o texto do DOM e gera PDF
          log('Boleto aberto em formato HTML. Extraindo texto do DOM e gerando PDF...')
          textoBoleto = await popupPage.evaluate(() => document.body.innerText || '')
          pdfBuffer = await popupPage.pdf({ format: 'A4', printBackground: true }).catch(() => null)
        }

        await popupPage.close().catch(() => {})
      } else {
        // Se abriu na mesma página
        log('Verificando se o boleto abriu na própria página...')
        await page.waitForTimeout(3000)
        textoBoleto = await page.evaluate(() => document.body.innerText || '')
        pdfBuffer = await page.pdf({ format: 'A4', printBackground: true }).catch(() => null)
      }

      if (!pdfBuffer && !textoBoleto) {
        log(`Aviso: Não foi possível capturar o boleto da cota ${item.numero_grupo}/${item.numero_cota}.`)
        continue
      }

      totalBoletosBaixados++

      // 8. Extração de texto via unpdf se tivermos o buffer de PDF
      if (pdfBuffer && (!textoBoleto || textoBoleto.length < 50)) {
        try {
          if (unpdf && unpdf.extractText) {
            const { text } = await unpdf.extractText(pdfBuffer)
            if (Array.isArray(text)) textoBoleto = text.join('\n')
            else if (typeof text === 'string') textoBoleto = text
          }
        } catch (pdfErr) {
          log(`Aviso ao extrair texto do PDF via unpdf: ${pdfErr.message}`)
        }
      }

      // 9. Extrai QR Code Pix Copia e Cola e Linha Digitável
      const dadosExtraidos = extrairDadosBoletoTexto(textoBoleto)
      log(`Dados extraídos da cota ${item.numero_grupo}/${item.numero_cota}:`)
      log(`- Pix Copia e Cola detectado: ${dadosExtraidos.qrCodePix ? 'SIM (' + dadosExtraidos.qrCodePix.substring(0, 30) + '...)' : 'NÃO'}`)
      log(`- Linha Digitável: ${dadosExtraidos.linhaDigitavel || 'NÃO DETECTADA'}`)
      log(`- Vencimento: ${dadosExtraidos.vencimento || 'NÃO DETECTADO'} | Valor: ${dadosExtraidos.valor || item.parcela}`)

      // 10. Salva o PDF no Supabase Storage (bucket 'boletos-cotas')
      let storagePath = null
      let storageUrl = null

      if (pdfBuffer) {
        const fileName = `boletos/${targetEmpresaId}/${compAno}-${compMes}/${item.numero_grupo}_${item.numero_cota}_${Date.now()}.pdf`
        log(`Realizando upload do PDF no bucket 'boletos-cotas' (${fileName})...`)

        const { data: uploadData, error: uploadErr } = await admin.storage
          .from('boletos-cotas')
          .upload(fileName, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          })

        if (uploadErr) {
          log(`Erro no upload do storage: ${uploadErr.message}`)
        } else {
          storagePath = uploadData.path
          const { data: publicData } = admin.storage
            .from('boletos-cotas')
            .getPublicUrl(storagePath)
          storageUrl = publicData?.publicUrl || null
          log(`Boleto salvo com sucesso no Storage! URL: ${storageUrl}`)
          totalBoletosArmazenados++
        }
      }

      // 11. Grava na tabela cotas_boletos
      const payloadCotasBoletos = {
        empresa_id: targetEmpresaId,
        venda_id: item.venda_id,
        cota_definitiva_id: item.cota_definitiva_id,
        numero_grupo: item.numero_grupo,
        numero_cota: item.numero_cota,
        cliente_nome: item.cliente_nome,
        cliente_documento: item.cliente_cpf_cnpj,
        cliente_telefone: item.cliente_telefone,
        competencia: competenciaAtual,
        vencimento: dadosExtraidos.vencimento || null,
        valor: dadosExtraidos.valor || item.parcela,
        arquivo_storage_path: storagePath,
        arquivo_url: storageUrl,
        qr_code_pix: dadosExtraidos.qrCodePix,
        linha_digitavel: dadosExtraidos.linhaDigitavel,
        status: 'BAIXADO',
        origem: 'ROBO_NEWCON',
        updated_at: new Date().toISOString(),
      }

      const { error: errUpsertCotasBoletos } = await admin
        .from('cotas_boletos')
        .upsert(payloadCotasBoletos, {
          onConflict: 'empresa_id,numero_grupo,numero_cota,competencia',
        })

      if (errUpsertCotasBoletos) {
        log(`Erro ao gravar em cotas_boletos: ${errUpsertCotasBoletos.message}`)
      } else {
        log(`Registro de boleto gravado com sucesso em cotas_boletos para Grupo ${item.numero_grupo} / Cota ${item.numero_cota}!`)
      }

      // 12. Sincroniza também em vendas_boletos_envios para a interface do ERP
      if (item.venda_id) {
        const payloadVendasEnvio = {
          empresa_id: targetEmpresaId,
          venda_id: item.venda_id,
          cota_id: item.cota_definitiva_id,
          competencia: competenciaIso,
          status_boleto: 'baixado',
          baixado_em: new Date().toISOString(),
          baixado_por_nome: 'Robô Newcon Franquia',
          arquivo_storage_path: storagePath,
          arquivo_url: storageUrl,
          qr_code_pix: dadosExtraidos.qrCodePix,
          linha_digitavel: dadosExtraidos.linhaDigitavel,
          valor: dadosExtraidos.valor || item.parcela,
          vencimento: dadosExtraidos.vencimento || null,
          numero_grupo: item.numero_grupo,
          numero_cota: item.numero_cota,
          origem: 'ROBO_NEWCON',
          updated_at: new Date().toISOString(),
        }

        await admin
          .from('vendas_boletos_envios')
          .upsert(payloadVendasEnvio, {
            onConflict: 'empresa_id,venda_id,competencia',
          })
          .catch((err) => {
            log(`Aviso sync vendas_boletos_envios: ${err.message}`)
          })
      }

      await page.waitForTimeout(1500)
    } catch (cotaErr) {
      log(`Erro no processamento da cota ${item.numero_grupo}/${item.numero_cota}: ${cotaErr.message}`)
      await page.screenshot({ path: path.join(screenshotsDir, `erro-cota-${item.numero_grupo}-${item.numero_cota}-${Date.now()}.png`) }).catch(() => {})
    }
  }

  log('=== EXECUÇÃO DO ROBÔ DE BOLETOS FINALIZADA COM SUCESSO ===')
  log(`Total de cotas analisadas: ${listaCotas.length}`)
  log(`Total de boletos baixados: ${totalBoletosBaixados}`)
  log(`Total de boletos armazenados no Storage: ${totalBoletosArmazenados}`)

  return {
    cotasProcessadas: listaCotas.length,
    totalBoletosBaixados,
    totalBoletosArmazenados,
    competencia: competenciaAtual,
  }
}
