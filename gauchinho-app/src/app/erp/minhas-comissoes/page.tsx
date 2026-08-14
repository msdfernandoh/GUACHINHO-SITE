import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { conferirPagamentoAction } from "./actions";
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
export default async function MinhasComissoesPage() {
  const { empresaAtiva, usuario } = await getCurrentTenantContext();
  if (!empresaAtiva || !usuario) return null;
  const db = await createClient();
  const { data: participante } = await db
    .from("participantes_comerciais")
    .select("id,nome,nome_exibicao")
    .eq("empresa_id", empresaAtiva.id)
    .eq("usuario_id", usuario.id)
    .eq("status", "ATIVO")
    .maybeSingle();
  if (!participante)
    return (
      <div className="rounded-2xl bg-amber-50 p-6 text-amber-900">
        Seu usuário ainda não possui identidade de participante ativa nesta
        empresa.
      </div>
    );
  const { data } = await db
    .from("comissao_previsoes_participantes")
    .select(
      "id,nome_etapa,competencia,valor_previsto,valor_elegivel,valor_pago,status,tipo_gatilho,conferido_por_participante",
    )
    .eq("empresa_id", empresaAtiva.id)
    .eq("participante_comercial_id", participante.id)
    .order("competencia");
  const rows = data ?? [];
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const next = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
  const sum = (
    predicate: (x: any) => boolean,
    key: "valor_previsto" | "valor_pago",
  ) => rows.filter(predicate).reduce((s, x) => s + Number(x[key] ?? 0), 0);
  const cards = [
    ["Total gerado", sum(() => true, "valor_previsto")],
    ["Ganho do mês", sum((x) => x.competencia === current, "valor_pago")],
    ["Próximo mês", sum((x) => x.competencia === next, "valor_previsto")],
    ["Ganhos futuros", sum((x) => x.competencia > next, "valor_previsto")],
  ] as const;
  return (
    <main className="space-y-6">
      <header className="rounded-3xl bg-slate-950 p-7 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
          Minha comissão
        </p>
        <h1 className="mt-2 text-3xl font-black">
          {participante.nome_exibicao || participante.nome}
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Valores líquidos e elegíveis conforme recebimento real da
          Franqueadora.
        </p>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-black">{money(value)}</p>
          </div>
        ))}
      </section>
      <section className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Competência</th>
              <th className="p-3">Etapa</th>
              <th className="p-3">Gerado</th>
              <th className="p-3">Elegível</th>
              <th className="p-3">Pago</th>
              <th className="p-3">Conferência</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-3">{row.competencia}</td>
                <td className="p-3 font-bold">
                  {row.tipo_gatilho === "CONTEMPLACAO"
                    ? "CONTEMPLAÇÃO"
                    : row.nome_etapa}
                </td>
                <td className="p-3">{money(Number(row.valor_previsto))}</td>
                <td className="p-3">{money(Number(row.valor_elegivel))}</td>
                <td className="p-3">{money(Number(row.valor_pago))}</td>
                <td className="p-3">
                  {row.conferido_por_participante ? (
                    <span className="font-bold text-emerald-700">
                      Conferido por mim
                    </span>
                  ) : Number(row.valor_pago) > 0 ? (
                    <form action={conferirPagamentoAction}>
                      <input type="hidden" name="previsao_id" value={row.id} />
                      <button className="rounded-lg border border-blue-300 px-2 py-1 text-xs font-bold text-blue-700">
                        Conferido / recebido por mim
                      </button>
                    </form>
                  ) : (
                    <span className="text-slate-400">Aguardando pagamento</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
