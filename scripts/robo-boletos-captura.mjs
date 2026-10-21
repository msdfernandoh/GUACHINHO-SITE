/** Captura também PDFs enviados pelo popup que se fecha após iniciar download. */
export async function capturarPdfBoleto({ page, context, emitir, timeoutMs = 30000, log = () => {} }) {
  const downloads = new Set()
  const popups = []
  const tarefas = new Set()
  let concluir
  let capturado = null
  const pronto = new Promise(resolve => { concluir = resolve })
  const aceitar = buffer => {
    if (!buffer?.length || Buffer.from(buffer).subarray(0, 5).toString() !== '%PDF-') return
    capturado = { pdfBuffer: Buffer.from(buffer), textoBoleto: '' }
    concluir(capturado)
  }
  const response = res => {
    if (!/application\/pdf/i.test(res.headers()['content-type'] || '') &&
      !/\.pdf/i.test(res.headers()['content-disposition'] || '')) return
    const tarefa = res.body().then(aceitar).catch(() => {}).finally(() => tarefas.delete(tarefa))
    tarefas.add(tarefa)
  }
  const download = async d => {
    try {
      const stream = await d.createReadStream()
      if (!stream) return
      const partes = []
      for await (const parte of stream) partes.push(parte)
      aceitar(Buffer.concat(partes))
    } catch { /* A falha final é informada se nenhum PDF válido chegar. */ }
  }
  const observar = p => {
    if (!downloads.has(p)) { p.on('download', download); p.on('dialog', dialog); downloads.add(p) }
  }
  const dialog = async d => {
    log(`Aviso do portal na emissão: ${d.message()}`)
    if (d.type() === 'alert') await d.accept()
    else await d.dismiss()
  }
  const novaPagina = p => { popups.push(p); observar(p) }
  for (const p of context.pages()) observar(p)
  context.on('page', novaPagina)
  context.on('response', response)
  let timer
  try {
    await emitir()
    await Promise.race([pronto, new Promise(resolve => { timer = setTimeout(resolve, timeoutMs) })])
    if (capturado) return capturado
    // Um relatório HTML só é convertido se contiver identificação de cobrança.
    for (const p of [...popups, page]) {
      if (p.isClosed()) continue
      const textoBoleto = await p.locator('body').innerText({ timeout: 3000 }).catch(() => '')
      if (!/\d{47}|\d{5}[. ]\d{5}|000201/.test(textoBoleto)) continue
      const pdfBuffer = await p.pdf({ format: 'A4', printBackground: true })
      return { pdfBuffer, textoBoleto }
    }
    throw new Error('A emissão não retornou PDF válido. O popup pode ter sido bloqueado ou encerrado pelo portal.')
  } finally {
    clearTimeout(timer)
    context.off('page', novaPagina)
    context.off('response', response)
    for (const p of downloads) { p.off('download', download); p.off('dialog', dialog) }
    for (const p of popups) if (!p.isClosed()) await p.close().catch(() => {})
  }
}
