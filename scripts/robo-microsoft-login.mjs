const CAMPO_SENHA = 'input[name="passwd"]:not(.moveOffScreen):not([aria-hidden="true"]):visible, input[type="password"]:not(.moveOffScreen):not([aria-hidden="true"]):visible'
const CAMPO_EMAIL = 'input[name="loginfmt"]:visible, input[type="email"]:visible, #i0116:visible'
const BOTAO_ENVIAR = '#idSIButton9:visible, input[type="submit"]:visible, button[type="submit"]:visible'

export function ehLoginMicrosoft(url) {
  try { return new URL(url).hostname === 'login.microsoftonline.com' } catch { return false }
}

export async function estadoLoginMicrosoft(page) {
  if (!ehLoginMicrosoft(page.url())) return 'SAIU'
  return page.evaluate(() => {
    const visivel = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && el.getAttribute('aria-hidden') !== 'true'
    const tem = seletor => [...document.querySelectorAll(seletor)].some(visivel)
    const texto = (document.body?.innerText || '').toLowerCase()
    // Erros e desafios têm prioridade sobre campos ou seletores remanescentes.
    if (tem('#passwordError, #usernameError, #service_exception_message, #errorDescription')) return 'ERRO'
    if (tem('#idDiv_SAOTCS_Proofs, #idDiv_SAOTCC_Description, #idDiv_SAOTCAS_Description, #idTxtBx_SAOTCC_OTC, input[name="otc"], #captcha') || /aprove a solicitação|approve sign in|approve a request|verifique sua identidade|verify your identity|insira o código|enter code|sua conta foi bloqueada|your account has been locked/.test(texto)) return 'INTERVENCAO'
    if ([...document.querySelectorAll('input[type="password"]')].some(el => visivel(el) && !el.classList.contains('moveOffScreen'))) return 'SENHA'
    if (tem('input[name="loginfmt"], input[type="email"], #i0116')) return 'EMAIL'
    if (/continuar conectado|mantenha-se conectado|manter a sessão iniciada|stay signed in/.test(texto)) return 'KMSI'
    if (tem('#tilesHolder') || /escolha uma conta|pick an account|choose an account/.test(texto)) return 'CONTAS'
    return 'AGUARDANDO'
  })
}

// Clique somente em controles interativos visíveis da conta exata configurada.
export async function selecionarContaMicrosoft(page, usuario) {
  const login = usuario.trim().toLowerCase()
  const controles = page.locator('#tilesHolder [role="button"]:visible, #tilesHolder button:visible, #tilesHolder a:visible, [data-test-id]:visible[role="button"], .tile[role="button"]:visible')
  for (let i = 0; i < await controles.count(); i++) {
    const controle = controles.nth(i)
    const corresponde = await controle.evaluate((el, esperado) => {
      const valores = [el.getAttribute('data-test-id'), el.getAttribute('data-username')]
      for (const filho of [el, ...el.querySelectorAll('*')]) {
        if (filho.children.length === 0) valores.push(filho.textContent)
      }
      const emails = (el.innerText || '').match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
      return [...valores, ...emails].some(valor => valor?.trim().toLowerCase() === esperado)
    }, login)
    if (corresponde) {
      await controle.click({ timeout: 5000 })
      return true
    }
  }
  const outraConta = page.getByRole('button', { name: /^(usar outra conta|use another account)$/i }).or(page.getByRole('link', { name: /^(usar outra conta|use another account)$/i })).first()
  if (await outraConta.isVisible()) {
    await outraConta.click({ timeout: 5000 })
    return true
  }
  return false
}

export async function aguardarTransicaoMicrosoft(page, estado, timeoutMs = 12_000) {
  const limite = Date.now() + timeoutMs
  while (Date.now() < limite) {
    try { if (await estadoLoginMicrosoft(page) !== estado) return } catch (erro) { if (page.isClosed()) throw erro }
    await page.waitForTimeout(250)
  }
  throw new Error(`Login Microsoft sem avanço na etapa ${estado} após ${Math.ceil(timeoutMs / 1000)} segundos. O robô interrompeu a execução; consulte a captura de erro.`)
}

export async function autenticarMicrosoft({ page, usuario, senha, log = () => {}, timeoutMs = 90_000, transicaoMs = 12_000 }) {
  const limite = Date.now() + timeoutMs
  let senhaEnviada = false
  let emailEnviado = false
  let confirmacaoEnviada = false
  let esperaInformada = false
  while (Date.now() < limite) {
    let estado
    try { estado = await estadoLoginMicrosoft(page) } catch (erro) {
      if (page.isClosed()) throw erro
      await page.waitForTimeout(250)
      continue
    }
    if (estado === 'SAIU') { log('Redirecionamento após autenticação Microsoft recebido.'); return }
    if (estado === 'ERRO') throw new Error('Microsoft recusou o login. Verifique a conta e a senha cadastradas; consulte a captura de erro do robô.')
    if (estado === 'INTERVENCAO') throw new Error('O login Microsoft exige intervenção humana (verificação de identidade, MFA, CAPTCHA ou desbloqueio). A execução foi interrompida sem repetir a senha.')
    if (estado === 'AGUARDANDO') {
      if (!esperaInformada) { log('Aguardando a próxima etapa do login Microsoft (limite de 90 segundos).'); esperaInformada = true }
      await page.waitForTimeout(250)
      continue
    }
    esperaInformada = false
    if (estado === 'SENHA') {
      if (senhaEnviada) throw new Error('O login Microsoft voltou à senha após o envio. Execução interrompida para evitar tentativas repetidas.')
      log('Preenchendo e enviando a senha Microsoft no campo visível...')
      await page.locator(CAMPO_SENHA).first().fill(senha, { timeout: 5000 })
      await page.locator(BOTAO_ENVIAR).first().click({ timeout: 5000 })
      senhaEnviada = true
    } else if (estado === 'EMAIL') {
      if (emailEnviado) throw new Error('O login Microsoft voltou à identificação da conta sem concluir a autenticação.')
      log('Preenchendo e enviando o usuário Microsoft configurado no robô...')
      await page.locator(CAMPO_EMAIL).first().fill(usuario.trim(), { timeout: 5000 })
      await page.locator(BOTAO_ENVIAR).first().click({ timeout: 5000 })
      emailEnviado = true
    } else if (estado === 'CONTAS') {
      log('Selecionando a conta Microsoft configurada; aguardando mudança real da tela...')
      if (!await selecionarContaMicrosoft(page, usuario)) throw new Error('A conta configurada não foi encontrada entre os controles visíveis da seleção Microsoft.')
    } else if (estado === 'KMSI') {
      if (confirmacaoEnviada) throw new Error('A confirmação de sessão Microsoft não avançou.')
      log('Confirmando a tela “Continuar conectado?” da Microsoft...')
      await page.locator(BOTAO_ENVIAR).first().click({ timeout: 5000 })
      confirmacaoEnviada = true
    }
    await aguardarTransicaoMicrosoft(page, estado, Math.min(transicaoMs, Math.max(1, limite - Date.now())))
  }
  throw new Error('Tempo limite do login Microsoft excedido. A autenticação não foi concluída em 90 segundos.')
}
