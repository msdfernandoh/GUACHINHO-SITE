import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { agruparCotasPorGrupo, CotaAssembleia } from "@/lib/erp/assembleias";
import { createAssembleiaAction, toggleAtencaoAssembleiaAction } from "@/app/erp/assembleias/actions";
import { listGruposAutorizadosForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";

import { ErpAssembleiasForm } from "@/components/erp/assembleias/erp-assembleias-form";

type Assembleia = {
  id: string;
  grupo_id: string;
  data_assembleia: string;
  numero_assembleia: number | null;
  pedra_sorteada: number;
  observacao: string | null;
  created_at: string;
};

type Grupo = {
  id: string;
  codigo_grupo: string;
  modalidade: string;
  administradora: string | null;
  quantidade_cotas_sorteio?: number | null;
};

type CotaRow = {
  id: string;
  grupo_id: string;
  numero_cota: string | null;
  status: string;
  venda: unknown;
};

export async function ErpAssembleiasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { empresaAtiva } = await getCurrentTenantContext();
  const empresaId = empresaAtiva?.id ?? "";
  const supabase = await createClient();

  const [gruposAutorizados, { data: assembleias, error: assembleiasError }, { data: canWrite }] =
    await Promise.all([
      listGruposAutorizadosForEmpresa(empresaId),
      supabase
        .from("erp_assembleias_grupo")
        .select("id,grupo_id,data_assembleia,numero_assembleia,pedra_sorteada,observacao,created_at")
        .eq("empresa_id", empresaId)
        .order("data_assembleia", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.rpc("can_write_tenant_internal", { p_empresa_id: empresaId }),
    ]);

  if (assembleiasError) throw new Error("Módulo Assembleias/Pedras ainda não está disponível neste ambiente.");

  const grupos = gruposAutorizados as Grupo[];
  const lista = (assembleias ?? []) as Assembleia[];
  const grupoById = new Map(grupos.map((g) => [g.id, g]));

  // Agrupa o histórico por evento operacional (data + pedra + numero) para evitar cards repetidos
  const eventosMap = new Map<
    string,
    {
      chave: string;
      id: string;
      data_assembleia: string;
      numero_assembleia: number | null;
      pedra_sorteada: number;
      gruposNomes: string[];
      totalGrupos: number;
    }
  >();

  for (const a of lista) {
    const chave = `${a.data_assembleia}:${a.pedra_sorteada}:${a.numero_assembleia ?? ""}`;
    const g = grupoById.get(a.grupo_id);
    const gNome = g ? `${g.codigo_grupo}` : a.grupo_id.slice(0, 6);
    const existente = eventosMap.get(chave);
    if (existente) {
      existente.totalGrupos += 1;
      if (existente.gruposNomes.length < 3 && !existente.gruposNomes.includes(gNome)) {
        existente.gruposNomes.push(gNome);
      }
    } else {
      eventosMap.set(chave, {
        chave,
        id: a.id,
        data_assembleia: a.data_assembleia,
        numero_assembleia: a.numero_assembleia,
        pedra_sorteada: a.pedra_sorteada,
        gruposNomes: [gNome],
        totalGrupos: 1,
      });
    }
  }
  const eventos = Array.from(eventosMap.values());

  const selecionada = lista.find((a) => a.id === params?.assembleia) ?? lista[0] ?? null;

  // Reúne todas as assembleias que pertencem ao mesmo evento de data/assembleia
  const assembleiasDoEvento = selecionada
    ? lista.filter(
        (a) =>
          a.data_assembleia === selecionada.data_assembleia &&
          (a.numero_assembleia != null && selecionada.numero_assembleia != null
            ? a.numero_assembleia === selecionada.numero_assembleia
            : a.pedra_sorteada === selecionada.pedra_sorteada),
      )
    : [];

  const grupoIdsDoEvento = [...new Set(assembleiasDoEvento.map((a) => a.grupo_id))];
  const assembleiaIdPorGrupo = new Map(assembleiasDoEvento.map((a) => [a.grupo_id, a.id]));
  const pedraPorGrupoId = new Map(assembleiasDoEvento.map((a) => [a.grupo_id, a.pedra_sorteada]));
  const assembleiaIdsDoEvento = assembleiasDoEvento.map((a) => a.id);

  let cotasMapeadas: Array<CotaAssembleia & { grupo_id: string }> = [];
  let atencoes = new Set<string>();

  if (selecionada && grupoIdsDoEvento.length > 0) {
    const [{ data: cotas }, { data: marcadas }] = await Promise.all([
      supabase
        .from("cotas_definitivas")
        .select("id,grupo_id,numero_cota,status,venda:vendas(cliente_nome,cliente:clientes(nome))")
        .eq("empresa_id", empresaId)
        .in("grupo_id", grupoIdsDoEvento),
      supabase
        .from("erp_assembleia_atencoes")
        .select("cota_definitiva_id,assembleia_id")
        .eq("empresa_id", empresaId)
        .in("assembleia_id", assembleiaIdsDoEvento),
    ]);

    cotasMapeadas = ((cotas ?? []) as unknown as CotaRow[]).map((c) => {
      const v = (Array.isArray(c.venda) ? c.venda[0] : c.venda) as
        | { cliente_nome?: string; cliente?: { nome?: string } | Array<{ nome?: string }> }
        | undefined;
      const clienteNome =
        (Array.isArray(v?.cliente) ? v.cliente[0]?.nome : v?.cliente?.nome) ||
        v?.cliente_nome ||
        "Cliente";
      return {
        id: c.id,
        grupo_id: c.grupo_id,
        numero_cota: c.numero_cota,
        status: c.status,
        cliente_nome: clienteNome,
      };
    });

    atencoes = new Set((marcadas ?? []).map((x) => `${x.assembleia_id}:${x.cota_definitiva_id}`));
  }

  // Monta lista de grupos do evento reconciliados com os metadados dos grupos
  const gruposDoEvento = grupoIdsDoEvento.map((gid) => {
    const g = grupoById.get(gid);
    return {
      id: gid,
      codigo_grupo: g?.codigo_grupo ?? gid.slice(0, 8),
      modalidade: g?.modalidade ?? "Consórcio",
      administradora: g?.administradora ?? null,
      quantidade_cotas_sorteio: g?.quantidade_cotas_sorteio ?? null,
    };
  });

  const gruposApurados = selecionada
    ? agruparCotasPorGrupo(
        gruposDoEvento,
        cotasMapeadas,
        selecionada.pedra_sorteada,
        assembleiaIdPorGrupo,
        pedraPorGrupoId,
      )
    : [];

  const totalCotasApuradas = gruposApurados.reduce((acc, g) => acc + g.cotas.length, 0);
  const totalContempladasPedra = gruposApurados.filter((g) => g.possuiContempladaPedra).length;

  const grupoFiltro = params?.grupo;
  const gruposExibidos =
    grupoFiltro && grupoFiltro !== "todos"
      ? gruposApurados.filter((g) => g.grupoId === grupoFiltro)
      : gruposApurados;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Operação de consórcio</p>
        <h1 className="text-3xl font-bold">Assembleias / Pedras</h1>
        <p className="mt-1 text-slate-500">
          Histórico operacional por grupo e proximidade das cotas reais. A atenção não altera contemplação nem resultado oficial.
        </p>
      </header>

      {canWrite === true && <ErpAssembleiasForm grupos={grupos} />}

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <section className="rounded-xl border bg-white">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold text-slate-900">Histórico de Assembleias</h2>
            <p className="text-xs text-slate-500">{eventos.length} evento(s) registrado(s)</p>
          </div>
          <div className="max-h-[680px] overflow-auto">
            {eventos.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Nenhuma assembleia registrada.</p>
            ) : (
              eventos.map((e) => {
                const isSelected = selecionada && e.data_assembleia === selecionada.data_assembleia && e.pedra_sorteada === selecionada.pedra_sorteada && e.numero_assembleia === selecionada.numero_assembleia;
                return (
                  <Link
                    key={e.chave}
                    href={`/erp/assembleias?assembleia=${e.id}`}
                    className={`block border-b px-4 py-3 text-sm transition-colors ${
                      isSelected ? "border-l-4 border-l-blue-600 bg-blue-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-slate-900">
                        {e.totalGrupos > 1 ? `Todos os grupos (${e.totalGrupos})` : `Grupo ${e.gruposNomes[0]}`}
                      </p>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                        Pedra {e.pedra_sorteada}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {e.data_assembleia}
                      {e.numero_assembleia ? ` · Assembleia ${e.numero_assembleia}` : ""}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <section className="space-y-4">
          {!selecionada ? (
            <div className="rounded-xl border bg-white p-12 text-center text-slate-500">
              <p className="font-semibold">Nenhuma assembleia selecionada</p>
              <p className="mt-1 text-sm">Registre uma assembleia acima para analisar a proximidade das cotas.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Cotas mais próximas da pedra {selecionada.pedra_sorteada}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Data: {selecionada.data_assembleia}
                      {selecionada.numero_assembleia ? ` · Assembleia ${selecionada.numero_assembleia}` : ""} · Somente cotas definitivas do mesmo grupo e tenant.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {totalContempladasPedra > 0 && (
                      <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                        🎯 {totalContempladasPedra} grupo(s) com pedra sorteada
                      </span>
                    )}
                    <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                      {totalCotasApuradas} cota(s) no total
                    </span>
                  </div>
                </div>

                {gruposApurados.length > 1 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Filtrar por grupo:</span>
                    <Link
                      href={`/erp/assembleias?assembleia=${selecionada.id}`}
                      data-grupo-value="TODOS"
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                        !grupoFiltro || grupoFiltro === "todos"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      Todos os grupos autorizados ({gruposApurados.length})
                    </Link>
                    {gruposApurados.map((g) => {
                      const isActive = grupoFiltro === g.grupoId;
                      return (
                        <Link
                          key={g.grupoId}
                          href={`/erp/assembleias?assembleia=${selecionada.id}&grupo=${g.grupoId}`}
                          className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                            isActive
                              ? "bg-blue-700 text-white"
                              : g.possuiContempladaPedra
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          Grupo {g.codigoGrupo} ({g.cotas.length}
                          {g.possuiContempladaPedra ? " · 🎯" : ""})
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
                <strong>Regra Oficial do Consórcio:</strong> A aproximação busca sempre a <strong>cota sorteada na pedra</strong> ou as <strong>cotas imediatamente superiores (maiores)</strong> em ordem crescente do grupo. Cotas com número inferior aparecem somente após o término do grupo (após giro).
              </div>

              {gruposExibidos.length === 0 ? (
                <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
                  Nenhum grupo encontrado para este filtro.
                </div>
              ) : (
                gruposExibidos.map((g) => {
                  const assembleiaIdDoGrupo = g.assembleiaId ?? selecionada.id;
                  return (
                    <article key={g.grupoId} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50/75 px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">
                            Grupo {g.codigoGrupo} · {g.modalidade}
                          </h3>
                          <span className="rounded bg-blue-700 px-2 py-0.5 font-mono text-xs font-bold text-white">
                            Pedra {g.pedraSorteada}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({g.quantidadeCotas} cotas)
                          </span>
                          {g.possuiContempladaPedra && (
                            <span className="rounded bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
                              🎯 Cota sorteada na pedra!
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {g.cotas.length > 0 ? (
                            <>
                              <span className="font-semibold text-slate-600">
                                {g.cotas.length} cota(s) numerada(s)
                              </span>
                              {g.menorDistancia != null && (
                                <span className="rounded bg-blue-100 px-2 py-0.5 font-bold text-blue-800">
                                  Menor diferença: {g.menorDistancia}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-400">Sem cotas cadastradas</span>
                          )}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Cota</th>
                              <th className="px-4 py-3">Cliente</th>
                              <th className="px-4 py-3">Diferença da pedra</th>
                              <th className="px-4 py-3">Status real</th>
                              <th className="px-4 py-3">Atenção</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {g.cotas.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-500">
                                  Nenhuma cota definitiva numerada neste grupo.
                                </td>
                              </tr>
                            ) : (
                              g.cotas.map((c) => {
                                const chaveAtencao = `${assembleiaIdDoGrupo}:${c.id}`;
                                const marcada = atencoes.has(chaveAtencao);
                                const isPedraExata = c.distancia === 0;

                                return (
                                  <tr
                                    key={c.id}
                                    className={`transition-colors ${
                                      isPedraExata
                                        ? "bg-emerald-50/80 font-medium hover:bg-emerald-100/70"
                                        : marcada
                                        ? "bg-amber-50 hover:bg-amber-100/50"
                                        : "hover:bg-slate-50"
                                    }`}
                                  >
                                    <td className="px-4 py-3">
                                      <span className="font-bold text-slate-900">{c.numero_cota}</span>
                                      {isPedraExata && (
                                        <span className="ml-2 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                          Sorteada!
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{c.cliente_nome}</td>
                                    <td className="px-4 py-3">
                                      {isPedraExata ? (
                                        <span className="font-black text-emerald-700">0 (Sorteada!)</span>
                                      ) : c.posicaoFila === "SUPERIOR" ? (
                                        <span className="font-bold text-blue-700">+{c.distancia} (Superior)</span>
                                      ) : (
                                        <span className="font-medium text-slate-500">+{c.distancia} (Após giro)</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                                        {c.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      {canWrite === true ? (
                                        <form action={toggleAtencaoAssembleiaAction}>
                                          <input type="hidden" name="assembleia_id" value={assembleiaIdDoGrupo} />
                                          <input type="hidden" name="cota_id" value={c.id} />
                                          <input type="hidden" name="marcada" value={String(marcada)} />
                                          <button
                                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                              marcada
                                                ? "bg-amber-500 text-white hover:bg-amber-600"
                                                : "border border-amber-300 text-amber-800 hover:bg-amber-100"
                                            }`}
                                          >
                                            {marcada ? "Em atenção" : "Marcar atenção"}
                                          </button>
                                        </form>
                                      ) : marcada ? (
                                        <span className="font-semibold text-amber-700">Em atenção</span>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  );
                })
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

