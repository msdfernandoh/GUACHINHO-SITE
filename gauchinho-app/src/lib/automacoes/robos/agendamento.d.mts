export type HorarioRobo = { hora: string; dia_semana?: number; dia_mes?: number }
export type AgendamentoRobo = { frequencia: 'MANUAL' | 'DIARIO' | 'SEMANAL' | 'MENSAL'; horarios: HorarioRobo[]; definido_em?: string }
export const DIAS_SEMANA: string[]
export function validarAgendamento(valor: unknown): void
export function obterAgendamento(tarefas?: Record<string, unknown>): AgendamentoRobo
export function descreverAgendamento(tarefas?: Record<string, unknown>): string
export function proximaExecucao(tarefas?: Record<string, unknown>, agora?: Date): string | null
export function ocorrenciasDevidas(tarefas?: Record<string, unknown>, agora?: Date): string[]
export function planejarExecucoes(robos: Array<{ id: string; ativo: boolean; configuracao_tarefas?: Record<string, unknown> }>, execucoes: Array<{ robo_config_id: string; status: string; detalhes?: Record<string, unknown> }>, agora?: Date): unknown[]
