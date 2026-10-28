// Executada no navegador: delimita a área do grupo sem alcançar outros grupos.
export function marcarAreaPlanos({ grupoEsperado }) {
  const esperado = String(grupoEsperado).replace(/^0+/, '')
  let area = null
  for (const botao of document.querySelectorAll('button, [role="button"]')) {
    if (!botao.getClientRects().length || !/^Ocultar planos$/i.test(botao.innerText.trim())) continue
    for (let el = botao.parentElement; el && el !== document.body; el = el.parentElement) {
      const grupos = new Set([...el.innerText.matchAll(/Grupo\s+(\d{4,8})\b/gi)].map(m => m[1].replace(/^0+/, '')))
      if (grupos.size > 1) break
      if (grupos.size === 1 && grupos.has(esperado)) area = el
    }
  }
  document.querySelectorAll('[data-robo-planos]').forEach(el => el.removeAttribute('data-robo-planos'))
  if (!area) throw new Error(`Área expandida do grupo ${esperado} não identificada; dados preservados.`)
  area.setAttribute('data-robo-planos', esperado)
  return (area.innerText.match(/R\$\s*[\d.,]+\s*\/\s*m[eê]s/gi) || []).length
}

export async function carregarTodosPlanos({ page, grupoEsperado, log = () => {}, limite = 100, timeout = 20000 }) {
  let cliques = 0
  while (true) {
    const antes = await page.evaluate(marcarAreaPlanos, { grupoEsperado })
    const mais = page.locator('[data-robo-planos]')
      .locator('button:visible, [role="button"]:visible, a:visible')
      .filter({ hasText: /^(?:(?:mostrar|carregar|ver)\s+)?mais(?:\s+(?:planos|cotas|opções))?\s*$/i })
    const quantidade = await mais.count()
    if (!quantidade) {
      if (!antes) throw new Error('Nenhum plano carregado; dados preservados.')
      log(`[Grupo ${grupoEsperado}] Carregamento completo: ${antes} planos, ${cliques} cliques em Mais.`)
      return { planos: antes, cliques }
    }
    if (quantidade !== 1) throw new Error('Mais de um controle Mais no grupo; dados preservados.')
    if (cliques >= limite) throw new Error('Limite de carregamento atingido com Mais ainda presente; dados preservados.')
    await mais.click({ timeout })
    cliques++
    // Aguarda novos planos, não apenas a animação ou o desaparecimento do botão.
    try {
      await page.waitForFunction(({ antes }) => {
        const area = document.querySelector('[data-robo-planos]')
        return area && (area.innerText.match(/R\$\s*[\d.,]+\s*\/\s*m[eê]s/gi) || []).length > antes
      }, { antes }, { timeout })
    } catch {
      throw new Error(`Mais não carregou novos planos do grupo ${grupoEsperado}; dados preservados.`)
    }
    log(`[Grupo ${grupoEsperado}] Mais acionado (${cliques}); novos planos carregados.`)
  }
}
