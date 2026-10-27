import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { autenticarMicrosoft, estadoLoginMicrosoft, selecionarContaMicrosoft } from '../robo-microsoft-login.mjs'

const require = createRequire(new URL('../../gauchinho-app/package.json', import.meta.url))
const { chromium } = require('playwright-core')
let browser
before(async () => { browser = await chromium.launch({ headless: true, channel: process.platform === 'win32' ? 'chrome' : undefined }) })
after(async () => { await browser?.close() })

async function pagina(html, executar) {
  const context = await browser.newContext()
  try {
    await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body: route.request().url().includes('login.microsoftonline.com') ? html : '<h1>Portal de teste</h1>' }))
    const page = await context.newPage()
    await page.goto('https://login.microsoftonline.com/fixture')
    await executar(page)
  } finally { await context.close() }
}

test('seletor oculto não é confundido com escolha de conta; KMSI avança', async () => {
  await pagina('<div id="tilesHolder" hidden><button>conta@exemplo.test</button></div><h1>Continuar conectado?</h1><input id="idSIButton9" type="submit" value="Sim" onclick="location.href=\'https://portal.exemplo.test/\'">', async page => {
    assert.equal(await estadoLoginMicrosoft(page), 'KMSI')
    await autenticarMicrosoft({ page, usuario: 'conta@exemplo.test', senha: 'senha-ficticia' })
    assert.equal(new URL(page.url()).hostname, 'portal.exemplo.test')
  })
})

test('seleciona a conta exata e visível; ignora outra conta do mesmo domínio', async () => {
  await pagina('<h1>Escolha uma conta</h1><div id="tilesHolder"><button onclick="window.escolhida=\'errada\'">outra@exemplo.test</button><button hidden>conta@exemplo.test</button><button onclick="window.escolhida=\'certa\'"><span>Nome diferente</span><span>conta@exemplo.test</span></button></div>', async page => {
    assert.equal(await selecionarContaMicrosoft(page, ' CONTA@exemplo.test '), true)
    assert.equal(await page.evaluate(() => window.escolhida), 'certa')
  })
})

test('texto sem controle interativo não é reportado como clique de conta', async () => {
  await pagina('<h1>Escolha uma conta</h1><div id="tilesHolder"><span>conta@exemplo.test</span></div>', async page => {
    assert.equal(await selecionarContaMicrosoft(page, 'conta@exemplo.test'), false)
  })
})

test('clique que não avança encerra com erro e ocorre uma única vez', async () => {
  await pagina('<h1>Escolha uma conta</h1><div id="tilesHolder"><button onclick="window.cliques=(window.cliques||0)+1">conta@exemplo.test</button></div>', async page => {
    await assert.rejects(autenticarMicrosoft({ page, usuario: 'conta@exemplo.test', senha: 'senha-ficticia', transicaoMs: 500 }), /sem avanço na etapa CONTAS/)
    assert.equal(await page.evaluate(() => window.cliques), 1)
  })
})

test('erro de senha prevalece sobre campo de senha e não reenvia credencial', async () => {
  await pagina('<span id="passwordError">Senha incorreta</span><input type="password"><input id="idSIButton9" type="submit" onclick="window.cliques=1">', async page => {
    assert.equal(await estadoLoginMicrosoft(page), 'ERRO')
    await assert.rejects(autenticarMicrosoft({ page, usuario: 'conta@exemplo.test', senha: 'senha-ficticia' }), /recusou o login/)
    assert.equal(await page.evaluate(() => window.cliques), undefined)
  })
})

test('MFA interrompe com motivo específico sem clicar em botões genéricos', async () => {
  await pagina('<h1>Aprove a solicitação no Authenticator</h1><input id="idSIButton9" type="submit" onclick="window.cliques=1">', async page => {
    await assert.rejects(autenticarMicrosoft({ page, usuario: 'conta@exemplo.test', senha: 'senha-ficticia' }), /intervenção humana/)
    assert.equal(await page.evaluate(() => window.cliques), undefined)
  })
})

test('fluxo email → conta → senha → confirmação → portal conclui sem expor credenciais', async () => {
  const html = `<input name="loginfmt"><input id="idSIButton9" type="submit" onclick="document.body.innerHTML=window.contas">
    <script>
    window.contas = '<h1>Escolha uma conta</h1><div id="tilesHolder"><button onclick="document.body.innerHTML=window.senha">conta@exemplo.test</button></div>';
    window.senha = '<input name="passwd" type="password"><input id="idSIButton9" type="submit" onclick="document.body.innerHTML=window.kmsi">';
    window.kmsi = '<h1>Stay signed in?</h1><input id="idSIButton9" type="submit" onclick="location.href=window.portal">';
    window.portal = 'https://portal.exemplo.test/';
    </script>`
  await pagina(html, async page => {
    const logs = []
    await autenticarMicrosoft({ page, usuario: 'conta@exemplo.test', senha: 'senha-ficticia', log: msg => logs.push(msg) })
    assert.equal(new URL(page.url()).hostname, 'portal.exemplo.test')
    assert.ok(!logs.join(' ').includes('senha-ficticia'))
    assert.ok(!logs.join(' ').includes('conta@exemplo.test'))
  })
})

test('conta ausente abre Usar outra conta sem selecionar usuário diferente', async () => {
  await pagina('<h1>Pick an account</h1><div id="tilesHolder"><button>outra@exemplo.test</button><button onclick="window.outra=true">Usar outra conta</button></div>', async page => {
    assert.equal(await selecionarContaMicrosoft(page, 'conta@exemplo.test'), true)
    assert.equal(await page.evaluate(() => window.outra), true)
  })
})
