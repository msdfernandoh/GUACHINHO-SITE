"use client";

import { useState, useTransition } from "react";
import {
  Users,
  UserPlus,
  Edit,
  Trash2,
  Shield,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Search,
  Filter,
  Eye,
  Key,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";
import {
  createParticipanteAction,
  updateParticipanteAction,
  deleteParticipanteAction,
  updateParticipanteStatusAction,
  verificarDependenciasParticipanteAction,
} from "@/app/admin/participantes/actions";
import type { ParticipanteComTipos } from "@/lib/parceiros/types";
import { PARTICIPANTE_STATUS, PARTICIPANTE_TIPOS } from "@/lib/parceiros/constants";

interface ParticipantesManagerViewProps {
  empresaId: string;
  initialRows: ParticipanteComTipos[];
  modulosDisponiveis?: string[];
}

const MODULOS_ERP_CATALOGO = [
  { id: "clientes", label: "Clientes & Contratos", desc: "Gestão da carteira de clientes" },
  { id: "leads", label: "CRM & Leads", desc: "Funil comercial e oportunidades" },
  { id: "propostas", label: "Propostas Comerciais", desc: "Simulações e propostas emitidas" },
  { id: "contratacoes", label: "Contratações Online", desc: "Formalização e checkout digital" },
  { id: "lances", label: "Lances & Estratégias", desc: "Acompanhamento e registro de lances" },
  { id: "assembleias", label: "Assembleias & Resultados", desc: "Calendário e apuração de pedras" },
  { id: "minhas-comissoes", label: "Comissões & Extrato", desc: "Extrato de repasses e liquidações" },
  { id: "grupos", label: "Grupos de Consórcio", desc: "Consulta de tabelas e vagas" },
];

export function ParticipantesManagerView({
  empresaId,
  initialRows,
  modulosDisponiveis = [
    "clientes",
    "leads",
    "propostas",
    "contratacoes",
    "lances",
    "assembleias",
    "minhas-comissoes",
    "grupos",
  ],
}: ParticipantesManagerViewProps) {
  const [rows, setRows] = useState<ParticipanteComTipos[]>(initialRows);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modais / Drawers
  const [editingPart, setEditingPart] = useState<ParticipanteComTipos | null>(null);
  const [permPart, setPermPart] = useState<ParticipanteComTipos | null>(null);
  const [deletePart, setDeletePart] = useState<ParticipanteComTipos | null>(null);
  const [deleteDeps, setDeleteDeps] = useState<{
    pode_excluir: boolean;
    total_vinculos: number;
    motivos: string[];
  } | null>(null);
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Filtragem
  const filteredRows = rows.filter((r) => {
    if (filtroStatus && r.status !== filtroStatus) return false;
    if (filtroTipo && !r.tipos.includes(filtroTipo as any)) return false;
    if (busca) {
      const term = busca.toLowerCase();
      const match =
        r.nome.toLowerCase().includes(term) ||
        r.email?.toLowerCase().includes(term) ||
        r.whatsapp?.toLowerCase().includes(term) ||
        r.cpf?.toLowerCase().includes(term);
      if (!match) return false;
    }
    return true;
  });

  const handleOpenDelete = async (part: ParticipanteComTipos) => {
    setDeletePart(part);
    setIsCheckingDeps(true);
    try {
      const res = await verificarDependenciasParticipanteAction(part.id);
      setDeleteDeps(res);
    } catch {
      setDeleteDeps({ pode_excluir: false, total_vinculos: 1, motivos: ["Erro ao validar vínculos"] });
    } finally {
      setIsCheckingDeps(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & FILTROS */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Participantes Comerciais & Consultores ({filteredRows.length})
          </h2>
          <p className="text-xs text-slate-500">
            Gerencie consultores, vendedores, indicadores e permissões de acesso com escopo operacional.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          + Novo Participante
        </button>
      </div>

      {/* BARRA DE BUSCA E FILTRO */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail, WhatsApp ou CPF..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="">Todos os Status</option>
          {PARTICIPANTE_STATUS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="">Todos os Tipos</option>
          {PARTICIPANTE_TIPOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* TABELA DE PARTICIPANTES */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-850">
              <tr>
                <th className="px-4 py-3">Participante</th>
                <th className="px-4 py-3">Tipos / Função</th>
                <th className="px-4 py-3">Contato</th>
                <th className="px-4 py-3">Acesso ERP</th>
                <th className="px-4 py-3">Escopo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Nenhum participante comercial encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredRows.map((part) => (
                  <tr key={part.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <strong className="font-bold text-slate-900 dark:text-white block">{part.nome}</strong>
                      {part.nome_exibicao && (
                        <span className="text-[11px] text-slate-400 block">Apelido: {part.nome_exibicao}</span>
                      )}
                      {part.cargo && <span className="text-[10px] text-blue-600 font-semibold">{part.cargo}</span>}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {part.tipos.map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      <p className="flex items-center gap-1 font-mono">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {part.whatsapp || part.telefone || "—"}
                      </p>
                      {part.email && (
                        <p className="flex items-center gap-1 text-[11px] text-slate-400 truncate max-w-[180px]">
                          <Mail className="h-3 w-3 text-slate-400" />
                          {part.email}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {part.usuario_id ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Login Ativo
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Sem login</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {part.escopo_visualizacao || "TODOS"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                          part.status === "ATIVO"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : part.status === "INATIVO"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {part.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingPart(part)}
                          title="Editar Participante"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setPermPart(part)}
                          title="Permissões e Escopo ERP"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-400"
                        >
                          <Shield className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDelete(part)}
                          title="Excluir ou Inativar"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
          MODAL: EDITAR PARTICIPANTE
      ─────────────────────────────────────────────────────────── */}
      {editingPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Editar Participante Comercial</h3>
              <button onClick={() => setEditingPart(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              action={async (fd) => {
                await updateParticipanteAction(fd);
                setEditingPart(null);
                window.location.reload();
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="empresa_id" value={empresaId} />
              <input type="hidden" name="id" value={editingPart.id} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Nome Completo *</label>
                  <input
                    name="nome"
                    defaultValue={editingPart.nome}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Nome de Exibição / Apelido</label>
                  <input
                    name="nome_exibicao"
                    defaultValue={editingPart.nome_exibicao || ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">WhatsApp / Celular</label>
                  <input
                    name="whatsapp"
                    defaultValue={editingPart.whatsapp || ""}
                    placeholder="(00) 00000-0000"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Telefone Fixo</label>
                  <input
                    name="telefone"
                    defaultValue={editingPart.telefone || ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">E-mail</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingPart.email || ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">CPF</label>
                  <input
                    name="cpf"
                    defaultValue={editingPart.cpf || ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Cargo / Função</label>
                  <input
                    name="cargo"
                    defaultValue={editingPart.cargo || ""}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Status</label>
                  <select
                    name="status"
                    defaultValue={editingPart.status}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {PARTICIPANTE_STATUS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tipos Múltiplos */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Tipos de Participação Comercial:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PARTICIPANTE_TIPOS.map((tipo) => (
                    <label key={tipo} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        name="tipos"
                        value={tipo}
                        defaultChecked={editingPart.tipos.includes(tipo)}
                        className="h-3.5 w-3.5 rounded text-blue-600"
                      />
                      <span>{tipo}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Observações Operacionais</label>
                <textarea
                  name="observacoes"
                  rows={2}
                  defaultValue={editingPart.observacoes || ""}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPart(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          MODAL: PERMISSÕES E ESCOPO DE VISUALIZAÇÃO
      ─────────────────────────────────────────────────────────── */}
      {permPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Permissões & Escopo: {permPart.nome}
                </h3>
                <p className="text-[11px] text-slate-500">Defina o nível de visibilidade e menus ERP autorizados.</p>
              </div>
              <button onClick={() => setPermPart(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              action={async (fd) => {
                await updateParticipanteAction(fd);
                setPermPart(null);
                window.location.reload();
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="empresa_id" value={empresaId} />
              <input type="hidden" name="id" value={permPart.id} />
              <input type="hidden" name="nome" value={permPart.nome} />
              <input type="hidden" name="status" value={permPart.status} />

              {/* Escopo de Visualização */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">
                  Regra de Escopo de Visualização:
                </label>
                <select
                  name="escopo_visualizacao"
                  defaultValue={permPart.escopo_visualizacao || "TODOS"}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="TODOS">Todos os registros da Master Franquia</option>
                  <option value="VINCULADOS">Somente registros vinculados a este participante</option>
                  <option value="CRIADOS">Somente registros criados por este participante</option>
                  <option value="VINCULADOS_OU_CRIADOS">Vinculados OU criados por este participante</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  Aplica-se a CRM, Propostas, Cotas, Lances e Comissões tanto na interface quanto nas queries seguras.
                </p>
              </div>

              {/* Módulos Liberados */}
              <div className="space-y-2">
                <label className="font-bold text-slate-800 dark:text-slate-200 block">
                  Módulos ERP Autorizados (Limitados pelo Plano da Empresa):
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {MODULOS_ERP_CATALOGO.filter((m) => modulosDisponiveis.includes(m.id)).map((modulo) => (
                    <label
                      key={modulo.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <div>
                        <strong className="block text-slate-900 dark:text-white font-bold">{modulo.label}</strong>
                        <span className="text-[10px] text-slate-500">{modulo.desc}</span>
                      </div>
                      <input
                        type="checkbox"
                        name="modulos_permitidos"
                        value={modulo.id}
                        defaultChecked={
                          Array.isArray(permPart.modulos_permitidos)
                            ? permPart.modulos_permitidos.includes(modulo.id)
                            : true
                        }
                        className="h-4 w-4 rounded text-indigo-600"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPermPart(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  Salvar Permissões
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          MODAL: EXCLUSÃO OU INATIVAÇÃO COM DEPENDÊNCIAS
      ─────────────────────────────────────────────────────────── */}
      {deletePart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Excluir / Inativar: {deletePart.nome}
              </h3>
            </div>

            {isCheckingDeps ? (
              <div className="py-6 text-center space-y-2">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600" />
                <p className="text-xs text-slate-500">Verificando histórico e dependências no ERP...</p>
              </div>
            ) : deleteDeps?.pode_excluir ? (
              <div className="space-y-3 text-xs">
                <p className="text-slate-600 dark:text-slate-300">
                  Este participante foi criado recentemente e <strong>não possui nenhum vínculo histórico</strong> com
                  vendas, cotas, propostas ou comissões.
                </p>
                <p className="text-rose-600 font-bold">Deseja realmente excluí-lo definitivamente?</p>

                <form
                  action={async (fd) => {
                    await deleteParticipanteAction(fd);
                    setDeletePart(null);
                    window.location.reload();
                  }}
                  className="flex justify-end gap-2 pt-3 border-t dark:border-slate-800"
                >
                  <input type="hidden" name="empresa_id" value={empresaId} />
                  <input type="hidden" name="id" value={deletePart.id} />
                  <button
                    type="button"
                    onClick={() => setDeletePart(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700"
                  >
                    Confirmar Exclusão
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="rounded-xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                  <p className="font-bold mb-1">Exclusão Bloqueada por Integridade Histórica:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {deleteDeps?.motivos.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  Para preservar a auditoria de comissões e vendas, este participante não pode ser apagado, mas pode ser{" "}
                  <strong>inativado</strong> para revogar novos lançamentos.
                </p>

                <form
                  action={async (fd) => {
                    await updateParticipanteStatusAction(fd);
                    setDeletePart(null);
                    window.location.reload();
                  }}
                  className="flex justify-end gap-2 pt-3 border-t dark:border-slate-800"
                >
                  <input type="hidden" name="empresa_id" value={empresaId} />
                  <input type="hidden" name="id" value={deletePart.id} />
                  <input type="hidden" name="status" value="INATIVO" />
                  <input
                    type="hidden"
                    name="motivo"
                    value="Inativação operacional solicitada via painel de participantes"
                  />
                  <button
                    type="button"
                    onClick={() => setDeletePart(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-amber-600 px-4 py-2 font-bold text-white hover:bg-amber-700"
                  >
                    Inativar Participante
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────
          MODAL: NOVO PARTICIPANTE
      ─────────────────────────────────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Novo Participante Comercial</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              action={async (fd) => {
                await createParticipanteAction(fd);
                setIsCreateOpen(false);
                window.location.reload();
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="empresa_id" value={empresaId} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Nome Completo *</label>
                  <input
                    name="nome"
                    required
                    placeholder="Ex: Carlos Silva"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Nome de Exibição / Apelido</label>
                  <input
                    name="nome_exibicao"
                    placeholder="Ex: Carlos Consórcios"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">WhatsApp / Celular</label>
                  <input
                    name="whatsapp"
                    placeholder="(00) 00000-0000"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Telefone Fixo</label>
                  <input
                    name="telefone"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">E-mail</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="carlos@exemplo.com"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">CPF</label>
                  <input
                    name="cpf"
                    placeholder="000.000.000-00"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Cargo / Função</label>
                  <input
                    name="cargo"
                    placeholder="Ex: Consultor Sênior"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300">Status Inicial</label>
                  <select
                    name="status"
                    defaultValue="ATIVO"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                  >
                    {PARTICIPANTE_STATUS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tipos Múltiplos */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Tipos de Participação Comercial *:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PARTICIPANTE_TIPOS.map((tipo) => (
                    <label key={tipo} className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        name="tipos"
                        value={tipo}
                        defaultChecked={tipo === "CONSULTOR"}
                        className="h-3.5 w-3.5 rounded text-blue-600"
                      />
                      <span>{tipo}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Observações</label>
                <textarea
                  name="observacoes"
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Criar Participante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
