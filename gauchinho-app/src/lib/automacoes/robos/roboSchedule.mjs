export const PORTAIS_ROBO = ['RACON', 'ADEMICON', 'RODOBENS', 'PORTO_SEGURO', 'CUSTOM']

export function horarioCuiaba(agora = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(agora).map(p => [p.type, p.value]))
  return { dia: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) }
}

export function janelaDiaria(agora = new Date()) {
  const { dia, minutos } = horarioCuiaba(agora)
  if (minutos >= 20 * 60) return `${dia}-20H`
  if (minutos >= 4 * 60) return `${dia}-04H`
  return `${diaAnterior(dia)}-20H`
}

function diaAnterior(dia) {
  const anterior = new Date(`${dia}T12:00:00.000Z`)
  anterior.setUTCDate(anterior.getUTCDate() - 1)
  return anterior.toISOString().slice(0, 10)
}

export function inicioCicloColeta(agora = new Date()) {
  const { dia, minutos } = horarioCuiaba(agora)
  if (minutos >= 20 * 60) {
    return new Date(`${dia}T20:00:00-04:00`).toISOString()
  }
  if (minutos >= 4 * 60) {
    return new Date(`${dia}T04:00:00-04:00`).toISOString()
  }
  return new Date(`${diaAnterior(dia)}T20:00:00-04:00`).toISOString()
}

export function inicioDiaCuiaba(agora = new Date()) {
  return `${horarioCuiaba(agora).dia}T04:00:00.000Z`
}

export function execucaoCobreRobo(execucao, robo) {
  if (execucao.dry_run || !['SUCESSO', 'JA_IMPORTADO'].includes(execucao.status)) return false
  if (execucao.robo_config_id === robo.id) return true
  return execucao.portal_tipo === robo.portal_tipo &&
    (execucao.detalhes?.robos_cobertos || []).includes(robo.id)
}

export function planejarAgendamento(robos, execucoes, chaveJanela) {
  if (!chaveJanela) return []
  const pendentes = robos.filter(r => r.ativo &&
    !execucoes.some(e => execucaoCobreRobo(e, r) ||
      (e.robo_config_id === r.id && ['PENDENTE', 'PROCESSANDO'].includes(e.status))))
  const jobs = []
  for (const robo of pendentes) {
    const chave = `${chaveJanela}:${robo.id}`
    if (execucoes.some(e => e.detalhes?.agendamento_chave === chave)) continue
    jobs.push({
      robo,
      chave,
      robosCobertos: [robo.id],
    })
  }
  return jobs
}
