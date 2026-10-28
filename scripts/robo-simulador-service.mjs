import path from 'node:path'
import { extrairPlanosSimulador, agruparPlanosSimulador, resolverGrupoSimulador } from './robo-simulador-planos.mjs'

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
    .select('id, codigo_grupo, modalidade, tipo_administradora_id')
    .eq('administradora_id', raconAdminId)

  const mapDbGrupos = new Map()
  for (const dbg of dbGrupos || []) {
    const num = dbg.codigo_grupo.replace(/\D/g, '').replace(/^0+/, '')
    if (num) mapDbGrupos.set(num, [...(mapDbGrupos.get(num) || []), dbg])
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

          const isImovelProd = produto.toLowerCase().includes('imóv') || produto.toLowerCase().includes('imov')
          const tipoIdProd = isImovelProd
            ? '57295700-5e68-498c-8882-2ef4ccc8c08d'
            : '877a793f-21b3-4ea8-b3c3-b1e56dc216c9'

          let dbGrupo = resolverGrupoSimulador(mapDbGrupos.get(numGrupo) || [], tipoIdProd)

          // Rola suavemente até o final da página para disparar lazy-load de todos os cards de cotas
          await page.evaluate(async () => {
            const distance = 400
            for (let i = 0; i < 20; i++) {
              window.scrollBy(0, distance)
              await new Promise(r => setTimeout(r, 150))
            }
            window.scrollTo(0, 0)
          }).catch(() => {})
          await page.waitForTimeout(800)

          // Falha fechada: validar todos os cartões antes de qualquer gravação.
          const planosList = await page.evaluate(extrairPlanosSimulador, { grupoEsperado: numGrupo })
          const porCredito = agruparPlanosSimulador(planosList)
          if (dbGrupo) {
            const { data: cotasExistentes, error: coberturaErr } = await admin.from('grupos_cotas')
              .select('valor_credito').eq('grupo_id', dbGrupo.id)
              .eq('tipo_transcorrido', modUpper).eq('ativo', true)
            if (coberturaErr) throw new Error(`Não foi possível conferir cobertura: ${coberturaErr.message}`)
            const ausentes = (cotasExistentes || []).filter(c => !porCredito.has(Number(c.valor_credito)))
            if (ausentes.length) throw new Error(`Leitura incompleta: ${ausentes.length} créditos ativos ausentes; grupo preservado.`)
          }
          log(`[Grupo ${numGrupo} | ${modUpper}] Planos validados: ${planosList.length}`)
          if (!dbGrupo) {
            log(`Grupo ${numGrupo} não encontrado no banco. Criando novo grupo global...`)
            const { data: newGrupo, error: errNewG } = await admin
              .from('grupos_consorcio')
              .insert({
                empresa_origem_id: null,
                administradora_id: raconAdminId,
                codigo_grupo: `${numGrupo} ${produto.toUpperCase()}`,
                modalidade: isImovelProd ? 'Imóvel' : 'Veículos',
                tipo_administradora_id: tipoIdProd,
                origem_governanca: 'GLOBAL',
                status_governanca: 'GLOBAL',
                visivel_franquia: true,
                ano_ultimo_reajuste: new Date().getFullYear(),
                data_ultimo_reajuste: new Date().toISOString(),
                status: 'Disponível',
                ativo: true,
              })
              .select('id, codigo_grupo, modalidade, tipo_administradora_id')
              .single()

            if (!errNewG && newGrupo) {
              dbGrupo = newGrupo
              mapDbGrupos.set(numGrupo, [...(mapDbGrupos.get(numGrupo) || []), newGrupo])
              totalGruposNovos++
            }
          }

          if (!dbGrupo) {
            log(`Aviso: Não foi possível obter ID do grupo ${numGrupo}. Pulando...`)
            continue
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
          const updateGrupoPayload = {
            tipo_administradora_id: tipoIdProd,
            ano_ultimo_reajuste: new Date().getFullYear(),
            data_ultimo_reajuste: new Date().toISOString(),
            visivel_franquia: true,
            status: 'Disponível',
            ativo: true,
            updated_at: new Date().toISOString(),
          }
          const firstCota = porCredito.values().next().value
          if (firstCota?.taxaAdm != null) updateGrupoPayload.taxa_administrativa_percentual = firstCota.taxaAdm
          if (firstCota?.fundoReserva != null) updateGrupoPayload.fundo_reserva_percentual = firstCota.fundoReserva

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

          const percentuaisEncontrados = new Set()
          for (const [, cotaData] of porCredito) {
            if (cotaData.parcelasReduzidas) {
              Object.keys(cotaData.parcelasReduzidas).forEach(p => {
                const n = Number(p)
                if (Number.isFinite(n) && n > 0 && n < 100) percentuaisEncontrados.add(n)
              })
            }
          }
          if (percentuaisEncontrados.size > 0) {
            const pList = Array.from(percentuaisEncontrados).sort((a, b) => a - b)
            updateGrupoPayload.tem_parcela_reduzida = true
            updateGrupoPayload.percentuais_parcela_reduzida = pList
            updateGrupoPayload.percentual_parcela_reduzida = pList.includes(60) ? 60 : pList[0]
          }

          if (Object.keys(updateGrupoPayload).length > 0) {
            await admin.from('grupos_consorcio').update(updateGrupoPayload).eq('id', dbGrupo.id)
          }

          // Garante modalidades de comissão ativas no grupo
          const modalidadesRacon = [
            '05b2d9fd-d552-47b5-b5c7-7e99e6cb773e', // INTEGRAL
            '84a6a781-ba3a-49cd-ac41-857ceaa63478', // REDUZIDA_ABAIXO_59
            '0e8c6d88-9e17-4be5-b41c-a6e6826751ae', // REDUZIDA_60_99
          ]
          for (const mId of modalidadesRacon) {
            await admin.from('grupos_modalidades_disponiveis').upsert({
              grupo_id: dbGrupo.id,
              administradora_modalidade_id: mId,
              ativo: true,
              configuracao: { modo_reduzido: 'padrao', origem: 'ADMINISTRADORA_PADRAO' },
            }, { onConflict: 'grupo_id,administradora_modalidade_id' })
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

          // A ausência em uma leitura do portal não comprova indisponibilidade.
          // Preserva cotas existentes: paginação/rolagem incompleta não pode inativá-las.

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
