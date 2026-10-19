import path from 'node:path'

/**
 * Módulo de automação do Robô 3: Plataforma de Vendas / Simulador Racon
 * Extrai grupos, cotas (PRORROGADA e DILUÍDA), parcelas integrais e reduzidas (50%, 60%, 70%)
 * e regras de contemplação, sincronizando com origem_governanca = GLOBAL.
 */
export async function executarRobo3Simulador({ page, config, admin, log, screenshotsDir }) {
  log('--- INICIANDO ROBÔ 3: PLATAFORMA DE VENDAS & SIMULADOR RACON ---')

  const targetUrl = 'https://e.randonconsorcios.com.br/simulador?etapa=filtros'
  log(`Navegando para o Simulador: ${targetUrl}...`)
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(4000)
  log(`Página do Simulador carregada: ${page.url()}`)
  await page.screenshot({ path: path.join(screenshotsDir, `racon-sim-01-filtros-${Date.now()}.png`) }).catch(() => {})

  // Helper para aguardar fim de skeletons / carregamento assíncrono
  async function aguardarSkeletons() {
    try {
      await page.waitForFunction(() => {
        const skeletons = document.querySelectorAll('div[class*="skeleton"], div[class*="Skeleton"], [aria-busy="true"], div[class*="loading"]')
        return skeletons.length === 0
      }, { timeout: 20_000 })
    } catch (_) {}
    await page.waitForTimeout(1500)
  }

  // Helper para garantir que o menu "Filtros adicionais" esteja expandido
  async function garantirFiltrosAdicionaisAbertos() {
    const btnProrrogada = page.locator('button:has-text("Prorrogada"), div[role="button"]:has-text("Prorrogada")').first()
    if (!(await btnProrrogada.isVisible().catch(() => false))) {
      const accFiltros = page.locator('div:has-text("Filtros adicionais"), p:has-text("Filtros adicionais"), span:has-text("Filtros adicionais")').last()
      if (await accFiltros.isVisible().catch(() => false)) {
        await accFiltros.click().catch(() => {})
        await page.waitForTimeout(1000)
      }
    }
  }

  // 1. Garantir Ponto de Venda selecionado: 939509 (Racon Sinop - Gauchinho Consor)
  log('Verificando seleção de Ponto de Venda no Simulador...')
  const pvAtual = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'))
    for (const inp of inputs) {
      if ((inp.value || '').includes('Gauchinho') || (inp.value || '').includes('939509')) return inp.value
    }
    const allText = document.body ? document.body.innerText : ''
    return allText.includes('Racon Sinop - Gauchinho Consor') ? 'Racon Sinop - Gauchinho Consor' : null
  }).catch(() => null)

  if (!pvAtual) {
    log('Ponto de Venda não detectado ativo. Selecionando 939509...')
    const pvInput = page.locator('input[placeholder*="Ponto"], input[aria-label*="Ponto"], div:has-text("Ponto de venda") input').first()
    if (await pvInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await pvInput.click()
      await pvInput.fill('939509')
      await page.waitForTimeout(1500)
      const optionSinop = page.locator('li:has-text("939509"), div[role="option"]:has-text("939509"), div:has-text("Racon Sinop")').first()
      if (await optionSinop.isVisible({ timeout: 4000 }).catch(() => false)) {
        await optionSinop.click()
        await page.waitForTimeout(2000)
        log('Ponto de Venda 939509 selecionado com sucesso!')
      }
    }
  } else {
    log(`Ponto de venda já ativo: ${pvAtual}`)
  }

  // 2. Carrega catálogo de grupos do Supabase para correlação rápida
  const raconAdminId = config.administradora_id || 'c5f8ecb4-cb5a-5014-b567-50484719b404'
  const { data: dbGrupos } = await admin
    .from('grupos_consorcio')
    .select('id, codigo_grupo, modalidade')
    .eq('administradora_id', raconAdminId)

  const mapDbGrupos = new Map()
  for (const dbg of dbGrupos || []) {
    const num = dbg.codigo_grupo.replace(/\D/g, '').replace(/^0+/, '')
    if (num) mapDbGrupos.set(num, dbg)
  }

  // 3. Produtos a percorrer no Simulador
  const produtos = [
    'Veículos',
    'Serviços',
    'Veículos Pró-Rata Total',
    'Imóveis',
    'Imóveis Pró-Rata Total',
  ]

  let totalCotasCadastradas = 0
  let totalGruposProcessados = 0
  let totalGruposNovos = 0
  let totalGruposAtualizados = 0

  for (const produto of produtos) {
    log(`\n===========================================================`)
    log(`PROCESSANDO PRODUTO NO SIMULADOR: ${produto}`)
    log(`===========================================================`)

    // Clica no botão do produto
    const btnProduto = page.locator(`button:has-text("${produto}"), div[role="button"]:has-text("${produto}"), span:text-is("${produto}")`).first()
    if (await btnProduto.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btnProduto.click()
      log(`Filtro de produto "${produto}" selecionado. Aguardando carregamento dos dados...`)
      await aguardarSkeletons()
      await page.screenshot({ path: path.join(screenshotsDir, `racon-sim-prod-${produto.replace(/\s+/g, '_')}-${Date.now()}.png`) }).catch(() => {})
    } else {
      log(`Botão do produto "${produto}" já ativo ou estilizado como selecionado.`)
      await aguardarSkeletons()
    }

    // Modalidades de transcorrido: Prorrogada e Diluída
    const modalidadesTranscorrido = ['Prorrogada', 'Diluída']

    for (const modTrans of modalidadesTranscorrido) {
      log(`\n--- Distribuição do Valor Transcorrido: [ ${modTrans.toUpperCase()} ] ---`)
      const modUpper = modTrans.toLowerCase().includes('dilu') ? 'DILUIDA' : 'PRORROGADA'

      await garantirFiltrosAdicionaisAbertos()

      const btnModTrans = page.locator(`button:has-text("${modTrans}"), div[role="button"]:has-text("${modTrans}"), span:text-is("${modTrans}")`).first()
      if (await btnModTrans.isVisible({ timeout: 5000 }).catch(() => false)) {
        await btnModTrans.click()
        await aguardarSkeletons()
      }

      // Aguarda até que os botões "Mostrar planos" estejam renderizados ou detecta ausência
      const btnsMostrarPlanos = page.locator('button:has-text("Mostrar planos"), div[role="button"]:has-text("Mostrar planos")')
      let totalBtns = await btnsMostrarPlanos.count()

      if (totalBtns === 0) {
        // Tenta mais uma espera caso a requisição de API tenha demorado
        await page.waitForTimeout(2000)
        await aguardarSkeletons()
        totalBtns = await btnsMostrarPlanos.count()
      }

      log(`Grupos disponíveis para expansão no produto "${produto}" (${modUpper}): ${totalBtns}`)
      if (totalBtns === 0) continue

      // Processa cada grupo da listagem
      for (let i = 0; i < totalBtns; i++) {
        try {
          // Re-busca os botões para garantir referência fresca no DOM
          const freshBtns = page.locator('button:has-text("Mostrar planos"), div[role="button"]:has-text("Mostrar planos")')
          const btnExp = freshBtns.nth(i)
          if (!(await btnExp.isVisible({ timeout: 3000 }).catch(() => false))) continue

          // Obtém texto do card do grupo
          const cardText = await btnExp.evaluate(el => {
            const card = el.closest('div[class*="card"], div[class*="Card"], article, div')
            return card ? card.innerText : ''
          }).catch(() => '')

          const matchGrupo = cardText.match(/Grupo\s+(\d{4,8})/i)
          if (!matchGrupo) continue
          const codGrupoRaw = matchGrupo[1]
          const numGrupo = codGrupoRaw.replace(/^0+/, '')

          log(`\n[${produto} | ${modUpper}] Grupo ${codGrupoRaw} (Num: ${numGrupo}) - Expandindo planos...`)

          // Expande os planos do grupo
          await btnExp.click().catch(() => {})
          await page.waitForTimeout(1500)
          await aguardarSkeletons()

          // Localiza ou cria o grupo no banco Supabase
          let dbGrupo = mapDbGrupos.get(numGrupo)
          if (!dbGrupo) {
            log(`Grupo ${numGrupo} não encontrado no banco. Criando novo grupo global...`)
            const { data: newGrupo, error: errNewG } = await admin
              .from('grupos_consorcio')
              .insert({
                empresa_origem_id: config.empresa_id,
                administradora_id: raconAdminId,
                codigo_grupo: `${numGrupo} ${produto.toUpperCase()}`,
                modalidade: produto.toLowerCase().includes('imóv') || produto.toLowerCase().includes('imov') ? 'Imóvel' : 'Veículos',
                origem_governanca: 'GLOBAL',
                ativo: true,
              })
              .select('id, codigo_grupo, modalidade')
              .single()

            if (!errNewG && newGrupo) {
              dbGrupo = newGrupo
              mapDbGrupos.set(numGrupo, newGrupo)
              totalGruposNovos++
            }
          }

          if (!dbGrupo) {
            log(`Aviso: Não foi possível obter ID do grupo ${numGrupo}. Pulando...`)
            continue
          }

          // Extrai os planos listados
          const planosList = await page.evaluate(() => {
            const items = []
            const planCards = Array.from(document.querySelectorAll('div, article')).filter(el => {
              const t = el.innerText || ''
              return t.includes('Crédito R$') && t.includes('Simular') && !t.includes('Mostrar planos')
            })

            for (const pc of planCards) {
              const text = pc.innerText || ''
              const credMatch = text.match(/Cr[eé]dito\s+R\$\s*([\d.,]+)/i)
              const parcMatch = text.match(/Parcela[\s\S]*?R\$\s*([\d.,]+)\s*\/\s*m[eê]s/i)
              const taxaAdmMatch = text.match(/Taxa\s+administrativa[\s\S]*?([\d.,]+)%/i)
              const fundoMatch = text.match(/Fundo\s+reserva[\s\S]*?([\d.,]+)%/i)
              const isReduzida70 = text.includes('Reduzida 70%') || text.includes('70%')
              const isReduzida60 = text.includes('Reduzida 60%') || text.includes('60%')
              const isReduzida50 = text.includes('Reduzida 50%') || text.includes('50%')

              if (credMatch && parcMatch) {
                items.push({
                  creditoStr: credMatch[1],
                  parcelaStr: parcMatch[1],
                  taxaAdm: taxaAdmMatch ? parseFloat(taxaAdmMatch[1].replace(',', '.')) : 12,
                  fundoReserva: fundoMatch ? parseFloat(fundoMatch[1].replace(',', '.')) : 0.5,
                  tipoReducao: isReduzida70 ? '70' : isReduzida60 ? '60' : isReduzida50 ? '50' : 'INTEGRAL',
                })
              }
            }
            return items
          }).catch(() => [])

          log(`[Grupo ${numGrupo} | ${modUpper}] Planos extraídos: ${planosList.length}`)

          // Agrupa por crédito para unir integral e reduções flexíveis
          const porCredito = new Map()
          for (const pl of planosList) {
            const cred = parseFloat(pl.creditoStr.replace(/\./g, '').replace(',', '.'))
            const parc = parseFloat(pl.parcelaStr.replace(/\./g, '').replace(',', '.'))
            if (!porCredito.has(cred)) {
              porCredito.set(cred, {
                credito: cred,
                taxaAdm: pl.taxaAdm,
                fundoReserva: pl.fundoReserva,
                parcelaIntegral: pl.tipoReducao === 'INTEGRAL' ? parc : 0,
                parcelasReduzidas: {},
              })
            }
            const entry = porCredito.get(cred)
            if (pl.tipoReducao === 'INTEGRAL') {
              entry.parcelaIntegral = parc
            } else {
              entry.parcelasReduzidas[pl.tipoReducao] = parc
            }
          }

          // Clica em "Simular" no primeiro plano para capturar características técnicas do grupo
          let dadosSimulacaoTecnica = null
          const btnSimular = page.locator('button:has-text("Simular")').first()
          if (await btnSimular.isVisible({ timeout: 2500 }).catch(() => false)) {
            await btnSimular.click()
            await page.waitForTimeout(2500)
            await aguardarSkeletons()
            await page.screenshot({ path: path.join(screenshotsDir, `racon-sim-detalhes-g${numGrupo}-${Date.now()}.png`) }).catch(() => {})

            dadosSimulacaoTecnica = await page.evaluate(() => {
              const body = document.body ? document.body.innerText : ''
              const parseMoney = (regex) => {
                const m = body.match(regex)
                if (!m) return null
                return parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || null
              }

              // Características de contemplação
              const contempMatches = []
              const regexContemp = /(\d+[ªaºo]?\s+contempla[cç][aã]o)[\s\S]*?([A-Za-z0-9\s%-]+)/gi
              let cm
              while ((cm = regexContemp.exec(body)) !== null) {
                contempMatches.push({ ordem: cm[1].trim(), tipo: cm[2].trim() })
                if (contempMatches.length >= 7) break
              }

              return {
                valorTranscorrido: parseMoney(/Valor\s+transcorrido[\s\S]*?R\$\s*([\d.,]+)/i),
                taxaSeguro: body.match(/Taxa\s+do\s+seguro[\s\S]*?([\d.,]+%?\s*a\.?m\.?)/i)?.[1] || null,
                valorEmbutido: body.match(/Valor\s+embutido[\s\S]*?([\d.,]+%)/i)?.[1] || null,
                tipoProRata: body.match(/Tipo\s+de\s+pro\s+rata[\s\S]*?([A-Za-z\s]+)/i)?.[1]?.trim() || null,
                parcelaMinima: parseMoney(/Parcela\s+m[ií]nima[\s\S]*?R\$\s*([\d.,]+)/i),
                proximaAssembleia: body.match(/Pr[oó]xima\s+assembleia[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i)?.[1] || null,
                vencimentoGrupo: body.match(/Vencimento\s+do\s+grupo[\s\S]*?(\d{2}\/\d{2}\/\d{4})/i)?.[1] || null,
                regrasContemplacao: contempMatches,
              }
            }).catch(() => null)

            // Retorna clicando em "Escolher outro plano"
            const btnVoltar = page.locator('button:has-text("Escolher outro plano"), a:has-text("Escolher outro plano"), div[role="button"]:has-text("Escolher outro plano")').first()
            if (await btnVoltar.isVisible({ timeout: 4000 }).catch(() => false)) {
              await btnVoltar.click()
              await page.waitForTimeout(2000)
              await aguardarSkeletons()
              await garantirFiltrosAdicionaisAbertos()
            }
          }

          // Atualiza dados técnicos no grupos_consorcio se coletados
          const updateGrupoPayload = {}
          const firstCota = porCredito.values().next().value
          if (firstCota?.taxaAdm) updateGrupoPayload.taxa_administrativa_percentual = firstCota.taxaAdm
          if (firstCota?.fundoReserva) updateGrupoPayload.fundo_reserva_percentual = firstCota.fundoReserva

          if (dadosSimulacaoTecnica) {
            if (dadosSimulacaoTecnica.parcelaMinima) updateGrupoPayload.parcela_minima = dadosSimulacaoTecnica.parcelaMinima
            if (dadosSimulacaoTecnica.tipoProRata) updateGrupoPayload.tipo_pro_rata = dadosSimulacaoTecnica.tipoProRata
            if (dadosSimulacaoTecnica.regrasContemplacao?.length) updateGrupoPayload.regras_contemplacao = dadosSimulacaoTecnica.regrasContemplacao
            if (dadosSimulacaoTecnica.taxaSeguro) {
              const sMatch = dadosSimulacaoTecnica.taxaSeguro.match(/([\d.,]+)/)
              if (sMatch) updateGrupoPayload.seguro_percentual = parseFloat(sMatch[1].replace(',', '.'))
            }
            if (dadosSimulacaoTecnica.valorEmbutido) {
              const eMatch = dadosSimulacaoTecnica.valorEmbutido.match(/([\d.,]+)/)
              if (eMatch) {
                updateGrupoPayload.permite_lance_embutido = true
                updateGrupoPayload.percentual_lance_embutido = parseFloat(eMatch[1].replace(',', '.'))
              }
            }
            if (dadosSimulacaoTecnica.proximaAssembleia) {
              const pParts = dadosSimulacaoTecnica.proximaAssembleia.split('/')
              if (pParts.length === 3) updateGrupoPayload.proxima_assembleia_data = `${pParts[2]}-${pParts[1]}-${pParts[0]}`
            }
            if (dadosSimulacaoTecnica.vencimentoGrupo) {
              const diaMatch = dadosSimulacaoTecnica.vencimentoGrupo.match(/^(\d{2})/)
              if (diaMatch) updateGrupoPayload.vencimento_dia = diaMatch[1]
            }
          }

          if (Object.keys(updateGrupoPayload).length > 0) {
            await admin.from('grupos_consorcio').update(updateGrupoPayload).eq('id', dbGrupo.id)
          }

          // Grava cada cota no Supabase public.grupos_cotas
          for (const [credVal, cotaData] of porCredito) {
            const reducoes = cotaData.parcelasReduzidas
            const valorParcela = cotaData.parcelaIntegral || reducoes['70'] || reducoes['60'] || reducoes['50'] || 0
            const { error: cotaErr } = await admin
              .from('grupos_cotas')
              .upsert({
                grupo_id: dbGrupo.id,
                tipo_transcorrido: modUpper,
                valor_credito: credVal,
                valor_transcorrido: dadosSimulacaoTecnica?.valorTranscorrido || 0,
                valor_parcela: valorParcela,
                parcela_integral: cotaData.parcelaIntegral || null,
                parcela_reduzida: reducoes['70'] || reducoes['60'] || reducoes['50'] || null,
                parcela_reduzida_50: reducoes['50'] || null,
                parcela_reduzida_60: reducoes['60'] || null,
                parcela_reduzida_70: reducoes['70'] || null,
                parcelas_reduzidas: reducoes,
                dados_simulacao: dadosSimulacaoTecnica || {},
                status: 'Disponível',
                ativo: true,
              }, { onConflict: 'grupo_id,valor_credito,tipo_transcorrido' })

            if (!cotaErr) {
              totalCotasCadastradas++
            } else {
              log(`Aviso ao gravar cota R$ ${credVal} (${modUpper}): ${cotaErr.message}`)
            }
          }

          totalGruposProcessados++
          totalGruposAtualizados++
          log(`[Grupo ${numGrupo} | ${modUpper}] Sincronizado com sucesso! ${porCredito.size} cotas gravadas.`)

          // Oculta planos se ainda visível para manter listagem limpa
          const btnOcultar = page.locator('button:has-text("Ocultar planos"), div[role="button"]:has-text("Ocultar planos")').first()
          if (await btnOcultar.isVisible({ timeout: 1500 }).catch(() => false)) {
            await btnOcultar.click().catch(() => {})
            await page.waitForTimeout(600)
          }

        } catch (grpErr) {
          log(`Erro ao processar card de grupo ${i}: ${grpErr.message}`)
        }
      }
    }
  }

  log(`\n=== PROCESSAMENTO ROBÔ 3 FINALIZADO ===`)
  log(`Grupos processados: ${totalGruposProcessados}`)
  log(`Novos grupos criados: ${totalGruposNovos}`)
  log(`Grupos atualizados: ${totalGruposAtualizados}`)
  log(`Total de cotas cadastradas: ${totalCotasCadastradas}`)

  return {
    totalGruposProcessados,
    totalGruposNovos,
    totalGruposAtualizados,
    totalCotasCadastradas,
  }
}
