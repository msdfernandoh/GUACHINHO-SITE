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

const { count, error } = await sb.from('grupo_assembleias_contemplacoes').select('*', { count: 'exact', head: true })
console.log('Total cotas gravadas até agora:', count, error ? error.message : '')

const { data: ultimas } = await sb
  .from('grupo_assembleias_contemplacoes')
  .select('codigo_grupo, assembleia_numero, assembleia_data, modalidade, cota')
  .order('criado_em', { ascending: false })
  .limit(1)

console.log('Última cota salva agora:', ultimas?.[0])



