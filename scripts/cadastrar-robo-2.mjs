import { createRequire } from 'node:module'
import fs from 'node:fs'

const req = createRequire(new URL('../gauchinho-app/package.json', import.meta.url))
const { createClient } = req('@supabase/supabase-js')

const envLines = fs.readFileSync('gauchinho-app/.env.local', 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (m) env[m[1]] = (m[2] || '').replace(/^['"]|['"]$/g, '').trim()
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// Obtém credenciais criptografadas do Robô 1 para reaproveitar
const { data: robo1 } = await sb.from('robo_configuracoes').select('*').ilike('nome', '%Racon Atualizacao%').single()

if (!robo1) {
  console.error('Robô 1 não encontrado para copiar credenciais.')
  process.exit(1)
}

const robo2Payload = {
  nome: 'Robô Racon — Contemplações e Médias de Lance',
  portal_tipo: 'RACON',
  login_url: 'https://e.randonconsorcios.com.br/',
  site_url: 'https://e.randonconsorcios.com.br/',
  usuario_login: robo1.usuario_login,
  senha_encrypted: robo1.senha_encrypted,
  administradora_id: robo1.administradora_id,
  modo: 'PRODUCAO',
  ativo: true,
  configuracao_tarefas: {
    tipo_rotina: 'CONTEMPLACAO_ASSEMBLEIAS',
    ponto_venda: '939509',
    modelo: 'Lista Grupo',
    agendamento: 'Mensal todo dia 14 às 20:00 (Cuiabá)',
    descricao: 'Extrai cotas contempladas (Sorteio, Lance Livre, Lance Fixo, Sorteio Canceladas), calcula médias de lance (1m, 3m, 6m, 12m), datas da próxima assembleia e atualiza grupos_consorcio e grupo_assembleias_contemplacoes.',
  },
}

// Verifica se já existe
const { data: existingRobo2 } = await sb.from('robo_configuracoes').select('id').ilike('nome', '%Contempla%').maybeSingle()

if (existingRobo2) {
  console.log('Robô 2 já existente. Atualizando configurações...')
  const { data: updated, error } = await sb.from('robo_configuracoes').update(robo2Payload).eq('id', existingRobo2.id).select().single()
  if (error) console.error('Erro ao atualizar Robô 2:', error)
  else console.log('Robô 2 atualizado com sucesso! ID:', updated.id)
} else {
  console.log('Cadastrando Robô 2 na Central de Robôs...')
  const { data: created, error } = await sb.from('robo_configuracoes').insert(robo2Payload).select().single()
  if (error) console.error('Erro ao cadastrar Robô 2:', error)
  else console.log('Robô 2 cadastrado com sucesso! ID:', created.id)
}
