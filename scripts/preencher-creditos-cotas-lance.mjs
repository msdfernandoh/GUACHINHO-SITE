/**
 * Preenche valor_credito somente nas cotas legadas cujo valor está zerado.
 * A fonte é o snapshot individual já gerado pelo ERP/Newcon, nesta ordem:
 * valor_bem_racon, valor_base_relatorio e valor_credito_contratado.
 *
 * Uso:
 *   node scripts/preencher-creditos-cotas-lance.mjs          # auditoria, não grava
 *   node scripts/preencher-creditos-cotas-lance.mjs --apply  # aplica somente valores válidos
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const req = createRequire(new URL('../gauchinho-app/package.json', import.meta.url))
const { createClient } = req('@supabase/supabase-js')
const aplicar = process.argv.includes('--apply')

for (const envPath of [
  path.resolve(process.cwd(), 'gauchinho-app/.env.local'),
  path.resolve(process.cwd(), '.env.local'),
]) {
  if (!fs.existsSync(envPath)) continue
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (!match) continue
    const [, key, original = ''] = match
    let value = original.trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    if (!process.env[key]) process.env[key] = value
  }
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Credenciais do Supabase não encontradas.')
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: cotas, error } = await admin
  .from('cotas_definitivas')
  .select('id, empresa_id, valor_credito, snapshot_cota')
  .or('valor_credito.is.null,valor_credito.eq.0')

if (error) throw error

function valorIndividual(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return 0
  for (const campo of ['valor_bem_racon', 'valor_base_relatorio', 'valor_credito_contratado']) {
    const valor = Number(snapshot[campo])
    if (Number.isFinite(valor) && valor > 0) return Number(valor.toFixed(2))
  }
  return 0
}

const elegiveis = (cotas || []).map((cota) => ({ ...cota, valor: valorIndividual(cota.snapshot_cota) })).filter((cota) => cota.valor > 0)
console.log(`Cotas zeradas encontradas: ${(cotas || []).length}. Valores individuais recuperáveis: ${elegiveis.length}.`)

if (!aplicar) process.exit(0)

let atualizadas = 0
for (const cota of elegiveis) {
  const { error: updateError } = await admin
    .from('cotas_definitivas')
    .update({ valor_credito: cota.valor, updated_at: new Date().toISOString() })
    .eq('id', cota.id)
    .eq('empresa_id', cota.empresa_id)
    .or('valor_credito.is.null,valor_credito.eq.0')
  if (updateError) throw updateError
  atualizadas += 1
}

console.log(`Cotas atualizadas com valor individual preservado: ${atualizadas}.`)
