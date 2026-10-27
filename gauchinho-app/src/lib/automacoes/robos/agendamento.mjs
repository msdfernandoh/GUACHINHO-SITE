export const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

export function validarAgendamento(valor) {
  if (valor === undefined) return
  if (!valor || !['MANUAL', 'DIARIO', 'SEMANAL', 'MENSAL'].includes(valor.frequencia)) throw new Error('Frequência de agendamento inválida.')
  if (valor.definido_em !== undefined && (typeof valor.definido_em !== 'string' || !Number.isFinite(Date.parse(valor.definido_em)) || new Date(valor.definido_em).toISOString() !== valor.definido_em)) throw new Error('Data de definição do agendamento inválida.')
  if (valor.frequencia === 'MANUAL') return
  if (!Array.isArray(valor.horarios) || valor.horarios.length < 1 || valor.horarios.length > 31) throw new Error('Informe ao menos um horário de execução.')
  const chaves = new Set()
  for (const item of valor.horarios) {
    if (!item || typeof item.hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.hora)) throw new Error('Horário inválido. Use HH:mm.')
    if (valor.frequencia === 'SEMANAL' && (!Number.isInteger(item.dia_semana) || item.dia_semana < 0 || item.dia_semana > 6)) throw new Error('Selecione o dia da semana.')
    if (valor.frequencia === 'MENSAL' && (!Number.isInteger(item.dia_mes) || item.dia_mes < 1 || item.dia_mes > 31)) throw new Error('Informe um dia do mês entre 1 e 31.')
    const chave = `${valor.frequencia === 'SEMANAL' ? item.dia_semana : valor.frequencia === 'MENSAL' ? item.dia_mes : ''}:${item.hora}`
    if (chaves.has(chave)) throw new Error('Remova os horários repetidos.')
    chaves.add(chave)
  }
}

export function obterAgendamento(tarefas = {}) {
  const valor = tarefas?.agendamento
  if (valor !== undefined) {
    try { validarAgendamento(valor); return valor } catch { return { frequencia: 'MANUAL', horarios: [] } }
  }
  // Compatibilidade: não muda a rotina dos robôs já cadastrados.
  return { frequencia: 'DIARIO', horarios: [{ hora: '04:00' }, { hora: '20:00' }] }
}

function diaLocal(agora) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(agora).map(p => [p.type, p.value]))
  return `${partes.year}-${partes.month}-${partes.day}`
}

function ocorrenciasNoDia(agenda, dia) {
  const data = new Date(`${dia}T12:00:00Z`)
  return agenda.horarios.filter(item =>
    agenda.frequencia === 'DIARIO' ||
    (agenda.frequencia === 'SEMANAL' && item.dia_semana === data.getUTCDay()) ||
    (agenda.frequencia === 'MENSAL' && item.dia_mes === data.getUTCDate())
  ).map(item => new Date(`${dia}T${item.hora}:00-04:00`).toISOString()).sort()
}

export function ocorrenciasDevidas(tarefas, agora = new Date()) {
  const agenda = obterAgendamento(tarefas)
  if (agenda.frequencia === 'MANUAL') return []
  // Recupera atrasos no próprio dia, sem disparar lotes de dias/meses passados.
  return ocorrenciasNoDia(agenda, diaLocal(agora)).filter(iso => iso <= agora.toISOString() && (!agenda.definido_em || iso >= agenda.definido_em))
}

export function proximaExecucao(tarefas, agora = new Date()) {
  const agenda = obterAgendamento(tarefas)
  if (agenda.frequencia === 'MANUAL') return null
  const data = new Date(`${diaLocal(agora)}T12:00:00Z`)
  for (let i = 0; i < 370; i++) {
    const proxima = ocorrenciasNoDia(agenda, data.toISOString().slice(0, 10)).find(iso => iso > agora.toISOString())
    if (proxima) return proxima
    data.setUTCDate(data.getUTCDate() + 1)
  }
  return null
}

export function descreverAgendamento(tarefas) {
  const agenda = obterAgendamento(tarefas)
  if (agenda.frequencia === 'MANUAL') return 'Somente execução manual'
  return agenda.horarios.map(item => agenda.frequencia === 'DIARIO' ? `Todos os dias às ${item.hora}` : agenda.frequencia === 'SEMANAL' ? `Toda ${DIAS_SEMANA[item.dia_semana]} às ${item.hora}` : `Todo dia ${item.dia_mes} às ${item.hora}`).join(' • ')
}

export function planejarExecucoes(robos, execucoes, agora = new Date()) {
  const jobs = []
  for (const robo of robos) {
    if (!robo.ativo || execucoes.some(e => e.robo_config_id === robo.id && ['PENDENTE', 'PROCESSANDO'].includes(e.status))) continue
    let devidas = ocorrenciasDevidas(robo.configuracao_tarefas, agora)
    const legado = robo.configuracao_tarefas?.agendamento === undefined
    if (legado) {
      // Mantém a última janela legada, incluindo a noite anterior antes das 04h.
      const data = new Date(`${diaLocal(agora)}T12:00:00Z`)
      data.setUTCDate(data.getUTCDate() - 1)
      devidas = [devidas.at(-1) || new Date(`${data.toISOString().slice(0, 10)}T20:00:00-04:00`).toISOString()]
    }
    for (const instante of devidas) {
      const chave = `${instante}:${robo.id}`
      if (execucoes.some(e => e.detalhes?.agendamento_chave === chave)) continue
      const chaveLegada = `${diaLocal(new Date(instante))}-${new Date(instante).getUTCHours() === 8 ? '04H' : '20H'}:${robo.id}`
      if (legado && execucoes.some(e => e.detalhes?.agendamento_chave === chaveLegada || (!e.dry_run && ['SUCESSO', 'JA_IMPORTADO'].includes(e.status) && e.iniciado_em >= instante && (e.robo_config_id === robo.id || (e.portal_tipo === robo.portal_tipo && e.detalhes?.robos_cobertos?.includes(robo.id)))))) continue
      jobs.push({ robo, chave, instante, robosCobertos: [robo.id] })
      // Um robô recebe no máximo um trabalho por ciclo de consulta.
      break
    }
  }
  return jobs
}
