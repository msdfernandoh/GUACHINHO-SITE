export const ROBO_POLL_TIMEOUT_MS = 15 * 60_000

export type ResultadoAcompanhamento = {
  execucao: any | null
  motivo: 'FINALIZADO' | 'AGUARDANDO' | 'CONSULTA_INDISPONIVEL' | 'INTERROMPIDO'
  mensagem?: string
}

export async function acompanharExecucaoRobo(opcoes: {
  roboId: string
  execucaoId: string
  onUpdate?: (execucao: any) => void
  interrompido?: () => boolean
  fetcher?: typeof fetch
  esperar?: (ms: number) => Promise<void>
  agora?: () => number
  limiteMs?: number
}): Promise<ResultadoAcompanhamento> {
  const fetcher = opcoes.fetcher ?? fetch
  const esperar = opcoes.esperar ?? ((ms) => new Promise(resolve => setTimeout(resolve, ms)))
  const agora = opcoes.agora ?? Date.now
  const prazo = agora() + (opcoes.limiteMs ?? ROBO_POLL_TIMEOUT_MS)
  let execucao: any = null
  let falhas = 0
  let erro = ''
  while (agora() < prazo) {
    if (opcoes.interrompido?.()) return { execucao, motivo: 'INTERROMPIDO' }
    try {
      const resposta = await fetcher(
        `/api/automacoes/robos/${opcoes.roboId}/executar?execucaoId=${encodeURIComponent(opcoes.execucaoId)}`,
        { cache: 'no-store', signal: AbortSignal.timeout(15_000) }
      )
      const data = await resposta.json()
      if (!resposta.ok) throw new Error(data.error || `Consulta de execução indisponível (HTTP ${resposta.status})`)
      const atual = (data.execucoes ?? []).find((e: { id: string; status: string }) => e.id === opcoes.execucaoId)
      if (!atual) throw new Error('A execução solicitada não foi encontrada no acompanhamento.')
      execucao = atual
      falhas = 0
      opcoes.onUpdate?.(atual)
      if (['SUCESSO', 'JA_IMPORTADO', 'CONCLUIDO', 'ERRO', 'FALHA', 'CANCELADO'].includes(atual.status)) {
        return { execucao, motivo: 'FINALIZADO' }
      }
    } catch (e) {
      erro = e instanceof Error ? e.message : 'Falha de conexão ao consultar execução'
      if (++falhas >= 3) return {
        execucao, motivo: 'CONSULTA_INDISPONIVEL',
        mensagem: `Não foi possível consultar o resultado: ${erro}. A execução permanece registrada; atualize a Central para acompanhar.`,
      }
    }
    await esperar(3_000)
  }
  return {
    execucao, motivo: 'AGUARDANDO',
    mensagem: execucao?.status === 'PENDENTE'
      ? 'A execução continua na fila, aguardando o Runner. Atualize a tela para acompanhar.'
      : 'A espera desta tela terminou sem um resultado final. A execução permanece registrada no histórico.',
  }
}
