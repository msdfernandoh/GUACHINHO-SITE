import http from 'node:http'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const req = createRequire(new URL('../gauchinho-app/package.json', import.meta.url))
const { createClient } = req('@supabase/supabase-js')
const { createServerClient } = req('@supabase/ssr')

const envLines = fs.readFileSync('gauchinho-app/.env.local', 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (m) env[m[1]] = (m[2] || '').replace(/^['"]|['"]$/g, '').trim()
}

const sbAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const sbAnon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

console.log('1. Gerando link mágico sem envio de email...')
const email = 'hugo@msdeducacao.com.br'
const { data: linkData, error: linkErr } = await sbAdmin.auth.admin.generateLink({
  type: 'magiclink',
  email,
})
if (linkErr) throw linkErr

console.log('2. Verificando OTP para obter sessão de autenticação...')
const { data: verifyData, error: verifyErr } = await sbAnon.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: 'magiclink',
})
if (verifyErr) throw verifyErr

console.log('3. Formatando cookie de sessão SSR...')
const cookiesList = []
const ssrClient = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  cookies: {
    getAll: () => [],
    setAll: (toSet) => cookiesList.push(...toSet),
  },
})

await ssrClient.auth.setSession({
  access_token: verifyData.session.access_token,
  refresh_token: verifyData.session.refresh_token,
})

const cookieHeader = cookiesList.map(c => `${c.name}=${c.value}`).join('; ')

console.log('4. Executando requisição HTTP via node:http com Host exato...')
const options = {
  hostname: '127.0.0.1',
  port: 3005,
  path: '/erp/whatsapp',
  method: 'GET',
  headers: {
    'Host': 'www.gauchinhoconsorcios.com.br',
    'x-forwarded-host': 'www.gauchinhoconsorcios.com.br',
    'Cookie': cookieHeader,
    'User-Agent': 'Antigravity-Smoke-Tester/1.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
}

const makeRequest = () => new Promise((resolve, reject) => {
  const req = http.request(options, (res) => {
    let data = ''
    res.on('data', chunk => { data += chunk })
    res.on('end', () => {
      resolve({ statusCode: res.statusCode, headers: res.headers, body: data })
    })
  })
  req.on('error', reject)
  req.end()
})

const res = await makeRequest()

console.log('--- RESULTADO HTTP ---')
console.log('Status HTTP:', res.statusCode)
if (res.headers.location) console.log('Location:', res.headers.location)
console.log('HTML recebido (tamanho):', res.body.length, 'bytes')

// Verifica marcadores esperados no HTML
const markers = [
  'WhatsApp',
  'Cloud API',
  'Conectar',
  'Mensagens',
]
console.log('--- VERIFICAÇÃO DE MARCADORES ---')
for (const marker of markers) {
  const found = res.body.includes(marker)
  console.log(`Marcador "${marker}":`, found ? 'ENCONTRADO' : 'NÃO ENCONTRADO')
}

// Limpeza da sessão temporária
await sbAnon.auth.signOut({ scope: 'local' })
console.log('Sessão temporária encerrada localmente.')

if (res.statusCode === 200 && res.body.includes('WhatsApp')) {
  console.log('SMOKE TEST PASSOU COM SUCESSO! HTTP 200 OK.')
  process.exit(0)
} else {
  console.error('SMOKE TEST FALHOU!')
  process.exit(1)
}
