'use client'

import { DIAS_SEMANA, type AgendamentoRobo } from '@/lib/automacoes/robos/agendamento.mjs'

export function AgendamentoEditor({ valor, onChange }: { valor: AgendamentoRobo; onChange: (valor: AgendamentoRobo) => void }) {
  const campo = 'w-full rounded-lg border border-zinc-300 bg-white p-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100'
  return (
    <fieldset className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
      <legend className="px-1 text-sm font-semibold">Execução automática</legend>
      <label className="block space-y-1 text-xs font-medium">
        <span>Frequência</span>
        <select className={campo} value={valor.frequencia} onChange={e => onChange({ frequencia: e.target.value as AgendamentoRobo['frequencia'], horarios: [{ hora: '07:00', dia_semana: 1, dia_mes: 1 }] })}>
          <option value="MANUAL">Somente manual</option>
          <option value="DIARIO">Todos os dias</option>
          <option value="SEMANAL">Toda semana</option>
          <option value="MENSAL">Todo mês</option>
        </select>
      </label>
      {valor.frequencia !== 'MANUAL' && valor.horarios.map((item, indice) => (
        <div key={indice} className="flex flex-wrap items-end gap-2">
          {valor.frequencia === 'SEMANAL' && <label className="min-w-36 flex-1 space-y-1 text-xs font-medium"><span>Dia da semana</span><select className={campo} value={item.dia_semana ?? 1} onChange={e => onChange({ ...valor, horarios: valor.horarios.map((h, i) => i === indice ? { ...h, dia_semana: Number(e.target.value) } : h) })}>{DIAS_SEMANA.map((dia, i) => <option key={dia} value={i}>{dia}</option>)}</select></label>}
          {valor.frequencia === 'MENSAL' && <label className="min-w-24 flex-1 space-y-1 text-xs font-medium"><span>Dia do mês</span><input className={campo} type="number" min={1} max={31} required value={item.dia_mes ?? 1} onChange={e => onChange({ ...valor, horarios: valor.horarios.map((h, i) => i === indice ? { ...h, dia_mes: Number(e.target.value) } : h) })} /></label>}
          <label className="min-w-28 flex-1 space-y-1 text-xs font-medium"><span>Horário</span><input className={campo} type="time" required value={item.hora} onChange={e => onChange({ ...valor, horarios: valor.horarios.map((h, i) => i === indice ? { ...h, hora: e.target.value } : h) })} /></label>
          {valor.horarios.length > 1 && <button type="button" className="rounded-lg border border-zinc-300 p-2 text-xs" onClick={() => onChange({ ...valor, horarios: valor.horarios.filter((_, i) => i !== indice) })}>Remover</button>}
        </div>
      ))}
      {valor.frequencia !== 'MANUAL' && valor.horarios.length < 31 && <button type="button" className="text-sm font-semibold text-amber-700 dark:text-amber-400" onClick={() => onChange({ ...valor, horarios: [...valor.horarios, { hora: '07:00', dia_semana: 1, dia_mes: 15 }] })}>+ Adicionar dia / horário</button>}
      <p className="text-xs text-zinc-500">Horário de Cuiabá (MT). A execução automática depende do serviço de robôs ativo.{valor.frequencia === 'MENSAL' && ' Dias 29, 30 e 31 são executados apenas nos meses que possuem esse dia.'}</p>
    </fieldset>
  )
}
