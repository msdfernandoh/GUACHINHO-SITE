// Uma oferta só pode ser reaproveitada com protocolo, PDF e parâmetros idênticos.
// A mesma modalidade pode ter vários PDFs: quantidade de arquivos não indica conclusão.
export function encontrarOfertaComprovada(ofertas, tipo, percentual, embutido, dataAssembleia, agora = new Date()) {
  return [...ofertas].sort((a, b) => Date.parse(b.ofertado_em) - Date.parse(a.ofertado_em)).find(o => {
    const data = new Date(o.ofertado_em)
    const mesAtual = data.getUTCFullYear() === agora.getUTCFullYear() && data.getUTCMonth() === agora.getUTCMonth()
    const mesmaAssembleia = o.assembleia_data && dataAssembleia && o.assembleia_data.slice(0, 10) === dataAssembleia
    return o.tipo_lance === tipo && o.status === 'CONFIRMADO' && o.protocolo && o.comprovante_storage_path
      && (mesmaAssembleia || (!o.assembleia_data && mesAtual))
      && Math.abs(Number(o.percentual_lance) - Number(percentual)) < 0.00005
      && Math.abs(Number(o.percentual_embutido) - Number(embutido)) < 0.00005
  }) || null
}

export function conferirTextoComprovante(text, { grupo, cota, tipo, percentual, protocolo }) {
  const identificacao = text.match(/Cota:\s*0*(\d+)\s+Grupo:\s*0*(\d+)/i)
  const oferta = text.match(/R\$\s*([\d.,]+)\s+(\d{5,12})\s+((?:2[º°]\s*)?Lance\s+(?:Livre|Fixo))/i)
  const percentualPdf = text.split('Dados da oferta de lance:')[1]?.match(/([\d.,]+)\s*%/)?.[1]
  const modalidade = oferta?.[3].includes('Livre') ? 'LIVRE' : /^2/.test(oferta?.[3] || '') ? 'SEGUNDO_FIXO' : 'FIXO'
  if (!identificacao || Number(identificacao[1]) !== Number(cota) || Number(identificacao[2]) !== Number(String(grupo).match(/\d+/)?.[0])
    || !oferta || modalidade !== tipo || !percentualPdf || Math.abs(Number(percentualPdf.replace(',', '.')) - Number(percentual)) > 0.00005
    || (protocolo && protocolo !== oferta[2])) throw new Error('Comprovante diverge da cota, modalidade, percentual ou protocolo esperado.')
  return { protocolo: oferta[2], valorLance: Number(oferta[1].replace(/\./g, '').replace(',', '.')) }
}
