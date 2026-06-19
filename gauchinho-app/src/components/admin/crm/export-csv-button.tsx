"use client";

import { useSearchParams } from "next/navigation";

export function ExportCsvButton() {
  const sp = useSearchParams();
  const qs = sp.toString();
  const href = `/api/admin/leads/export${qs ? `?${qs}` : ""}`;

  return (
    <a
      href={href}
      className="inline-flex items-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20"
    >
      Exportar CSV
    </a>
  );
}
