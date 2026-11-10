import { createRequire } from 'node:module'
import { fork } from 'node:child_process'
const require = createRequire(new URL('../gauchinho-app/package.json', import.meta.url))
const { createClient } = require('@supabase/supabase-js')
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const ids = process.argv.find(a => a.startsWith('--cotas='))?.slice(8).split(',').filter(Boolean)
if (!ids?.length) throw new Error('Informe explicitamente --cotas=UUID,UUID')
const configId = process.argv.find(a => a.startsWith('--robo='))?.slice(7)
if (!configId) throw new Error('Informe explicitamente --robo=UUID')
const { data: ativos, error: erroAtivos } = await admin.from('robo_execucoes').select('id').in('status', ['PENDENTE', 'PROCESSANDO'])
if (erroAtivos) throw new Error(erroAtivos.message)
if (ativos.length) throw new Error('Existe execução pendente ou processando. Aguarde antes de iniciar outra.')
const { data: config, error: erroConfig } = await admin.from('robo_configuracoes').select('empresa_id,portal_tipo').eq('id', configId).single()
if (erroConfig) throw new Error(erroConfig.message)
const { data: execucao, error } = await admin.from('robo_execucoes').insert({
  empresa_id: config.empresa_id, robo_config_id: configId, portal_tipo: config.portal_tipo,
  status: 'PROCESSANDO', origem: 'UI_MANUAL', dry_run: !process.argv.includes('--aplicar'),
  iniciado_em: new Date().toISOString(), heartbeat_em: new Date().toISOString(), parametros: { tipo_rotina: 'FRANQUIA_LANCES_AUTOMATICOS' },
  detalhes: { origem: 'CLI_DIRETO', cotas_alvo_ids: ids, parametros: { retomar_modalidades_pendentes: true }, worker_id: `RETOMADA:${process.pid}`, logs: [] },
}).select('id').single()
if (error) throw new Error(error.message)
console.log(`Execução ${execucao.id}; cotas: ${ids.length}; teste: ${!process.argv.includes('--aplicar')}`)
const filho = fork(new URL('./robo-execucao-child.mjs', import.meta.url), [execucao.id], { silent: false })
let ultimo = ''
const poll = setInterval(async () => {
  await admin.from('robo_execucoes').update({ heartbeat_em: new Date().toISOString() }).eq('id', execucao.id).eq('status', 'PROCESSANDO')
  const { data } = await admin.from('robo_execucoes').select('status,detalhes').eq('id', execucao.id).single()
  const logs = data?.detalhes?.logs || []
  const indice = ultimo ? logs.findIndex(l => l.ts + l.msg === ultimo) + 1 : 0
  for (const log of logs.slice(indice)) console.log(`[${log.ts}] ${log.msg}`)
  if (logs.length) ultimo = logs.at(-1).ts + logs.at(-1).msg
  if (data?.status === 'CANCELADO') filho.kill()
}, 5000)
filho.on('exit', code => { clearInterval(poll); console.log(`Filho finalizado: ${code}`); process.exitCode = code || 0 })
