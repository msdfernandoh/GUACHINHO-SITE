"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  convidarUsuarioPlatformAction,
  alterarUsuarioPlatformAction,
  definirResponsavelPlatformAction,
  reenviarConvitePlatformAction,
  type PlatformFormState,
} from "../usuarios-actions";

export type PlatformUsuarioItem = {
  id: string; // empresa_usuario_id
  usuario_id: string;
  nome: string;
  email: string;
  empresa_id: string;
  empresa_nome: string;
  empresa_slug: string;
  papel_id: string;
  papel_nome: string;
  papel_codigo: string;
  status: string; // 'CONVIDADO', 'ATIVO', 'INATIVO', 'SUSPENSO'
  ativo: boolean;
  is_responsavel_principal: boolean;
  erp_modulos_visiveis: string[];
  convite_enviado_em: string | null;
  ultimo_acesso: string | null;
  created_at: string;
};

export type MasterFranquiaOption = {
  id: string;
  nome_fantasia: string;
  slug: string;
  usuarios_ativos: number;
  limite_usuarios: number;
  modulos_permitidos: string[];
  erp_habilitado: boolean;
};

export type PapelOption = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  empresa_id: string | null;
};

export type ModuloOption = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
};

const initial: PlatformFormState = { status: "IDLE", message: "" };

export function PlatformUsuariosClient({
  usuarios,
  franquias,
  papeis,
  modulosCatalogo,
  empresaInicialId,
  abrirConviteInicial = false,
  retornoEmpresaHref,
}: {
  usuarios: PlatformUsuarioItem[];
  franquias: MasterFranquiaOption[];
  papeis: PapelOption[];
  modulosCatalogo: ModuloOption[];
  empresaInicialId?: string;
  abrirConviteInicial?: boolean;
  retornoEmpresaHref?: string;
}) {
  const [busca, setBusca] = useState("");
  const [filtroFranquia, setFiltroFranquia] = useState("TODOS");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [filtroPapel, setFiltroPapel] = useState("TODOS");
  const [filtroConvite, setFiltroConvite] = useState("TODOS");

  // Modais
  const [modalConvidar, setModalConvidar] = useState(abrirConviteInicial);
  const [modalEditar, setModalEditar] = useState<PlatformUsuarioItem | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [aceitarResultadoCadastro, setAceitarResultadoCadastro] = useState(false);

  // Form State Convidar
  const [conviteEmpresaId, setConviteEmpresaId] = useState(
    empresaInicialId && franquias.some((franquia) => franquia.id === empresaInicialId)
      ? empresaInicialId
      : franquias[0]?.id || "",
  );
  const [conviteNome, setConviteNome] = useState("");
  const [conviteEmail, setConviteEmail] = useState("");
  const papelAdminEmpresa = papeis.find((p) => p.codigo === "admin_empresa" && p.empresa_id === null);
  const [convitePapelId, setConvitePapelId] = useState(papelAdminEmpresa?.id || papeis[0]?.id || "");
  const [conviteIsResponsavel, setConviteIsResponsavel] = useState(
    (franquias.find((franquia) => franquia.id === empresaInicialId)?.usuarios_ativos ?? 1) === 0,
  );
  const [conviteModulos, setConviteModulos] = useState<string[]>(
    franquias.find((franquia) => franquia.id === empresaInicialId)?.modulos_permitidos || [],
  );

  // Actions
  const [stateConvidar, actionConvidar, isPendingConvidar] = useActionState(convidarUsuarioPlatformAction, initial);
  const [stateAlterar, actionAlterar, isPendingAlterar] = useActionState(alterarUsuarioPlatformAction, initial);
  const [stateResponsavel, actionResponsavel, isPendingResponsavel] = useActionState(definirResponsavelPlatformAction, initial);
  const [stateReenviar, actionReenviar, isPendingReenviar] = useActionState(reenviarConvitePlatformAction, initial);

  const franquiaSelecionada = franquias.find((f) => f.id === conviteEmpresaId);
  const papeisDisponiveis = papeis.filter((p) => p.empresa_id === null || p.empresa_id === conviteEmpresaId);
  const modulosDisponiveisParaFranquia = modulosCatalogo.filter((m) =>
    franquiaSelecionada?.modulos_permitidos?.includes(m.codigo),
  );

  useEffect(() => {
    if (stateAlterar.status === "SUCCESS") {
      setModalEditar(null);
    }
  }, [stateAlterar.status]);

  async function copiarCredenciais(email: string, senhaTemporaria?: string) {
    if (!senhaTemporaria) return;
    await navigator.clipboard.writeText(`E-mail: ${email}\nSenha inicial: ${senhaTemporaria}`);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2500);
  }

  const filtrados = usuarios.filter((u) => {
    const matchBusca =
      !busca ||
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase()) ||
      u.empresa_nome.toLowerCase().includes(busca.toLowerCase());

    const matchFranquia = filtroFranquia === "TODOS" || u.empresa_id === filtroFranquia;
    const matchStatus = filtroStatus === "TODOS" || u.status === filtroStatus;
    const matchPapel = filtroPapel === "TODOS" || u.papel_id === filtroPapel;
    const matchConvite =
      filtroConvite === "TODOS" ||
      (filtroConvite === "PENDENTE" && u.status === "CONVIDADO") ||
      (filtroConvite === "ACEITO" && u.status !== "CONVIDADO");

    return matchBusca && matchFranquia && matchStatus && matchPapel && matchConvite;
  });

  const totalAtivos = usuarios.filter((u) => u.status === "ATIVO").length;
  const totalConvidados = usuarios.filter((u) => u.status === "CONVIDADO").length;
  const totalResponsaveis = usuarios.filter((u) => u.is_responsavel_principal).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Plataforma SaaS</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">Usuários & Responsáveis</h1>
          <p className="mt-1 text-sm text-slate-500">
            Governança global de identidades, credenciais, papéis e quotas de equipe das Master Franquias.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        {retornoEmpresaHref && (
          <Link
            href={retornoEmpresaHref}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            ← Voltar à Master Franquia
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            setConviteNome("");
            setConviteEmail("");
            setConviteModulos(modulosDisponiveisParaFranquia.map((m) => m.codigo));
            setConviteIsResponsavel((franquiaSelecionada?.usuarios_ativos ?? 0) === 0);
            setAceitarResultadoCadastro(false);
            setModalConvidar(true);
          }}
          className="rounded-lg bg-cyan-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-cyan-800 transition-colors"
        >
          + Cadastrar Usuário
        </button>
        </div>
      </div>

      {/* Feedbacks */}
      {[stateConvidar, stateAlterar, stateResponsavel, stateReenviar].map((st, i) =>
        st.message ? (
          <p
            key={i}
            role="status"
            className={`rounded-lg p-3 text-xs font-bold ${
              st.status === "SUCCESS"
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
            }`}
          >
            {st.message}
          </p>
        ) : null,
      )}

      {stateReenviar.status === "SUCCESS" && stateReenviar.data?.senhaTemporaria ? (
        <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">
          <p className="font-extrabold">Nova senha inicial — copie agora</p>
          <p className="mt-1 text-xs">Ela é mostrada somente nesta resposta e deverá ser trocada no primeiro acesso.</p>
          <div className="mt-3 grid gap-2 rounded-xl bg-white p-3 font-mono sm:grid-cols-2">
            <span>{stateReenviar.data.email}</span>
            <strong>{stateReenviar.data.senhaTemporaria}</strong>
          </div>
          <button
            type="button"
            onClick={() => copiarCredenciais(stateReenviar.data!.email, stateReenviar.data!.senhaTemporaria)}
            className="mt-3 rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800"
          >
            {copiado ? "Credenciais copiadas" : "Copiar e-mail e senha"}
          </button>
        </section>
      ) : null}

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-slate-500">Total de Usuários</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{usuarios.length}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-emerald-600">Usuários Ativos</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{totalAtivos}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-amber-600">Convites Pendentes</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{totalConvidados}</p>
        </article>
        <article className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase text-cyan-600">Responsáveis Principais</p>
          <p className="mt-2 text-2xl font-bold text-cyan-700">{totalResponsaveis}</p>
        </article>
      </section>

      {/* Filtros */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Buscar Usuário:</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, e-mail ou franquia..."
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Master Franquia:</label>
            <select
              value={filtroFranquia}
              onChange={(e) => setFiltroFranquia(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todas as Franquias</option>
              {franquias.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome_fantasia}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Status:</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="ATIVO">Ativo</option>
              <option value="CONVIDADO">Convidado (Pendente)</option>
              <option value="INATIVO">Inativo</option>
              <option value="SUSPENSO">Suspenso</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Papel / Perfil:</label>
            <select
              value={filtroPapel}
              onChange={(e) => setFiltroPapel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todos os Papéis</option>
              {papeis.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300">Convite:</label>
            <select
              value={filtroConvite}
              onChange={(e) => setFiltroConvite(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TODOS">Todos</option>
              <option value="PENDENTE">Pendente</option>
              <option value="ACEITO">Aceito</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="p-3">Usuário</th>
                <th className="p-3">Master Franquia</th>
                <th className="p-3">Papel</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Responsável</th>
                <th className="p-3">Módulos Efetivos</th>
                <th className="p-3">Último Acesso</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                    Nenhum usuário encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filtrados.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-white">{u.nome}</div>
                      <div className="font-mono text-[11px] text-slate-500">{u.email}</div>
                    </td>

                    <td className="p-3">
                      <Link
                        href={`/platform/empresas/${u.empresa_id}`}
                        className="font-bold text-cyan-700 dark:text-cyan-400 hover:underline"
                      >
                        {u.empresa_nome}
                      </Link>
                      <div className="font-mono text-[10px] text-slate-400">/{u.empresa_slug}</div>
                    </td>

                    <td className="p-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{u.papel_nome}</span>
                    </td>

                    <td className="p-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                          u.status === "ATIVO"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : u.status === "CONVIDADO"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : u.status === "SUSPENSO"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      {u.is_responsavel_principal ? (
                        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-black text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                          ⭐ Principal
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="p-3">
                      {u.erp_modulos_visiveis?.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {u.erp_modulos_visiveis.map((m) => (
                            <span
                              key={m}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">Todos do Plano</span>
                      )}
                    </td>

                    <td className="p-3 text-slate-400 font-mono text-[11px]">
                      {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleDateString("pt-BR") : "Nunca acessou"}
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setModalEditar(u)}
                          className="rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors"
                        >
                          Editar
                        </button>

                        {u.status === "CONVIDADO" && (
                          <form action={actionReenviar}>
                            <input type="hidden" name="empresa_usuario_id" value={u.id} />
                            <button
                              type="submit"
                              disabled={isPendingReenviar}
                              className="rounded bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 border border-amber-200"
                            >
                              Gerar acesso
                            </button>
                          </form>
                        )}

                        {!u.is_responsavel_principal && (
                          <form action={actionResponsavel}>
                            <input type="hidden" name="empresa_id" value={u.empresa_id} />
                            <input type="hidden" name="empresa_usuario_id" value={u.id} />
                            <button
                              type="submit"
                              disabled={isPendingResponsavel}
                              title="Tornar responsável principal desta Master Franquia"
                              className="rounded bg-cyan-50 px-2 py-1 text-[11px] font-bold text-cyan-800 hover:bg-cyan-100 border border-cyan-200"
                            >
                              ⭐
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────
          MODAL: CADASTRAR USUÁRIO
      ─────────────────────────────────────────────────────────── */}
      {modalConvidar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">+ Cadastrar Novo Usuário</h3>
            <p className="text-slate-500">
              O acesso será ativado sem envio de e-mail. O sistema gerará uma senha inicial que deverá ser trocada no primeiro acesso.
            </p>

            {aceitarResultadoCadastro && !isPendingConvidar && stateConvidar.status === "SUCCESS" && stateConvidar.data ? (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950">
                {stateConvidar.data.senhaTemporaria ? (
                  <>
                    <p className="font-extrabold">Acesso criado — copie a senha agora</p>
                    <p className="mt-1 text-[11px]">Esta senha não será exibida novamente.</p>
                    <div className="mt-3 space-y-2 rounded-lg bg-white p-3 font-mono text-sm">
                      <p><span className="font-sans text-xs text-slate-500">E-mail:</span> {stateConvidar.data.email}</p>
                      <p><span className="font-sans text-xs text-slate-500">Senha inicial:</span> <strong>{stateConvidar.data.senhaTemporaria}</strong></p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copiarCredenciais(stateConvidar.data!.email, stateConvidar.data!.senhaTemporaria)}
                      className="mt-3 rounded-lg bg-amber-700 px-4 py-2 font-bold text-white hover:bg-amber-800"
                    >
                      {copiado ? "Credenciais copiadas" : "Copiar e-mail e senha"}
                    </button>
                  </>
                ) : (
                  <p className="font-bold">Usuário já existente ativado nesta franquia. Ele deve entrar com a senha atual.</p>
                )}
              </div>
            ) : null}

            {!(aceitarResultadoCadastro && !isPendingConvidar && stateConvidar.status === "SUCCESS") ? (
            <form
              action={actionConvidar}
              onSubmit={() => setAceitarResultadoCadastro(true)}
              className="space-y-4"
            >
              <input type="hidden" name="modulos_json" value={JSON.stringify(conviteModulos)} />

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Master Franquia de Destino:</label>
                <select
                  name="empresa_id"
                  value={conviteEmpresaId}
                  onChange={(e) => {
                    setConviteEmpresaId(e.target.value);
                    const sel = franquias.find((f) => f.id === e.target.value);
                    setConviteModulos(sel?.modulos_permitidos || []);
                    setConviteIsResponsavel((sel?.usuarios_ativos ?? 0) === 0);
                    const papelAtual = papeis.find((p) => p.id === convitePapelId);
                    if (papelAtual?.empresa_id && papelAtual.empresa_id !== e.target.value) {
                      setConvitePapelId(papelAdminEmpresa?.id || "");
                    }
                  }}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  {franquias.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome_fantasia} ({f.usuarios_ativos} de {f.limite_usuarios} usuários ocupados)
                    </option>
                  ))}
                </select>
                {franquiaSelecionada && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Vagas disponíveis:{" "}
                    <strong>{Math.max(0, franquiaSelecionada.limite_usuarios - franquiaSelecionada.usuarios_ativos)}</strong>
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Nome Completo:</label>
                  <input
                    name="nome"
                    value={conviteNome}
                    onChange={(e) => setConviteNome(e.target.value)}
                    required
                    placeholder="Ex: João da Silva"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">E-mail Profissional:</label>
                  <input
                    name="email"
                    type="email"
                    value={conviteEmail}
                    onChange={(e) => setConviteEmail(e.target.value)}
                    required
                    placeholder="joao@franquia.com.br"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Papel / Perfil:</label>
                  <select
                    name="papel_id"
                    value={convitePapelId}
                    onChange={(e) => setConvitePapelId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {papeisDisponiveis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input
                      name="is_responsavel"
                      type="checkbox"
                      value="true"
                      checked={conviteIsResponsavel}
                      onChange={(e) => setConviteIsResponsavel(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                    />
                    ⭐ Responsável Principal
                  </label>
                </div>
              </div>

              {/* Seleção de Módulos ERP Permitidos pelo Plano */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Módulos ERP Efetivos ({conviteModulos.length} selecionados):
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border p-2.5 rounded-lg bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40">
                  {modulosDisponiveisParaFranquia.length === 0 ? (
                    <p className="text-slate-400 col-span-2">O plano desta franquia não inclui ERP.</p>
                  ) : (
                    modulosDisponiveisParaFranquia.map((m) => {
                      const sel = conviteModulos.includes(m.codigo);
                      return (
                        <label key={m.id} className="flex items-center gap-2 text-[11px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setConviteModulos([...conviteModulos, m.codigo]);
                              } else {
                                setConviteModulos(conviteModulos.filter((x) => x !== m.codigo));
                              }
                            }}
                            className="h-3.5 w-3.5 rounded text-cyan-600"
                          />
                          <span className={sel ? "font-bold text-slate-900 dark:text-white" : "text-slate-500"}>
                            {m.nome}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalConvidar(false)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingConvidar}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingConvidar ? "Criando acesso..." : "Cadastrar e gerar senha"}
                </button>
              </div>
            </form>
            ) : (
              <div className="flex justify-end border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalConvidar(false)}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  Concluir
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          MODAL: EDITAR USUÁRIO
      ─────────────────────────────────────────────────────────── */}
      {modalEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-900 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Editar Usuário: {modalEditar.nome}</h3>
            <p className="text-slate-500 font-mono text-[11px]">{modalEditar.email}</p>

            <form
              action={actionAlterar}
              className="space-y-4"
            >
              <input type="hidden" name="empresa_usuario_id" value={modalEditar.id} />
              <input type="hidden" name="modulos_json" value={JSON.stringify(modalEditar.erp_modulos_visiveis || [])} />

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Papel:</label>
                <select
                  name="papel_id"
                  defaultValue={modalEditar.papel_id}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  {papeis
                    .filter((p) => p.empresa_id === null || p.empresa_id === modalEditar.empresa_id)
                    .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Status:</label>
                <select
                  name="status"
                  defaultValue={modalEditar.status}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="ATIVO">ATIVO</option>
                  <option value="CONVIDADO">CONVIDADO</option>
                  <option value="INATIVO">INATIVO</option>
                  <option value="SUSPENSO">SUSPENSO</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    name="ativo"
                    type="checkbox"
                    value="true"
                    defaultChecked={modalEditar.ativo}
                    className="h-4 w-4 rounded text-cyan-600"
                  />
                  Vínculo Ativo na Franquia
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalEditar(null)}
                  className="rounded-lg border px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPendingAlterar}
                  className="rounded-lg bg-cyan-700 px-4 py-2 font-bold text-white hover:bg-cyan-800"
                >
                  {isPendingAlterar ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
