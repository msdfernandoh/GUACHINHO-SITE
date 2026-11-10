export async function salvarResultadoExecucao(admin, id, payload) {
  let { error } = await admin.from('robo_execucoes').update(payload).eq('id', id)
  // Bancos anteriores à inclusão de SUCESSO_PARCIAL aceitam apenas ERRO/SUCESSO.
  // Preserva os resultados e encerra a fila mesmo quando parte das cotas falhou.
  if (error?.code === '23514' && payload.status === 'SUCESSO_PARCIAL') {
    const fallback = { ...payload, status: 'ERRO', detalhes: { ...payload.detalhes, execucao_parcial: true }, resultado: { ...payload.resultado, execucao_parcial: true } }
    ;({ error } = await admin.from('robo_execucoes').update(fallback).eq('id', id))
  }
  if (error) throw new Error(`Falha ao encerrar execução: ${error.message}`)
}
