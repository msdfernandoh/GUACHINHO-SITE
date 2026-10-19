import { createRequire } from 'node:module'
import fs from 'node:fs'

const req = createRequire(new URL('../gauchinho-app/package.json', import.meta.url))
const { createClient } = req('@supabase/supabase-js')

const lines = fs.readFileSync('gauchinho-app/.env.local', 'utf8').split('\n')
const env = {}
lines.forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (m) env[m[1]] = (m[2] || '').replace(/^['"]|['"]$/g, '').trim()
})

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const { data: allCotas } = await sb.from('grupos_cotas').select('id, grupo_id, valor_credito, tipo_transcorrido')
const counts = new Map()
const dupes = []
for (const c of allCotas || []) {
  const k = `${c.grupo_id}_${c.valor_credito}_${c.tipo_transcorrido}`
  if (counts.has(k)) {
    dupes.push(c.id)
  } else {
    counts.set(k, c.id)
  }
}
console.log(`Total cotas: ${allCotas?.length || 0}. Duplicadas encontradas: ${dupes.length}`)
if (dupes.length > 0) {
  const { error } = await sb.from('grupos_cotas').delete().in('id', dupes)
  console.log('Removidas duplicatas:', dupes.length, error ? error.message : 'Sucesso')
}











const { count } = await sb
  .from('grupo_assembleias_contemplacoes')
  .select('*', { count: 'exact', head: true })

console.log('Total cotas gravadas no banco:', count)
