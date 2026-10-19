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

const robo3Payload = {
  nome: 'Robô Racon — Atualização de Cotas e Simulador',
  portal_tipo: 'RACON',
  login_url: 'https://e.randonconsorcios.com.br/',
  site_url: 'https://e.randonconsorcios.com.br/simulador?etapa=filtros',
  usuario_login: robo1.usuario_login,
  senha_encrypted: robo1.senha_encrypted,
  administradora_id: robo1.administradora_id,
  modo: 'PRODUCAO',
  ativo: true,
  configuracao_tarefas: {
    tipo_rotina: 'COTAS_SIMULADOR',
    ponto_venda: '939509',
    produtos: [
      'Veículos',
      'Serviços',
      'Veículos Pró-Rata Total',
      'Imóveis',
      'Imóveis Pró-Rata Total'
    ],
    modalidades_transcorrido: ['PRORROGADA', 'DILUIDA'],
    agendamento: 'Semanal ou sob demanda',
    descricao: 'Acessa o Simulador Racon, seleciona ponto de venda 939509, itera sobre todos os produtos, abre Mostrar Planos em cada grupo, simula planos com opções PRORROGADA e DILUIDA, extrai parcelas integrais e reduzidas (50%, 60%, 70%) e sincroniza grupos_cotas e grupos_consorcio com origem_governanca = GLOBAL.',
  },
}

// Verifica se já existe
const { data: existingRobo3 } = await sb.from('robo_configuracoes').select('id').ilike('nome', '%Simulador%').maybeSingle()

if (existingRobo3) {
  console.log('Robô 3 já existente. Atualizando configurações...')
  const { data: updated, error } = await sb.from('robo_configuracoes').update(robo3Payload).eq('id', existingRobo3.id).select().single()
  if (error) console.error('Erro ao atualizar Robô 3:', error)
  else console.log('Robô 3 atualizado com sucesso! ID:', updated.id)
} else {
  console.log('Cadastrando Robô 3 na Central de Robôs...')
  const { data: created, error } = await sb.from('robo_configuracoes').insert(robo3Payload).select().single()
  if (error) console.error('Erro ao cadastrar Robô 3:', error)
  else console.log('Robô 3 cadastrado com sucesso! ID:', created.id)
}
