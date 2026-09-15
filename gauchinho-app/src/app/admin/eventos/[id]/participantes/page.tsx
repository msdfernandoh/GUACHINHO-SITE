import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageLeads } from "@/lib/auth/permissions";
import { fetchEventoAdmin, updateParticipanteStatusAction } from "../../actions";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { formatDateTime } from "@/lib/utils/format";
import { PARTICIPANTE_STATUS } from "@/lib/comercial-eventos/types";
import {
  fetchParticipantesEventoEnriquecidos,
  type ParticipantesFiltros,
} from "@/lib/comercial-eventos/participantes-enriquecidos";
import {
  OPCOES_VEICULO,
  OPCOES_MORADIA,
  OPCOES_CAPACIDADE_MENSAL,
} from "@/lib/eventos-sorteio/checkin-conversacional-types";

export default async function EventoParticipantesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const u = await getUsuarioNegocio();
  if (!canManageLeads(u?.perfil)) redirect("/admin");
  const { id } = await params;
  const sp = await searchParams;

  let evento;
  try {
    evento = await fetchEventoAdmin(id);
  } catch {
    notFound();
  }

  const filtros: ParticipantesFiltros = {
    status: sp.status,
    checkin: (sp.checkin as any) || undefined,
    veiculo: sp.veiculo,
    moradia: sp.moradia,
    investimento: sp.investimento,
    convidou: sp.convidou,
    acompanhante: sp.acompanhante,
    busca: sp.busca,
  };

  const { participantes, resumo, totalSemFiltro } = await fetchParticipantesEventoEnriquecidos(
    id,
    filtros
  );

  // Parâmetros de query ativos para os links de exportação
  const queryParams = new URLSearchParams();
  if (sp.status) queryParams.set("status", sp.status);
  if (sp.checkin) queryParams.set("checkin", sp.checkin);
  if (sp.veiculo) queryParams.set("veiculo", sp.veiculo);
  if (sp.moradia) queryParams.set("moradia", sp.moradia);
  if (sp.investimento) queryParams.set("investimento", sp.investimento);
  if (sp.convidou) queryParams.set("convidou", sp.convidou);
  if (sp.acompanhante) queryParams.set("acompanhante", sp.acompanhante);
  if (sp.busca) queryParams.set("busca", sp.busca);
  const activeQueryString = queryParams.toString();

  const exportFilteredXlsxUrl = `/api/admin/eventos/${id}/participantes/export-xlsx${
    activeQueryString ? `?${activeQueryString}` : ""
  }`;
  const exportAllXlsxUrl = `/api/admin/eventos/${id}/participantes/export-xlsx?todos=1`;
  const exportCsvUrl = `/api/admin/eventos/${id}/participantes/export${
    activeQueryString ? `?${activeQueryString}` : ""
  }`;

  const temFiltroAtivo = Boolean(
    sp.status ||
      sp.checkin ||
      sp.veiculo ||
      sp.moradia ||
      sp.investimento ||
      sp.convidou ||
      sp.acompanhante ||
      sp.busca
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={`/admin/eventos/${id}`} className="text-sm text-amber-600 hover:underline">
            ← {evento.nome}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Participantes e Qualificação Comercial
          </h1>
          <p className="text-xs text-zinc-500">
            Gerencie presenças, respostas comerciais do check-in e números da sorte.
          </p>
        </div>

        {/* Botões de Exportação */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={exportFilteredXlsxUrl}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
          >
            📊 Exportar (.XLSX) {temFiltroAtivo && `(${participantes.length})`}
          </a>
          {temFiltroAtivo && (
            <a
              href={exportAllXlsxUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Exportar Todos ({totalSemFiltro})
            </a>
          )}
          <a
            href={exportCsvUrl}
            className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            CSV
          </a>
        </div>
      </div>

      {/* CARDS DE RESUMO NO TOPO */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
          <p className="text-[11px] font-medium text-zinc-500 uppercase">Convidados</p>
          <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {resumo.totalConvidados}
          </p>
        </div>
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-3 shadow-xs dark:border-blue-900/40 dark:bg-blue-950/20">
          <p className="text-[11px] font-medium text-blue-700 dark:text-blue-400 uppercase">
            Confirmados
          </p>
          <p className="mt-1 text-xl font-bold text-blue-900 dark:text-blue-200">
            {resumo.confirmados}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3 shadow-xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase">
            Presentes
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-900 dark:text-emerald-200">
            {resumo.presentes}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 uppercase">
            Check-ins QR
          </p>
          <p className="mt-1 text-xl font-bold text-amber-900 dark:text-amber-200">
            {resumo.checkins}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
          <p className="text-[11px] font-medium text-zinc-500 uppercase">Com Veículo</p>
          <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {resumo.comVeiculo}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60">
          <p className="text-[11px] font-medium text-zinc-500 uppercase">Mora de Aluguel</p>
          <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {resumo.aluguel}
          </p>
        </div>
        <div className="rounded-xl border border-purple-200/80 bg-purple-50/40 p-3 shadow-xs dark:border-purple-900/40 dark:bg-purple-950/20">
          <p className="text-[11px] font-medium text-purple-700 dark:text-purple-400 uppercase">
            Invest. &gt; R$ 1k
          </p>
          <p className="mt-1 text-xl font-bold text-purple-900 dark:text-purple-200">
            {resumo.investimentoAcima1k}
          </p>
        </div>
      </section>

      {/* FORMULÁRIO DE FILTROS AVANÇADOS */}
      <form
        method="get"
        className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Busca Rápida</Label>
            <Input
              name="busca"
              defaultValue={sp.busca ?? ""}
              placeholder="Nome, telefone, empresa ou nº..."
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select name="status" defaultValue={sp.status ?? ""}>
              <option value="">Todos os status</option>
              {PARTICIPANTE_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Fez Check-in</Label>
            <Select name="checkin" defaultValue={sp.checkin ?? ""}>
              <option value="">Todos</option>
              <option value="sim">Sim (Presença confirmada)</option>
              <option value="nao">Não (Aguardando check-in)</option>
            </Select>
          </div>
          <div>
            <Label>Quem Convidou</Label>
            <Input
              name="convidou"
              defaultValue={sp.convidou ?? ""}
              placeholder="Filtrar por consultor/amigo..."
            />
          </div>
          <div>
            <Label>Veículo</Label>
            <Select name="veiculo" defaultValue={sp.veiculo ?? ""}>
              <option value="">Todos os veículos</option>
              {OPCOES_VEICULO.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Moradia</Label>
            <Select name="moradia" defaultValue={sp.moradia ?? ""}>
              <option value="">Todas as moradias</option>
              {OPCOES_MORADIA.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Faixa de Investimento</Label>
            <Select name="investimento" defaultValue={sp.investimento ?? ""}>
              <option value="">Todas as faixas</option>
              {OPCOES_CAPACIDADE_MENSAL.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Acompanhante</Label>
            <Select name="acompanhante" defaultValue={sp.acompanhante ?? ""}>
              <option value="">Todos</option>
              <option value="sim">Com acompanhante</option>
              <option value="nao">Sem acompanhante</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">
            Exibindo <strong>{participantes.length}</strong> de {totalSemFiltro} participantes
          </p>
          <div className="flex items-center gap-2">
            {temFiltroAtivo && (
              <Link
                href={`/admin/eventos/${id}/participantes`}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Limpar filtros
              </Link>
            )}
            <Button type="submit" size="sm">
              Filtrar
            </Button>
          </div>
        </div>
      </form>

      {/* LISTAGEM DE PARTICIPANTES (TABELA DESKTOP + CARDS MOBILE) */}
      {participantes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">Nenhum participante encontrado com os filtros selecionados.</p>
        </div>
      ) : (
        <>
          {/* VISUALIZAÇÃO MOBILE (CARDS RESPONSIVOS) */}
          <div className="space-y-3 sm:hidden">
            {participantes.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {p.nome_participante}
                    </h3>
                    <p className="font-mono text-xs text-zinc-500">{p.telefone_participante}</p>
                    {p.empresa_convidou && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Empresa: {p.empresa_convidou}
                      </p>
                    )}
                  </div>
                  {p.codigo_sorteio ? (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-300">
                      {p.codigo_sorteio}
                    </span>
                  ) : (
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">
                      Sem Nº
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800">
                  <div>
                    <span className="text-zinc-400">Status: </span>
                    <span
                      className={`font-semibold ${
                        p.status === "presente"
                          ? "text-emerald-600"
                          : p.status === "confirmado"
                          ? "text-blue-600"
                          : "text-zinc-600"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Check-in: </span>
                    <span>{p.checkin_at ? formatDateTime(p.checkin_at, null) : "—"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Veículo: </span>
                    <span>{p.veiculo_label}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Moradia: </span>
                    <span>{p.moradia_label}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-zinc-400">Investimento: </span>
                    <span className="font-medium text-amber-700 dark:text-amber-400">
                      {p.investimento_label}
                    </span>
                  </div>
                  {p.nome_convidou && (
                    <div className="col-span-2 text-zinc-500">
                      Convidado por: {p.nome_convidou}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                  <div className="flex gap-1">
                    {(["presente", "cancelado"] as const).map((st) => {
                      if (p.id.startsWith("sorteio_")) return null;
                      const act = updateParticipanteStatusAction.bind(null, p.id, id, st);
                      return (
                        <form key={st} action={act}>
                          <Button type="submit" size="sm" variant="outline" className="text-xs py-0.5 px-2">
                            {st}
                          </Button>
                        </form>
                      );
                    })}
                  </div>
                  {p.telefone_participante ? (
                    <a
                      href={`https://wa.me/${p.telefone_participante.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-emerald-600 hover:underline"
                    >
                      WhatsApp ↗
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* VISUALIZAÇÃO DESKTOP (TABELA RICA COM QUALIFICAÇÃO) */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-3">Participante</th>
                  <th className="px-3 py-3">Nº Sorte</th>
                  <th className="px-3 py-3">Presença</th>
                  <th className="px-3 py-3">Veículo</th>
                  <th className="px-3 py-3">Moradia</th>
                  <th className="px-3 py-3">Investimento</th>
                  <th className="px-3 py-3">Convidou</th>
                  <th className="px-3 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {participantes.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition">
                    <td className="px-3 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {p.nome_participante}
                      </div>
                      <div className="font-mono text-xs text-zinc-500">{p.telefone_participante}</div>
                      {p.empresa_convidou && (
                        <div className="text-xs text-zinc-400">{p.empresa_convidou}</div>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {p.codigo_sorteio ? (
                        <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-300">
                          {p.codigo_sorteio}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          p.status === "presente"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : p.status === "confirmado"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                            : p.status === "lista_espera"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {p.status}
                      </span>
                      {p.checkin_at && (
                        <div className="mt-0.5 text-[11px] text-zinc-400">
                          {formatDateTime(p.checkin_at, null)}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3 text-xs text-zinc-700 dark:text-zinc-300">
                      {p.veiculo_label}
                    </td>

                    <td className="px-3 py-3 text-xs text-zinc-700 dark:text-zinc-300">
                      {p.moradia_label}
                    </td>

                    <td className="px-3 py-3 text-xs font-medium text-amber-700 dark:text-amber-400">
                      {p.investimento_label}
                    </td>

                    <td className="px-3 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {p.nome_convidou || "—"}
                      {p.tem_acompanhante && (
                        <div className="text-[11px] text-zinc-400">
                          +1 ({p.nome_acompanhante || "acomp."})
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {!p.id.startsWith("sorteio_") && (
                          <>
                            {p.status !== "presente" && (
                              <form action={updateParticipanteStatusAction.bind(null, p.id, id, "presente")}>
                                <Button type="submit" size="sm" variant="outline" className="text-xs">
                                  Confirmar
                                </Button>
                              </form>
                            )}
                            {p.status !== "cancelado" && (
                              <form action={updateParticipanteStatusAction.bind(null, p.id, id, "cancelado")}>
                                <Button type="submit" size="sm" variant="outline" className="text-xs text-red-600">
                                  Cancelar
                                </Button>
                              </form>
                            )}
                          </>
                        )}
                        {p.telefone_participante && (
                          <a
                            href={`https://wa.me/${p.telefone_participante.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-lg border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
