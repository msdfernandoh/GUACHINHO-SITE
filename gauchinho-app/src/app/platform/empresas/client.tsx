"use client";

import { useState } from "react";
import Link from "next/link";

export type MasterFranquiaItem = {
  id: string;
  nome_fantasia: string;
  razao_social: string;
  slug: string;
  status: string; // 'ativo', 'em_treinamento', 'suspenso', 'cancelado'
  ativo: boolean;
  erp_habilitado: boolean;
  plano_nome: string;
  assinatura_status: string;
  valor_mensal_estimado: number;
  modelo_site_nome: string;
  dominio_principal: string | null;
  administradoras_nomes: string[];
  total_usuarios: number;
  limite_usuarios: number;
  total_parceiros: number;
  total_sites_parceiros: number;
  updated_at: string;
};

export function MasterFranquiasListingClient({
  empresas,
}: {
  empresas: MasterFranquiaItem[];
}) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroErp, setFiltroErp] = useState("TODOS");
  const [filtroPlano, setFiltroPlano] = useState("TODOS");
  const [filtroModelo, setFiltroModelo] = useState("TODOS");

  const normalizarStatus = (status: string) => status.toLowerCase();
  const statusAtivo = (status: string) => ["ativo", "ativa"].includes(normalizarStatus(status));
  const statusSuspenso = (status: string) => ["suspenso", "suspensa"].includes(normalizarStatus(status));

  const planosUnicos = Array.from(new Set(empresas.map((e) => e.plano_nome).filter(Boolean)));
  const modelosUnicos = Array.from(new Set(empresas.map((e) => e.modelo_site_nome).filter(Boolean)));

  const filtradas = empresas.filter((emp) => {
    const matchBusca =
      !busca ||
      emp.nome_fantasia.toLowerCase().includes(busca.toLowerCase()) ||
      emp.razao_social.toLowerCase().includes(busca.toLowerCase()) ||
      emp.slug.toLowerCase().includes(busca.toLowerCase());

    const matchStatus =
      filtroStatus === "TODOS" ||
      (filtroStatus === "ATIVA" && statusAtivo(emp.status)) ||
      (filtroStatus === "TREINAMENTO" && ["em_treinamento", "treinamento"].includes(normalizarStatus(emp.status))) ||
      (filtroStatus === "SUSPENSA" && statusSuspenso(emp.status)) ||
      (filtroStatus === "INATIVA" && ["cancelado", "cancelada", "inativo", "inativa"].includes(normalizarStatus(emp.status)));

    const matchErp =
      filtroErp === "TODOS" ||
      (filtroErp === "HABILITADO" && emp.erp_habilitado) ||
      (filtroErp === "DESABILITADO" && !emp.erp_habilitado);

    const matchPlano = filtroPlano === "TODOS" || emp.plano_nome === filtroPlano;
    const matchModelo = filtroModelo === "TODOS" || emp.modelo_site_nome === filtroModelo;

    return matchBusca && matchStatus && matchErp && matchPlano && matchModelo;
  });

  const totalAtivas = empresas.filter((e) => statusAtivo(e.status)).length;
  const totalTreinamento = empresas.filter((e) => ["em_treinamento", "treinamento"].includes(normalizarStatus(e.status))).length;
  const totalSuspensas = empresas.filter((e) => statusSuspenso(e.status)).length;
  const totalMrr = empresas
    .filter((e) => statusAtivo(e.status))
    .reduce((acc, e) => acc + (e.valor_mensal_estimado || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Platform</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">Master Franquias</h1>
          <p className="mt-1 text-sm text-slate-500">
            Hub de governança de clientes SaaS, contratos, templates de site, administradoras e quotas operacionais.
          </p>
        </div>
        <Link
          href="/platform/empresas/nova"
          className="rounded-lg bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-cyan-800"
        >
          + Nova Master Franquia
        </Link>
      </div>

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-slate-500">Total de Franquias</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{empresas.length}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-emerald-600">Franquias Ativas</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{totalAtivas}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-amber-600">Em Treinamento</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{totalTreinamento}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-cyan-600">MRR Contratual Total</p>
          <p className="mt-2 text-2xl font-bold text-cyan-700">R$ {totalMrr.toFixed(2)}</p>
        </article>
      </section>

      {/* Barra de Filtros */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Buscar Franquia:</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, razão ou slug..."
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Status:</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="ATIVA">Ativa</option>
              <option value="TREINAMENTO">Em Treinamento</option>
              <option value="SUSPENSA">Suspensa</option>
              <option value="INATIVA">Inativa</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Plano SaaS:</label>
            <select
              value={filtroPlano}
              onChange={(e) => setFiltroPlano(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todos os Planos</option>
              {planosUnicos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">ERP Sistema:</label>
            <select
              value={filtroErp}
              onChange={(e) => setFiltroErp(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todos</option>
              <option value="HABILITADO">ERP Habilitado</option>
              <option value="DESABILITADO">ERP Não Contratado</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Modelo de Site:</label>
            <select
              value={filtroModelo}
              onChange={(e) => setFiltroModelo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todos os Modelos</option>
              {modelosUnicos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Master Franquias */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="p-3">Master Franquia</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3">Plano SaaS</th>
                <th className="p-3">Administradoras</th>
                <th className="p-3">Site & Domínio</th>
                <th className="p-3 text-center">ERP</th>
                <th className="p-3 text-center">Usuários</th>
                <th className="p-3 text-center">Parceiros</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    Nenhuma Master Franquia encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filtradas.map((emp) => {
                  const statusNorm = (emp.status || "").toLowerCase();
                  const ativo = statusAtivo(emp.status);
                  const suspenso = statusSuspenso(emp.status);
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white">{emp.nome_fantasia}</div>
                        <div className="text-[11px] text-slate-500">{emp.razao_social}</div>
                        <div className="font-mono text-[10px] text-slate-400">/{emp.slug}</div>
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                            ativo
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : statusNorm === "em_treinamento"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : suspenso
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {ativo ? "ATIVA" : suspenso ? "SUSPENSA" : statusNorm === "em_treinamento" ? "TREINAMENTO" : emp.status}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{emp.plano_nome || "—"}</div>
                        <div className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400">
                          {emp.valor_mensal_estimado > 0
                            ? `R$ ${emp.valor_mensal_estimado.toFixed(2)}/mês`
                            : "Sob Consulta"}
                        </div>
                      </td>

                      <td className="p-3">
                        {emp.administradoras_nomes?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {emp.administradoras_nomes.map((adm) => (
                              <span
                                key={adm}
                                className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                              >
                                {adm}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">Nenhuma</span>
                        )}
                      </td>

                      <td className="p-3">
                        <div className="font-medium text-slate-700 dark:text-slate-300">
                          {emp.modelo_site_nome || "Gauchinho Default"}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {emp.dominio_principal || "Sem domínio"}
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            emp.erp_habilitado
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                          }`}
                        >
                          {emp.erp_habilitado ? "Ativo" : "Inativo"}
                        </span>
                      </td>

                      <td className="p-3 text-center font-bold">
                        <span className="text-slate-900 dark:text-white">{emp.total_usuarios}</span>
                        <span className="text-slate-400"> / {emp.limite_usuarios}</span>
                      </td>

                      <td className="p-3 text-center font-medium">
                        <div className="text-slate-900 dark:text-white font-bold">{emp.total_parceiros} parceiros</div>
                        <div className="text-[10px] text-slate-500">{emp.total_sites_parceiros} sites</div>
                      </td>

                      <td className="p-3 text-center">
                        <Link
                          href={`/platform/empresas/${emp.id}`}
                          className="inline-block rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-cyan-800 transition-colors"
                        >
                          Gerenciar HUB →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
