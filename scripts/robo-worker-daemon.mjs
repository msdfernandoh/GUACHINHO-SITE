import { createRequire } from 'node:module'
const req = createRequire(new URL('../gauchinho-app/package.json', import.meta.url))
const { createClient } = req('@supabase/supabase-js')
import { randomUUID } from 'node:crypto'
import { fork, execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { inicioDiaCuiaba, inicioCicloColeta, janelaDiaria } from './roboSchedule.mjs'
import { planejarExecucoes } from '../gauchinho-app/src/lib/automacoes/robos/agendamento.mjs'

// Carrega .env.local de gauchinho-app ou da raiz
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('ERRO: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env.local')
  process.exit(1)
}

const admin = createClient(supabaseUrl, serviceKey)
const dono = randomUUID()
const workerId = `${process.env.COMPUTERNAME || process.env.HOSTNAME || 'GAUCHINHO-RUNNER'}:${process.pid}`
const umaVez = process.argv.includes('--once')
const agendarUmaVez = process.argv.includes('--force-run')
const verificar = process.argv.includes('--check')
const alvo = process.argv.find(a => a.startsWith('--execucao-id='))?.split('=')[1] || process.env.EXECUCAO_ID
const MAX_EXECUCAO_MS = 10 * 60_000

let encerrar = false
let filho = null
let leaseAtivo = false
let renovando = false
let ultimoAgendamento = 0
let falhasConsecutivasLease = 0

function pararFilho() {
  if (!filho?.pid) return
  const processo = filho
  if (process.platform === 'win32') {
    execFile('taskkill', ['/PID', String(processo.pid), '/T', '/F'], { windowsHide: true }, () => {})
  } else processo.kill('SIGKILL')
}

for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => {
  encerrar = true
  pararFilho()
})

async function renovarLease() {
  if (renovando || !leaseAtivo) return
  renovando = true
  try {
    const { data, error } = await admin.rpc('robo_runner_adquirir', { p_dono: dono }).abortSignal(AbortSignal.timeout(25_000))
    if (error || !data) {
      falhasConsecutivasLease++
      console.warn(`Aviso ao renovar lease (tentativa ${falhasConsecutivasLease}/3): ${error?.message || 'Sem resposta'}`)
      if (falhasConsecutivasLease >= 3) {
        console.error('Coordenação do runner expirou após 3 falhas consecutivas. Interrompendo para evitar concorrência.')
        leaseAtivo = false
        pararFilho()
      }
    } else {
      falhasConsecutivasLease = 0
    }
  } catch (err) {
    falhasConsecutivasLease++
    console.warn(`Aviso na conexão do lease (tentativa ${falhasConsecutivasLease}/3): ${err?.message || err}`)
    if (falhasConsecutivasLease >= 3) {
      console.error('Coordenação do runner expirou após 3 falhas consecutivas.')
      leaseAtivo = false
      pararFilho()
    }
  } finally {
    renovando = false
  }
}

async function enfileirarAgendamento() {
  const agora = new Date()
  const inicioConsulta = [inicioDiaCuiaba(agora), inicioCicloColeta(agora)].sort()[0]
  const [rs, es] = await Promise.all([
    admin.from('robo_configuracoes').select('*').eq('ativo', true).order('created_at'),
    listarExecucoesAgendamento(inicioConsulta),
  ])
  if (rs.error || es.error) throw new Error(rs.error?.message || es.error?.message)

  for (const job of planejarExecucoes(rs.data, es.data, agora)) {
    const { error } = await admin.from('robo_execucoes').insert({
      empresa_id: job.robo.empresa_id,
      robo_config_id: job.robo.id,
      portal_tipo: job.robo.portal_tipo,
      status: 'PENDENTE',
      origem: 'CRON_TERMINAL',
      dry_run: job.robo.modo === 'DRY_RUN',
      iniciado_em: new Date().toISOString(),
      detalhes: {
        origem: 'CRON_TERMINAL',
        agendamento_chave: job.chave,
        parametros: {
          robosCobertos: job.robosCobertos,
          dryRun: job.robo.modo === 'DRY_RUN',
        },
        logs: [{ ts: new Date().toISOString(), msg: `Rotina agendada: ${job.robo.nome} (${job.instante})` }],
      },
    })
    if (error && error.code !== '23505') throw new Error(error.message)
    if (!error) console.log(`Agendado com sucesso: ${job.robo.nome} (${job.instante})`)
  }
}

async function listarExecucoesAgendamento(inicio) {
  const execucoes = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from('robo_execucoes')
      .select('robo_config_id,portal_tipo,dry_run,status,iniciado_em,detalhes')
      .or(`iniciado_em.gte.${inicio},status.in.(PENDENTE,PROCESSANDO)`)
      .order('id').range(offset, offset + 499)
    if (error) return { data: null, error }
    execucoes.push(...data)
    if (data.length < 500) return { data: execucoes, error: null }
  }
}

async function expirarExecucoesOrfas() {
  const agora = Date.now()
  const limiteHeartbeatMs = 5 * 60_000
  const { data: emProc } = await admin
    .from('robo_execucoes')
    .select('id, status, iniciado_em, heartbeat_em, detalhes')
    .eq('status', 'PROCESSANDO')

  for (const row of emProc || []) {
    const refTs = Date.parse(row.heartbeat_em || row.iniciado_em || '')
    if (!Number.isFinite(refTs) || agora - refTs > limiteHeartbeatMs) {
      const msg = 'Execução órfã encerrada automaticamente (timeout de heartbeat do worker).'
      await admin.from('robo_execucoes').update({
        status: 'ERRO',
        finalizado_em: new Date().toISOString(),
        erro_mensagem: msg,
        erro_sanitizado: msg,
        detalhes: {
          ...(row.detalhes || {}),
          erro: msg,
          logs: [...(row.detalhes?.logs || []), { ts: new Date().toISOString(), msg }],
        },
      }).eq('id', row.id).eq('status', 'PROCESSANDO')
      console.log(`Execução órfã limpa automaticamente: ${row.id}`)
    }
  }
}

async function reivindicar() {
  await expirarExecucoesOrfas().catch(() => {})
  let consulta = admin.from('robo_execucoes').select('*').eq('status', 'PENDENTE').order('iniciado_em').limit(1)
  if (alvo) consulta = consulta.eq('id', alvo)
  const { data, error } = await consulta.maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const agora = new Date().toISOString()
  const { data: travado, error: erroLock } = await admin.from('robo_execucoes').update({
    status: 'PROCESSANDO',
    iniciado_em: agora,
    heartbeat_em: agora,
    detalhes: { ...data.detalhes, worker_id: workerId, lock_em: agora },
  }).eq('id', data.id).eq('status', 'PENDENTE').select('*').maybeSingle()

  if (erroLock) throw new Error(erroLock.message)
  return travado
}

async function registrarFalha(id, mensagem) {
  const { data: atual, error } = await admin.from('robo_execucoes').select('status,detalhes').eq('id', id).single()
  if (error) return
  if (atual.status !== 'PROCESSANDO') return

  await admin.from('robo_execucoes').update({
    status: 'ERRO',
    finalizado_em: new Date().toISOString(),
    erro_sanitizado: mensagem,
    detalhes: {
      ...atual.detalhes,
      erro: mensagem,
      logs: [...(atual.detalhes?.logs || []), { ts: new Date().toISOString(), msg: mensagem }],
    },
  }).eq('id', id).eq('status', 'PROCESSANDO')
}

async function processar(execucao) {
  console.log(`Processando execução ${execucao.id} (${execucao.portal_tipo})...`)
  let expirou = false
  const { data: config } = await admin.from("robo_configuracoes").select("nome, configuracao_tarefas").eq("id", execucao.robo_config_id).single()
  const limiteMs = (config?.configuracao_tarefas?.tipo_rotina === "CONTEMPLACAO_ASSEMBLEIAS" || /contempla|médias de lance/i.test(config?.nome || "")) ? 6 * 60 * 60_000 : MAX_EXECUCAO_MS

  const exitCode = await new Promise((resolve, reject) => {
    filho = fork(fileURLToPath(new URL('./robo-execucao-child.mjs', import.meta.url)), [execucao.id], {
      windowsHide: true,
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    })

    const timer = setTimeout(() => { expirou = true; pararFilho() }, limiteMs)
    const heartbeat = setInterval(() => {
      admin.from('robo_execucoes').update({ heartbeat_em: new Date().toISOString() })
        .eq('id', execucao.id).eq('status', 'PROCESSANDO')
        .then(({ error }) => { if (error) console.error('Erro de heartbeat:', error.message) })
    }, 20_000)

    const limpar = () => { clearTimeout(timer); clearInterval(heartbeat); filho = null }
    filho.once('error', e => { limpar(); reject(e) })
    filho.once('exit', code => { limpar(); resolve(code) })
  })

  if (exitCode !== 0) {
    await registrarFalha(execucao.id, expirou ? 'Tempo limite de execução excedido ('+(limiteMs / 60_000)+' minutos).' : 'Processo interrompido.')
  }

  const { data } = await admin.from('robo_execucoes').select('status').eq('id', execucao.id).single()
  console.log(`Resultado da execução ${execucao.id}: ${data?.status || 'DESCONHECIDO'}`)
  return ['SUCESSO', 'JA_IMPORTADO'].includes(data?.status)
}

async function iniciar() {
  if (verificar) {
    try {
      const { data, error } = await admin.from('robo_configuracoes').select('id,portal_tipo').eq('ativo', true).abortSignal(AbortSignal.timeout(15_000))
      if (error) throw new Error(error.message)
      console.log(JSON.stringify({ conexao: 'OK', robosAtivos: data.length, janela: janelaDiaria(), inicioDia: inicioDiaCuiaba() }))
    } catch (e) {
      console.log(JSON.stringify({ conexao: 'INDISPONIVEL', erro: e?.message?.slice(0, 100), janela: janelaDiaria(), inicioDia: inicioDiaCuiaba() }))
    }
    return
  }

  const renovar = setInterval(() => {
    renovarLease().catch(e => console.warn('Aviso no lease:', e.message))
  }, 20_000)

  let sucesso = true
  try {
    while (!encerrar) {
      try {
        if (!leaseAtivo) {
          const { data, error } = await admin.rpc('robo_runner_adquirir', { p_dono: dono }).abortSignal(AbortSignal.timeout(25_000))
          if (error) {
            console.error(`Aviso ao coordenar o runner: ${error.message}`)
            await new Promise(r => setTimeout(r, 10_000))
            continue
          }
          leaseAtivo = Boolean(data)
          if (!leaseAtivo) {
            if (umaVez) { console.log('Outro runner ativo na fila.'); break }
            await new Promise(r => setTimeout(r, 10_000))
            continue
          }
          falhasConsecutivasLease = 0
          console.log(`Gauchinho Runner ativo: ${workerId}. Monitorando fila e agendamentos individuais...`)
        }

        if (!alvo && (!umaVez || agendarUmaVez) && Date.now() - ultimoAgendamento > 60_000) {
          await enfileirarAgendamento()
          ultimoAgendamento = Date.now()
        }

        const execucao = await reivindicar()
        if (execucao) {
          sucesso = (await processar(execucao)) && sucesso
          if (alvo) break
          continue
        }

        if (umaVez) break
        await new Promise(r => setTimeout(r, 10_000))
      } catch (errLoop) {
        console.error('Aviso no loop do daemon:', errLoop.message)
        await new Promise(r => setTimeout(r, 10_000))
      }
    }
  } finally {
    clearInterval(renovar)
    pararFilho()
    try {
      await admin.rpc('robo_runner_liberar', { p_dono: dono })
    } catch {}
  }

  if (!sucesso) process.exitCode = 1
}

iniciar().catch(e => { console.error('Falha crítica no runner:', e.message); process.exitCode = 1 })
