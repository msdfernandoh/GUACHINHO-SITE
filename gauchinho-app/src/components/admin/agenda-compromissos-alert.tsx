import Link from "next/link";
import { fetchProximosCompromissosDoConsultor } from "@/app/admin/agenda/disponibilidade/actions";
import { formatDateTime } from "@/lib/utils/format";

export async function AgendaCompromissosAlert() {
  const proximos = await fetchProximosCompromissosDoConsultor(5);
  if (!proximos.length) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-amber-100">
            Você tem {proximos.length} compromisso{proximos.length > 1 ? "s" : ""} na agenda
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-100/85">
            {proximos.slice(0, 3).map((c) => (
              <li key={c.id}>
                {formatDateTime(c.data_inicio, null)} — {c.titulo}
                {c.leadNome ? ` · ${c.leadNome}` : ""}
              </li>
            ))}
            {proximos.length > 3 ? (
              <li className="text-amber-200/70">+ {proximos.length - 3} outro(s)</li>
            ) : null}
          </ul>
        </div>
        <Link
          href="/admin/agenda"
          className="shrink-0 rounded-lg border border-amber-400/40 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-50 hover:bg-amber-500/30"
        >
          Abrir agenda
        </Link>
      </div>
    </div>
  );
}
