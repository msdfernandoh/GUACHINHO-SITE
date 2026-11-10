import test from 'node:test'
import assert from 'node:assert/strict'
import { salvarResultadoExecucao } from '../robo-finalizacao.mjs'
test('encerra resultado parcial no banco antigo e preserva contagens', async () => {
  const writes = []
  const admin = { from: () => ({ update: payload => ({ eq: async () => {
    writes.push(payload)
    return { error: writes.length === 1 ? { code: '23514', message: 'status_check' } : null }
  } }) }) }
  await salvarResultadoExecucao(admin, 'execucao', { status: 'SUCESSO_PARCIAL', resultado: { lances: { cotasProcessadas: 5, totalErros: 1 } }, detalhes: { logs: ['fim'] } })
  assert.equal(writes[1].status, 'ERRO')
  assert.deepEqual(writes[1].resultado.lances, { cotasProcessadas: 5, totalErros: 1 })
  assert.equal(writes[1].detalhes.execucao_parcial, true)
})
test('falha de gravação nunca é ignorada', async () => {
  const admin = { from: () => ({ update: () => ({ eq: async () => ({ error: { code: '500', message: 'indisponível' } }) }) }) }
  await assert.rejects(salvarResultadoExecucao(admin, 'execucao', { status: 'SUCESSO' }), /Falha ao encerrar/)
})
