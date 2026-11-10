import { createRequire } from 'node:module'
import { encontrarOfertaComprovada } from './robo-lances-retomada.mjs'
import { calcularVencimentoSeisAssembleias } from './robo-lances-service.mjs'
const require = createRequire(new URL('../gauchinho-app/package.json', import.meta.url))
const { createClient } = require('@supabase/supabase-js')
const { extractText } = require('unpdf')
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const ids = process.argv.find(a => a.startsWith('--cotas='))?.slice(8).split(',').filter(Boolean)
if (!ids?.length) throw new Error('Informe explicitamente as cotas.')
const aplicar = process.argv.includes('--aplicar')
for (const id of ids) {
  const { data: est, error: erroEst } = await admin.from('cota_estrategias_lance').select('*').eq('cota_definitiva_id', id).single()
  if (erroEst) throw new Error(erroEst.message)
  const { data: ofertas, error } = await admin.from('cota_lances_ofertados').select('*').eq('cota_definitiva_id', id).eq('status', 'CONFIRMADO').order('ofertado_em', { ascending: false })
  if (error) throw new Error(error.message)
  const modalidades = [['lance_livre', 'LIVRE', 'protocolo_lance_livre'], ['lance_fixo', 'FIXO', 'protocolo_lance_fixo'], ['segundo_lance_fixo', 'SEGUNDO_FIXO', 'protocolo_segundo_lance_fixo']].filter(([campo]) => est[`${campo}_ativo`])
  const conferidas = []
  for (const [campo, tipo, protocoloCampo] of modalidades) {
    const candidatas = ofertas.filter(o => o.tipo_lance === tipo && Math.abs(Number(o.percentual_lance) - Number(est[`${campo}_percentual`])) < 0.00005 && Math.abs(Number(o.percentual_embutido) - Number(est[`${campo}_embutido_percentual`])) < 0.00005)
    const oferta = candidatas[0]
    if (!oferta?.comprovante_storage_path) continue
    const { data: blob, error: erroPdf } = await admin.storage.from('lances-comprovantes').download(oferta.comprovante_storage_path)
    if (erroPdf) throw new Error(erroPdf.message)
    const { text } = await extractText(new Uint8Array(await blob.arrayBuffer()), { mergePages: true })
    const protocolo = text.match(/R\$\s*[\d.,]+\s+(\d{5,12})\s+(?:2[º°]\s*)?Lance\s+(?:Livre|Fixo)/i)?.[1]
    const dataAss = text.match(/(\d{2}\/\d{2}\/\d{4})\s+R\$/)?.[1]
    const dataIso = dataAss?.split('/').reverse().join('-')
    const cota = text.match(/Cota:\s*0*(\d+)\s+Grupo:\s*0*(\d+)/i)
    if (!protocolo || !dataIso || !cota || Number(cota[1]) !== Number(oferta.numero_cota) || Number(cota[2]) !== Number(String(oferta.numero_grupo).match(/\d+/)?.[0])) throw new Error(`Comprovante sem identificação suficiente: ${id}/${tipo}`)
    if (oferta.protocolo && oferta.protocolo !== protocolo) throw new Error('Protocolo do PDF diverge do registro.')
    const verificada = { ...oferta, protocolo, assembleia_data: dataIso }
    if (!encontrarOfertaComprovada([verificada], tipo, est[`${campo}_percentual`], est[`${campo}_embutido_percentual`], dataIso)) continue
    // O protocolo é recuperado somente após conferir a cota e o grupo no próprio PDF.
    if (aplicar && (!oferta.protocolo || !oferta.assembleia_data)) {
      const { error: erroUpdate } = await admin.from('cota_lances_ofertados').update({ protocolo, assembleia_data: dataIso }).eq('id', oferta.id)
      if (erroUpdate) throw new Error(erroUpdate.message)
    }
    conferidas.push({ ...verificada, protocoloCampo, dataAss })
  }
  console.log(JSON.stringify({ cota: id, modalidades: modalidades.length, comprovadas: conferidas.map(o => ({ tipo: o.tipo_lance, protocolo: o.protocolo })) }))
  if (!modalidades.length || conferidas.length !== modalidades.length) { console.log('PENDENTE: faltam modalidades; confirmação consolidada preservada.'); continue }
  const principal = conferidas[0]
  if (new Set(conferidas.map(o => o.assembleia_data)).size !== 1) throw new Error('Comprovantes de assembleias diferentes.')
  const ultima = conferidas.map(o => o.ofertado_em).sort().at(-1)
  const payload = {
    confirmado: true, confirmado_em: new Date().toISOString(), confirmado_por_nome: 'Robô Newcon Franquia',
    confirmado_observacao: `Conciliação dos PDFs oficiais: ${conferidas.map(o => `${o.tipo_lance}: ${o.protocolo}`).join(' | ')}`,
    ultimo_lance_ofertado_em: ultima, data_lance: ultima.slice(0, 10), assembleia_data: principal.assembleia_data,
    data_vencimento: calcularVencimentoSeisAssembleias(new Date(ultima), principal.dataAss),
    oferta_origem: 'ROBO_NEWCON', comprovante_storage_path: principal.comprovante_storage_path,
    comprovante_url: principal.comprovante_url, comprovante_nome: principal.comprovante_storage_path.split('/').at(-1),
    updated_at: new Date().toISOString(),
    ...Object.fromEntries(conferidas.map(o => [o.protocoloCampo, o.protocolo])),
  }
  if (aplicar) {
    const { data, error: erroSync } = await admin.from('cota_estrategias_lance').update(payload).eq('id', est.id).eq('updated_at', est.updated_at).select('id,confirmado,protocolo_lance_livre,protocolo_lance_fixo,protocolo_segundo_lance_fixo')
    if (erroSync || data.length !== 1) throw new Error(erroSync?.message || 'Estratégia alterada durante a conciliação.')
    console.log(JSON.stringify({ sincronizada: data[0] }))
  }
}
