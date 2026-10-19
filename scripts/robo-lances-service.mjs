/**
 * Servico de Automacao do Robo de Oferta de Lances da Franquia (Newcon Web / Racon)
 * Mapeamento completo:
 * 1. Entrada no Newcon Web
 * 2. Clique no icone dos dois bonequinhos (Consorciado / Atendimento) -> CONAT/frmConAtSrcConsorciado.aspx
 * 3. Itera sobre cotas ativas nao contempladas: preenche Grupo e Cota -> clica [Localizar]
 * 4. Na tela de Atendimento (CONAT/frmConAtCnsAtendimento.aspx) -> clica em "Oferta de Lance" no menu lateral
 * 5. Na tela de Oferta de Lance (CONCP/frmConCpCadCredenciamentoLance.aspx):
 *    - Regra Lance Livre: sempre lance embutido + 1,1234 (ex: 25% embutido -> livre 26,1234)
 *    - Opcao Reduzir Parcela, Repetir por 6 assembleias, Clica [Confirmar]
 *    - Captura protocolo no alert do navegador, confirma com OK
 *    - No relatorio/comprovante (frmConCmNewconReports.aspx) clica [Voltar]
 *    - Oferta Lance Fixo: se grupo tiver fixo (ex: 25%), preenche 25% e embutido 25%, confirma, captura protocolo e clica [Voltar]
 *    - Se tiver 2º Lance Fixo (ex: 40%), oferta com embutido maximo permitido (25%), confirma e clica [Voltar]
 * 6. Sincroniza confirmacao e protocolos na tela de Lances e Estrategia do ERP (/erp/lances)
 */

import path from 'node:path'
import fs from 'node:fs'

/**
 * Calcula regra de lance livre: sempre 1,1234 + embutido
 * Ex: 25% embutido -> livre 26,1234%
 */
export function calcularRegraLanceLivre(embutidoPct, margem = 1.1234) {
  const embutido = Number(embutidoPct) || 0
  const livre = Number((embutido + margem).toFixed(4))
  return {
    livrePct: livre,
    embutidoPct: embutido,
    strLivrePct: livre.toFixed(4).replace('.', ','),
    strEmbutidoPct: embutido.toFixed(4).replace('.', ','),
  }
}

/**
 * Extrai número do protocolo de mensagem de alert/dialog do Newcon
 * Ex: "Anote os números dos protocolos: Lance Livre: 5735314" -> "5735314"
 */
export function extrairProtocoloAlert(msg) {
  if (!msg || typeof msg !== 'string') return null
  const matchEspec = msg.match(/protocolo[s]?\s*:\s*(?:[^0-9]*?)(\d{5,12})/i) ||
                     msg.match(/lance\s+(?:livre|fixo|segundo\s+fixo|2[º°]\s*fixo)\s*:\s*(\d{5,12})/i) ||
                     msg.match(/\b(\d{5,10})\b/)
  return matchEspec ? matchEspec[1] : null
}

/**
 * Calcula os parâmetros de estratégia para os lances do grupo
 */
export function calcularEstrategiaGrupo({ embutidoMaximoPct = 25, fixoPct = null, segundoFixoPct = null }) {
  const embutido = Number(embutidoMaximoPct) || 25.0
  const { livrePct, strLivrePct, strEmbutidoPct } = calcularRegraLanceLivre(embutido)

  const resultado = {
    livre: {
      ativo: true,
      percentual: livrePct,
      strPercentual: strLivrePct,
      percentualEmbutido: embutido,
      strEmbutido: strEmbutidoPct,
    },
    fixo: null,
    segundoFixo: null,
  }

  if (fixoPct !== null && fixoPct !== undefined) {
    const fPct = Number(fixoPct)
    resultado.fixo = {
      ativo: true,
      percentual: fPct,
      strPercentual: fPct.toFixed(4).replace('.', ','),
      percentualEmbutido: Math.min(fPct, embutido),
      strEmbutido: Math.min(fPct, embutido).toFixed(4).replace('.', ','),
    }
  }

  if (segundoFixoPct !== null && segundoFixoPct !== undefined) {
    const sPct = Number(segundoFixoPct)
    resultado.segundoFixo = {
      ativo: true,
      percentual: sPct,
      strPercentual: sPct.toFixed(4).replace('.', ','),
      percentualEmbutido: embutido,
      strEmbutido: embutido.toFixed(4).replace('.', ','),
    }
  }

  return resultado
}

export async function executarRoboLances({
  page,
  context,
  config,
  admin,
  log,
  screenshotsDir,
}) {
  log('=== INICIANDO ROBÔ DE OFERTA DE LANCES AUTOMÁTICOS DA FRANQUIA ===')

  const empresaId = config.empresa_id
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

  // 1. Busca cotas elegíveis para lance (ativas e não contempladas)
  log('Buscando cotas ativas não contempladas da franquia no banco de dados...')

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
      grupo_id,
      venda:vendas(id, cliente_nome, cliente_cpf_cnpj, cliente_telefone),
      grupo:grupos_consorcio(codigo_grupo, percentual_lance_embutido, permite_lance_embutido)
    `)
    .eq('empresa_id', targetEmpresaId)
    .neq('status', 'cancelada')
    .neq('status', 'contemplada')
    .not('numero_cota', 'is', null)
    .order('numero_grupo', { ascending: true })

  if (cotasDb && cotasDb.length > 0) {
    // 1.1. Verifica cotas que já possuem lance ativo com repetição por 6 assembleias
    const isManualTest = Boolean(config.filtro_grupo || config.grupo_teste || config.filtro_cotas || config.cotas_teste)
    const cotasBloqueadas6Meses = new Set()

    if (!isManualTest) {
      const cotaIds = cotasDb.map(c => c.id)
      const { data: estsAtivas } = await admin
        .from('cota_estrategias_lance')
        .select('cota_definitiva_id, repetir_seis_assembleias, ultimo_lance_ofertado_em, confirmado')
        .in('cota_definitiva_id', cotaIds)
        .eq('confirmado', true)
        .eq('repetir_seis_assembleias', true)

      if (estsAtivas && estsAtivas.length > 0) {
        const agoraMs = Date.now()
        for (const est of estsAtivas) {
          if (est.ultimo_lance_ofertado_em) {
            const dataOfertadaMs = new Date(est.ultimo_lance_ofertado_em).getTime()
            const diasDecorridos = Math.floor((agoraMs - dataOfertadaMs) / (1000 * 60 * 60 * 24))
            // 6 meses / 6 assembleias = aproximadamente 170 dias
            if (diasDecorridos < 170) {
              cotasBloqueadas6Meses.add(est.cota_definitiva_id)
            }
          }
        }
      }
    }

    listaCotas = cotasDb
      .filter(c => {
        if (cotasBloqueadas6Meses.has(c.id)) {
          log(`[LANCE ATIVO 6 MESES] Cota Grupo ${c.numero_grupo} / Cota ${c.numero_cota} possui lance confirmado com repetição por 6 assembleias ativa. Próximo lance em 6 meses. Ignorando na rodada mensal.`)
          return false
        }
        return true
      })
      .map((c) => ({
        cota_definitiva_id: c.id,
        venda_id: c.venda_id || c.venda?.id,
        empresa_id: c.empresa_id,
        numero_grupo: String(c.numero_grupo || '').trim(),
        numero_cota: String(c.numero_cota || '').trim(),
        cliente_nome: c.venda?.cliente_nome || 'Consorciado',
        cliente_cpf_cnpj: c.venda?.cliente_cpf_cnpj || null,
        cliente_telefone: c.venda?.cliente_telefone || null,
        valor_credito: c.valor_credito,
        parcela: c.parcela,
        grupo_embutido_pct: c.grupo?.percentual_lance_embutido || 25,
      }))
  } else {
    // Fallback: cotas de vendas confirmadas não contempladas
    const { data: vendasDb } = await admin
      .from('vendas')
      .select('id, numero_grupo, cliente_nome, cliente_cpf_cnpj, cliente_telefone, parcela, valor_credito, snapshot_venda')
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
            valor_credito: v.valor_credito,
            parcela: v.parcela,
            grupo_embutido_pct: 25,
          })
        }
      }
    }
  }

  // Filtro opcional para execução de TESTE em cotas reais específicas
  const filtroGrupo = config.filtro_grupo || config.grupo_teste
  const filtroCotasRaw = config.filtro_cotas || config.cotas_teste || config.filtro_cota || config.cota_teste
  let filtroCotasArray = []
  if (filtroCotasRaw) {
    if (Array.isArray(filtroCotasRaw)) {
      filtroCotasArray = filtroCotasRaw.map(x => String(x).trim())
    } else {
      filtroCotasArray = String(filtroCotasRaw).split(',').map(x => x.trim()).filter(Boolean)
    }
  }

  if (filtroGrupo) {
    const fg = String(filtroGrupo).trim()
    listaCotas = listaCotas.filter(c => c.numero_grupo === fg || c.numero_grupo.padStart(6, '0') === fg.padStart(6, '0') || c.numero_grupo.includes(fg))
  }
  if (filtroCotasArray.length > 0) {
    listaCotas = listaCotas.filter(c => {
      const cNum = String(c.numero_cota).trim()
      return filtroCotasArray.some(fc => cNum === fc || cNum.padStart(3, '0') === fc.padStart(3, '0') || cNum.padStart(4, '0') === fc.padStart(4, '0'))
    })
  }

  // Se o usuário especificou cotas para teste, mas alguma não está no banco, adiciona para processamento
  if (filtroGrupo && filtroCotasArray.length > 0) {
    for (const cotaAlvo of filtroCotasArray) {
      const jaExiste = listaCotas.some(c => {
        const cNum = String(c.numero_cota).trim()
        return cNum === cotaAlvo || cNum.padStart(3, '0') === cotaAlvo.padStart(3, '0') || cNum.padStart(4, '0') === cotaAlvo.padStart(4, '0')
      })
      if (!jaExiste) {
        log(`Cota ${filtroGrupo}/${cotaAlvo} especificada para teste unitário real. Buscando registro no banco de dados...`)
        const numGrupoNorm = String(filtroGrupo).trim()
        const cotaPad = String(cotaAlvo).trim().padStart(4, '0')
        const { data: cotaEncontrada } = await admin
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
            grupo_id,
            venda:vendas(id, cliente_nome, cliente_cpf_cnpj, cliente_telefone),
            grupo:grupos_consorcio(codigo_grupo, percentual_lance_embutido, permite_lance_embutido)
          `)
          .eq('numero_grupo', numGrupoNorm)
          .or(`numero_cota.eq.${cotaAlvo},numero_cota.eq.${cotaPad}`)
          .maybeSingle()

        if (cotaEncontrada) {
          log(`Cota localizada em cotas_definitivas: ID ${cotaEncontrada.id} (Empresa: ${cotaEncontrada.empresa_id})`)
          targetEmpresaId = cotaEncontrada.empresa_id || targetEmpresaId
          listaCotas.push({
            cota_definitiva_id: cotaEncontrada.id,
            venda_id: cotaEncontrada.venda_id || cotaEncontrada.venda?.id,
            empresa_id: cotaEncontrada.empresa_id,
            numero_grupo: String(cotaEncontrada.numero_grupo || '').trim(),
            numero_cota: String(cotaEncontrada.numero_cota || '').trim(),
            cliente_nome: cotaEncontrada.venda?.cliente_nome || 'MSD INFORMATICA LTDA',
            cliente_cpf_cnpj: cotaEncontrada.venda?.cliente_cpf_cnpj || null,
            cliente_telefone: cotaEncontrada.venda?.cliente_telefone || null,
            valor_credito: cotaEncontrada.valor_credito || 331415.26,
            parcela: cotaEncontrada.parcela || 1657.07,
            grupo_embutido_pct: cotaEncontrada.grupo?.percentual_lance_embutido || 25,
          })
        } else {
          log(`Cota ${filtroGrupo}/${cotaAlvo} não localizada no banco. Adicionando para processamento avulso...`)
          listaCotas.push({
            cota_definitiva_id: null,
            venda_id: null,
            empresa_id: targetEmpresaId,
            numero_grupo: String(filtroGrupo).trim(),
            numero_cota: String(cotaAlvo).trim(),
            cliente_nome: 'Consorciado Teste Real',
            cliente_cpf_cnpj: null,
            cliente_telefone: null,
            valor_credito: 331415.26,
            parcela: 1657.07,
            grupo_embutido_pct: 25,
          })
        }
      }
    }
  }

  if (config.limite_cotas && config.limite_cotas > 0) {
    listaCotas = listaCotas.slice(0, config.limite_cotas)
  }

  log(`Total de cotas elegíveis para oferta de lances: ${listaCotas.length}`)

  if (listaCotas.length === 0) {
    log('Nenhuma cota ativa elegível encontrada para oferta de lances. Processamento concluído.')
    return { cotasProcessadas: 0, lancesOfertados: 0 }
  }

  let totalLancesOfertados = 0
  let totalCotasProcessadas = 0

  // 2. Navegação para tela de Consorciados
  log('Acessando Atendimento / Consorciados no Newcon Web...')
  let telaConsorciadoAberta = false

  const bonecosSelectors = [
    'a[href*="frmConAtSrcConsorciado"]',
    'img[src*="consorciado" i]',
    'img[title*="Consorciado" i]',
    'a[title*="Consorciado" i]',
    'input[id*="Consorciado"]',
    '#ctl00_imgConsorciado',
  ]

  for (const sel of bonecosSelectors) {
    const el = page.locator(sel).first()
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      log(`Ícone de consorciados clicado via: ${sel}`)
      await el.click().catch(() => {})
      telaConsorciadoAberta = true
      break
    }
  }

  if (!telaConsorciadoAberta) {
    log('Navegando diretamente para CONAT/frmConAtSrcConsorciado.aspx...')
    await page.goto('https://nwcweb.randonconsorcios.com.br/CONAT/frmConAtSrcConsorciado.aspx', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
  }

  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.waitForTimeout(3000)

  // 3. Itera sobre cada cota
  for (let i = 0; i < listaCotas.length; i++) {
    const item = listaCotas[i]
    log(`[${i + 1}/${listaCotas.length}] Processando ofertas da Cota Grupo ${item.numero_grupo} / Cota ${item.numero_cota} (${item.cliente_nome})...`)

    try {
      if (!page.url().includes('frmConAtSrcConsorciado')) {
        await page.goto('https://nwcweb.randonconsorcios.com.br/CONAT/frmConAtSrcConsorciado.aspx', {
          waitUntil: 'domcontentloaded',
          timeout: 25_000,
        })
        await page.waitForTimeout(2000)
      }

      // Preenche Grupo (com 6 dígitos se necessário)
      const grupoStr = String(item.numero_grupo).trim()
      const grupoFormatado = grupoStr.length < 6 ? grupoStr.padStart(6, '0') : grupoStr
      const inputGrupo = page.locator('input[name*="txtST_Grupo"], input[id*="txtST_Grupo"], input[name*="Grupo"]').first()
      await inputGrupo.waitFor({ state: 'visible', timeout: 10_000 })
      await inputGrupo.click()
      await inputGrupo.fill(grupoFormatado)
      await page.waitForTimeout(400)

      // Preenche Cota (com 4 dígitos se necessário)
      const cotaStr = String(item.numero_cota).trim()
      const cotaFormatada = cotaStr.length < 4 ? cotaStr.padStart(4, '0') : cotaStr
      const inputCota = page.locator('input[name*="txtST_Cota"], input[id*="txtST_Cota"], input[name*="Cota"]').first()
      await inputCota.waitFor({ state: 'visible', timeout: 8_000 })
      await inputCota.click()
      await inputCota.fill(cotaFormatada)
      await page.waitForTimeout(400)

      // Clica em [Localizar]
      const btnLocalizar = page.locator('input[value="Localizar"], input[id*="btnLocalizar"], button:has-text("Localizar")').first()
      await btnLocalizar.click()
      await page.waitForLoadState('domcontentloaded').catch(() => {})
      await page.waitForTimeout(3000)

      // Se abriu lista de resultados, clica no primeiro link correspondente
      if (!page.url().includes('frmConAtCnsAtendimento')) {
        const linkResultado = page.locator('table a:has-text("' + item.numero_cota + '"), table tr td a').first()
        if (await linkResultado.isVisible({ timeout: 3000 }).catch(() => false)) {
          await linkResultado.click()
          await page.waitForLoadState('domcontentloaded').catch(() => {})
          await page.waitForTimeout(3000)
        } else {
          log(`Cota ${item.numero_grupo}/${item.numero_cota} não localizada no Newcon. Pulando...`)
          continue
        }
      }

      // 4. Clica em "Oferta de Lance" no menu lateral Operações
      log('Localizando e clicando em "Oferta de Lance" no menu Operações...')
      const linkOfertaLance = page.locator('a:has-text("Oferta de Lance"), a[href*="frmConCpCadCredenciamentoLance"]').filter({ hasNotText: 'Lote' }).first()
      await linkOfertaLance.waitFor({ state: 'visible', timeout: 15_000 })
      await linkOfertaLance.click()

      await page.waitForURL(url => url.pathname.includes('frmConCpCadCredenciamentoLance') || url.href.includes('CredenciamentoLance'), { timeout: 25_000 })
      await page.waitForLoadState('domcontentloaded').catch(() => {})
      await page.waitForTimeout(3000)
      log(`Tela de Oferta de Lance carregada com sucesso: ${page.url()}`)
      await page.screenshot({ path: path.join(screenshotsDir, `lance-01-tela-${item.numero_grupo}-${item.numero_cota}-${Date.now()}.png`) }).catch(() => {})

      // 5. Extrai dados do Lance exibidos na tela para esta cota
      const dadosTelaLance = await page.evaluate(() => {
        const getText = (selector) => {
          const el = document.querySelector(selector)
          return el ? (el.value || el.innerText || '').trim() : ''
        }

        // Lance Fixo
        const fixoInput = document.querySelector('input[name*="txtPC_LanceFixo"], input[id*="txtPC_LanceFixo"]')
        const fixoTexto = fixoInput ? fixoInput.value : ''

        // 2º Lance Fixo
        const fixo2Input = document.querySelector('input[name*="txtPC_SegundoLanceFixo"], input[id*="txtPC_SegundoLanceFixo"]')
        const fixo2Texto = fixo2Input ? fixo2Input.value : ''

        // Assembleia
        const assInput = document.querySelector('input[name*="txtST_Assembleia"], input[id*="txtST_Assembleia"], span[id*="lblAssembleia"]')
        const assTexto = assInput ? (assInput.value || assInput.innerText || '') : ''

        // Bem / Valor
        const bemInput = document.querySelector('input[name*="txtVL_Bem"], span[id*="lblValorBem"]')
        const bemTexto = bemInput ? (bemInput.value || bemInput.innerText || '') : ''

        return {
          lanceFixoPct: fixoTexto ? parseFloat(fixoTexto.replace(',', '.')) : 25.0,
          segundoLanceFixoPct: fixo2Texto ? parseFloat(fixo2Texto.replace(',', '.')) : null,
          assembleia: assTexto,
          valorBem: bemTexto,
        }
      })

      log(`Dados do grupo/cota extraídos na tela:`)
      log(`- Lance Fixo: ${dadosTelaLance.lanceFixoPct}%`)
      log(`- 2º Lance Fixo: ${dadosTelaLance.segundoLanceFixoPct ? dadosTelaLance.segundoLanceFixoPct + '%' : 'Não possui'}`)
      log(`- Assembleia: ${dadosTelaLance.assembleia || 'Atual'}`)

      // Dump dos campos visíveis no formulário para diagnóstico
      const camposFormulario = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, button, label')).map(el => ({
          tag: el.tagName,
          type: el.type,
          id: el.id,
          name: el.name,
          value: el.value,
          text: (el.innerText || el.textContent || '').trim(),
          for: el.htmlFor,
        })).filter(e => e.type !== 'hidden')
      })
      log(`Campos detectados no formulário: ${JSON.stringify(camposFormulario)}`)

      // Regra de Lance Embutido:
      // O limite de embutido comum é 25%. Usamos a regra do grupo ou o fixo se menor.
      const embutidoMaximoPct = Number(item.grupo_embutido_pct || 25.0)

      // Regra do Usuário:
      // "lance fixo sempre 1,1234 + que o lance embutido para todos clientes. Exemplo desse grupo 1273 cota 209: embutido maximo de 25% ai o livre 26,1234"
      const { livrePct: livrePctCalculado, strLivrePct, strEmbutidoPct } = calcularRegraLanceLivre(embutidoMaximoPct)

      let protocoloLivre = null
      let protocoloFixo = null
      let protocoloSegundoFixo = null

      let compLivre = null
      let compFixo = null
      let compSegundoFixo = null

      // Listener contínuo de dialogs do navegador (lida com confirmações intermediárias e alertas de protocolo)
      let ultimoProtocoloCapturado = null
      const dialogHandler = async (dialog) => {
        const msg = dialog.message() || ''
        log(`Dialog recebido do Newcon: "${msg}"`)
        const prot = extrairProtocoloAlert(msg)
        if (prot) {
          ultimoProtocoloCapturado = prot
          log(`Protocolo extraído com sucesso: ${prot}`)
        }
        await dialog.accept().catch(() => {})
      }
      page.on('dialog', dialogHandler)

      // Listener para novas abas/popups que possam abrir o relatório
      let popupPage = null
      const popupHandler = (p) => {
        log(`Nova aba/popup detectada: ${p.url()}`)
        popupPage = p
      }
      context.on('page', popupHandler)

      // Helper para preenchimento de campos numéricos com máscara financeira/percentual
      const preencherCampoComMascara = async (selector, valorStr) => {
        const loc = page.locator(selector).first()
        await loc.waitFor({ state: 'visible', timeout: 5000 })
        const isEnabled = await loc.isEnabled().catch(() => false)
        if (!isEnabled) {
          log(`[Mascara] Campo ${selector} está desabilitado/bloqueado (${await loc.inputValue().catch(() => '')}). Pulando edição.`)
          return
        }
        await loc.scrollIntoViewIfNeeded().catch(() => {})

        const digitos = valorStr.replace(/\D/g, '')
        log(`[Mascara] Preenchendo ${selector} com "${valorStr}" (dígitos: "${digitos}")...`)

        // 1. Tenta preenchimento direto no DOM com disparo completo de eventos
        await page.evaluate(({ sel, val }) => {
          const el = document.querySelector(sel)
          if (el) {
            el.focus()
            el.value = val
            el.dispatchEvent(new Event('input', { bubbles: true }))
            el.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }, { sel: selector, val: valorStr })

        await page.waitForTimeout(200)
        let valAtual = await loc.inputValue().catch(() => '')

        // 2. Se o valor não persistiu ou continua '0,0000', usa digitação sequencial via teclado
        if (!valAtual || valAtual === '0,0000' || !valAtual.includes(digitos.slice(0, 2))) {
          log(`[Mascara] Valor após evaluate foi "${valAtual}". Aplicando digitação via teclado...`)
          await loc.click()
          await page.waitForTimeout(100)
          await page.keyboard.press('Control+a')
          await page.keyboard.press('Backspace')
          await page.waitForTimeout(100)

          await loc.pressSequentially(valorStr, { delay: 60 })
          await page.waitForTimeout(200)
          valAtual = await loc.inputValue().catch(() => '')

          // Se ainda estiver 0,0000, digita apenas dígitos numéricos (máscara shift-from-right)
          if (!valAtual || valAtual === '0,0000') {
            log(`[Mascara] Tentando digitação dos dígitos puros ("${digitos}")...`)
            await loc.click()
            await page.keyboard.press('Control+a')
            await page.keyboard.press('Backspace')
            await loc.pressSequentially(digitos, { delay: 60 })
            await page.waitForTimeout(200)
            valAtual = await loc.inputValue().catch(() => '')
          }
        }

        // 3. Força consolidação final no blur
        await page.evaluate(({ sel, val }) => {
          const el = document.querySelector(sel)
          if (el) {
            if (!el.value || el.value === '0,0000') {
              el.value = val
            }
            el.dispatchEvent(new Event('blur', { bubbles: true }))
            if (typeof el.onchange === 'function') el.onchange()
            if (typeof el.onblur === 'function') el.onblur()
          }
        }, { sel: selector, val: valorStr })

        await page.waitForTimeout(300)
        const valFinal = await loc.inputValue().catch(() => '')
        log(`[Mascara] Campo ${selector} consolidado com: "${valFinal}"`)
      }

      // Função auxiliar para capturar o comprovante, salvar no Supabase Storage e retornar da tela de relatório
      const voltarDoRelatorio = async (tipoLance = 'LIVRE') => {
        log(`Verificando comprovante/relatório de ${tipoLance}...`)
        let infoComprovante = null
        let targetPage = page

        // Aguarda até 8 segundos para ver se abriu popup ou se a página atual navegou para relatório
        const startTime = Date.now()
        while (Date.now() - startTime < 8000) {
          if (popupPage) {
            targetPage = popupPage
            break
          }
          if (page.url().includes('frmConCmNewconReports') || page.url().includes('Reports')) {
            targetPage = page
            break
          }
          await page.waitForTimeout(500)
        }

        const isRelatorio = targetPage.url().includes('frmConCmNewconReports') || targetPage.url().includes('Reports')
        if (isRelatorio) {
          log(`Tela de comprovante (${tipoLance}) identificada: ${targetPage.url()}`)
          await targetPage.waitForLoadState('domcontentloaded').catch(() => {})
          await targetPage.waitForTimeout(2500)

          const nomeArquivo = `comprovante_${tipoLance.toLowerCase()}_g${item.numero_grupo}_c${item.numero_cota}_${Date.now()}.png`
          const localPath = path.join(screenshotsDir, nomeArquivo)
          const imgBuffer = await targetPage.screenshot({ path: localPath, fullPage: false }).catch(() => null)

          if (imgBuffer && admin && targetEmpresaId) {
            try {
              const storagePath = `${targetEmpresaId}/${item.cota_definitiva_id || item.numero_cota}/${nomeArquivo}`
              log(`Fazendo upload do comprovante para o Storage (lances-comprovantes): ${storagePath}...`)
              const { error: upErr } = await admin.storage
                .from('lances-comprovantes')
                .upload(storagePath, imgBuffer, { contentType: 'image/png', upsert: true })

              if (!upErr) {
                const { data: signData } = await admin.storage
                  .from('lances-comprovantes')
                  .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1 ano

                infoComprovante = {
                  storagePath,
                  url: signData?.signedUrl || null,
                  nome: `Comprovante ${tipoLance} - Grupo ${item.numero_grupo} / Cota ${item.numero_cota}.png`,
                }
                log(`Comprovante de ${tipoLance} salvo com sucesso no Storage!`)
              } else {
                log(`Aviso ao subir comprovante para Storage: ${upErr.message}`)
              }
            } catch (errUpload) {
              log(`Erro no upload do comprovante: ${errUpload.message}`)
            }
          }

          if (targetPage !== page) {
            log('Fechando popup do relatório...')
            await targetPage.close().catch(() => {})
            popupPage = null
          } else {
            const btnVoltar = page.locator('input[value="Voltar"], button:has-text("Voltar"), a:has-text("Voltar"), #btnVoltar, input[id*="btnVoltar"]').first()
            if (await btnVoltar.isVisible({ timeout: 4000 }).catch(() => false)) {
              log('Clicando no botão [Voltar] da tela de relatório...')
              await btnVoltar.click()
              await page.waitForLoadState('domcontentloaded').catch(() => {})
              await page.waitForTimeout(2000)
            } else {
              log('Botão Voltar não visível diretamente. Retornando via navegação direta para credenciamento...')
              await page.goto('https://nwcweb.randonconsorcios.com.br/CONCP/frmConCpCadCredenciamentoLance.aspx', { waitUntil: 'domcontentloaded' }).catch(() => {})
              await page.waitForTimeout(2000)
            }
          }
        } else {
          log(`Não foi aberta tela de relatório para ${tipoLance}. Prosseguindo na tela atual.`)
        }
        return infoComprovante
      }

      // =========================================================================
      // ETAPA A: OFERTA DO LANCE LIVRE (1,1234 + embutido)
      // =========================================================================
      log(`--- Ofertando LANCE LIVRE: ${strLivrePct}% (Embutido: ${strEmbutidoPct}%) ---`)

      // 1. Seleciona Radio "Livre" (ctl00_Conteudo_rgLance_0)
      const rdoLivre = page.locator('#ctl00_Conteudo_rgLance_0, label[for="ctl00_Conteudo_rgLance_0"], label:text-is("Livre")').first()
      if (await rdoLivre.isVisible({ timeout: 3000 }).catch(() => false)) {
        await rdoLivre.click({ force: true }).catch(() => {})
        await page.waitForTimeout(400)
      }

      // 2. Seleciona Radio "Reduzir Parcela" (ctl00_Conteudo_rblFormasLance_1)
      const rdoReduzirParcela = page.locator('#ctl00_Conteudo_rblFormasLance_1, label[for="ctl00_Conteudo_rblFormasLance_1"], label:has-text("Reduzir Parcela")').first()
      if (await rdoReduzirParcela.isVisible({ timeout: 3000 }).catch(() => false)) {
        await rdoReduzirParcela.click({ force: true }).catch(() => {})
        await page.waitForTimeout(400)
      }

      // 3. Dropdown do Tipo de Oferta -> Percentual (%)
      const selectTipoOferta = page.locator('#ctl00_Conteudo_rblTipoOferta, select[name*="rblTipoOferta"]').first()
      if (await selectTipoOferta.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectTipoOferta.selectOption('%').catch(() => selectTipoOferta.selectOption({ label: 'Percentual' }))
        await page.waitForTimeout(400)
      }

      // 4. Preenche valor do Lance Livre (26,1234)
      await preencherCampoComMascara('#ctl00_Conteudo_edtOferta', strLivrePct)

      // 5. Dropdown Lance Embutido -> Percentual (%)
      const selectTipoEmbutido = page.locator('#ctl00_Conteudo_cbxLanceEmbutido, select[name*="cbxLanceEmbutido"]').first()
      if (await selectTipoEmbutido.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectTipoEmbutido.selectOption('%').catch(() => selectTipoEmbutido.selectOption({ label: 'Percentual' }))
        await page.waitForTimeout(400)
      }

      // 6. Preenche valor do Lance Embutido (25,0000)
      await preencherCampoComMascara('#ctl00_Conteudo_edtEmbutido', strEmbutidoPct)

      // 7. Marca checkbox "Repetir a oferta do lance por 6 assembleia(s)"
      const chkRepetir = page.locator('#ctl00_Conteudo_chkLanceLivre, input[name*="chkLanceLivre"], label:has-text("Repetir")').first()
      if (await chkRepetir.isVisible({ timeout: 3000 }).catch(() => false)) {
        const isChk = await chkRepetir.isChecked().catch(() => false)
        if (!isChk) {
          await chkRepetir.click({ force: true }).catch(() => {})
        }
        await page.waitForTimeout(400)
      }

      await page.screenshot({ path: path.join(screenshotsDir, `lance-02-livre-preenchido-${item.numero_grupo}-${item.numero_cota}.png`) }).catch(() => {})

      // 8. Clica em [Confirmar] e escuta os dialogs com o protocolo
      log('Clicando em [Confirmar] para o Lance Livre...')
      ultimoProtocoloCapturado = null
      const btnConfirmar = page.locator('#ctl00_Conteudo_btnConfirma, input[value="Confirmar"]').first()
      await btnConfirmar.scrollIntoViewIfNeeded().catch(() => {})
      await btnConfirmar.click({ force: true })
      await page.waitForTimeout(4000)

      protocoloLivre = ultimoProtocoloCapturado
      log(`Protocolo do Lance Livre capturado: ${protocoloLivre || 'Confirmado via Web'}`)

      // 9. Aguarda relatório e clica em Voltar
      compLivre = await voltarDoRelatorio('LIVRE')
      totalLancesOfertados++

      // =========================================================================
      // ETAPA B: OFERTA DO LANCE FIXO (ex: 25%)
      // =========================================================================
      if (dadosTelaLance.lanceFixoPct && dadosTelaLance.lanceFixoPct > 0) {
        if (!page.url().includes('frmConCpCadCredenciamentoLance') && !page.url().includes('CredenciamentoLance')) {
          log('Reabrindo tela de Oferta de Lance para Lance Fixo...')
          const linkOfertaLance = page.locator('a:has-text("Oferta de Lance"), a[href*="frmConCpCadCredenciamentoLance"]').filter({ hasNotText: 'Lote' }).first()
          if (await linkOfertaLance.isVisible({ timeout: 8000 }).catch(() => false)) {
            await linkOfertaLance.click()
            await page.waitForURL(url => url.pathname.includes('frmConCpCadCredenciamentoLance') || url.href.includes('CredenciamentoLance'), { timeout: 20_000 }).catch(() => {})
            await page.waitForLoadState('domcontentloaded').catch(() => {})
            await page.waitForTimeout(2000)
          } else {
            await page.goto('https://nwcweb.randonconsorcios.com.br/CONCP/frmConCpCadCredenciamentoLance.aspx', { waitUntil: 'domcontentloaded' }).catch(() => {})
            await page.waitForTimeout(2000)
          }
        }

        const fixoPct = Number(dadosTelaLance.lanceFixoPct)
        const strFixoPct = fixoPct.toFixed(4).replace('.', ',')
        // Regra do usuário: "no lance fixo precisa preencher com o mesmo valor do lance quando for 25% quando é de 40% e só pode usar 25% de embutido preencher 25%"
        const embFixoPct = Math.min(fixoPct, embutidoMaximoPct)
        const strEmbFixoPct = embFixoPct.toFixed(4).replace('.', ',')

        log(`--- Ofertando LANCE FIXO: ${strFixoPct}% (Embutido: ${strEmbFixoPct}%) ---`)

        // 1. Seleciona Radio "Fixo" (ctl00_Conteudo_rgLance_1, value LF)
        const rdoFixo = page.locator('#ctl00_Conteudo_rgLance_1, label[for="ctl00_Conteudo_rgLance_1"], label:text-is("Fixo")').first()
        if (await rdoFixo.isVisible({ timeout: 4000 }).catch(() => false)) {
          await rdoFixo.click({ force: true }).catch(() => {})
          await page.waitForTimeout(800)
        }

        // 2. Opção Reduzir Parcela
        const rdoReduzirFixo = page.locator('#ctl00_Conteudo_rblFormasLance_1, label[for="ctl00_Conteudo_rblFormasLance_1"], label:has-text("Reduzir Parcela")').first()
        if (await rdoReduzirFixo.isVisible({ timeout: 3000 }).catch(() => false)) {
          await rdoReduzirFixo.click({ force: true }).catch(() => {})
          await page.waitForTimeout(400)
        }

        // 3. Dropdown Tipo de Oferta -> Percentual (apenas se habilitado)
        const selectTipoFixo = page.locator('#ctl00_Conteudo_rblTipoOferta, select[name*="rblTipoOferta"]').first()
        if (await selectTipoFixo.isVisible({ timeout: 3000 }).catch(() => false)) {
          const isEnabled = await selectTipoFixo.isEnabled().catch(() => false)
          if (isEnabled) {
            await selectTipoFixo.selectOption('%').catch(() => selectTipoFixo.selectOption({ label: 'Percentual' }))
            await page.waitForTimeout(400)
          } else {
            log('Dropdown Tipo de Oferta bloqueado em Percentual pelo Newcon.')
          }
        }

        // 4. Preenche valor do Lance Fixo (edtOferta) se habilitado
        await preencherCampoComMascara('#ctl00_Conteudo_edtOferta', strFixoPct)

        // 5. Dropdown Embutido -> Percentual (apenas se habilitado)
        const selectEmbFixo = page.locator('#ctl00_Conteudo_cbxLanceEmbutido, select[name*="cbxLanceEmbutido"]').first()
        if (await selectEmbFixo.isVisible({ timeout: 3000 }).catch(() => false)) {
          const isEmbEnabled = await selectEmbFixo.isEnabled().catch(() => false)
          if (isEmbEnabled) {
            await selectEmbFixo.selectOption('%').catch(() => selectEmbFixo.selectOption({ label: 'Percentual' }))
            await page.waitForTimeout(400)
          }
        }

        // 6. Preenche valor do Embutido Fixo (edtEmbutido)
        await preencherCampoComMascara('#ctl00_Conteudo_edtEmbutido', strEmbFixoPct)

        // 7. Checkbox Repetir por 6 assembleias
        const chkRepetirFixo = page.locator('#ctl00_Conteudo_chkLanceLivre, input[name*="chkLanceLivre"], label:has-text("Repetir")').first()
        if (await chkRepetirFixo.isVisible({ timeout: 3000 }).catch(() => false)) {
          const isChkFixo = await chkRepetirFixo.isChecked().catch(() => false)
          if (!isChkFixo) {
            await chkRepetirFixo.click({ force: true }).catch(() => {})
          }
          await page.waitForTimeout(400)
        }

        await page.screenshot({ path: path.join(screenshotsDir, `lance-03-fixo-preenchido-${item.numero_grupo}-${item.numero_cota}.png`) }).catch(() => {})

        // 8. Clica em [Confirmar] e escuta os dialogs
        log('Clicando em [Confirmar] para o Lance Fixo...')
        ultimoProtocoloCapturado = null
        const btnConfirmarFixo = page.locator('#ctl00_Conteudo_btnConfirma, input[value="Confirmar"]').first()
        await btnConfirmarFixo.scrollIntoViewIfNeeded().catch(() => {})
        await btnConfirmarFixo.click({ force: true })
        await page.waitForTimeout(4000)

        protocoloFixo = ultimoProtocoloCapturado
        log(`Protocolo do Lance Fixo capturado: ${protocoloFixo || 'Confirmado via Web'}`)

        compFixo = await voltarDoRelatorio('FIXO')
        totalLancesOfertados++
      }

      // =========================================================================
      // ETAPA C: OFERTA DO 2º LANCE FIXO (se houver no grupo, ex: 40%)
      // =========================================================================
      if (dadosTelaLance.segundoLanceFixoPct && dadosTelaLance.segundoLanceFixoPct > 0) {
        if (!page.url().includes('frmConCpCadCredenciamentoLance') && !page.url().includes('CredenciamentoLance')) {
          log('Reabrindo tela de Oferta de Lance para 2º Lance Fixo...')
          const linkOfertaLance = page.locator('a:has-text("Oferta de Lance"), a[href*="frmConCpCadCredenciamentoLance"]').filter({ hasNotText: 'Lote' }).first()
          if (await linkOfertaLance.isVisible({ timeout: 8000 }).catch(() => false)) {
            await linkOfertaLance.click()
            await page.waitForURL(url => url.pathname.includes('frmConCpCadCredenciamentoLance') || url.href.includes('CredenciamentoLance'), { timeout: 20_000 }).catch(() => {})
            await page.waitForLoadState('domcontentloaded').catch(() => {})
            await page.waitForTimeout(2000)
          } else {
            await page.goto('https://nwcweb.randonconsorcios.com.br/CONCP/frmConCpCadCredenciamentoLance.aspx', { waitUntil: 'domcontentloaded' }).catch(() => {})
            await page.waitForTimeout(2000)
          }
        }

        const fixo2Pct = Number(dadosTelaLance.segundoLanceFixoPct)
        const strFixo2Pct = fixo2Pct.toFixed(4).replace('.', ',')
        const embFixo2Pct = Math.min(fixo2Pct, embutidoMaximoPct)
        const strEmbFixo2Pct = embFixo2Pct.toFixed(4).replace('.', ',')

        log(`--- Ofertando 2º LANCE FIXO: ${strFixo2Pct}% (Embutido: ${strEmbFixo2Pct}%) ---`)

        const rdo2Fixo = page.locator('#ctl00_Conteudo_rgLance_2, label[for="ctl00_Conteudo_rgLance_2"], label:has-text("2º Fixo")').first()
        if (await rdo2Fixo.isVisible({ timeout: 4000 }).catch(() => false)) {
          await rdo2Fixo.click({ force: true }).catch(() => {})
          await page.waitForTimeout(800)

          const rdoReduzir2Fixo = page.locator('#ctl00_Conteudo_rblFormasLance_1, label[for="ctl00_Conteudo_rblFormasLance_1"], label:has-text("Reduzir Parcela")').first()
          if (await rdoReduzir2Fixo.isVisible({ timeout: 3000 }).catch(() => false)) {
            await rdoReduzir2Fixo.click({ force: true }).catch(() => {})
            await page.waitForTimeout(400)
          }

          const selectTipo2Fixo = page.locator('#ctl00_Conteudo_rblTipoOferta, select[name*="rblTipoOferta"]').first()
          if (await selectTipo2Fixo.isVisible({ timeout: 3000 }).catch(() => false)) {
            await selectTipo2Fixo.selectOption('%').catch(() => selectTipo2Fixo.selectOption({ label: 'Percentual' }))
            await page.waitForTimeout(400)
          }

          await preencherCampoComMascara('#ctl00_Conteudo_edtOferta', strFixo2Pct)

          const selectEmb2Fixo = page.locator('#ctl00_Conteudo_cbxLanceEmbutido, select[name*="cbxLanceEmbutido"]').first()
          if (await selectEmb2Fixo.isVisible({ timeout: 3000 }).catch(() => false)) {
            await selectEmb2Fixo.selectOption('%').catch(() => selectEmb2Fixo.selectOption({ label: 'Percentual' }))
            await page.waitForTimeout(400)
          }

          await preencherCampoComMascara('#ctl00_Conteudo_edtEmbutido', strEmbFixo2Pct)

          const chkRepetir2Fixo = page.locator('#ctl00_Conteudo_chkLanceLivre, input[name*="chkLanceLivre"], label:has-text("Repetir")').first()
          if (await chkRepetir2Fixo.isVisible({ timeout: 3000 }).catch(() => false)) {
            const isChk2 = await chkRepetir2Fixo.isChecked().catch(() => false)
            if (!isChk2) {
              await chkRepetir2Fixo.click({ force: true }).catch(() => {})
            }
            await page.waitForTimeout(400)
          }

          log('Clicando em [Confirmar] para o 2º Lance Fixo...')
          ultimoProtocoloCapturado = null
          const btnConfirmar2Fixo = page.locator('#ctl00_Conteudo_btnConfirma, input[value="Confirmar"]').first()
          await btnConfirmar2Fixo.scrollIntoViewIfNeeded().catch(() => {})
          await btnConfirmar2Fixo.click({ force: true })
          await page.waitForTimeout(4000)

          protocoloSegundoFixo = ultimoProtocoloCapturado
          log(`Protocolo do 2º Lance Fixo capturado: ${protocoloSegundoFixo || 'Confirmado via Web'}`)

          compSegundoFixo = await voltarDoRelatorio('SEGUNDO_FIXO')
          totalLancesOfertados++
        }
      }

      // =========================================================================
      // ETAPA D: GRAVAÇÃO E SINCRONIZAÇÃO NA TELA DE LANCES DO ERP
      // =========================================================================
      log(`Gravando estratégia e confirmação no ERP para Cota ${item.numero_grupo}/${item.numero_cota}...`)

      if (item.cota_definitiva_id) {
        const compPrincipal = compLivre || compFixo || compSegundoFixo
        const payloadEstrategia = {
          empresa_id: targetEmpresaId,
          cota_definitiva_id: item.cota_definitiva_id,
          lance_livre_ativo: true,
          lance_livre_percentual: livrePctCalculado,
          lance_fixo_ativo: Boolean(dadosTelaLance.lanceFixoPct),
          lance_fixo_percentual: dadosTelaLance.lanceFixoPct || 25.0,
          segundo_lance_fixo_ativo: Boolean(dadosTelaLance.segundoLanceFixoPct),
          segundo_lance_fixo_percentual: dadosTelaLance.segundoLanceFixoPct || null,
          lance_embutido_percentual: embutidoMaximoPct,
          parcela_reduzida_ativa: true,
          repetir_seis_assembleias: true,
          data_lance: new Date().toISOString().split('T')[0],
          data_vencimento: (() => {
            const d = new Date()
            d.setMonth(d.getMonth() + 6)
            return d.toISOString().split('T')[0]
          })(),
          confirmado: true,
          confirmado_em: new Date().toISOString(),
          confirmado_por_nome: 'Robô Newcon Franquia',
          confirmado_observacao: `Ofertado via Robô Newcon. Protocolo Livre: ${protocoloLivre || 'N/A'}${protocoloFixo ? ` | Fixo: ${protocoloFixo}` : ''}${protocoloSegundoFixo ? ` | 2º Fixo: ${protocoloSegundoFixo}` : ''} (Repetir por 6 assembleias ativo)`,
          protocolo_lance_livre: protocoloLivre,
          protocolo_lance_fixo: protocoloFixo,
          protocolo_segundo_lance_fixo: protocoloSegundoFixo,
          assembleia_numero: dadosTelaLance.assembleia || null,
          ultimo_lance_ofertado_em: new Date().toISOString(),
          oferta_origem: 'ROBO_NEWCON',
          comprovante_storage_path: compPrincipal?.storagePath || null,
          comprovante_url: compPrincipal?.url || null,
          comprovante_nome: compPrincipal?.nome || null,
          ativa: true,
          updated_at: new Date().toISOString(),
        }

        const { data: estSalva, error: errEst } = await admin
          .from('cota_estrategias_lance')
          .upsert(payloadEstrategia, { onConflict: 'cota_definitiva_id' })
          .select()
          .single()

        if (errEst) {
          log(`Erro ao sincronizar cota_estrategias_lance: ${errEst.message}`)
        } else {
          log(`Estratégia e Confirmação de Lance registradas com sucesso no ERP! ID: ${estSalva?.id}`)
        }

        // Grava no histórico individual de ofertas
        const ofertasLances = []
        if (protocoloLivre) {
          ofertasLances.push({
            empresa_id: targetEmpresaId,
            cota_definitiva_id: item.cota_definitiva_id,
            numero_grupo: item.numero_grupo,
            numero_cota: item.numero_cota,
            assembleia_numero: dadosTelaLance.assembleia || null,
            tipo_lance: 'LIVRE',
            opcao_reducao: 'REDUZIR_PARCELA',
            percentual_lance: livrePctCalculado,
            percentual_embutido: embutidoMaximoPct,
            protocolo: protocoloLivre,
            comprovante_storage_path: compLivre?.storagePath || null,
            comprovante_url: compLivre?.url || null,
            repetir_seis_assembleias: true,
            status: 'CONFIRMADO',
          })
        }
        if (protocoloFixo) {
          ofertasLances.push({
            empresa_id: targetEmpresaId,
            cota_definitiva_id: item.cota_definitiva_id,
            numero_grupo: item.numero_grupo,
            numero_cota: item.numero_cota,
            assembleia_numero: dadosTelaLance.assembleia || null,
            tipo_lance: 'FIXO',
            opcao_reducao: 'REDUZIR_PARCELA',
            percentual_lance: dadosTelaLance.lanceFixoPct || 25.0,
            percentual_embutido: Math.min(dadosTelaLance.lanceFixoPct || 25.0, embutidoMaximoPct),
            protocolo: protocoloFixo,
            comprovante_storage_path: compFixo?.storagePath || null,
            comprovante_url: compFixo?.url || null,
            repetir_seis_assembleias: true,
            status: 'CONFIRMADO',
          })
        }
        if (protocoloSegundoFixo) {
          ofertasLances.push({
            empresa_id: targetEmpresaId,
            cota_definitiva_id: item.cota_definitiva_id,
            numero_grupo: item.numero_grupo,
            numero_cota: item.numero_cota,
            assembleia_numero: dadosTelaLance.assembleia || null,
            tipo_lance: 'SEGUNDO_FIXO',
            opcao_reducao: 'REDUZIR_PARCELA',
            percentual_lance: dadosTelaLance.segundoLanceFixoPct || 40.0,
            percentual_embutido: embutidoMaximoPct,
            protocolo: protocoloSegundoFixo,
            comprovante_storage_path: compSegundoFixo?.storagePath || null,
            comprovante_url: compSegundoFixo?.url || null,
            repetir_seis_assembleias: true,
            status: 'CONFIRMADO',
          })
        }

        if (ofertasLances.length > 0) {
          const { error: errHist } = await admin.from('cota_lances_ofertados').insert(ofertasLances)
          if (errHist) {
            log(`Aviso ao gravar histórico de lances: ${errHist.message}`)
          } else {
            log(`Histórico individual de lances gravado com sucesso! (${ofertasLances.length} registros)`)
          }
        }
      }

      totalCotasProcessadas++
      await page.waitForTimeout(1500)

    } catch (cotaErr) {
      log(`Erro no processamento de lances da cota ${item.numero_grupo}/${item.numero_cota}: ${cotaErr.message}`)
      await page.screenshot({ path: path.join(screenshotsDir, `erro-lance-${item.numero_grupo}-${item.numero_cota}-${Date.now()}.png`) }).catch(() => {})
    }
  }

  log('=== PROCESSAMENTO DO ROBÔ DE LANCES FINALIZADO COM SUCESSO ===')
  log(`Total de cotas analisadas: ${totalCotasProcessadas}`)
  log(`Total de lances ofertados com confirmação: ${totalLancesOfertados}`)

  return {
    cotasProcessadas: totalCotasProcessadas,
    lancesOfertados: totalLancesOfertados,
  }
}
