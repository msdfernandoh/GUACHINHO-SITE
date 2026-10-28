import { createHash } from 'node:crypto'

export function selecionarPendenciaBoleto(pendencias, competencia) {
  return pendencias.find(p => !p.desabilitado && /RECBTO\.\s*PARCELA/i.test(p.texto) &&
    (p.texto.match(/\d{2}\/\d{2}\/\d{4}/g) || []).some(d => `${d.slice(6)}-${d.slice(3, 5)}` === competencia))
}

export function competenciaBoletos(agora = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit',
  }).formatToParts(agora).map(p => [p.type, p.value]))
  return { iso: `${partes.year}-${partes.month}`, brasileira: `${partes.month}/${partes.year}` }
}

export async function carregarCotasBoletos(admin, config) {
  if (!config.empresa_id) throw new Error('Robô de boletos exige empresa_id explícito; nenhuma empresa padrão é permitida.')
  const alvos = config.configuracao_tarefas?.cotas_alvo_ids
  if (Array.isArray(alvos) && !alvos.length) return []
  const cotas = []
  for (let offset = 0; ; offset += 500) {
    let query = admin.from('cotas_definitivas').select(`
      id, venda_id, empresa_id, numero_grupo, numero_cota, parcela, status,
      venda:vendas!inner(id, cliente_id, cliente_nome, cliente_cpf_cnpj, cliente_telefone, administradora_id, status, cliente:clientes(id, nao_executar_boleto_automatico))
    `).eq('empresa_id', config.empresa_id).neq('status', 'cancelada')
      .neq('venda.status', 'cancelada').not('numero_cota', 'is', null)
      .order('id', { ascending: true }).range(offset, offset + 499)
    if (config.administradora_id) query = query.eq('venda.administradora_id', config.administradora_id)
    if (Array.isArray(alvos)) query = query.in('id', alvos)
    const { data, error } = await query
    if (error) throw new Error(`Falha ao consultar cotas da empresa: ${error.message}`)
    for (const c of data || []) {
      const venda = Array.isArray(c.venda) ? c.venda[0] : c.venda
      if (!c.numero_grupo?.trim() || !c.numero_cota?.trim() || !venda) continue
      const clienteRel = Array.isArray(venda.cliente) ? venda.cliente[0] : venda.cliente
      if (clienteRel?.nao_executar_boleto_automatico === true || venda.nao_executar_boleto_automatico === true) {
        continue
      }
      cotas.push({
        cota_definitiva_id: c.id, venda_id: c.venda_id, empresa_id: c.empresa_id,
        numero_grupo: c.numero_grupo.trim(), numero_cota: c.numero_cota.trim(),
        cliente_nome: venda.cliente_nome, cliente_cpf_cnpj: venda.cliente_cpf_cnpj,
        cliente_telefone: venda.cliente_telefone, parcela: c.parcela,
      })
    }
    if (!data || data.length < 500) return cotas
  }
}

export async function salvarBoletoCota({ admin, item, competencia, pdfBuffer, dados }) {
  if (!item.empresa_id || !item.venda_id || !item.cota_definitiva_id) throw new Error('Boleto exige empresa, venda e cota definitiva.')
  if (!pdfBuffer?.length || Buffer.from(pdfBuffer).subarray(0, 5).toString() !== '%PDF-') throw new Error('Arquivo recebido não é um PDF válido.')
  if (!dados.linhaDigitavel && !dados.qrCodePix) throw new Error('Documento sem linha digitável ou Pix; não será marcado como boleto baixado.')
  const identidade = { empresa_id: item.empresa_id, venda_id: item.venda_id, cota_id: item.cota_definitiva_id, competencia: competencia.iso }
  let lookup = admin.from('vendas_boletos_envios').select('id,status_boleto').match(identidade)
  const { data: existentes, error: lookupError } = await lookup
  if (lookupError) throw new Error(`Falha ao consultar boleto da cota: ${lookupError.message}`)
  if (existentes?.length > 1) throw new Error('Mais de um controle de boleto para a mesma cota/competência; conferência necessária.')
  const existente = existentes?.[0]
  const hash = createHash('sha256').update(pdfBuffer).digest('hex')
  const arquivoPath = `boletos/${item.empresa_id}/${competencia.iso}/${item.cota_definitiva_id}/${hash}.pdf`
  const bucket = admin.storage.from('boletos-cotas')
  const { error: uploadError } = await bucket.upload(arquivoPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
  if (uploadError) throw new Error(`Falha no upload do boleto: ${uploadError.message}`)
  const arquivoUrl = bucket.getPublicUrl(arquivoPath).data?.publicUrl
  if (!arquivoUrl) throw new Error('Storage não retornou endereço do boleto.')
  const campos = {
    arquivo_storage_path: arquivoPath, arquivo_url: arquivoUrl,
    qr_code_pix: dados.qrCodePix, linha_digitavel: dados.linhaDigitavel,
    valor: dados.valor ?? null, vencimento: dados.vencimento ?? null,
    numero_grupo: item.numero_grupo, numero_cota: item.numero_cota,
    origem: 'ROBO_NEWCON', updated_at: new Date().toISOString(),
  }
  const { data: anterior, error: anteriorError } = await admin.from('cotas_boletos').select('id,status')
    .eq('empresa_id', item.empresa_id).eq('numero_grupo', item.numero_grupo)
    .eq('numero_cota', item.numero_cota).eq('competencia', competencia.brasileira).maybeSingle()
  if (anteriorError) throw new Error(`Falha ao consultar histórico: ${anteriorError.message}`)
  const { error: historicoError } = await admin.from('cotas_boletos').upsert({
    ...campos, empresa_id: item.empresa_id, venda_id: item.venda_id,
    cota_definitiva_id: item.cota_definitiva_id, cliente_nome: item.cliente_nome,
    cliente_documento: item.cliente_cpf_cnpj, cliente_telefone: item.cliente_telefone,
    competencia: competencia.brasileira,
    status: ['PAGO', 'ENVIADO_WHATSAPP'].includes(anterior?.status) ? anterior.status : 'BAIXADO',
  }, { onConflict: 'empresa_id,numero_grupo,numero_cota,competencia' })
  if (historicoError) throw new Error(`Falha ao gravar histórico: ${historicoError.message}`)
  // A tabela de controle não tem a chave única empresa/venda/competência.
  // Essa chave ainda misturaria duas cotas de uma mesma venda.
  const controle = { ...campos, ...identidade, baixado_em: new Date().toISOString(), baixado_por_nome: 'Robô Newcon Franquia' }
  const operacao = existente
    ? admin.from('vendas_boletos_envios').update(controle).eq('id', existente.id).eq('empresa_id', item.empresa_id)
    : admin.from('vendas_boletos_envios').insert({ ...controle, status_boleto: 'baixado' })
  const { error: controleError } = await operacao
  if (controleError) throw new Error(`Falha ao sincronizar Vendas & Cotas: ${controleError.message}`)
  return { arquivoPath }
}
