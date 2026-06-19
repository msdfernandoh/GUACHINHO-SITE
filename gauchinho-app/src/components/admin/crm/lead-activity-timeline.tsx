"use client";

import type { TimelineItem } from "@/lib/crm/types";
import { formatDateTime } from "@/lib/utils/format";

export function LeadActivityTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-4 border-l border-zinc-800 pl-4">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-4 ring-zinc-950" />
          <p className="text-xs text-zinc-500">{formatDateTime(item.at, null)}</p>
          <p className="font-medium capitalize text-zinc-200">{item.titulo}</p>
          {item.descricao ? <p className="text-sm text-zinc-500">{item.descricao}</p> : null}
          <span className="text-[10px] uppercase text-zinc-600">{item.origem}</span>
        </li>
      ))}
      {!items.length ? <p className="text-sm text-zinc-500">Sem eventos ainda</p> : null}
    </ol>
  );
}
