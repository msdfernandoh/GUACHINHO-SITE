import test from 'node:test'
import assert from 'node:assert/strict'
import { obterAgendamento, validarAgendamento, proximaExecucao, planejarExecucoes, ocorrenciasDevidas } from '../../gauchinho-app/src/lib/automacoes/robos/agendamento.mjs'

const tarefas = (frequencia, horarios) => ({ agendamento: { frequencia, horarios } })
const robo = config => ({ id: 'r1', ativo: true, configuracao_tarefas: config })

test('diário respeita horário de Cuiabá e a virada UTC', () => {
  const config = tarefas('DIARIO', [{ hora: '23:00' }])
  assert.deepEqual(ocorrenciasDevidas(config, new Date('2026-10-28T02:59Z')), [])
  assert.deepEqual(ocorrenciasDevidas(config, new Date('2026-10-28T03:00Z')), ['2026-10-28T03:00:00.000Z'])
})
test('segunda às 7h e passagem para a semana seguinte', () => {
  const config = tarefas('SEMANAL', [{ dia_semana: 1, hora: '07:00' }])
  assert.equal(proximaExecucao(config, new Date('2026-10-25T12:00Z')), '2026-10-26T11:00:00.000Z')
  assert.equal(proximaExecucao(config, new Date('2026-10-26T11:00Z')), '2026-11-02T11:00:00.000Z')
  assert.deepEqual(ocorrenciasDevidas(config, new Date('2026-10-27T12:00Z')), [])
})
test('duas vezes por mês em horários independentes', () => {
  const config = tarefas('MENSAL', [{ dia_mes: 1, hora: '07:00' }, { dia_mes: 15, hora: '18:30' }])
  assert.equal(proximaExecucao(config, new Date('2026-11-01T12:00Z')), '2026-11-15T22:30:00.000Z')
  assert.equal(proximaExecucao(config, new Date('2026-11-15T23:00Z')), '2026-12-01T11:00:00.000Z')
})
test('dia 31 pula meses curtos e dia 29 respeita ano bissexto', () => {
  assert.equal(proximaExecucao(tarefas('MENSAL', [{ dia_mes: 31, hora: '07:00' }]), new Date('2026-04-01T12:00Z')), '2026-05-31T11:00:00.000Z')
  assert.equal(proximaExecucao(tarefas('MENSAL', [{ dia_mes: 29, hora: '07:00' }]), new Date('2028-02-01T12:00Z')), '2028-02-29T11:00:00.000Z')
})
test('manual, inativo e configuração inválida não disparam', () => {
  assert.equal(proximaExecucao(tarefas('MANUAL', [])), null)
  assert.deepEqual(planejarExecucoes([{ ...robo({}), ativo: false }], []), [])
  assert.deepEqual(planejarExecucoes([robo(tarefas('INVALIDO', []))], []), [])
})
test('validação rejeita horários/dias inválidos e duplicatas', () => {
  for (const config of [tarefas('DIARIO', [{ hora: '24:00' }]), tarefas('MENSAL', [{ hora: '07:00', dia_mes: 0 }]), tarefas('SEMANAL', [{ hora: '07:00', dia_semana: 7 }]), tarefas('DIARIO', [{ hora: '07:00' }, { hora: '07:00' }])]) assert.throws(() => validarAgendamento(config.agendamento))
})
test('fila e chave persistida impedem duplicação, inclusive após erro', () => {
  const r = robo(tarefas('DIARIO', [{ hora: '07:00' }, { hora: '18:00' }]))
  const agora = new Date('2026-10-27T23:00Z')
  const [job] = planejarExecucoes([r], [], agora)
  const exec = { robo_config_id: 'r1', status: 'ERRO', detalhes: { agendamento_chave: job.chave } }
  assert.equal(planejarExecucoes([r], [exec], agora)[0].instante, '2026-10-27T22:00:00.000Z')
  assert.deepEqual(planejarExecucoes([r], [{ ...exec, status: 'PENDENTE' }], agora), [])
})
test('nova programação não executa retroativamente e não recupera dias passados', () => {
  const config = tarefas('DIARIO', [{ hora: '07:00' }])
  config.agendamento.definido_em = '2026-10-27T12:00:00.000Z'
  assert.deepEqual(ocorrenciasDevidas(config, new Date('2026-10-27T13:00Z')), [])
  assert.deepEqual(ocorrenciasDevidas(config, new Date('2026-10-28T10:00Z')), [])
})
test('legado mantém janela atual e reconhece chaves antigas', () => {
  assert.equal(obterAgendamento().horarios.length, 2)
  const r = robo({})
  assert.equal(planejarExecucoes([r], [], new Date('2026-10-27T23:00Z'))[0].instante, '2026-10-27T08:00:00.000Z')
  assert.deepEqual(planejarExecucoes([r], [{ robo_config_id: 'r1', status: 'ERRO', detalhes: { agendamento_chave: '2026-10-27-04H:r1' } }], new Date('2026-10-27T23:00Z')), [])
  assert.equal(planejarExecucoes([r], [], new Date('2026-10-27T06:00Z'))[0].instante, '2026-10-27T00:00:00.000Z')
})
