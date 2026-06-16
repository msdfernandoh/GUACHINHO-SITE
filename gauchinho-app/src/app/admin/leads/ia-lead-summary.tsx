import { formatDate } from "@/lib/utils/format";

type Props = {
  lead: Record<string, unknown>;
  iaConversa: Record<string, unknown> | null;
  iaMensagens: Array<Record<string, unknown>>;
};

export function IaLeadSummarySection({ lead, iaConversa, iaMensagens }: Props) {
  if (lead.origem !== "ia_chat") return null;

  const dados = (lead.dados_simulacao as Record<string, unknown> | null) ?? {};
  const analise = String(lead.analise_ia ?? iaConversa?.resumo ?? "");

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <h2 className="font-semibold text-amber-900 dark:text-amber-200">Resumo da IA</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-zinc-500">Página de origem</dt>
          <dd>{String(dados.pagina_origem ?? iaConversa?.pagina_origem ?? "—")}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Interesse identificado</dt>
          <dd>{String(lead.tipo_interesse ?? iaConversa?.interesse_identificado ?? "—")}</dd>
        </div>
        {analise ? (
          <div>
            <dt className="text-zinc-500">Resumo da conversa</dt>
            <dd className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">{analise}</dd>
          </div>
        ) : null}
      </dl>
      {iaMensagens.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-amber-800 dark:text-amber-300">
            Histórico completo ({iaMensagens.length} mensagens)
          </summary>
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs">
            {iaMensagens.map((m) => (
              <li key={String(m.id)} className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                <span className="font-semibold uppercase text-zinc-500">{String(m.role)}</span>
                <span className="text-zinc-400"> · {formatDate(String(m.created_at))}</span>
                <p className="mt-1 text-zinc-700 dark:text-zinc-300">{String(m.content)}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
