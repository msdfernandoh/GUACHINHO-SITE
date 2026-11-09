/** Auditoria somente leitura de cotas e estratégias de lance por grupo. */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const grupo = process.argv.find((arg) => arg.startsWith('--grupo='))?.split('=')[1]
if (!grupo) throw new Error('Informe --grupo=1553')
const corrigirEmbutido = process.argv.includes('--corrigir-embutido-25')
const cotasParaCorrigir = new Set((process.argv.find((arg) => arg.startsWith('--cotas='))?.split('=')[1] || '').split(',').map((valor) => valor.trim()).filter(Boolean))

const req = createRequire(new URL('../gauchinho-app/package.json', import.meta.url))
const { createClient } = req('@supabase/supabase-js')
for (const envPath of [path.resolve(process.cwd(), 'gauchinho-app/.env.local'), path.resolve(process.cwd(), '.env.local')]) {
  if (!fs.existsSync(envPath)) continue
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (!match) continue
    const [, key, raw = ''] = match
    let value = raw.trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: cotas, error } = await admin
  .from('cotas_definitivas')
  .select('id, numero_grupo, numero_cota, robo_boleto_login, valor_credito, status')
  .ilike('numero_grupo', `${grupo}%`)
  .order('numero_cota')
if (error) throw error

const ids = (cotas || []).map((cota) => cota.id)
const { data: estrategias, error: estrategiasError } = ids.length
  ? await admin.from('cota_estrategias_lance').select('cota_definitiva_id, ativa, confirmado, lance_livre_ativo, lance_livre_percentual, lance_livre_embutido_percentual, lance_fixo_ativo, lance_fixo_percentual, lance_fixo_embutido_percentual, segundo_lance_fixo_ativo, segundo_lance_fixo_percentual, segundo_lance_fixo_embutido_percentual, data_vencimento').in('cota_definitiva_id', ids)
  : { data: [], error: null }
if (estrategiasError) throw estrategiasError

const porCota = new Map((estrategias || []).map((estrategia) => [estrategia.cota_definitiva_id, estrategia]))
if (corrigirEmbutido) {
  if (cotasParaCorrigir.size === 0) throw new Error('Informe as cotas: --cotas=195,67')
  const alvo = (cotas || []).filter((cota) => cotasParaCorrigir.has(String(cota.numero_cota).replace(/^0+/, '')))
  if (alvo.length !== cotasParaCorrigir.size) throw new Error('Uma ou mais cotas solicitadas não foram encontradas no grupo.')
  for (const cota of alvo) {
    const estrategia = porCota.get(cota.id)
    if (!estrategia?.ativa || !estrategia.lance_fixo_ativo) throw new Error(`Cota ${cota.numero_cota} não possui estratégia de lance fixo ativa.`)
    const { error: updateError } = await admin
      .from('cota_estrategias_lance')
      .update({ lance_fixo_embutido_percentual: 25, updated_at: new Date().toISOString() })
      .eq('cota_definitiva_id', cota.id)
    if (updateError) throw updateError
  }
  console.log(`Estratégia corrigida para embutido de 25% nas cotas: ${alvo.map((cota) => cota.numero_cota).join(', ')}.`)
}
console.log(JSON.stringify((cotas || []).map((cota) => ({ ...cota, estrategia: porCota.get(cota.id) || null })), null, 2))
