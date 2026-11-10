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

// O Newcon recebe somente a parte numérica do grupo/cota, com largura fixa.
// Mantemos a mesma normalização usada pelo robô de boletos (ex.: "1553 IMÓVEL"
// vira "001553") para que a busca direcionada encontre o consorciado.
export function normalizarNumeroPortal(valor, tamanho) {
  const numero = String(valor || '').match(/\d+/)?.[0]
  return numero ? numero.padStart(tamanho, '0') : ''
}

/**
 * Extrai número do protocolo de mensagem de alert/dialog do Newcon
 * Ex: "Anote os números dos protocolos: Lance Livre: 5735314" -> "5735314"
 */
export function extrairProtocoloAlert(msg) {
  if (!msg || typeof msg !== 'string') return null
  const matchEspec = msg.match(/protocolo[s]?\s*:\s*(?:[^0-9]*?)(\d{5,12})/i) ||
                     msg.match(/lance\s+(?:livre|fixo|segundo\s+fixo|2[º°]\s*fixo)\s*:\s*(\d{5,12})/i)
  return matchEspec ? matchEspec[1] : null
}

function normalizarPercentualEmbutido(valor, fallback = 25) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? Math.max(0, Math.floor(numero + 1e-9)) : fallback
}

function parseValorMonetario(valor) {
  const texto = String(valor ?? '').replace(/[^0-9,.-]/g, '').trim()
  if (!texto) return null
  const normalizado = texto.includes(',')
    ? texto.replace(/\./g, '').replace(',', '.')
    : texto
  const numero = Number(normalizado)
  return Number.isFinite(numero) && numero > 0 ? numero : null
}

export function calcularEmbutidoValido(percentualOferta, percentualGrupo) {
  const ofertaPct = Number(percentualOferta)
  const embutidoPct = normalizarPercentualEmbutido(percentualGrupo)
  if (!Number.isFinite(ofertaPct) || ofertaPct <= 0) return embutidoPct
  // Tanto o lance quanto o embutido são percentuais do saldo devedor lido no
  // Newcon. Nunca use o crédito contratado para reduzir o embutido: um valor
  // legado de crédito pode transformar 25% em 3%, mesmo quando a estratégia e
  // a modalidade permitem 25%. O único teto operacional é o próprio lance.
  return Math.max(0, Math.min(embutidoPct, Math.floor(ofertaPct + 1e-9)))
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

export function alinharFixosComPortal(estrategia, portal) {
  // A configuração salva é uma intenção operacional; a tela da cota no
  // Newcon é a fonte de verdade para as modalidades que podem ser ofertadas.
  // Nunca "rebaixamos" um fixo de 50% para 25%: se ele não existir na cota,
  // apenas o desativamos nesta execução e preservamos as demais modalidades.
  const resultado = {
    ...estrategia,
    lance_fixo_ativo: false,
    segundo_lance_fixo_ativo: false,
    modalidades_indisponiveis: [],
  }
  const campos = ['lance_fixo', 'segundo_lance_fixo']
  const percentuais = [portal.lanceFixoPct, portal.segundoLanceFixoPct]
  for (const origem of campos) {
    if (!estrategia[`${origem}_ativo`]) continue
    const percentual = Number(estrategia[`${origem}_percentual`] || percentuais[campos.indexOf(origem)])
    const indice = percentuais.findIndex(valor => Number(valor) > 0 && Math.abs(Number(valor) - percentual) < 0.0001)
    if (indice < 0) {
      resultado.modalidades_indisponiveis.push(`${percentual}%`)
      continue
    }
    const destino = campos[indice]
    resultado[`${destino}_ativo`] = true
    resultado[`${destino}_percentual`] = percentual
    resultado[`${destino}_embutido_percentual`] = estrategia[`${origem}_embutido_percentual`]
  }
  return resultado
}

function dataLocalValida(valor) {
  if (!valor) return null
  const texto = String(valor).trim()
  const br = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]), 12)
  const iso = texto.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12)
  const data = new Date(texto)
  return Number.isNaN(data.getTime()) ? null : data
}

/**
 * O checkbox do Newcon repete a oferta em seis assembleias. A validade não é
 * a data em que a estratégia foi salva: ela começa no ciclo de assembleia.
 * Ex.: oferta até 09/10 (corte dia 10) termina em março; oferta em 30/10 ou
 * no ciclo de novembro termina em abril. Mantemos o dia da oferta somente
 * para a data exibida, avançando cinco meses para cobrir seis assembleias.
 */
export function calcularVencimentoSeisAssembleias(dataOferta, dataAssembleia = null, diaCorte = 10) {
  const oferta = dataLocalValida(dataOferta)
  if (!oferta) return null
  const assembleia = dataLocalValida(dataAssembleia)
  const inicio = new Date(oferta.getFullYear(), oferta.getMonth(), oferta.getDate(), 12)

  if (assembleia) {
    const mesAnterior = new Date(assembleia.getFullYear(), assembleia.getMonth() - 1, 1, 12)
    const ofertaNoMesAnterior = oferta.getFullYear() === mesAnterior.getFullYear()
      && oferta.getMonth() === mesAnterior.getMonth()
    const ofertaNoMesDaAssembleia = oferta.getFullYear() === assembleia.getFullYear()
      && oferta.getMonth() === assembleia.getMonth()

    if (ofertaNoMesAnterior && oferta.getDate() >= diaCorte) {
      inicio.setFullYear(assembleia.getFullYear(), assembleia.getMonth())
    } else if (ofertaNoMesDaAssembleia) {
      inicio.setFullYear(assembleia.getFullYear(), assembleia.getMonth())
    }
  }

  inicio.setMonth(inicio.getMonth() + 5)
  return `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}-${String(inicio.getDate()).padStart(2, '0')}`
}

export function devePularLanceVencido(estrategia, incluirLancesVencidos, agora = new Date()) {
  if (incluirLancesVencidos || !estrategia?.data_vencimento) return false
  const vencimento = new Date(`${estrategia.data_vencimento}T23:59:59`)
  return !Number.isNaN(vencimento.getTime()) && vencimento < agora
}

export async function executarRoboLances({
  page,
  context,
  config,
  admin,
  log,
  screenshotsDir,
  verificarCancelamento,
  dryRun = false,
}) {
  log('=== INICIANDO ROBÔ DE OFERTA DE LANCES AUTOMÁTICOS DA FRANQUIA ===')
  const incluirLancesVencidos = config.configuracao_tarefas?.modo_execucao_lances === 'TODOS'
  log(incluirLancesVencidos
    ? 'Modo de execução: todas as cotas marcadas, incluindo estratégias com lance vencido.'
    : 'Modo de execução: somente cotas sem lance vencido.')

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

  const { data: clientesBloqueadosDb } = await admin
    .from('clientes')
    .select('id, nome, cpf_cnpj, documento_normalizado')
    .eq('empresa_id', targetEmpresaId)
    .eq('nao_executar_lance_automatico', true)

  const clientesBloqueadosIds = new Set(
    (clientesBloqueadosDb || []).map((cli) => cli.id).filter(Boolean)
  )
  const clientesBloqueadosDocs = new Set(
    (clientesBloqueadosDb || [])
      .flatMap((cli) => [cli.cpf_cnpj, cli.documento_normalizado])
      .map((doc) => String(doc || '').replace(/\D/g, ''))
      .filter((doc) => doc.length >= 11)
  )
  const clientesBloqueadosNomes = new Set(
    (clientesBloqueadosDb || [])
      .map((cli) => String(cli.nome || '').trim().toUpperCase())
      .filter(Boolean)
  )

  const clienteEstaBloqueadoParaLance = (vendaObj) => {
    if (!vendaObj) return false
    if (vendaObj.cliente?.nao_executar_lance_automatico === true) return true
    if (vendaObj.cliente_id && clientesBloqueadosIds.has(vendaObj.cliente_id)) return true
    const doc = String(vendaObj.cliente_cpf_cnpj || '').replace(/\D/g, '')
    if (doc.length >= 11 && clientesBloqueadosDocs.has(doc)) return true
    const nome = String(vendaObj.cliente_nome || '').trim().toUpperCase()
    if (!doc && nome && clientesBloqueadosNomes.has(nome)) return true
    return false
  }

  let listaCotas = []

  let cotasQuery = admin
    .from('cotas_definitivas')
    .select(`
      id,
      venda_id,
      empresa_id,
      numero_grupo,
      numero_cota,
      robo_boleto_login,
      valor_credito,
      snapshot_cota,
      parcela,
      status,
      grupo_id,
      venda:vendas(id, cliente_id, cliente_nome, cliente_cpf_cnpj, cliente_telefone, cliente:clientes(id, nao_executar_lance_automatico)),
      grupo:grupos_consorcio(codigo_grupo, percentual_lance_embutido, permite_lance_embutido)
    `)
    .eq('empresa_id', targetEmpresaId)
    .neq('status', 'cancelada')
    .neq('status', 'contemplada')
    .not('numero_cota', 'is', null)
    .order('numero_grupo', { ascending: true })

  const loginLance = config.configuracao_tarefas?.robo_boleto_login || null
  if (loginLance) {
    // O mesmo vínculo operacional usado pelo robô de boletos escolhe o robô de lances.
    cotasQuery = cotasQuery.eq('robo_boleto_login', loginLance)
  }

  const { data: cotasDb, error: errCotas } = await cotasQuery
  if (errCotas) throw new Error(`Falha ao consultar cotas autorizadas: ${errCotas.message}`)
  if (!dryRun && !loginLance) throw new Error('Defina o login operacional para executar lances.')

  // Execuções direcionadas (por exemplo, o botão "processar esta cota")
  // devem limitar o robô aos IDs explicitamente enviados na fila. Sem esse
  // recorte, o robô continuava elegendo todas as cotas do login configurado.
  const cotasAlvoIds = Array.isArray(config.configuracao_tarefas?.cotas_alvo_ids)
    ? new Set(config.configuracao_tarefas.cotas_alvo_ids.filter(Boolean))
    : null
  const cotasDbProcessaveis = cotasAlvoIds && cotasAlvoIds.size > 0
    ? (cotasDb || []).filter((cota) => cotasAlvoIds.has(cota.id))
    : cotasDb

  if (!dryRun && !cotasDbProcessaveis?.length) {
    log('Nenhuma cota autorizada para o login selecionado.')
    return { cotasElegiveis: 0, cotasProcessadas: 0, lancesOfertados: 0 }
  }
  if (cotasDbProcessaveis && cotasDbProcessaveis.length > 0) {
    // 1.1. Verifica cotas que já possuem lance ativo com repetição por 6 assembleias
    const isExecucaoDirecionada = Boolean(cotasAlvoIds && cotasAlvoIds.size > 0)
    const isManualTest = dryRun && Boolean(
      config.filtro_grupo || config.grupo_teste || config.filtro_cotas || config.cotas_teste
      || isExecucaoDirecionada,
    )
    if (isExecucaoDirecionada) {
      log('Execução direcionada: somente as cotas escolhidas serão processadas; o bloqueio geral de repetição não será aplicado.')
    }
    const cotasBloqueadas6Meses = new Set()

    const cotaIds = cotasDbProcessaveis.map(c => c.id)
    const { data: estrategiasCotas } = await admin
      .from('cota_estrategias_lance')
      .select('cota_definitiva_id, ativa, lance_livre_ativo, lance_livre_percentual, lance_livre_embutido_percentual, lance_fixo_ativo, lance_fixo_percentual, lance_fixo_embutido_percentual, segundo_lance_fixo_ativo, segundo_lance_fixo_percentual, segundo_lance_fixo_embutido_percentual, repetir_seis_assembleias, ultimo_lance_ofertado_em, data_vencimento, confirmado')
      .in('cota_definitiva_id', cotaIds)
    const estrategiasMap = new Map((estrategiasCotas || []).map(e => [e.cota_definitiva_id, e]))

    // Um protocolo ou comprovante individual é evidência de que uma oferta já
    // chegou ao Newcon, ainda que a confirmação consolidada da estratégia tenha
    // falhado depois. Nunca reenviar automaticamente nesses casos: a cota precisa
    // ser conciliada para não duplicar uma oferta financeira real.
    const { data: ofertasJaRegistradas, error: errOfertasJaRegistradas } = await admin
      .from('cota_lances_ofertados')
      .select('cota_definitiva_id, protocolo, comprovante_storage_path, comprovante_url')
      .in('cota_definitiva_id', cotaIds)
    if (errOfertasJaRegistradas) {
      throw new Error(`Falha ao verificar ofertas já registradas: ${errOfertasJaRegistradas.message}`)
    }
    const cotasComOfertaRegistrada = new Set(
      (ofertasJaRegistradas || [])
        .filter((oferta) => Boolean(
          String(oferta.protocolo || '').trim()
          || String(oferta.comprovante_storage_path || '').trim()
          || String(oferta.comprovante_url || '').trim(),
        ))
        .map((oferta) => oferta.cota_definitiva_id)
        .filter(Boolean),
    )
    // Uma reoferta direcionada é uma correção operacional explícita da cota
    // escolhida. Ela não pode ser descartada pelo bloqueio geral de seis
    // assembleias, que continua obrigatório nas execuções em lote.
    if (!isManualTest && !isExecucaoDirecionada) {
      const { data: estsAtivas } = await admin
        .from('cota_estrategias_lance')
        .select('cota_definitiva_id, repetir_seis_assembleias, ultimo_lance_ofertado_em, data_vencimento, confirmado')
        .in('cota_definitiva_id', cotaIds)
        .eq('confirmado', true)
        .eq('repetir_seis_assembleias', true)

      if (estsAtivas && estsAtivas.length > 0) {
        const agoraMs = Date.now()
        for (const est of estsAtivas) {
          if (est.ultimo_lance_ofertado_em) {
            const dataOfertadaMs = new Date(est.ultimo_lance_ofertado_em).getTime()
            const dataVencimento = est.data_vencimento ? new Date(`${est.data_vencimento}T12:00:00`) : null
            if (dataVencimento && !Number.isNaN(dataVencimento.getTime())) {
              if (new Date(agoraMs) < dataVencimento) {
                cotasBloqueadas6Meses.add(est.cota_definitiva_id)
              }
            } else if (Math.floor((agoraMs - dataOfertadaMs) / (1000 * 60 * 60 * 24)) < 170) {
              cotasBloqueadas6Meses.add(est.cota_definitiva_id)
            }
          }
        }
      }
    }

    listaCotas = cotasDbProcessaveis
      .filter(c => {
        if (clienteEstaBloqueadoParaLance(c.venda)) {
          log(`[CLIENTE MARCADO NÃO EXECUTAR] Ignorando Grupo ${c.numero_grupo} / Cota ${c.numero_cota} (${c.venda?.cliente_nome || 'Consorciado'}) — cliente marcado para não executar lance automático.`)
          return false
        }
        if (cotasBloqueadas6Meses.has(c.id)) {
          log(`[LANCE ATIVO 6 ASSEMBLEIAS] Cota Grupo ${c.numero_grupo} / Cota ${c.numero_cota} permanece protegida até uma assembleia antes do vencimento configurado.`)
          return false
        }
        const estrategia = estrategiasMap.get(c.id)
        if (cotasComOfertaRegistrada.has(c.id)) {
          log(`[OFERTA JÁ REGISTRADA] Ignorando Grupo ${c.numero_grupo} / Cota ${c.numero_cota}: há protocolo ou comprovante salvo sem confirmação consolidada. Concilie a cota antes de uma nova oferta para evitar duplicidade.`)
          return false
        }
        // A confirmação é o registro posterior de um lance já enviado. Ela não
        // pode ser pré-requisito para a execução: a estratégia salva e ativa é
        // justamente a autorização para o robô ofertar o lance configurado.
        if (!estrategia || estrategia.ativa === false || !(
          estrategia.lance_livre_ativo || estrategia.lance_fixo_ativo || estrategia.segundo_lance_fixo_ativo
        )) {
          log(`[SEM ESTRATÉGIA] Ignorando Grupo ${c.numero_grupo} / Cota ${c.numero_cota}: nenhuma estratégia ativa configurada em /erp/lances.`)
          return false
        }
        if (!isManualTest && !isExecucaoDirecionada && devePularLanceVencido(estrategia, incluirLancesVencidos)) {
          log(`[LANCE VENCIDO] Ignorando Grupo ${c.numero_grupo} / Cota ${c.numero_cota}: selecione “Executar todas” para renovar uma estratégia vencida.`)
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
        snapshot_cota: c.snapshot_cota,
        parcela: c.parcela,
        grupo_embutido_pct: c.grupo?.percentual_lance_embutido || 25,
        estrategia: estrategiasMap.get(c.id) || null,
      }))
  } else {
    // Fallback: cotas de vendas confirmadas não contempladas
    const { data: vendasDb } = await admin
      .from('vendas')
      .select('id, cliente_id, numero_grupo, cliente_nome, cliente_cpf_cnpj, cliente_telefone, parcela, valor_credito, snapshot_venda, cliente:clientes(id, nao_executar_lance_automatico)')
      .eq('empresa_id', targetEmpresaId)
      .neq('status', 'cancelada')

    if (vendasDb && vendasDb.length > 0) {
      for (const v of vendasDb) {
        if (clienteEstaBloqueadoParaLance(v)) {
          continue
        }
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
  if (dryRun && filtroGrupo && filtroCotasArray.length > 0) {
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
    return { cotasElegiveis: 0, cotasProcessadas: 0, lancesOfertados: 0 }
  }

  let totalLancesOfertados = 0
  let totalCotasProcessadas = 0
  let totalErros = 0

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
      // O Newcon pode manter requisições abertas e nunca emitir o evento
      // domcontentloaded, embora o formulário já esteja utilizável.
      waitUntil: 'commit',
      timeout: 30_000,
    })
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {
    log('Aviso: o Newcon não sinalizou domcontentloaded; continuando com o formulário da tela de Consorciados.')
  })
  await page.waitForTimeout(3000)

  // O menu do Newcon faz postback em alguns acessos e navegação completa em
  // outros. Esperar somente pela URL deixa o robô parado até o timeout mesmo
  // quando o formulário de Oferta de Lance já foi carregado no documento.
  const aguardarTelaOfertaLance = async () => {
    const urlOferta = (url) => url.pathname.includes('frmConCpCadCredenciamentoLance') || url.href.includes('CredenciamentoLance')
    const campoOferta = page.locator(
      '#ctl00_Conteudo_edtOferta, #ctl00_Conteudo_rgLance_0, #ctl00_Conteudo_btnConfirma, input[value="Confirmar"]',
    ).first()

    if (!urlOferta(new URL(page.url())) || !(await campoOferta.isVisible().catch(() => false))) {
      const resultado = await Promise.race([
        page.waitForURL(urlOferta, { timeout: 45_000 }).then(() => 'url').catch(() => null),
        campoOferta.waitFor({ state: 'visible', timeout: 45_000 }).then(() => 'formulario').catch(() => null),
      ])

      if (!resultado && !(await campoOferta.isVisible().catch(() => false))) {
        throw new Error(`O postback do menu Oferta de Lance não carregou o formulário (URL atual: ${page.url()}).`)
      }
    }

    await campoOferta.waitFor({ state: 'visible', timeout: 15_000 })
    await page.waitForTimeout(1500)
  }

  // 3. Itera sobre cada cota
  for (let i = 0; i < listaCotas.length; i++) {
    await verificarCancelamento?.()
    const item = listaCotas[i]
    let dialogHandler
    let popupHandler
    log(`[${i + 1}/${listaCotas.length}] Processando ofertas da Cota Grupo ${item.numero_grupo} / Cota ${item.numero_cota} (${item.cliente_nome})...`)

    try {
      if (!page.url().includes('frmConAtSrcConsorciado')) {
        await page.goto('https://nwcweb.randonconsorcios.com.br/CONAT/frmConAtSrcConsorciado.aspx', {
          waitUntil: 'commit',
          timeout: 25_000,
        })
        await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {
          log('Aviso: a tela de localização não sinalizou domcontentloaded; continuando com a busca por grupo e cota.')
        })
        await page.waitForTimeout(2000)
      }

      // Preenche Grupo (com 6 dígitos se necessário)
      const grupoFormatado = normalizarNumeroPortal(item.numero_grupo, 6)
      // Algumas versões do Newcon renderizam os campos sem name/id semântico.
      // Sempre escolhemos os campos visíveis do formulário: Grupo (6 dígitos),
      // Cota (4) e complemento (2). Isso evita selecionar inputs legados ocultos.
      const localizarCampoVisivel = async (padrao, fallbackIndex, descricao) => {
        for (const frame of page.frames()) {
          const campos = await frame.locator('input').evaluateAll((inputs) => inputs.map((el, index) => {
            const rect = el.getBoundingClientRect()
            const estilo = window.getComputedStyle(el)
            return { index, type: el.type, value: (el.value || '').trim(), visivel: rect.width > 0 && rect.height > 0 && estilo.visibility !== 'hidden' && estilo.display !== 'none' }
          }).filter((campo) => campo.visivel && campo.type !== 'hidden')).catch(() => [])
          const encontrado = campos.find((campo) => padrao.test(campo.value)) || campos[fallbackIndex]
          if (encontrado) return frame.locator('input').nth(encontrado.index)
        }
        throw new Error(`Campo ${descricao} visível não encontrado na tela de localização.`)
      }

      let preenchimentoPorCoordenadas = false
      let inputGrupo
      try {
        inputGrupo = await localizarCampoVisivel(/^\d{6}$/, 0, 'Grupo')
        await inputGrupo.waitFor({ state: 'visible', timeout: 10_000 })
        await inputGrupo.click()
        await inputGrupo.fill(grupoFormatado)
      } catch (erroCampoGrupo) {
        log(`Aviso: DOM do Grupo não exposto pelo Newcon (${erroCampoGrupo.message}); usando fallback visual do formulário legado.`)
        preenchimentoPorCoordenadas = true
        await page.mouse.click(560, 250)
        await page.keyboard.press('Control+A')
        await page.keyboard.type(grupoFormatado)
      }
      await page.waitForTimeout(400)

      // Preenche Cota (com 4 dígitos se necessário)
      const cotaFormatada = normalizarNumeroPortal(item.numero_cota, 4)
      if (preenchimentoPorCoordenadas) {
        await page.mouse.click(625, 250)
        await page.keyboard.press('Control+A')
        await page.keyboard.type(cotaFormatada)
      } else {
        const inputCota = await localizarCampoVisivel(/^\d{4}$/, 1, 'Cota')
        await inputCota.waitFor({ state: 'visible', timeout: 8_000 })
        await inputCota.click()
        await inputCota.fill(cotaFormatada)
      }
      await page.waitForTimeout(400)

      // Clica em [Localizar]
      const btnLocalizar = page.locator('input[value="Localizar"], input[id*="btnLocalizar"], button:has-text("Localizar")').first()
      await btnLocalizar.click({ noWaitAfter: true })
      await Promise.race([
        page.waitForURL((url) => url.pathname.includes('frmConAtCnsAtendimento'), { timeout: 45_000 }).catch(() => null),
        page.locator('a[href*="frmConAtCnsAtendimento"]').first().waitFor({ state: 'visible', timeout: 45_000 }).catch(() => null),
      ])
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {})
      await page.waitForTimeout(2000)

      // Se abriu lista de resultados, clica no primeiro link correspondente
      if (!page.url().includes('frmConAtCnsAtendimento')) {
        const linkResultado = page.locator('a[href*="frmConAtCnsAtendimento"], a:has-text("' + item.numero_cota + '")').first()
        if (await linkResultado.isVisible({ timeout: 5000 }).catch(() => false)) {
          await linkResultado.click()
          await page.waitForLoadState('domcontentloaded').catch(() => {})
          await page.waitForTimeout(3000)
        } else {
          log(`Cota ${item.numero_grupo}/${item.numero_cota} não localizada no Newcon. Pulando...`)
          continue
        }
      }
      if (!page.url().includes('frmConAtCnsAtendimento')) {
        throw new Error(`A localização não abriu a tela de Atendimento da cota (URL atual: ${page.url()}).`)
      }

      // 4. Clica em "Oferta de Lance" no menu lateral Operações
      const saldoDevedorTela = await page.evaluate(() => {
        const texto = document.body?.innerText || ''
        const match = texto.match(/saldo\s+devedor\s*:?\s*R?\$?\s*([0-9.]+,[0-9]{2})/i)
        return match ? match[1] : null
      }).catch(() => null)
      if (saldoDevedorTela) log(`Saldo devedor identificado na cota: R$ ${saldoDevedorTela}`)
      log('Localizando e clicando em "Oferta de Lance" no menu Operações...')
      const linksOferta = page.locator('a:has-text("Oferta de Lance"), a[href*="frmConCpCadCredenciamentoLance"]').filter({ hasNotText: 'Lote' })
      let linkOfertaLance = null
      for (const candidato of await linksOferta.all()) {
        if (await candidato.isVisible().catch(() => false)) {
          linkOfertaLance = candidato
          break
        }
      }
      if (!linkOfertaLance) throw new Error('Link visível de Oferta de Lance não encontrado no menu Operações.')
      await linkOfertaLance.scrollIntoViewIfNeeded().catch(() => {})
      await linkOfertaLance.click({ noWaitAfter: true })

      await aguardarTelaOfertaLance()
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
        const dataAssInput = document.querySelector('input[name*="DataAssembleia"], input[id*="DataAssembleia"], input[name*="dtAssembleia"], input[id*="dtAssembleia"]')
        const dataAssTexto = dataAssInput ? (dataAssInput.value || dataAssInput.innerText || '') : ''
        const dataAssMatch = dataAssTexto.match(/\d{1,2}\/\d{1,2}\/\d{4}/)
          || (document.body?.innerText || '').match(/assembleia\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)

        // Bem / Valor
        const bemInput = document.querySelector('input[name*="txtVL_Bem"], span[id*="lblValorBem"]')
        const bemTexto = bemInput ? (bemInput.value || bemInput.innerText || '') : ''

        return {
          // Não presumir 25%: alguns grupos possuem somente Lance Livre.
          // Inventar esse valor fazia o robô tentar uma modalidade inexistente
          // e classificava a cota inteira como falha.
          lanceFixoPct: fixoTexto ? parseFloat(fixoTexto.replace(',', '.')) : null,
          segundoLanceFixoPct: fixo2Texto ? parseFloat(fixo2Texto.replace(',', '.')) : null,
          lanceMaximoPct: (() => {
            const match = (document.body?.innerText || '').match(/lance\s+m[aá]ximo\s*:\s*([\d.,]+)\s*%/i)
            return match ? parseFloat(match[1].replace('.', '').replace(',', '.')) : null
          })(),
          assembleia: assTexto,
          dataAssembleia: dataAssMatch ? dataAssMatch[0] : null,
          valorBem: bemTexto,
        }
      })

      const estrategiaCota = item.estrategia ? alinharFixosComPortal(item.estrategia, dadosTelaLance) : null
      if (estrategiaCota?.modalidades_indisponiveis?.length) {
        log(`[MODALIDADE AJUSTADA] Fixo(s) ${estrategiaCota.modalidades_indisponiveis.join(', ')} não disponível(is) nesta cota no Newcon. A oferta seguirá apenas com as modalidades realmente habilitadas.`)
      }
      if (estrategiaCota) {
        dadosTelaLance.lanceFixoPct = estrategiaCota.lance_fixo_ativo
          ? Number(estrategiaCota.lance_fixo_percentual || dadosTelaLance.lanceFixoPct || 0)
          : null
        dadosTelaLance.segundoLanceFixoPct = estrategiaCota.segundo_lance_fixo_ativo
          ? Number(estrategiaCota.segundo_lance_fixo_percentual || dadosTelaLance.segundoLanceFixoPct || 0)
          : null

        const temModalidadeExecutavel = Boolean(
          estrategiaCota.lance_livre_ativo
          || estrategiaCota.lance_fixo_ativo
          || estrategiaCota.segundo_lance_fixo_ativo,
        )
        if (!temModalidadeExecutavel) {
          if (!dryRun && item.cota_definitiva_id) {
            const { error: syncError } = await admin
              .from('cota_estrategias_lance')
              .update({
                ativa: false,
                lance_fixo_ativo: false,
                segundo_lance_fixo_ativo: false,
                updated_at: new Date().toISOString(),
              })
              .eq('cota_definitiva_id', item.cota_definitiva_id)
            if (syncError) throw new Error(`Não foi possível sincronizar a estratégia sem modalidade do Newcon: ${syncError.message}`)
          }
          log(`[SEM MODALIDADE EXECUTÁVEL] Grupo ${item.numero_grupo} / Cota ${item.numero_cota}: estratégia foi inativada para revisão, sem oferta e sem falha do robô.`)
          totalCotasProcessadas++
          continue
        }
      }

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
      const embutidoMaximoPct = normalizarPercentualEmbutido(item.grupo_embutido_pct || 25.0)
      const saldoDevedor = parseValorMonetario(saldoDevedorTela)
      // O Newcon calcula o embutido sobre o valor do bem exibido na tela,
      // que pode ser diferente do snapshot de crédito armazenado no ERP.
      // A tela do portal é a fonte de verdade para evitar rejeições monetárias.
      const valorBemRacon = parseValorMonetario(dadosTelaLance.valorBem)
      const creditoContratado = valorBemRacon || Number(item.valor_credito) || null

      if (!dryRun && item.cota_definitiva_id && (saldoDevedor > 0 || valorBemRacon > 0)) {
        const snapshotAtual = item.snapshot_cota && typeof item.snapshot_cota === 'object' ? item.snapshot_cota : {}
        const snapshotRacon = {
          ...snapshotAtual,
          ...(saldoDevedor > 0 ? { saldo_devedor: Number(saldoDevedor.toFixed(2)) } : {}),
          ...(valorBemRacon > 0 ? { valor_bem_racon: Number(valorBemRacon.toFixed(2)) } : {}),
          fonte_dados_racon: 'NEWCON',
          dados_racon_atualizados_em: new Date().toISOString(),
        }
        const { error: snapshotError } = await admin
          .from('cotas_definitivas')
          .update({
            snapshot_cota: snapshotRacon,
            // Corrige cotas antigas/importadas que ainda mostram R$ 0,00 no
            // ERP. O valor exibido pelo Newcon é a origem auditável.
            ...(Number(item.valor_credito || 0) <= 0 && valorBemRacon > 0
              ? { valor_credito: Number(valorBemRacon.toFixed(2)) }
              : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.cota_definitiva_id)
          .eq('empresa_id', item.empresa_id)
        if (snapshotError) {
          log(`Aviso: não foi possível atualizar o saldo da Racon no ERP para ${item.numero_grupo}/${item.numero_cota}: ${snapshotError.message}`)
        } else {
          log(`ERP atualizado com os dados lidos na Racon para ${item.numero_grupo}/${item.numero_cota}.`)
        }
      }
      if (!(saldoDevedor > 0)) {
        throw new Error('Newcon não apresentou um saldo devedor positivo para a cota. Oferta não enviada.')
      }
      const embutidoLivreConfigurado = estrategiaCota?.lance_livre_embutido_percentual == null
        ? embutidoMaximoPct
        : Math.min(normalizarPercentualEmbutido(estrategiaCota.lance_livre_embutido_percentual), embutidoMaximoPct)
      const embutidoFixoConfigurado = estrategiaCota?.lance_fixo_embutido_percentual == null
        ? Math.min(Number(dadosTelaLance.lanceFixoPct || 0), embutidoMaximoPct)
        : Math.min(normalizarPercentualEmbutido(estrategiaCota.lance_fixo_embutido_percentual), embutidoMaximoPct)
      const embutidoSegundoFixoConfigurado = estrategiaCota?.segundo_lance_fixo_embutido_percentual == null
        ? Math.min(Number(dadosTelaLance.segundoLanceFixoPct || 0), embutidoMaximoPct)
        : Math.min(normalizarPercentualEmbutido(estrategiaCota.segundo_lance_fixo_embutido_percentual), embutidoMaximoPct)
      const embutidoFixoPct = calcularEmbutidoValido(dadosTelaLance.lanceFixoPct || 0, embutidoFixoConfigurado)
      const embutidoSegundoFixoPct = calcularEmbutidoValido(dadosTelaLance.segundoLanceFixoPct || 0, embutidoSegundoFixoConfigurado)

      // Regra do Usuário:
      // "lance fixo sempre 1,1234 + que o lance embutido para todos clientes. Exemplo desse grupo 1273 cota 209: embutido maximo de 25% ai o livre 26,1234"
      const livrePctConfigurado = estrategiaCota?.lance_livre_percentual == null ? null : Number(estrategiaCota.lance_livre_percentual)
      const livrePctSolicitado = livrePctConfigurado ?? calcularRegraLanceLivre(embutidoLivreConfigurado).livrePct
      const livrePctCalculado = dadosTelaLance.lanceMaximoPct
        ? Math.min(livrePctSolicitado, dadosTelaLance.lanceMaximoPct)
        : livrePctSolicitado
      const embutidoLivrePct = calcularEmbutidoValido(livrePctCalculado, embutidoLivreConfigurado)
      if (dryRun) {
        log(`[TESTE] Grupo ${item.numero_grupo} / Cota ${item.numero_cota}: tela de oferta carregada e parâmetros lidos. Nenhuma oferta confirmada.`)
        totalCotasProcessadas++
        continue
      }
      if (saldoDevedor && creditoContratado) {
        log(`Embutidos limitados pelo valor da oferta: livre ${embutidoLivrePct}%, fixo ${embutidoFixoPct}%, 2º fixo ${embutidoSegundoFixoPct}% (saldo R$ ${saldoDevedor.toFixed(2)}, crédito R$ ${creditoContratado.toFixed(2)})`)
      }
      const strLivrePct = livrePctCalculado.toFixed(4).replace('.', ',')
      const strEmbutidoPct = embutidoLivrePct.toFixed(4).replace('.', ',')

      let protocoloLivre = null
      let protocoloFixo = null
      let protocoloSegundoFixo = null

      let compLivre = null
      let compFixo = null
      let compSegundoFixo = null

      // Listener contínuo de dialogs do navegador (lida com confirmações intermediárias e alertas de protocolo)
      let ultimoProtocoloCapturado = null
      let erroLancePortal = null
      dialogHandler = async (dialog) => {
        const msg = dialog.message() || ''
        log(`Dialog recebido do Newcon: "${msg}"`)
        if (/maior que o máximo permitido|máximo permitido|não permitido|nao permitido|maior que o valor gerado pela oferta|valor do lance embutido.*maior/i.test(msg)) {
          erroLancePortal = msg
        }
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
      popupHandler = (p) => {
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

      const lerPercentualCampo = async (selector) => {
        const valor = await page.locator(selector).first().inputValue().catch(() => '')
        const numero = Number(String(valor).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, ''))
        return Number.isFinite(numero) ? numero : null
      }

      const validarPercentualOferta = async (percentualEsperado, modalidade) => {
        const percentualAtual = await lerPercentualCampo('#ctl00_Conteudo_edtOferta')
        if (percentualAtual == null || Math.abs(percentualAtual - percentualEsperado) > 0.001) {
          throw new Error(`Newcon não aplicou o Lance ${modalidade} corretamente: tela=${percentualAtual == null ? 'vazio' : percentualAtual.toFixed(4)}%, esperado=${percentualEsperado.toFixed(4)}%. Oferta não enviada.`)
        }
        log(`Valor conferido na tela para ${modalidade}: ${percentualAtual.toFixed(4)}%`)
      }

      const validarPercentualCampo = async (selector, percentualEsperado, campo) => {
        const percentualAtual = await lerPercentualCampo(selector)
        if (percentualAtual == null || Math.abs(percentualAtual - percentualEsperado) > 0.001) {
          throw new Error(`Newcon não aplicou ${campo} corretamente: tela=${percentualAtual == null ? 'vazio' : percentualAtual.toFixed(4)}%, esperado=${percentualEsperado.toFixed(4)}%. Oferta não enviada.`)
        }
        log(`Valor conferido na tela para ${campo}: ${percentualAtual.toFixed(4)}%`)
      }

      // Função auxiliar para capturar o comprovante, salvar no Supabase Storage e retornar da tela de relatório
      const voltarDoRelatorio = async (tipoLance, protocolo, percentualLance, percentualEmbutido) => {
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

          // Cada modalidade recebe seu próprio PDF. O CDP funciona também no Chrome
          // visível/oculto usado pelo robô; o fallback PNG só ocorre se o portal
          // bloquear a impressão e mantém a evidência, sem sobrescrever outra.
          // O Storage rejeita chaves com espaços, acentos e outros caracteres
          // vindos da descrição do grupo/cota. A chave precisa ser estável e
          // segura mesmo quando o grupo contém texto como "1553 IMÓVEL".
          const normalizarNomeStorage = (valor) => String(valor ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .toLowerCase()
          const baseNome = `comprovante_${normalizarNomeStorage(tipoLance)}_g${normalizarNomeStorage(item.numero_grupo)}_c${normalizarNomeStorage(item.numero_cota)}_${Date.now()}`
          let arquivoBuffer = null
          let contentType = 'application/pdf'
          let extensao = 'pdf'
          try {
            const cdp = await targetPage.context().newCDPSession(targetPage)
            const pdfResult = await cdp.send('Page.printToPDF', {
              printBackground: true,
              preferCSSPageSize: true,
              landscape: false,
            })
            arquivoBuffer = Buffer.from(pdfResult.data, 'base64')
          } catch (pdfErr) {
            log(`Aviso: PDF do ${tipoLance} indisponível (${pdfErr.message}); salvando captura PNG como evidência.`)
            contentType = 'image/png'
            extensao = 'png'
            arquivoBuffer = await targetPage.screenshot({ fullPage: true }).catch(() => null)
          }

          const nomeArquivo = `${baseNome}.${extensao}`
          const localPath = path.join(screenshotsDir, nomeArquivo)
          if (arquivoBuffer) {
            await fs.promises.writeFile(localPath, arquivoBuffer).catch(() => {})
          }

          if (arquivoBuffer && admin && targetEmpresaId) {
            try {
              const storagePath = `${targetEmpresaId}/${item.cota_definitiva_id || item.numero_cota}/${nomeArquivo}`
              log(`Fazendo upload do comprovante para o Storage (lances-comprovantes): ${storagePath}...`)
              const { error: upErr } = await admin.storage
                .from('lances-comprovantes')
                .upload(storagePath, arquivoBuffer, { contentType, upsert: true })

              if (!upErr) {
                const { data: signData } = await admin.storage
                  .from('lances-comprovantes')
                  .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1 ano

                infoComprovante = {
                  storagePath,
                  url: signData?.signedUrl || null,
                  nome: `Comprovante ${tipoLance} - Grupo ${item.numero_grupo} / Cota ${item.numero_cota}.${extensao}`,
                }
                log(`Comprovante de ${tipoLance} salvo com sucesso no Storage!`)
              } else {
                throw new Error(`Falha ao subir comprovante de ${tipoLance} para o Storage: ${upErr.message}`)
              }
            } catch (errUpload) {
              throw new Error(`Erro no upload do comprovante de ${tipoLance}: ${errUpload.message}`)
            }
          }

          if (!infoComprovante?.storagePath || !infoComprovante?.url) {
            throw new Error(`Comprovante de ${tipoLance} não foi salvo no Storage; o lance não será registrado como concluído.`)
          }

          if (item.cota_definitiva_id) {
            const { error } = await admin.from('cota_lances_ofertados').insert({
              empresa_id: targetEmpresaId,
              cota_definitiva_id: item.cota_definitiva_id,
              numero_grupo: item.numero_grupo,
              numero_cota: item.numero_cota,
              assembleia_numero: dadosTelaLance.assembleia || null,
              tipo_lance: tipoLance,
              opcao_reducao: 'REDUZIR_PARCELA',
              percentual_lance: percentualLance,
              percentual_embutido: percentualEmbutido,
              protocolo,
              comprovante_storage_path: infoComprovante.storagePath,
              comprovante_url: infoComprovante.url,
              repetir_seis_assembleias: true,
              status: 'CONFIRMADO',
            })
            if (error) throw new Error(`Comprovante ${tipoLance} enviado ao Storage, mas o vínculo com a cota falhou: ${error.message}`)
            log(`Comprovante ${tipoLance} vinculado no ERP para ${item.numero_grupo}/${item.numero_cota}.`)
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
          throw new Error(`A tela de comprovante do Lance ${tipoLance} não foi aberta; o lance não será registrado como concluído.`)
        }
        return infoComprovante
      }

      // =========================================================================
      // ETAPA A: OFERTA DO LANCE LIVRE (1,1234 + embutido)
      // =========================================================================
      const deveOfertarLivre = estrategiaCota ? estrategiaCota.lance_livre_ativo === true : true
      if (deveOfertarLivre) {
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
      await validarPercentualOferta(livrePctCalculado, 'Livre')

      // 5. Dropdown Lance Embutido -> Percentual (%)
      const selectTipoEmbutido = page.locator('#ctl00_Conteudo_cbxLanceEmbutido, select[name*="cbxLanceEmbutido"]').first()
      if (await selectTipoEmbutido.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectTipoEmbutido.selectOption('%').catch(() => selectTipoEmbutido.selectOption({ label: 'Percentual' }))
        await page.waitForTimeout(400)
      }

      // 6. Preenche valor do Lance Embutido (25,0000)
      await preencherCampoComMascara('#ctl00_Conteudo_edtEmbutido', strEmbutidoPct)
      await validarPercentualCampo('#ctl00_Conteudo_edtEmbutido', embutidoLivrePct, 'embutido do Lance Livre')

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

      if (erroLancePortal) throw new Error(`Newcon rejeitou o Lance Livre: ${erroLancePortal}`)

      protocoloLivre = ultimoProtocoloCapturado
      log(`Protocolo do Lance Livre capturado: ${protocoloLivre || 'Confirmado via Web'}`)

      // 9. Aguarda relatório e clica em Voltar
      compLivre = await voltarDoRelatorio('LIVRE', protocoloLivre, livrePctCalculado, embutidoLivrePct)
      totalLancesOfertados++
      } else {
        log('Lance livre não configurado para esta cota; seguindo somente as modalidades selecionadas.')
      }

      // =========================================================================
      // ETAPA B: OFERTA DO LANCE FIXO (ex: 25%)
      // =========================================================================
      if (dadosTelaLance.lanceFixoPct && dadosTelaLance.lanceFixoPct > 0) {
        if (!page.url().includes('frmConCpCadCredenciamentoLance') && !page.url().includes('CredenciamentoLance')) {
          log('Reabrindo tela de Oferta de Lance para Lance Fixo...')
          const linkOfertaLance = page.locator('a:has-text("Oferta de Lance"), a[href*="frmConCpCadCredenciamentoLance"]').filter({ hasNotText: 'Lote' }).first()
          if (await linkOfertaLance.isVisible({ timeout: 8000 }).catch(() => false)) {
            await linkOfertaLance.click()
            await aguardarTelaOfertaLance()
          } else {
            await page.goto('https://nwcweb.randonconsorcios.com.br/CONCP/frmConCpCadCredenciamentoLance.aspx', { waitUntil: 'domcontentloaded' }).catch(() => {})
            await page.waitForTimeout(2000)
          }
        }

        const fixoPct = Number(dadosTelaLance.lanceFixoPct)
        const strFixoPct = fixoPct.toFixed(4).replace('.', ',')
        // Regra do usuário: "no lance fixo precisa preencher com o mesmo valor do lance quando for 25% quando é de 40% e só pode usar 25% de embutido preencher 25%"
        const embFixoPct = calcularEmbutidoValido(fixoPct, embutidoFixoPct, saldoDevedor, creditoContratado)
        const strEmbFixoPct = embFixoPct.toFixed(4).replace('.', ',')

        log(`--- Ofertando LANCE FIXO: ${strFixoPct}% (Embutido: ${strEmbFixoPct}%) ---`)

        // 1. Seleciona Radio "Fixo" (ctl00_Conteudo_rgLance_1, value LF)
        const rdoFixo = page.locator('#ctl00_Conteudo_rgLance_1, label[for="ctl00_Conteudo_rgLance_1"], label:text-is("Fixo")').first()
        if (await rdoFixo.isVisible({ timeout: 4000 }).catch(() => false)) {
          await rdoFixo.click({ force: true }).catch(() => {})
          await page.locator('#ctl00_Conteudo_rgLance_1').check({ force: true }).catch(() => {})
          await page.waitForTimeout(1800)
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
        await validarPercentualOferta(fixoPct, 'Fixo')

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
        await validarPercentualCampo('#ctl00_Conteudo_edtEmbutido', embFixoPct, 'embutido do Lance Fixo')

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

        if (erroLancePortal) throw new Error(`Newcon rejeitou o Lance Fixo: ${erroLancePortal}`)

        protocoloFixo = ultimoProtocoloCapturado
        log(`Protocolo do Lance Fixo capturado: ${protocoloFixo || 'Confirmado via Web'}`)

        compFixo = await voltarDoRelatorio('FIXO', protocoloFixo, fixoPct, embFixoPct)
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
            await aguardarTelaOfertaLance()
          } else {
            await page.goto('https://nwcweb.randonconsorcios.com.br/CONCP/frmConCpCadCredenciamentoLance.aspx', { waitUntil: 'domcontentloaded' }).catch(() => {})
            await page.waitForTimeout(2000)
          }
        }

        const fixo2Pct = Number(dadosTelaLance.segundoLanceFixoPct)
        const strFixo2Pct = fixo2Pct.toFixed(4).replace('.', ',')
        const embFixo2Pct = calcularEmbutidoValido(fixo2Pct, embutidoSegundoFixoPct, saldoDevedor, creditoContratado)
        const strEmbFixo2Pct = embFixo2Pct.toFixed(4).replace('.', ',')

        log(`--- Ofertando 2º LANCE FIXO: ${strFixo2Pct}% (Embutido: ${strEmbFixo2Pct}%) ---`)

        const rdo2Fixo = page.locator('#ctl00_Conteudo_rgLance_2, label[for="ctl00_Conteudo_rgLance_2"], label:has-text("2º Fixo")').first()
        if (await rdo2Fixo.isVisible({ timeout: 4000 }).catch(() => false)) {
          await rdo2Fixo.click({ force: true }).catch(() => {})
          await page.locator('#ctl00_Conteudo_rgLance_2').check({ force: true }).catch(() => {})
          await page.waitForTimeout(1800)

          const rdoReduzir2Fixo = page.locator('#ctl00_Conteudo_rblFormasLance_1, label[for="ctl00_Conteudo_rblFormasLance_1"], label:has-text("Reduzir Parcela")').first()
          if (await rdoReduzir2Fixo.isVisible({ timeout: 3000 }).catch(() => false)) {
            await rdoReduzir2Fixo.click({ force: true }).catch(() => {})
            await page.waitForTimeout(400)
          }

          const selectTipo2Fixo = page.locator('#ctl00_Conteudo_rblTipoOferta, select[name*="rblTipoOferta"]').first()
          if (await selectTipo2Fixo.isVisible({ timeout: 3000 }).catch(() => false) && await selectTipo2Fixo.isEnabled()) {
            await selectTipo2Fixo.selectOption('%').catch(() => selectTipo2Fixo.selectOption({ label: 'Percentual' }))
            await page.waitForTimeout(400)
          }

          await preencherCampoComMascara('#ctl00_Conteudo_edtOferta', strFixo2Pct)
          await validarPercentualOferta(fixo2Pct, '2º Fixo')

          const selectEmb2Fixo = page.locator('#ctl00_Conteudo_cbxLanceEmbutido, select[name*="cbxLanceEmbutido"]').first()
          if (await selectEmb2Fixo.isVisible({ timeout: 3000 }).catch(() => false) && await selectEmb2Fixo.isEnabled()) {
            await selectEmb2Fixo.selectOption('%').catch(() => selectEmb2Fixo.selectOption({ label: 'Percentual' }))
            await page.waitForTimeout(400)
          }

          await preencherCampoComMascara('#ctl00_Conteudo_edtEmbutido', strEmbFixo2Pct)
          await validarPercentualCampo('#ctl00_Conteudo_edtEmbutido', embFixo2Pct, 'embutido do 2º Lance Fixo')

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

          if (erroLancePortal) throw new Error(`Newcon rejeitou o 2º Lance Fixo: ${erroLancePortal}`)

          protocoloSegundoFixo = ultimoProtocoloCapturado
          log(`Protocolo do 2º Lance Fixo capturado: ${protocoloSegundoFixo || 'Confirmado via Web'}`)

          compSegundoFixo = await voltarDoRelatorio('SEGUNDO_FIXO', protocoloSegundoFixo, fixo2Pct, embFixo2Pct)
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
          lance_livre_ativo: estrategiaCota ? estrategiaCota.lance_livre_ativo === true : true,
          lance_livre_percentual: livrePctCalculado,
          lance_livre_embutido_percentual: embutidoLivrePct,
          lance_fixo_ativo: Boolean(dadosTelaLance.lanceFixoPct),
          lance_fixo_percentual: dadosTelaLance.lanceFixoPct || 25.0,
          lance_fixo_embutido_percentual: embutidoFixoPct,
          segundo_lance_fixo_ativo: Boolean(dadosTelaLance.segundoLanceFixoPct),
          segundo_lance_fixo_percentual: dadosTelaLance.segundoLanceFixoPct || null,
          segundo_lance_fixo_embutido_percentual: embutidoSegundoFixoPct,
          lance_embutido_percentual: embutidoMaximoPct,
          parcela_reduzida_ativa: true,
          repetir_seis_assembleias: true,
          data_lance: new Date().toISOString().split('T')[0],
          data_vencimento: calcularVencimentoSeisAssembleias(
            new Date(),
            dadosTelaLance.dataAssembleia || null,
          ),
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
          throw new Error(`Comprovantes vinculados, mas a confirmação da estratégia falhou: ${errEst.message}`)
        } else {
          log(`Estratégia e Confirmação de Lance registradas com sucesso no ERP! ID: ${estSalva?.id}`)
        }

      }

      totalCotasProcessadas++
      await page.waitForTimeout(1500)

    } catch (cotaErr) {
      totalErros++
      log(`Erro no processamento de lances da cota ${item.numero_grupo}/${item.numero_cota}: ${cotaErr.message}`)
      await page.screenshot({ path: path.join(screenshotsDir, `erro-lance-${item.numero_grupo}-${item.numero_cota}-${Date.now()}.png`) }).catch(() => {})
    } finally {
      if (dialogHandler) page.off('dialog', dialogHandler)
      if (popupHandler) context.off('page', popupHandler)
    }
  }

  log('=== PROCESSAMENTO DO ROBÔ DE LANCES FINALIZADO COM SUCESSO ===')
  log(`Total de cotas analisadas: ${totalCotasProcessadas}`)
  log(`Total de lances ofertados com confirmação: ${totalLancesOfertados}`)

  if (listaCotas.length > 0 && totalCotasProcessadas === 0) {
    throw new Error(`Nenhuma cota foi processada: ${listaCotas.length} cota(s) elegível(is), 0 concluída(s).`)
  }

  return {
    cotasElegiveis: listaCotas.length,
    cotasProcessadas: totalCotasProcessadas,
    lancesOfertados: totalLancesOfertados,
    totalErros,
  }
}
