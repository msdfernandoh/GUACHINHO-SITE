import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchGrupoWithCotas } from "../actions";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { getErpSistemaConfig } from "@/lib/erp/erp-modulos";

function percentual(value: unknown) {
  const numero = Number(value ?? 0);
  return `${numero.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`;
}

export default async function GrupoReadonlyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { empresaAtiva } = await getCurrentTenantContext();
  const erpEnabled = getErpSistemaConfig(empresaAtiva?.configuracoes).habilitado;

  let data;
  try {
    data = await fetchGrupoWithCotas(id);
  } catch {
    notFound();
  }

  const grupo = data.grupo as Record<string, unknown>;
  const administradora = grupo.administradora_rel as { nome?: string } | null;
  const resumo = [
    ["Administradora", administradora?.nome ?? grupo.administradora ?? "—"],
    ["Tipo oficial", grupo.modalidade ?? "—"],
    ["Prazo total", grupo.prazo_total ? `${grupo.prazo_total} meses` : "—"],
    ["Vagas disponíveis", grupo.vagas_disponiveis ?? 0],
    ["Taxa administrativa", percentual(grupo.taxa_administrativa_percentual)],
    ["Fundo de reserva", percentual(grupo.fundo_reserva_percentual)],
    ["Seguro", grupo.seguro_habilitado ? percentual(grupo.seguro_percentual) : "Não habilitado"],
    ["Status", grupo.status ?? "—"],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/grupos" className="text-sm text-amber-500 hover:underline">
            ← Catálogo de grupos
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Grupo {String(grupo.codigo_grupo)}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Visualização do catálogo oficial. Esta área do site não altera dados estruturais.
          </p>
        </div>
        {erpEnabled ? (
          <Link
            href={`/erp/grupos/${id}`}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Configurar no ERP
          </Link>
        ) : null}
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6">
        <h2 className="text-lg font-bold">Dados oficiais</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {resumo.map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{String(label)}</dt>
              <dd className="mt-1 font-medium text-zinc-100">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-6">
        <div>
          <h2 className="text-lg font-bold">Créditos publicados</h2>
          <p className="mt-1 text-sm text-zinc-400">
            O site calcula as parcelas com as regras oficiais; aqui são exibidos apenas os valores de crédito.
          </p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-zinc-500">
              <tr><th className="py-2">Crédito</th><th className="py-2">Status</th><th className="py-2">Ativo</th></tr>
            </thead>
            <tbody>
              {data.cotas.map((cota) => (
                <tr key={cota.id} className="border-t border-zinc-800">
                  <td className="py-3 font-medium">
                    {Number(cota.valor_credito).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                  <td className="py-3">{cota.status}</td>
                  <td className="py-3">{cota.ativo ? "Sim" : "Não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
