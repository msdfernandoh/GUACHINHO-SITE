"use client";

import { useSearchParams } from "next/navigation";

export function ExportLeadsButton() {
  const sp = useSearchParams();
  const qs = sp.toString();
  const base = qs ? `?${qs}` : "";
  const csvHref = `/api/admin/leads/export${base}${base ? "&" : "?"}format=csv`;
  const xlsHref = `/api/admin/leads/export${base}${base ? "&" : "?"}format=xls`;

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={csvHref}
        className="inline-flex items-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20"
      >
        Exportar CSV
      </a>
      <a
        href={xlsHref}
        className="inline-flex items-center rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
      >
        Exportar XLS
      </a>
    </div>
  );
}
