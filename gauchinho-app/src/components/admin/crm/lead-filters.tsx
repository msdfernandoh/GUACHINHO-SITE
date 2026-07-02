"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FUNNEL_STATUSES, LEAD_TEMPERATURES } from "@/lib/crm/constants";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";

type Srd = { id: string; nome: string };
type EventoOpt = { id: string; nome: string };

export function LeadFilters({ srds, eventos = [] }: { srds: Srd[]; eventos?: EventoOpt[] }) {
  const sp = useSearchParams();
  const q = (k: string) => sp.get(k) ?? "";

  return (
    <form
      method="get"
      action="/admin/leads"
      className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 md:grid-cols-4 lg:grid-cols-6"
    >
      <div>
        <Label>Período</Label>
        <Select name="periodo" defaultValue={q("periodo")}>
          <option value="">Todos</option>
          <option value="7">7 dias</option>
          <option value="30">30 dias</option>
        </Select>
      </div>
      <div>
        <Label>Status</Label>
        <Select name="status" defaultValue={q("status")}>
          <option value="">Todos</option>
          {FUNNEL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Origem</Label>
        <Input name="origem" defaultValue={q("origem")} placeholder="simulador…" />
      </div>
      <div>
        <Label>Evento</Label>
        <Select name="evento" defaultValue={q("evento")}>
          <option value="">Todos</option>
          {eventos.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.nome}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Temperatura</Label>
        <Select name="temperatura" defaultValue={q("temperatura")}>
          <option value="">—</option>
          {LEAD_TEMPERATURES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Consultor</Label>
        <Select name="srd" defaultValue={q("srd")}>
          <option value="">Todos</option>
          {srds.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Retorno / ação</Label>
        <Select name="retorno" defaultValue={q("retorno")}>
          <option value="">—</option>
          <option value="hoje">Retorno hoje</option>
          <option value="atrasados">Atrasados</option>
          <option value="sem">Sem agendamento</option>
        </Select>
      </div>
      <div>
        <Label>Cidade</Label>
        <Input name="cidade" defaultValue={q("cidade")} />
      </div>
      <div>
        <Label>Produto</Label>
        <Input name="produto" defaultValue={q("produto")} />
      </div>
      <div className="md:col-span-2">
        <Label>Busca</Label>
        <Input name="q" defaultValue={q("q")} placeholder="Nome, WhatsApp, e-mail…" />
      </div>
      <div className="flex flex-wrap items-end gap-2 md:col-span-2">
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" name="sem_responsavel" value="1" defaultChecked={q("sem_responsavel") === "1"} />
          Sem responsável
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" name="somente_novos" value="1" defaultChecked={q("somente_novos") === "1"} />
          Só novos
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" name="somente_quentes" value="1" defaultChecked={q("somente_quentes") === "1"} />
          Quentes
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" name="acao_vencida" value="1" defaultChecked={q("acao_vencida") === "1"} />
          Ação vencida
        </label>
      </div>
      <div className="flex flex-wrap gap-2 md:col-span-6">
        <Button type="submit">Filtrar</Button>
        <Link href="/admin/leads" className="text-sm text-amber-400 hover:underline">
          Limpar
        </Link>
        <Link href="/admin/leads/funil" className="text-sm text-amber-400 hover:underline">
          Ver funil →
        </Link>
      </div>
    </form>
  );
}
