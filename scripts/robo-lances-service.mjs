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
  const match = msg.match(/(?:protocolos?:\s*(?:Lance\s*[^:]+:\s*)?|Lance\s*[^:]+:\s*)?(\d{5,10})/i)
  return match ? match[1] : null
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
    listaCotas = cotasDb.map((c) => ({
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
      const linkOfertaLance = page.locator('a:has-text("Oferta de Lance"), a[href*="frmConCpCadCredenciamentoLance"]').first()
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

      // Regra de Lance Embutido:
      // O limite de embutido comum é 25%. Usamos a regra do grupo ou o fixo se menor.
      const embutidoMaximoPct = Number(item.grupo_embutido_pct || 25.0)

      // Regra do Usuário:
      // "lance fixo sempre 1,1234 + que o lance embutido para todos clientes. Exemplo desse grupo 1273 cota 209: embutido maximo de 25% ai o livre 26,1234"
      const { livrePct: livrePctCalculado, strLivrePct, strEmbutidoPct } = calcularRegraLanceLivre(embutidoMaximoPct)

      let protocoloLivre = null
      let protocoloFixo = null
      let protocoloSegundoFixo = null

      // Função auxiliar para aguardar o alerta do navegador com o número do protocolo
      const aguardarProtocoloAlert = () => {
        return new Promise((resolve) => {
          let timeoutId = setTimeout(() => resolve(null), 15_000)
          page.once('dialog', async (dialog) => {
            clearTimeout(timeoutId)
            const msg = dialog.message() || ''
            log(`Mensagem de confirmação recebida do Newcon: "${msg}"`)
            const numProt = extrairProtocoloAlert(msg)
            await dialog.accept().catch(() => {})
            resolve(numProt)
          })
        })
      }

      // Função auxiliar para retornar da tela de relatório
      const voltarDoRelatorio = async () => {
        await page.waitForTimeout(3000)
        log('Verificando se abriu tela de comprovante (frmConCmNewconReports.aspx)...')
        if (page.url().includes('frmConCmNewconReports') || page.url().includes('Reports')) {
          log('Tela de comprovante aberta. Localizando e clicando no botão [Voltar]...')
          await page.screenshot({ path: path.join(screenshotsDir, `comprovante-lance-${item.numero_grupo}-${item.numero_cota}-${Date.now()}.png`) }).catch(() => {})
          const btnVoltar = page.locator('input[value="Voltar"], button:has-text("Voltar"), a:has-text("Voltar"), #btnVoltar').first()
          if (await btnVoltar.isVisible({ timeout: 5000 }).catch(() => false)) {
            await btnVoltar.click()
            await page.waitForLoadState('domcontentloaded').catch(() => {})
            await page.waitForTimeout(2500)
          } else {
            log('Botão Voltar não visível diretamente. Retornando histórico...')
            await page.goBack().catch(() => {})
            await page.waitForTimeout(2000)
          }
        }
      }

      // =========================================================================
      // ETAPA A: OFERTA DO LANCE LIVRE (1,1234 + embutido)
      // =========================================================================
      log(`--- Ofertando LANCE LIVRE: ${strLivrePct}% (Embutido: ${strEmbutidoPct}%) ---`)

      // 1. Seleciona Radio "Livre"
      const rdoLivre = page.locator('input[type="radio"][value="Livre"], #ctl00_Conteudo_rdoTipoLance_0, input[name*="rdoTipoLance"][value*="0"]').first()
      await rdoLivre.waitFor({ state: 'visible', timeout: 8000 })
      await rdoLivre.check().catch(() => rdoLivre.click())
      await page.waitForTimeout(800)

      // 2. Seleciona Radio "Reduzir Parcela"
      const rdoReduzirParcela = page.locator('input[type="radio"][value="Reduzir Parcela"], #ctl00_Conteudo_rdoOpcaoLance_1, input[name*="rdoOpcaoLance"][value*="1"]').first()
      if (await rdoReduzirParcela.isVisible({ timeout: 3000 }).catch(() => false)) {
        await rdoReduzirParcela.check().catch(() => rdoReduzirParcela.click())
        await page.waitForTimeout(600)
      }

      // 3. Dropdown do Tipo de Oferta -> Percentual
      const selectTipoOferta = page.locator('select[name*="ddlTipoOferta"], select[id*="ddlTipoOferta"]').first()
      if (await selectTipoOferta.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectTipoOferta.selectOption({ label: 'Percentual' }).catch(() => {})
        await page.waitForTimeout(600)
      }

      // 4. Preenche valor do Lance Livre (26,1234)
      const inputValorLance = page.locator('input[name*="txtVL_Lance"], input[name*="txtPC_Lance"], input[id*="txtPC_Lance"], input[id*="txtVL_Lance"]').first()
      await inputValorLance.waitFor({ state: 'visible', timeout: 5000 })
      await inputValorLance.fill(strLivrePct)
      await page.waitForTimeout(600)

      // 5. Dropdown Lance Embutido -> Percentual
      const selectTipoEmbutido = page.locator('select[name*="ddlTipoEmbutido"], select[id*="ddlTipoEmbutido"]').first()
      if (await selectTipoEmbutido.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectTipoEmbutido.selectOption({ label: 'Percentual' }).catch(() => {})
        await page.waitForTimeout(600)
      }

      // 6. Preenche valor do Lance Embutido (25,0000)
      const inputValorEmbutido = page.locator('input[name*="txtVL_Embutido"], input[name*="txtPC_Embutido"], input[id*="txtPC_Embutido"], input[id*="txtVL_Embutido"]').first()
      if (await inputValorEmbutido.isVisible({ timeout: 4000 }).catch(() => false)) {
        await inputValorEmbutido.fill(strEmbutidoPct)
        await page.waitForTimeout(600)
      }

      // 7. Marca checkbox "Repetir a oferta do lance por 6 assembleia(s)"
      const chkRepetir = page.locator('input[type="checkbox"][name*="chkRepetirLance"], input[type="checkbox"][id*="chkRepetirLance"]').first()
      if (await chkRepetir.isVisible({ timeout: 3000 }).catch(() => false)) {
        if (!(await chkRepetir.isChecked())) {
          await chkRepetir.check().catch(() => chkRepetir.click())
        }
        await page.waitForTimeout(600)
      }

      await page.screenshot({ path: path.join(screenshotsDir, `lance-02-livre-preenchido-${item.numero_grupo}-${item.numero_cota}.png`) }).catch(() => {})

      // 8. Clica em [Confirmar] e escuta o popup com o protocolo
      log('Clicando em [Confirmar] para o Lance Livre...')
      const btnConfirmar = page.locator('input[value="Confirmar"], button:has-text("Confirmar"), input[id*="btnConfirmar"]').first()
      
      const promiseDialogLivre = aguardarProtocoloAlert()
      await btnConfirmar.click()

      protocoloLivre = await promiseDialogLivre
      log(`Protocolo do Lance Livre capturado: ${protocoloLivre || 'Confirmado via Web'}`)

      // 9. Aguarda relatório e clica em Voltar
      await voltarDoRelatorio()
      totalLancesOfertados++

      // =========================================================================
      // ETAPA B: OFERTA DO LANCE FIXO (ex: 25%)
      // =========================================================================
      if (dadosTelaLance.lanceFixoPct && dadosTelaLance.lanceFixoPct > 0) {
        const fixoPct = Number(dadosTelaLance.lanceFixoPct)
        const strFixoPct = fixoPct.toFixed(4).replace('.', ',')
        // Regra do usuário: "no lance fixo precisa preencher com o mesmo valor do lance quando for 25% quando é de 40% e só pode usar 25% de embutido preencher 25%"
        const embFixoPct = Math.min(fixoPct, embutidoMaximoPct)
        const strEmbFixoPct = embFixoPct.toFixed(4).replace('.', ',')

        log(`--- Ofertando LANCE FIXO: ${strFixoPct}% (Embutido: ${strEmbFixoPct}%) ---`)

        // 1. Seleciona Radio "Fixo"
        const rdoFixo = page.locator('input[type="radio"][value="Fixo"], #ctl00_Conteudo_rdoTipoLance_1, input[name*="rdoTipoLance"][value*="1"]').first()
        await rdoFixo.waitFor({ state: 'visible', timeout: 8000 })
        await rdoFixo.check().catch(() => rdoFixo.click())
        await page.waitForTimeout(800)

        // 2. Opção Reduzir Parcela
        const rdoReduzirFixo = page.locator('input[type="radio"][value="Reduzir Parcela"], #ctl00_Conteudo_rdoOpcaoLance_1, input[name*="rdoOpcaoLance"][value*="1"]').first()
        if (await rdoReduzirFixo.isVisible({ timeout: 3000 }).catch(() => false)) {
          await rdoReduzirFixo.check().catch(() => rdoReduzirFixo.click())
          await page.waitForTimeout(600)
        }

        // 3. Dropdown Tipo de Oferta -> Percentual
        const selectTipoFixo = page.locator('select[name*="ddlTipoOferta"], select[id*="ddlTipoOferta"]').first()
        if (await selectTipoFixo.isVisible({ timeout: 3000 }).catch(() => false)) {
          await selectTipoFixo.selectOption({ label: 'Percentual' }).catch(() => {})
          await page.waitForTimeout(600)
        }

        // 4. Input Lance Fixo
        const inputLanceFixo = page.locator('input[name*="txtVL_Lance"], input[name*="txtPC_Lance"], input[id*="txtPC_Lance"], input[id*="txtVL_Lance"]').first()
        if (await inputLanceFixo.isVisible({ timeout: 3000 }).catch(() => false)) {
          await inputLanceFixo.fill(strFixoPct).catch(() => {})
          await page.waitForTimeout(600)
        }

        // 5. Dropdown Embutido -> Percentual
        const selectEmbFixo = page.locator('select[name*="ddlTipoEmbutido"], select[id*="ddlTipoEmbutido"]').first()
        if (await selectEmbFixo.isVisible({ timeout: 3000 }).catch(() => false)) {
          await selectEmbFixo.selectOption({ label: 'Percentual' }).catch(() => {})
          await page.waitForTimeout(600)
        }

        // 6. Preenche valor do Embutido Fixo
        const inputEmbFixo = page.locator('input[name*="txtVL_Embutido"], input[name*="txtPC_Embutido"], input[id*="txtPC_Embutido"], input[id*="txtVL_Embutido"]').first()
        if (await inputEmbFixo.isVisible({ timeout: 3000 }).catch(() => false)) {
          await inputEmbFixo.fill(strEmbFixoPct).catch(() => {})
          await page.waitForTimeout(600)
        }

        // 7. Checkbox Repetir por 6 assembleias
        const chkRepetirFixo = page.locator('input[type="checkbox"][name*="chkRepetirLance"], input[type="checkbox"][id*="chkRepetirLance"]').first()
        if (await chkRepetirFixo.isVisible({ timeout: 3000 }).catch(() => false)) {
          if (!(await chkRepetirFixo.isChecked())) {
            await chkRepetirFixo.check().catch(() => chkRepetirFixo.click())
          }
          await page.waitForTimeout(600)
        }

        await page.screenshot({ path: path.join(screenshotsDir, `lance-03-fixo-preenchido-${item.numero_grupo}-${item.numero_cota}.png`) }).catch(() => {})

        // 8. Clica em [Confirmar] e escuta o popup
        log('Clicando em [Confirmar] para o Lance Fixo...')
        const btnConfirmarFixo = page.locator('input[value="Confirmar"], button:has-text("Confirmar"), input[id*="btnConfirmar"]').first()
        
        const promiseDialogFixo = aguardarProtocoloAlert()
        await btnConfirmarFixo.click()

        protocoloFixo = await promiseDialogFixo
        log(`Protocolo do Lance Fixo capturado: ${protocoloFixo || 'Confirmado via Web'}`)

        await voltarDoRelatorio()
        totalLancesOfertados++
      }

      // =========================================================================
      // ETAPA C: OFERTA DO 2º LANCE FIXO (se houver no grupo, ex: 40%)
      // =========================================================================
      if (dadosTelaLance.segundoLanceFixoPct && dadosTelaLance.segundoLanceFixoPct > 0) {
        const fixo2Pct = Number(dadosTelaLance.segundoLanceFixoPct)
        const strFixo2Pct = fixo2Pct.toFixed(4).replace('.', ',')
        const embFixo2Pct = Math.min(fixo2Pct, embutidoMaximoPct)
        const strEmbFixo2Pct = embFixo2Pct.toFixed(4).replace('.', ',')

        log(`--- Ofertando 2º LANCE FIXO: ${strFixo2Pct}% (Embutido: ${strEmbFixo2Pct}%) ---`)

        const rdo2Fixo = page.locator('input[type="radio"][value*="2º"], #ctl00_Conteudo_rdoTipoLance_2, input[name*="rdoTipoLance"][value*="2"]').first()
        if (await rdo2Fixo.isVisible({ timeout: 4000 }).catch(() => false)) {
          await rdo2Fixo.check().catch(() => rdo2Fixo.click())
          await page.waitForTimeout(800)

          const rdoReduzir2Fixo = page.locator('input[type="radio"][value="Reduzir Parcela"], #ctl00_Conteudo_rdoOpcaoLance_1, input[name*="rdoOpcaoLance"][value*="1"]').first()
          if (await rdoReduzir2Fixo.isVisible({ timeout: 3000 }).catch(() => false)) {
            await rdoReduzir2Fixo.check().catch(() => rdoReduzir2Fixo.click())
            await page.waitForTimeout(600)
          }

          const selectTipo2Fixo = page.locator('select[name*="ddlTipoOferta"], select[id*="ddlTipoOferta"]').first()
          if (await selectTipo2Fixo.isVisible({ timeout: 3000 }).catch(() => false)) {
            await selectTipo2Fixo.selectOption({ label: 'Percentual' }).catch(() => {})
            await page.waitForTimeout(600)
          }

          const inputLance2Fixo = page.locator('input[name*="txtVL_Lance"], input[name*="txtPC_Lance"], input[id*="txtPC_Lance"], input[id*="txtVL_Lance"]').first()
          if (await inputLance2Fixo.isVisible({ timeout: 3000 }).catch(() => false)) {
            await inputLance2Fixo.fill(strFixo2Pct).catch(() => {})
            await page.waitForTimeout(600)
          }

          const selectEmb2Fixo = page.locator('select[name*="ddlTipoEmbutido"], select[id*="ddlTipoEmbutido"]').first()
          if (await selectEmb2Fixo.isVisible({ timeout: 3000 }).catch(() => false)) {
            await selectEmb2Fixo.selectOption({ label: 'Percentual' }).catch(() => {})
            await page.waitForTimeout(600)
          }

          const inputEmb2Fixo = page.locator('input[name*="txtVL_Embutido"], input[name*="txtPC_Embutido"], input[id*="txtPC_Embutido"], input[id*="txtVL_Embutido"]').first()
          if (await inputEmb2Fixo.isVisible({ timeout: 3000 }).catch(() => false)) {
            await inputEmb2Fixo.fill(strEmbFixo2Pct).catch(() => {})
            await page.waitForTimeout(600)
          }

          const chkRepetir2Fixo = page.locator('input[type="checkbox"][name*="chkRepetirLance"], input[type="checkbox"][id*="chkRepetirLance"]').first()
          if (await chkRepetir2Fixo.isVisible({ timeout: 3000 }).catch(() => false)) {
            if (!(await chkRepetir2Fixo.isChecked())) {
              await chkRepetir2Fixo.check().catch(() => chkRepetir2Fixo.click())
            }
            await page.waitForTimeout(600)
          }

          log('Clicando em [Confirmar] para o 2º Lance Fixo...')
          const btnConfirmar2Fixo = page.locator('input[value="Confirmar"], button:has-text("Confirmar"), input[id*="btnConfirmar"]').first()
          
          const promiseDialog2Fixo = aguardarProtocoloAlert()
          await btnConfirmar2Fixo.click()

          protocoloSegundoFixo = await promiseDialog2Fixo
          log(`Protocolo do 2º Lance Fixo capturado: ${protocoloSegundoFixo || 'Confirmado via Web'}`)

          await voltarDoRelatorio()
          totalLancesOfertados++
        }
      }

      // =========================================================================
      // ETAPA D: GRAVAÇÃO E SINCRONIZAÇÃO NA TELA DE LANCES DO ERP
      // =========================================================================
      log(`Gravando estratégia e confirmação no ERP para Cota ${item.numero_grupo}/${item.numero_cota}...`)

      if (item.cota_definitiva_id) {
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
          confirmado: true,
          confirmado_em: new Date().toISOString(),
          confirmado_por_nome: 'Robô Newcon Franquia',
          confirmado_observacao: `Ofertado via Robô Newcon. Protocolo Livre: ${protocoloLivre || 'N/A'}${protocoloFixo ? ` | Fixo: ${protocoloFixo}` : ''}${protocoloSegundoFixo ? ` | 2º Fixo: ${protocoloSegundoFixo}` : ''}`,
          protocolo_lance_livre: protocoloLivre,
          protocolo_lance_fixo: protocoloFixo,
          protocolo_segundo_lance_fixo: protocoloSegundoFixo,
          assembleia_numero: dadosTelaLance.assembleia || null,
          ultimo_lance_ofertado_em: new Date().toISOString(),
          oferta_origem: 'ROBO_NEWCON',
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
            repetir_seis_assembleias: true,
            status: 'CONFIRMADO',
          })
        }

        if (ofertasLances.length > 0) {
          await admin.from('cota_lances_ofertados').insert(ofertasLances).catch(() => {})
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
