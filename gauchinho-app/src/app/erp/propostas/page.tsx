import Link from "next/link";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { BulkArchiveSelection } from "@/components/erp/bulk-archive-selection";
import { excluirPropostasEmLoteAction } from "@/app/admin/propostas/actions";
import { MarcarPropostaContratadaButton } from "@/components/admin/marcar-proposta-contratada-button";
import { BaixarPropostaPdfButton } from "@/components/admin/baixar-proposta-pdf-button";
import { agruparPropostasPorClienteEData } from "@/lib/proposta/proposta-unificacao-service";
import { createClient } from "@/lib/supabase/server";
import { FileText, Plus, Search } from "lucide-react";

export default async function ErpPropostasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filtros = await searchParams;
  const { empresaAtiva, vinculo } = await requireErpRouteAccess("propostas");
  const podeExcluirEmLote = vinculo.papel?.codigo === "admin_empresa" || (await isPlatformSuperadmin());

  const supabase = await createClient();
  let query = supabase
    .from("propostas")
    .select("id, created_at, nome_cliente, whatsapp_cliente, email_cliente, cidade_cliente, tipo_proposta, tipo_bem, valor_credito, valor_parcela, prazo, status, lead_id, pdf_url, consultor_nome")
    .eq("empresa_id", empresaAtiva.id)
    .is("excluido_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filtros.status) {
    query = query.eq("status", filtros.status);
  }

  const { data: rawData, error } = await query;
  if (error) throw new Error(error.message);

  let propostas = rawData ?? [];

  // Filtro de busca textual em memória para velocidade e flexibilidade
  if (filtros.busca) {
    const b = filtros.busca.toLowerCase().replace(/\D/g, "") || filtros.busca.toLowerCase();
    propostas = propostas.filter((p) =>
      [p.nome_cliente, p.whatsapp_cliente, p.email_cliente, p.cidade_cliente]
        .some((val) => val && (val.toLowerCase().includes(filtros.busca!.toLowerCase()) || val.replace(/\D/g, "").includes(b)))
    );
  }

  // Busca contratações vinculadas para enriquecer os botões de ação
  const propostaIds = propostas.map((p) => p.id);
  const contratacoesMap = new Map<string, { id: string; protocolo: string }>();

  if (propostaIds.length > 0) {
    const { data: cList } = await supabase
      .from("contratacoes_online")
      .select("id, protocolo, proposta_id")
      .eq("empresa_id", empresaAtiva.id)
      .in("proposta_id", propostaIds);

    for (const c of cList ?? []) {
      if (c.proposta_id) {
        contratacoesMap.set(c.proposta_id, { id: c.id, protocolo: c.protocolo });
      }
    }
  }

  const rows = propostas.map((p) => {
    const c = contratacoesMap.get(p.id);
    return {
      ...p,
      contratacao_id: c?.id ?? null,
      contratacao_protocolo: c?.protocolo ?? null,
      isContratada: p.status === "Contratada" || Boolean(c),
    };
  });

  const unificar = filtros.unificar !== "0";
  const displayedRows = unificar
    ? agruparPropostasPorClienteEData(rows).map((g) => ({
        ...g.propostaPrincipal,
        _totalNoDia: g.totalNoDia,
      }))
    : rows.map((r) => ({ ...r, _totalNoDia: 1 }));

  // Métricas para cards operacionais
  const total = rows.length;
  const emNegociacao = rows.filter((r) => ["Gerada", "PDF gerado", "Em negociação", "Enviada"].includes(r.status) && !r.isContratada).length;
  const contratadas = rows.filter((r) => r.isContratada).length;
  const mesAtual = new Date().toISOString().slice(0, 7);
  const geradasNoMes = rows.filter((r) => (r.created_at ?? "").startsWith(mesAtual)).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">
            Comercial · ERP
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            Propostas comerciais
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Acompanhe cotações, gerencie propostas em negociação e formalize contratações.
          </p>
        </div>
        <Link
          href="/erp/propostas/nova"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
        >
          <Plus size={16} />
          Nova proposta
        </Link>
      </header>

      {/* Cards de Métricas Operacionais */}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Total listado</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Em andamento / Negociação</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{emNegociacao}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Contratadas</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{contratadas}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-600">Geradas no mês</p>
          <p className="mt-2 text-3xl font-bold text-blue-700">{geradasNoMes}</p>
        </div>
      </section>

      {/* Formulário de Filtros */}
      <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3 xl:grid-cols-6">
        <div className="relative xl:col-span-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            name="busca"
            defaultValue={filtros.busca}
            placeholder="Buscar por cliente, WhatsApp, e-mail ou cidade..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          name="status"
          defaultValue={filtros.status ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none xl:col-span-2"
        >
          <option value="">Todos os status</option>
          <option value="Gerada">Gerada</option>
          <option value="PDF gerado">PDF gerado</option>
          <option value="Enviada">Enviada</option>
          <option value="Em negociação">Em negociação</option>
          <option value="Aprovada">Aprovada</option>
          <option value="Contratada">Contratada</option>
          <option value="Perdida">Perdida</option>
          <option value="Cancelada">Cancelada</option>
        </select>
        <div className="flex items-center gap-2 xl:col-span-1">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              name="unificar"
              value="1"
              defaultChecked={unificar}
              className="rounded border-slate-300"
            />
            Unificar por cliente e data
          </label>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Filtrar
        </button>
      </form>

      {/* Tabela de Propostas */}
      <BulkArchiveSelection
        enabled={podeExcluirEmLote}
        entityLabel="propostas"
        action={excluirPropostasEmLoteAction}
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {podeExcluirEmLote && (
                  <th className="w-10 px-4 py-3">
                    <span className="sr-only">Selecionar</span>
                  </th>
                )}
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo / Bem</th>
                <th className="px-4 py-3">Crédito</th>
                <th className="px-4 py-3">Parcela / Prazo</th>
                <th className="px-4 py-3">Consultor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedRows.map((p) => (
                <tr key={p.id} className="align-middle hover:bg-slate-50/80">
                  {podeExcluirEmLote && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        name="ids"
                        value={p.id}
                        aria-label={`Selecionar proposta de ${p.nome_cliente ?? "cliente"}`}
                      />
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {formatDate(p.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-900">
                        {p.nome_cliente || "Cliente não informado"}
                      </span>
                      {p._totalNoDia > 1 && (
                        <span
                          className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800"
                          title={`${p._totalNoDia} cotações geradas nesta data por este cliente`}
                        >
                          {p._totalNoDia} no dia
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.whatsapp_cliente && (
                        <span>{p.whatsapp_cliente}</span>
                      )}
                      {p.cidade_cliente && (
                        <span> · {p.cidade_cliente}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div className="text-xs font-medium">{p.tipo_proposta || "Consórcio"}</div>
                    {p.tipo_bem && <div className="text-[11px] text-slate-400">{p.tipo_bem}</div>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                    {p.valor_credito ? formatCurrency(Number(p.valor_credito)) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    {p.valor_parcela ? (
                      <div>{formatCurrency(Number(p.valor_parcela))}</div>
                    ) : null}
                    {p.prazo ? (
                      <div className="text-slate-400">{p.prazo} meses</div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                    {p.consultor_nome || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        p.isContratada
                          ? "bg-emerald-100 text-emerald-800"
                          : p.status === "Aprovada"
                          ? "bg-blue-100 text-blue-800"
                          : p.status === "Em negociação"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {p.isContratada ? "Contratada" : p.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <BaixarPropostaPdfButton propostaId={p.id} />
                      <MarcarPropostaContratadaButton
                        propostaId={p.id}
                        contratacaoId={p.contratacao_id}
                        contratacaoProtocolo={p.contratacao_protocolo}
                        isContratada={p.isContratada}
                        origem="erp"
                      />
                      <Link
                        href={`/erp/propostas/${p.id}`}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Ver detalhes
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="p-12 text-center text-slate-500">
              <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="font-semibold">Nenhuma proposta encontrada.</p>
              <p className="text-xs text-slate-400 mt-1">
                Tente alterar os filtros ou crie uma nova proposta comercial.
              </p>
            </div>
          )}
        </div>
      </BulkArchiveSelection>
    </div>
  );
}
