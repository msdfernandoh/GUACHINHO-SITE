import { formatBRL } from "@/lib/formatters/money";
import { valorCreditoPorCota } from "@/lib/erp/valor-credito-cota";
import { resumoGruposAssembleia } from "@/lib/erp/assembleias-resumo";
import { StatusCotaAssembleiaButtons } from "@/components/erp/assembleias/status-cota-assembleia-buttons";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { agruparCotasPorGrupo, numeroCotaParaPedra, CotaAssembleia } from "@/lib/erp/assembleias";
import { toggleAtencaoAssembleiaAction } from "@/app/erp/assembleias/actions";
import { aplicarCorrecaoPedra, chaveEvento, quantidadeCotasRegistrada } from "@/lib/erp/assembleias-pedras-historico";
import { listarGruposParaAssembleias } from "@/lib/erp/grupos-assembleias";

import { ErpAssembleiasForm } from "@/components/erp/assembleias/erp-assembleias-form";
import { ErpClientesContempladosPanel } from "@/components/erp/assembleias/erp-clientes-contemplados-panel";
import { ErpContemplacoesPanel } from "@/components/erp/assembleias/erp-contemplacoes-panel";

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
  capacidade_total?: number | null;
  quantidade_cotas_sorteio?: number | null;
};

type CotaRow = {
  id: string;
  grupo_id: string;
  numero_cota: string | null;
  status: string;
  contemplada: boolean | null;
  valor_credito: number | null;
  snapshot_cota: unknown;
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
      listarGruposParaAssembleias(supabase, empresaId),
      supabase
        .from("erp_assembleias_grupo")
        .select("id,grupo_id,data_assembleia,numero_assembleia,pedra_sorteada,observacao,created_at")
        .eq("empresa_id", empresaId)
        .order("data_assembleia", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.rpc("can_write_tenant_internal", { p_empresa_id: empresaId }),
    ]);

  if (assembleiasError) throw new Error("Módulo Assembleias/Pedras ainda não está disponível neste ambiente.");

  const ordemNumerica = new Intl.Collator("pt-BR", { numeric: true });
  const grupos = [...gruposAutorizados].sort((a, b) =>
    ordemNumerica.compare(a.codigo_grupo, b.codigo_grupo),
  ) as Grupo[];
  const lista = ((assembleias ?? []) as Assembleia[]).map(aplicarCorrecaoPedra);
  const grupoById = new Map(grupos.map((g) => [g.id, g]));

  // Uma gravação em lote pode produzir pedras diferentes na mesma assembleia.
  const eventosMap = new Map<
    string,
    {
      chave: string;
      id: string;
      data_assembleia: string;
      numero_assembleia: number | null;
      pedras: Set<number>;
      gruposNomes: string[];
      totalGrupos: number;
    }
  >();

  for (const a of lista) {
    const chave = chaveEvento(a);
    const g = grupoById.get(a.grupo_id);
    const gNome = g ? `${g.codigo_grupo}` : a.grupo_id.slice(0, 6);
    const existente = eventosMap.get(chave);
    if (existente) {
      existente.totalGrupos += 1;
      existente.pedras.add(a.pedra_sorteada);
      if (existente.gruposNomes.length < 3 && !existente.gruposNomes.includes(gNome)) {
        existente.gruposNomes.push(gNome);
      }
    } else {
      eventosMap.set(chave, {
        chave,
        id: a.id,
        data_assembleia: a.data_assembleia,
        numero_assembleia: a.numero_assembleia,
        pedras: new Set([a.pedra_sorteada]),
        gruposNomes: [gNome],
        totalGrupos: 1,
      });
    }
  }
  const eventos = Array.from(eventosMap.values());

  const selecionada = lista.find((a) => a.id === params?.assembleia) ?? lista[0] ?? null;

  const assembleiasDoEvento = selecionada
    ? lista.filter((a) => chaveEvento(a) === chaveEvento(selecionada))
    : [];

  const grupoIdsDoEvento = [...new Set(assembleiasDoEvento.map((a) => a.grupo_id))];
  const assembleiaIdPorGrupo = new Map(assembleiasDoEvento.map((a) => [a.grupo_id, a.id]));
  const pedraPorGrupoId = new Map(assembleiasDoEvento.map((a) => [a.grupo_id, a.pedra_sorteada]));
  const assembleiaIdsDoEvento = assembleiasDoEvento.map((a) => a.id);

  let cotasMapeadas: Array<CotaAssembleia & { grupo_id: string }> = [];
  let atencoes = new Set<string>();

  const abaPedras = params?.aba !== "contemplacoes" && params?.aba !== "clientes-contemplados";
  if (abaPedras && selecionada && grupoIdsDoEvento.length > 0) {
    const [{ data: cotas }, { data: marcadas }] = await Promise.all([
      supabase
        .from("cotas_definitivas")
        .select("id,grupo_id,numero_cota,status,contemplada,valor_credito,snapshot_cota,venda:vendas(cliente_id,cliente_nome,cliente:clientes(nome))")
        .eq("empresa_id", empresaId)
        .in("grupo_id", grupoIdsDoEvento)
        .order("id"),
      supabase
        .from("erp_assembleia_atencoes")
        .select("cota_definitiva_id,assembleia_id")
        .eq("empresa_id", empresaId)
        .in("assembleia_id", assembleiaIdsDoEvento),
    ]);

    atencoes = new Set((marcadas ?? []).map((x) => `${x.assembleia_id}:${x.cota_definitiva_id}`));
    const foraDaFila = new Set<string>();
    const cotasPorChave = new Map<string, (typeof cotasMapeadas)[number]>();
    for (const c of (cotas ?? []) as unknown as CotaRow[]) {
      const v = (Array.isArray(c.venda) ? c.venda[0] : c.venda) as
        | { cliente_id?: string | null; cliente_nome?: string; cliente?: { nome?: string } | Array<{ nome?: string }> }
        | undefined;
      const clienteNome =
        (Array.isArray(v?.cliente) ? v.cliente[0]?.nome : v?.cliente?.nome) ||
        v?.cliente_nome ||
        "Cliente";
      const numero = numeroCotaParaPedra(c.numero_cota);
      const chave = v?.cliente_id && numero != null
        ? `${c.grupo_id}:${numero}:${v.cliente_id}`
        : c.id;
      if (c.status === "cancelada") {
        foraDaFila.add(chave);
        continue;
      }
      const assembleiaId = assembleiaIdPorGrupo.get(c.grupo_id);
      if (cotasPorChave.has(chave) && !atencoes.has(`${assembleiaId}:${c.id}`)) continue;
      cotasPorChave.set(chave, {
        id: c.id,
        grupo_id: c.grupo_id,
        numero_cota: c.numero_cota,
        status: c.contemplada ? "contemplada" : c.status,
        cliente_nome: clienteNome,
        valor_credito: valorCreditoPorCota(c) || null,
      });
    }
    cotasMapeadas = [...cotasPorChave].filter(([chave]) => !foraDaFila.has(chave)).map(([, cota]) => cota);
  }

  // Monta lista de grupos do evento reconciliados com os metadados dos grupos
  const assembleiaPorGrupo = new Map(assembleiasDoEvento.map((a) => [a.grupo_id, a]));
  const gruposDoEvento = grupoIdsDoEvento.map((gid) => {
    const assembleia = assembleiaPorGrupo.get(gid);
    const g = grupoById.get(gid);
    return {
      id: gid,
      codigo_grupo: g?.codigo_grupo ?? gid.slice(0, 8),
      modalidade: g?.modalidade ?? "Consórcio",
      administradora: g?.administradora ?? null,
      capacidade_total: (assembleia && quantidadeCotasRegistrada(assembleia)) ?? g?.capacidade_total ?? null,
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
      ).sort((a, b) => ordemNumerica.compare(a.codigoGrupo, b.codigoGrupo))
    : [];

  const totalCotasApuradas = gruposApurados.reduce((acc, g) => acc + g.cotas.length, 0);
  const totalContempladasPedra = gruposApurados.filter((g) => g.possuiContempladaPedra).length;

  const grupoFiltro = params?.grupo;
  // Padrão: só grupos com cotas da carteira; "sem_cotas=1" mostra todos.
  const mostrarSemCotas = params?.sem_cotas === "1";
  const gruposVisiveis = mostrarSemCotas ? gruposApurados : gruposApurados.filter((g) => g.cotas.length > 0);
  const qsSemCotas = mostrarSemCotas ? "&sem_cotas=1" : "";
  const gruposExibidos =
    grupoFiltro && grupoFiltro !== "todos"
      ? gruposApurados.filter((g) => g.grupoId === grupoFiltro)
      : gruposVisiveis;

  const abaAtiva = params?.aba === "contemplacoes" || params?.aba === "clientes-contemplados" ? params.aba : "pedras";
  const resumoPorGrupo = abaAtiva === "pedras" && gruposExibidos.length
    ? await resumoGruposAssembleia(
        supabase,
        gruposAutorizados.filter((g) => gruposExibidos.some((e) => e.grupoId === g.id)),
      ).catch((error) => {
        console.error("Indicadores das assembleias indisponíveis", error);
        return null;
      })
    : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Operação de consórcio</p>
          <h1 className="text-2xl font-bold md:text-3xl">Assembleias e pedras</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Pedra da Loteria Federal, cotas da carteira mais próximas e resultados oficiais da Racon.
          </p>
        </div>
      </header>

      {/* Navegação entre abas */}
      <nav className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="inline-flex min-w-max gap-1 rounded-xl bg-slate-100 p-1">
          {([
            ["pedras", "Pedras e aproximação"],
            ["contemplacoes", "Resultados e contemplações"],
            ["clientes-contemplados", "Clientes contemplados"],
          ] as const).map(([id, rotulo]) => (
            <Link
              key={id}
              href={`/erp/assembleias?aba=${id}`}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition md:px-4 ${
                abaAtiva === id ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {rotulo}
            </Link>
          ))}
        </div>
      </nav>

      {abaAtiva === "clientes-contemplados" ? (
        <ErpClientesContempladosPanel />
      ) : abaAtiva === "contemplacoes" ? (
        <ErpContemplacoesPanel grupos={grupos} />
      ) : (
        <>
          {canWrite === true && (
            <details className="group rounded-xl border bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-800">
                <span>+ Registrar nova assembleia</span>
                <span className="text-xs font-normal text-slate-500 group-open:hidden">Abrir</span>
                <span className="hidden text-xs font-normal text-slate-500 group-open:inline">Fechar</span>
              </summary>
              <div className="border-t p-4"><ErpAssembleiasForm grupos={grupos} /></div>
            </details>
          )}

          <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <section className="rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold text-slate-900">Histórico</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{eventos.length}</span>
          </div>
          <div className="max-h-56 overflow-auto md:max-h-[680px]">
            {eventos.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Nenhuma assembleia registrada.</p>
            ) : (
              eventos.map((e) => {
                const isSelected = selecionada && e.chave === chaveEvento(selecionada);
                return (
                  <Link
                    key={e.chave}
                    href={`/erp/assembleias?assembleia=${e.id}`}
                    className={`flex items-center justify-between gap-3 border-b px-4 py-3 text-sm transition-colors ${
                      isSelected ? "border-l-4 border-l-blue-600 bg-blue-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {e.totalGrupos > 1 ? `${e.totalGrupos} grupos` : `Grupo ${e.gruposNomes[0]}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        {e.data_assembleia.split("-").reverse().join("/")}
                        {e.numero_assembleia ? ` · nº ${e.numero_assembleia}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-slate-900 px-2 py-1 font-mono text-xs font-bold text-white">
                      {e.pedras.size === 1 ? [...e.pedras][0] : "várias"}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <section className="min-w-0 space-y-4">
          {!selecionada ? (
            <div className="rounded-xl border bg-white p-12 text-center text-slate-500">
              <p className="font-semibold">Nenhuma assembleia selecionada</p>
              <p className="mt-1 text-sm">Registre uma assembleia para ver as cotas mais próximas da pedra.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-white p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assembleia selecionada</p>
                    <h2 className="text-lg font-bold text-slate-900 md:text-xl">
                      {selecionada.data_assembleia.split("-").reverse().join("/")}
                      {selecionada.numero_assembleia ? ` · nº ${selecionada.numero_assembleia}` : ""}
                    </h2>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 md:gap-3">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Grupos</p>
                    <p className="text-xl font-bold text-slate-900">{gruposApurados.length}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Cotas</p>
                    <p className="text-xl font-bold text-slate-900">{totalCotasApuradas}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${totalContempladasPedra > 0 ? "bg-emerald-50" : "bg-slate-50"}`}>
                    <p className="text-[11px] font-semibold uppercase text-slate-500">Na pedra</p>
                    <p className={`text-xl font-bold ${totalContempladasPedra > 0 ? "text-emerald-700" : "text-slate-900"}`}>{totalContempladasPedra}</p>
                  </div>
                </div>

                <Link
                  href={`/erp/assembleias?assembleia=${selecionada.id}${grupoFiltro ? `&grupo=${grupoFiltro}` : ""}${mostrarSemCotas ? "" : "&sem_cotas=1"}`}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700"
                  role="checkbox"
                  aria-checked={!mostrarSemCotas}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${mostrarSemCotas ? "border-slate-400 bg-white" : "border-blue-600 bg-blue-600 text-white"}`}>
                    {mostrarSemCotas ? null : <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true"><path d="M2 6l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>}
                  </span>
                  Mostrar só grupos com cotas
                </Link>

                {gruposVisiveis.length > 1 && (
                  <div className="-mx-4 mt-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                    <div className="flex min-w-max gap-2 md:min-w-0 md:flex-wrap">
                    <Link
                      href={`/erp/assembleias?assembleia=${selecionada.id}${qsSemCotas}`}
                      data-grupo-value="TODOS"
                      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        !grupoFiltro || grupoFiltro === "todos"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      Todos ({gruposVisiveis.length})
                    </Link>
                    {gruposVisiveis.map((g) => {
                      const isActive = grupoFiltro === g.grupoId;
                      return (
                        <Link
                          key={g.grupoId}
                          href={`/erp/assembleias?assembleia=${selecionada.id}&grupo=${g.grupoId}${qsSemCotas}`}
                          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                            isActive
                              ? "bg-blue-700 text-white"
                              : g.possuiContempladaPedra
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {g.codigoGrupo} · {g.cotas.length}
                        </Link>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>

              <details className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                <summary className="cursor-pointer font-semibold">Como a aproximação é calculada</summary>
                <p className="mt-2">A aproximação busca a <strong>cota sorteada na pedra</strong> ou as <strong>cotas imediatamente superiores</strong>, em ordem crescente do grupo. Cotas com número inferior aparecem só depois do fim do grupo (após o giro).</p>
              </details>

              {gruposExibidos.length === 0 ? (
                <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
                  Nenhum grupo encontrado para este filtro.
                </div>
              ) : (
                gruposExibidos.map((g) => {
                  const resumo = resumoPorGrupo?.[g.grupoId];
                  const assembleiaIdDoGrupo = g.assembleiaId ?? selecionada.id;
                  return (
                    <article key={g.grupoId} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50/75 px-4 py-3 md:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">
                            Grupo {g.codigoGrupo} · {g.modalidade}
                          </h3>
                          <span className="rounded bg-blue-700 px-2 py-0.5 font-mono text-xs font-bold text-white">
                            Pedra {g.pedraSorteada}
                          </span>
                          <span className="text-xs text-slate-500">
                            {g.quantidadeCotas == null ? "(sem total cadastrado)" : `(${g.quantidadeCotas} cotas)`}
                          </span>
                          {g.possuiContempladaPedra && (
                            <span className="rounded bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
                              Cota sorteada na pedra
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
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

                      <div className="grid grid-cols-3 divide-x border-b text-center">
                        <div className="px-2 py-2"><p className="text-[10px] font-semibold uppercase text-slate-500">Lance livre 3m</p><p className="text-sm font-bold text-slate-900">{resumo?.media3m == null ? "—" : `${resumo.media3m.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`}</p></div>
                        <div className="px-2 py-2"><p className="text-[10px] font-semibold uppercase text-slate-500">Contempladas / faltam</p><p className="text-sm font-bold text-slate-900">{resumo?.contempladas ?? "—"} / {resumo?.aContemplar ?? "—"}</p></div>
                        <div className="px-2 py-2"><p className="text-[10px] font-semibold uppercase text-slate-500">Assembleias</p><p className="text-sm font-bold text-slate-900">{resumo?.ultima ?? "—"} / {resumo?.totalAssembleias || "—"}</p></div>
                      </div>
                      <div>
                        <table className="w-full table-fixed break-words text-sm max-sm:block">
                          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 max-sm:hidden">
                            <tr>
                              <th className="w-[10%] px-2 py-3">Cota</th>
                              <th className="px-2 py-2">Cliente</th>
                              <th className="w-[19%] px-2 py-3">Diferença da pedra</th>
                              <th className="w-[14%] px-2 py-3">Status real</th>
                              <th className="w-[22%] px-2 py-3">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y max-sm:block">
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
                                    className={`transition-colors max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)_auto] max-sm:items-center max-sm:gap-x-2 max-sm:px-2 max-sm:py-3 ${
                                      isPedraExata
                                        ? "bg-emerald-50/80 font-medium hover:bg-emerald-100/70"
                                        : marcada
                                        ? "bg-amber-50 hover:bg-amber-100/50"
                                        : "hover:bg-slate-50"
                                    }`}
                                  >
                                    <td className="px-2 py-2">
                                      <span className="font-bold text-slate-900">{c.numero}</span>
                                      {isPedraExata && (
                                        <span className="ml-2 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                          Sorteada!
                                        </span>
                                      )}
                                    </td>
                                                                        <td className="px-2 py-3 font-medium text-slate-800 max-sm:col-span-3 max-sm:order-first max-sm:py-0">
                                      <span className="block">{c.cliente_nome}</span><span className="text-xs font-semibold text-slate-500">{c.valor_credito ? formatBRL(c.valor_credito) : "Crédito não informado"}</span>
                                    </td>
                                    <td className="px-2 py-2">
                                      {isPedraExata ? (
                                        <span className="font-black text-emerald-700">0 · sorteada</span>
                                      ) : c.posicaoFila === "SUPERIOR" ? (
                                        <span className="font-bold text-blue-700">+{c.distancia} <span className="font-normal text-slate-500">acima</span></span>
                                      ) : (
                                        <span className="font-medium text-slate-500">+{c.distancia} após giro</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-2">
                                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                                        {c.status}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2 max-sm:col-span-3 max-sm:pt-2">
                                      {canWrite === true ? (
                                        <div className="flex flex-wrap items-start gap-1.5 md:flex-col">
                                        <form action={toggleAtencaoAssembleiaAction}>
                                          <input type="hidden" name="assembleia_id" value={assembleiaIdDoGrupo} />
                                          <input type="hidden" name="cota_id" value={c.id} />
                                          <button
                                            type="submit"
                                            name="marcada"
                                            value={String(marcada)}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                              marcada
                                                ? "bg-amber-500 text-white hover:bg-amber-600"
                                                : "border border-amber-300 text-amber-800 hover:bg-amber-100"
                                            }`}
                                          >
                                            {marcada ? "Desmarcar atenção" : "Marcar atenção"}
                                          </button>
                                        </form>
                                          {assembleiaIdDoGrupo && c.status !== "contemplada" && <StatusCotaAssembleiaButtons assembleiaId={assembleiaIdDoGrupo} cotaId={c.id} numero={c.numero} valorCreditoCadastrado={c.valor_credito} />}
                                        </div>
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
        </>
      )}
    </div>
  );
}

