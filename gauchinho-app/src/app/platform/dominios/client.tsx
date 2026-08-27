"use client";

import { useActionState, useEffect, useState } from "react";
import {
  criarDominioTenantPlatformAction,
  definirDominioPrincipalPlatformAction,
  editarDominioTenantPlatformAction,
  toggleStatusDominioPlatformAction,
  verificarDominioTenantPlatformAction,
  type PlatformFormState,
} from "@/app/platform/dominios-actions";

type DominioItem = {
  id: string;
  empresa_id: string;
  valor: string;
  tipo: string;
  principal: boolean;
  ativo: boolean;
  verificado: boolean;
  status_dns: string;
  status_vercel: string;
  status_ssl: string;
  dns_instrucoes: {
    registros_esperados?: Array<{ tipo: string; host: string; valor: string }>;
    registros_encontrados?: Array<{ tipo: string; host: string; valor: string }>;
    nota?: string;
  } | null;
  ultima_verificacao_em: string | null;
  ultima_mensagem_erro: string | null;
  created_at: string;
  updated_at: string;
  empresa?: { id: string; nome_fantasia: string; slug: string } | null;
};

type EmpresaOption = {
  id: string;
  nome_fantasia: string;
  slug: string;
  status: string;
};

const initial: PlatformFormState = { status: "IDLE", message: "" };

export function DominiosListingClient({
  dominios,
  empresas,
  dominioInicialId,
  automacaoVercelDisponivel,
}: {
  dominios: DominioItem[];
  empresas: EmpresaOption[];
  dominioInicialId: string | null;
  automacaoVercelDisponivel: boolean;
}) {
  const [modalNovo, setModalNovo] = useState(false);
  const [modalEditar, setModalEditar] = useState<DominioItem | null>(
    dominios.find((d) => d.id === dominioInicialId) ?? null,
  );
  const [stateNovo, actionNovo, isPendingNovo] = useActionState(criarDominioTenantPlatformAction, initial);
  const [statePrincipal, actionPrincipal, isPendingPrincipal] = useActionState(
    definirDominioPrincipalPlatformAction,
    initial,
  );
  const [stateToggle, actionToggle, isPendingToggle] = useActionState(toggleStatusDominioPlatformAction, initial);
  const [stateEditar, actionEditar, isPendingEditar] = useActionState(editarDominioTenantPlatformAction, initial);
  const [stateVerificar, actionVerificar, isPendingVerificar] = useActionState(verificarDominioTenantPlatformAction, initial);

  useEffect(() => {
    if (stateNovo.status === "SUCCESS") setModalNovo(false);
  }, [stateNovo.status]);
  useEffect(() => {
    if (stateEditar.status === "SUCCESS") setModalEditar(null);
  }, [stateEditar.status]);
  useEffect(() => {
    if (modalEditar) {
      setModalEditar(dominios.find((dominio) => dominio.id === modalEditar.id) ?? null);
    }
  }, [dominios]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalDominios = dominios.length;
  const totalAtivos = dominios.filter((d) => d.ativo).length;
  const totalPrincipais = dominios.filter((d) => d.principal).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Platform</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">Domínios do Sistema</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerenciamento oficial de domínios customizados e subdomínios vinculados às Master Franquias.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalNovo(true)}
          className="rounded-lg bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-cyan-800"
        >
          + Novo Domínio
        </button>
      </div>

      {/* Feedbacks */}
      {stateNovo.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs font-bold ${
            stateNovo.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {stateNovo.message}
        </p>
      )}
      {statePrincipal.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs font-bold ${
            statePrincipal.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {statePrincipal.message}
        </p>
      )}
      {stateToggle.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs font-bold ${
            stateToggle.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {stateToggle.message}
        </p>
      )}
      {[stateEditar, stateVerificar].map((state, index) => state.message ? (
        <p key={index} role="status" className={`rounded-lg p-3 text-xs font-bold ${state.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {state.message}
        </p>
      ) : null)}

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-slate-500">Total de Domínios</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{totalDominios}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-emerald-600">Domínios Ativos</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{totalAtivos}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-cyan-600">Principais (Canônicos)</p>
          <p className="mt-2 text-2xl font-bold text-cyan-700">{totalPrincipais}</p>
        </article>
      </section>

      {/* Card Informativo de Apontamento DNS */}
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-xs text-slate-700 dark:border-cyan-900 dark:bg-cyan-950 dark:text-slate-300 space-y-2">
        <h3 className="font-bold text-cyan-950 dark:text-cyan-200">Fluxo simplificado de domínio</h3>
        <p><strong>1.</strong> Cadastre o domínio. <strong>2.</strong> Copie o único apontamento exibido para o provedor DNS. <strong>3.</strong> O sistema verifica DNS e HTTPS automaticamente; também é possível clicar em “Verificar agora”.</p>
        <p>
          <strong>Status da automação Vercel:</strong>{" "}
          <span className={automacaoVercelDisponivel ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>
            {automacaoVercelDisponivel ? "Conectada" : "Credencial pendente — o DNS pode ser conferido, mas novos domínios precisam ser adicionados manualmente ao projeto"}
          </span>
        </p>
        <p>
          • <strong>Segurança:</strong> O domínio <code>admin.gauchinhoconsorcios.com.br</code> é de uso exclusivo da Plataforma Master e nunca pode ser vinculado a uma franquia.
        </p>
      </div>

      {/* Tabela de Domínios */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="p-3">Domínio / Host</th>
                <th className="p-3">Master Franquia</th>
                <th className="p-3">Tipo</th>
                <th className="p-3 text-center">Principal</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">DNS / Verificação</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {dominios.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Nenhum domínio cadastrado.
                  </td>
                </tr>
              ) : (
                dominios.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      <span className="font-mono text-cyan-700 dark:text-cyan-400">{d.valor}</span>
                    </td>
                    <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                      {d.empresa?.nome_fantasia || "Empresa não informada"}
                    </td>
                    <td className="p-3 text-slate-500">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {d.tipo === "DOMINIO_CUSTOMIZADO" ? "Customizado" : "Subdomínio"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {d.principal ? (
                        <span className="inline-flex rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-bold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                          ★ Principal
                        </span>
                      ) : (
                        <form action={actionPrincipal} className="inline">
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="empresa_id" value={d.empresa_id} />
                          <button
                            type="submit"
                            disabled={isPendingPrincipal}
                            className="text-[11px] font-semibold text-slate-400 hover:text-cyan-700 underline"
                          >
                            Tornar Principal
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <form action={actionToggle} className="inline">
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="ativo" value={String(!d.ativo)} />
                        <button
                          type="submit"
                          disabled={isPendingToggle}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            d.ativo
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                          }`}
                        >
                          {d.ativo ? "Ativo" : "Inativo"}
                        </button>
                      </form>
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          d.verificado
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {d.verificado ? "✓ Operacional" : d.status_dns === "ATIVO" ? "DNS OK / SSL pendente" : "⏳ Pendente DNS"}
                      </span>
                      <div className="mt-1 text-[10px] text-slate-400">Vercel: {d.status_vercel} · SSL: {d.status_ssl}</div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => setModalEditar(d)} className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">DNS / Editar</button>
                        <form action={actionVerificar}>
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="empresa_id" value={d.empresa_id} />
                          <button type="submit" disabled={isPendingVerificar} className="rounded bg-cyan-700 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-60">
                            {isPendingVerificar ? "Verificando..." : "Verificar agora"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Novo Domínio */}
      {modalNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Novo Domínio de Franquia</h3>
              <button
                type="button"
                onClick={() => setModalNovo(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form
              action={actionNovo}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Master Franquia / Empresa:</label>
                <select
                  name="empresa_id"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Selecione a empresa...</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome_fantasia} ({e.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Domínio ou Subdomínio:</label>
                <input
                  name="valor"
                  placeholder="Ex: franquiacuritiba.com.br ou curitiba.gauchinhoconsorcios.com.br"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Tipo de Domínio:</label>
                <select
                  name="tipo"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="DOMINIO_CUSTOMIZADO">Domínio Próprio Customizado (.com.br, etc.)</option>
                  <option value="SUBDOMINIO">Subdomínio da Plataforma</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chkPrincipal"
                  name="principal"
                  value="true"
                  className="h-4 w-4 rounded text-cyan-600"
                />
                <label htmlFor="chkPrincipal" className="font-semibold text-slate-700 dark:text-slate-300">
                  Definir como Domínio Principal da Franquia
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalNovo(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingNovo}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingNovo ? "Cadastrando..." : "Cadastrar Domínio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Configuração do domínio</h3>
                <p className="font-mono text-cyan-700">{modalEditar.valor}</p>
              </div>
              <button type="button" onClick={() => setModalEditar(null)} className="text-lg text-slate-400">✕</button>
            </div>

            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3"><span className="text-slate-500">Vercel</span><strong className="mt-1 block">{modalEditar.status_vercel}</strong></div>
              <div className="rounded-lg border p-3"><span className="text-slate-500">DNS</span><strong className="mt-1 block">{modalEditar.status_dns}</strong></div>
              <div className="rounded-lg border p-3"><span className="text-slate-500">HTTPS/SSL</span><strong className="mt-1 block">{modalEditar.status_ssl}</strong></div>
            </section>

            <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
              <h4 className="font-extrabold text-cyan-950">Registros para copiar no provedor DNS</h4>
              <div className="mt-3 space-y-2">
                {(modalEditar.dns_instrucoes?.registros_esperados ?? []).map((registro, index) => (
                  <div key={`${registro.tipo}-${index}`} className="grid grid-cols-[70px_1fr_2fr] gap-2 rounded-lg bg-white p-3 font-mono">
                    <strong>{registro.tipo}</strong><span>{registro.host}</span><span className="break-all font-bold text-cyan-800">{registro.valor}</span>
                  </div>
                ))}
              </div>
              {modalEditar.ultima_mensagem_erro ? <p className="mt-3 rounded bg-amber-100 p-2 text-amber-900">{modalEditar.ultima_mensagem_erro}</p> : null}
              <p className="mt-2 text-slate-600">Última verificação: {modalEditar.ultima_verificacao_em ? new Date(modalEditar.ultima_verificacao_em).toLocaleString("pt-BR") : "ainda não executada"}</p>
            </section>

            <form action={actionVerificar} className="flex justify-start">
              <input type="hidden" name="id" value={modalEditar.id} />
              <input type="hidden" name="empresa_id" value={modalEditar.empresa_id} />
              <button type="submit" disabled={isPendingVerificar} className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-60">
                {isPendingVerificar ? "Verificando DNS..." : "Verificar DNS agora"}
              </button>
            </form>

            <form action={actionEditar} className="space-y-4">
              <input type="hidden" name="id" value={modalEditar.id} />
              <input type="hidden" name="empresa_id" value={modalEditar.empresa_id} />
              <label className="block font-bold">Domínio
                <input name="valor" defaultValue={modalEditar.valor} required className="mt-1 w-full rounded-lg border p-2.5 font-mono" />
              </label>
              <label className="block font-bold">Tipo
                <select name="tipo" defaultValue={modalEditar.tipo} className="mt-1 w-full rounded-lg border p-2.5">
                  <option value="DOMINIO_CUSTOMIZADO">Domínio próprio</option>
                  <option value="SUBDOMINIO">Subdomínio</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="principal" value="true" defaultChecked={modalEditar.principal} /> Principal</label>
                <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="ativo" value="true" defaultChecked={modalEditar.ativo} /> Ativo</label>
                {!automacaoVercelDisponivel ? <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="confirmar_vercel" value="true" defaultChecked={modalEditar.status_vercel === "ADICIONADO"} /> Já adicionado ao projeto Vercel</label> : null}
              </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                <button type="button" onClick={() => setModalEditar(null)} className="rounded-lg border px-4 py-2 font-bold">Cancelar</button><button type="submit" disabled={isPendingEditar} className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white">{isPendingEditar ? "Salvando..." : "Salvar alterações"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
