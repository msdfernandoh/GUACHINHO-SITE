import { execSync } from 'node:child_process'
import crypto from 'node:crypto'

const verifyToken = 'gauchinho_wa_' + crypto.randomBytes(16).toString('hex')
console.log('Token gerado:', verifyToken)

const vars = [
  { name: 'WHATSAPP_GRAPH_VERSION', val: 'v23.0' },
  { name: 'NEXT_PUBLIC_WHATSAPP_APP_ID', val: '1412730744263214' },
  { name: 'NEXT_PUBLIC_WHATSAPP_CONFIG_ID', val: '1582891326394697' },
  { name: 'NEXT_PUBLIC_WHATSAPP_GRAPH_VERSION', val: 'v23.0' },
  { name: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', val: verifyToken }
]

for (const v of vars) {
  console.log(`Adicionando ${v.name} na Vercel (Production)...`)
  try {
    const out = execSync(`npx vercel env add ${v.name} production --value "${v.val}" --yes --force`, {
      cwd: 'gauchinho-app',
      encoding: 'utf8',
      stdio: 'pipe'
    })
    console.log(`OK: ${v.name}`)
  } catch (err) {
    console.error(`Erro ao adicionar ${v.name}:`, err.message)
  }
}
