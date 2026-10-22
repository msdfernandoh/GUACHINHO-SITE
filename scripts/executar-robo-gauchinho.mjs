/**
 * Script CLI para executar um Robô de Importação do Gauchinho diretamente pelo terminal.
 * Uso: node scripts/executar-robo-gauchinho.mjs [robo_id] [--forcar]
 */

import { createRequire } from 'node:module'
const req = createRequire(new URL('../gauchinho-app/package.json', import.meta.url))
const { createClient } = req('@supabase/supabase-js')
import path from 'node:path'
import fs from 'node:fs'
import { fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const envCandidates = [
  path.resolve(process.cwd(), 'gauchinho-app/.env.local'),
  path.resolve(process.cwd(), '.env.local'),
]

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
      if (match) {
        const key = match[1]
        let val = match[2] || ''
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1)
        if (!process.env[key]) process.env[key] = val.trim()
      }
    }
  }
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const roboId = process.argv[2]
const forcar = process.argv.includes('--forcar')

async function main() {
  console.log('--- EXECUTOR CLI: ROBÔ DE IMPORTAÇÃO GAUCHINHO ---')

  let config
  if (roboId && !roboId.startsWith('--')) {
    const { data } = await admin.from('robo_configuracoes').select('*').eq('id', roboId).single()
    config = data
  } else {
    const { data } = await admin.from('robo_configuracoes').select('*').eq('ativo', true).order('created_at').limit(1).single()
    config = data
  }

  if (!config) {
    console.error('Nenhum robô encontrado para execução.')
    process.exit(1)
  }

  console.log(`Robô selecionado: ${config.nome} (ID: ${config.id})`)

  // Enfileira execução
  const { data: execucao, error } = await admin.from('robo_execucoes').insert({
    empresa_id: config.empresa_id,
    robo_config_id: config.id,
    portal_tipo: config.portal_tipo,
    status: 'PROCESSANDO',
    iniciado_em: new Date().toISOString(),
    dry_run: process.argv.includes('--dry-run') || config.modo === 'DRY_RUN',
    detalhes: {
      origem: 'CLI_DIRETO',
      grupos: process.argv.find(a=>a.startsWith('--grupos='))?.split('=')[1].split(','),
      logs: [{ ts: new Date().toISOString(), msg: 'Iniciado via terminal CLI' }],
    },
  }).select('*').single()

  if (error || !execucao) {
    console.error('Erro ao registrar execução:', error?.message)
    process.exit(1)
  }

  console.log(`Execução iniciada: ${execucao.id}. Rodando automação Playwright...`)

  const child = fork(fileURLToPath(new URL('./robo-execucao-child.mjs', import.meta.url)), [execucao.id], {
    stdio: 'inherit',
  })

  child.on('exit', (code) => {
    console.log(`Processo finalizado com código: ${code}`)
    process.exit(code || 0)
  })
}

main().catch(err => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
