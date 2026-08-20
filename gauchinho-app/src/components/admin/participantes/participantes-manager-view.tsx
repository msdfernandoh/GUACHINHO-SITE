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

export const MODULOS_ERP_CATALOGO = [
  // ── SEÇÃO: OPERAÇÃO ──────────────────────────────────────────────
  { id: "clientes", label: "Clientes & Carteira", desc: "Gestão da carteira de clientes, contratos e histórico", categoria: "Operação" },
  { id: "consultores", label: "Consultores & Participantes", desc: "Gestão da equipe de vendas, consultores e parceiros", categoria: "Operação" },
  { id: "lances", label: "Lances & Estratégias", desc: "Acompanhamento e registro de lances de todas as cotas", categoria: "Operação" },
  { id: "assembleias", label: "Assembleias & Resultados", desc: "Calendário, apuração de pedras e resultados de sorteios", categoria: "Operação" },
  { id: "grupos", label: "Tabelas / Grupos de Consórcio", desc: "Consulta de tabelas de grupos, prazos e cotas", categoria: "Operação" },
  { id: "regras-comissao", label: "Regras de Comissão", desc: "Configuração de regras e programas de comissionamento", categoria: "Operação" },
  { id: "repasse-franquia", label: "Repasse Franquia", desc: "Acompanhamento de repasses e liquidações operacionais", categoria: "Operação" },
  { id: "minhas-comissoes", label: "Minhas Comissões", desc: "Extrato individual de comissões e repasses do consultor", categoria: "Operação" },
  { id: "contas-pagar", label: "Contas a Pagar", desc: "Gestão de despesas e financeiro operacional da franquia", categoria: "Operação" },

  // ── SEÇÃO: GESTÃO & COMERCIAL ─────────────────────────────────────
  { id: "painel", label: "Painel Geral / Início", desc: "Visão geral e principais indicadores do ERP", categoria: "Gestão & CRM" },
  { id: "leads", label: "CRM & Leads", desc: "Funil comercial, captação e oportunidades de venda", categoria: "Gestão & CRM" },
  { id: "propostas", label: "Propostas Comerciais", desc: "Simulações e propostas comerciais emitidas", categoria: "Gestão & CRM" },
  { id: "contratacoes", label: "Contratações Online", desc: "Formalização e checkout digital de contratos", categoria: "Gestão & CRM" },
  { id: "vendas", label: "Vendas & Cotas", desc: "Registro e controle de vendas de cotas da franquia", categoria: "Gestão & CRM" },
  { id: "comissoes", label: "Comissões Globais", desc: "Painel consolidado de comissões e repasses da franquia", categoria: "Gestão & CRM" },
  { id: "financeiro", label: "Financeiro Completo", desc: "Gestão financeira abrangente e fluxo de caixa", categoria: "Gestão & CRM" },
  { id: "relatorios", label: "Relatórios Gerenciais", desc: "Métricas analíticas e relatórios do negócio", categoria: "Gestão & CRM" },
  { id: "metas", label: "Metas & Equipes", desc: "Gestão de metas comerciais e produtividade", categoria: "Gestão & CRM" },
  { id: "tarefas", label: "Tarefas & Follow-up", desc: "Acompanhamento de tarefas e rotinas de clientes", categoria: "Gestão & CRM" },
  { id: "usuarios", label: "Usuários do Sistema", desc: "Controle de acessos e logins do ERP", categoria: "Gestão & CRM" },
];

interface ParticipantesManagerViewProps {
  empresaId: string;
  initialRows: ParticipanteComTipos[];
  modulosDisponiveis?: string[];
}

export function ParticipantesManagerView({
  empresaId,
  initialRows,
  modulosDisponiveis = MODULOS_ERP_CATALOGO.map((m) => m.id),
}: ParticipantesManagerViewProps) {
  const [rows, setRows] = useState<ParticipanteComTipos[]>(initialRows);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  // Modais / Drawers
  const [editingPart, setEditingPart] = useState<ParticipanteComTipos | null>(null);
  const [editSelectedModulos, setEditSelectedModulos] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [permPart, setPermPart] = useState<ParticipanteComTipos | null>(null);
  const [permSelectedModulos, setPermSelectedModulos] = useState<string[]>([]);
  const [permError, setPermError] = useState<string | null>(null);
  const [isSavingPerm, setIsSavingPerm] = useState(false);

  const [deletePart, setDeletePart] = useState<ParticipanteComTipos | null>(null);
  const [deleteDeps, setDeleteDeps] = useState<{
    pode_excluir: boolean;
    total_vinculos: number;
    motivos: string[];
  } | null>(null);
  const [isCheckingDeps, setIsCheckingDeps] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSelectedModulos, setCreateSelectedModulos] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSavingCreate, setIsSavingCreate] = useState(false);

  const handleOpenEdit = (part: ParticipanteComTipos) => {
    setEditingPart(part);
    setEditSelectedModulos(
      Array.isArray(part.modulos_permitidos)
        ? part.modulos_permitidos
        : MODULOS_ERP_CATALOGO.map((m) => m.id)
    );
    setEditError(null);
  };

  const handleOpenPerm = (part: ParticipanteComTipos) => {
    setPermPart(part);
    setPermSelectedModulos(
      Array.isArray(part.modulos_permitidos)
        ? part.modulos_permitidos
        : MODULOS_ERP_CATALOGO.map((m) => m.id)
    );
    setPermError(null);
  };

  const handleOpenCreate = () => {
    setIsCreateOpen(true);
    setCreateSelectedModulos(MODULOS_ERP_CATALOGO.map((m) => m.id));
    setCreateError(null);
  };

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
            Pessoas e entidades com papéis comerciais (consultores, vendedores, gestores, indicadores e parceiros).
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <UserPlus className="h-4 w-4" />
          Novo Participante
        </button>
      </div>

      {/* BARRA DE BUSCA E FILTROS */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail, WhatsApp ou CPF..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs dark:border-slate-800 dark:bg-slate-900"
          />
        </div>

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">Todos os Status</option>
          {PARTICIPANTE_STATUS.map((s) => (
            <option key={s} value={s}>
              Status: {s}
            </option>
          ))}
        </select>

        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">Todos os Tipos</option>
          {PARTICIPANTE_TIPOS.map((t) => (
            <option key={t} value={t}>
              Tipo: {t}
            </option>
          ))}
        </select>
      </div>

      {/* TABELA DE PARTICIPANTES */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Participante</th>
                <th className="px-4 py-3">Tipos / Papéis</th>
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
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    Nenhum participante comercial encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredRows.map((part) => (
                  <tr key={part.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <div>{part.nome}</div>
                      {part.nome_exibicao && (
                        <div className="text-[11px] font-normal text-slate-500">Apelido: {part.nome_exibicao}</div>
                      )}
                      {part.cargo && (
                        <span className="inline-block mt-0.5 rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {part.cargo}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {part.tipos.length > 0 ? (
                          part.tipos.map((tipo) => (
                            <span
                              key={tipo}
                              className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                            >
                              {tipo}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 space-y-0.5">
                      {part.whatsapp && (
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <Phone className="h-3 w-3 text-emerald-600" />
                          {part.whatsapp}
                        </div>
                      )}
                      {part.email && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <Mail className="h-3 w-3 text-blue-500" />
                          {part.email}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {part.usuario_id ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          <Key className="h-3 w-3" /> Login Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Lock className="h-3 w-3" /> Sem Login
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
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
                          onClick={() => handleOpenEdit(part)}
                          title="Editar Participante"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenPerm(part)}
                          title="Permissões e Escopo ERP"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-400 cursor-pointer"
                        >
                          <Shield className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDelete(part)}
                          title="Excluir ou Inativar"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-rose-400 cursor-pointer"
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
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Editar Participante Comercial</h3>
              <button onClick={() => setEditingPart(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                {editError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingEdit(true);
                setEditError(null);
                try {
                  const fd = new FormData(e.currentTarget);
                  const res = await updateParticipanteAction(fd);
                  if (res && !((res as { ok?: boolean; success?: boolean }).ok ?? (res as { ok?: boolean; success?: boolean }).success)) {
                    setEditError(res.error || "Erro ao salvar alterações.");
                    return;
                  }
                  setEditingPart(null);
                  window.location.reload();
                } catch (err) {
                  setEditError(err instanceof Error ? err.message : "Erro ao salvar alterações.");
                } finally {
                  setIsSavingEdit(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="empresa_id" value={empresaId} />
              <input type="hidden" name="id" value={editingPart.id} />
              <input type="hidden" name="usuario_id" value={editingPart.usuario_id || ""} />

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

              {/* Escopo de Visualização */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Escopo de Visualização:
                </label>
                <select
                  name="escopo_visualizacao"
                  defaultValue={editingPart.escopo_visualizacao || "TODOS"}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="TODOS">Todos os registros da Master Franquia</option>
                  <option value="VINCULADOS">Somente registros vinculados a este participante</option>
                  <option value="CRIADOS">Somente registros criados por este participante</option>
                  <option value="VINCULADOS_OU_CRIADOS">Vinculados OU criados por este participante</option>
                </select>
              </div>

              {/* Menus do ERP Visíveis */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 dark:text-slate-200">
                    Menus do ERP Visíveis para este Consultor:
                  </label>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setEditSelectedModulos(MODULOS_ERP_CATALOGO.map((m) => m.id))}
                      className="font-bold text-blue-600 hover:underline"
                    >
                      Marcar Todos
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setEditSelectedModulos([])}
                      className="font-bold text-slate-500 hover:underline"
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {MODULOS_ERP_CATALOGO.map((modulo) => {
                    const isChecked = editSelectedModulos.includes(modulo.id);
                    return (
                      <label
                        key={modulo.id}
                        className={`flex items-start gap-2 rounded-lg border p-2 cursor-pointer transition ${
                          isChecked
                            ? "border-blue-300 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30"
                            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="modulos_permitidos"
                          value={modulo.id}
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditSelectedModulos([...editSelectedModulos, modulo.id]);
                            } else {
                              setEditSelectedModulos(editSelectedModulos.filter((id) => id !== modulo.id));
                            }
                          }}
                          className="mt-0.5 h-3.5 w-3.5 rounded text-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white text-[11px] truncate">
                              {modulo.label}
                            </span>
                            <span className="rounded bg-slate-100 px-1 text-[9px] text-slate-500 dark:bg-slate-700">
                              {modulo.categoria}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight line-clamp-1">{modulo.desc}</p>
                        </div>
                      </label>
                    );
                  })}
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
                  disabled={isSavingEdit}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSavingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Permissões & Menus ERP: {permPart.nome}
                </h3>
                <p className="text-[11px] text-slate-500">Defina os menus visíveis no ERP e o escopo de visualização de dados.</p>
              </div>
              <button onClick={() => setPermPart(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {permError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                {permError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingPerm(true);
                setPermError(null);
                try {
                  const fd = new FormData(e.currentTarget);
                  const res = await updateParticipanteAction(fd);
                  if (res && !res.ok) {
                    setPermError(res.error || "Erro ao salvar permissões.");
                    return;
                  }
                  setPermPart(null);
                  window.location.reload();
                } catch (err) {
                  setPermError(err instanceof Error ? err.message : "Erro ao salvar permissões.");
                } finally {
                  setIsSavingPerm(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="empresa_id" value={empresaId} />
              <input type="hidden" name="id" value={permPart.id} />

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
                  Aplica-se a CRM, Propostas, Cotas, Lances e Comissões.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 dark:text-slate-200 block">
                    Todos os Menus do ERP Autorizados:
                  </label>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPermSelectedModulos(MODULOS_ERP_CATALOGO.map((m) => m.id))}
                      className="font-bold text-indigo-600 hover:underline"
                    >
                      Marcar Todos
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setPermSelectedModulos([])}
                      className="font-bold text-slate-500 hover:underline"
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {MODULOS_ERP_CATALOGO.map((modulo) => {
                    const isChecked = permSelectedModulos.includes(modulo.id);
                    return (
                      <label
                        key={modulo.id}
                        className={`flex items-start gap-2 rounded-lg border p-2 cursor-pointer transition ${
                          isChecked
                            ? "border-indigo-300 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/30"
                            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="modulos_permitidos"
                          value={modulo.id}
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPermSelectedModulos([...permSelectedModulos, modulo.id]);
                            } else {
                              setPermSelectedModulos(permSelectedModulos.filter((id) => id !== modulo.id));
                            }
                          }}
                          className="mt-0.5 h-3.5 w-3.5 rounded text-indigo-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white text-[11px] truncate">
                              {modulo.label}
                            </span>
                            <span className="rounded bg-slate-100 px-1 text-[9px] text-slate-500 dark:bg-slate-700">
                              {modulo.categoria}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight line-clamp-1">{modulo.desc}</p>
                        </div>
                      </label>
                    );
                  })}
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
                  disabled={isSavingPerm}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSavingPerm && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Novo Participante Comercial</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                {createError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSavingCreate(true);
                setCreateError(null);
                try {
                  const fd = new FormData(e.currentTarget);
                  const res = await createParticipanteAction(fd);
                  if (res && !res.ok) {
                    setCreateError(res.error || "Erro ao criar participante.");
                    return;
                  }
                  setIsCreateOpen(false);
                  window.location.reload();
                } catch (err) {
                  setCreateError(err instanceof Error ? err.message : "Erro ao criar participante.");
                } finally {
                  setIsSavingCreate(false);
                }
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
                  <label className="font-bold text-slate-700 dark:text-slate-300">Status</label>
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
                  Tipos de Participação Comercial:
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

              {/* Menus do ERP Visíveis */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 dark:text-slate-200">
                    Menus do ERP Visíveis:
                  </label>
                  <div className="flex gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCreateSelectedModulos(MODULOS_ERP_CATALOGO.map((m) => m.id))}
                      className="font-bold text-blue-600 hover:underline"
                    >
                      Marcar Todos
                    </button>
                    <span>|</span>
                    <button
                      type="button"
                      onClick={() => setCreateSelectedModulos([])}
                      className="font-bold text-slate-500 hover:underline"
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {MODULOS_ERP_CATALOGO.map((modulo) => {
                    const isChecked = createSelectedModulos.includes(modulo.id);
                    return (
                      <label
                        key={modulo.id}
                        className={`flex items-start gap-2 rounded-lg border p-2 cursor-pointer transition ${
                          isChecked
                            ? "border-blue-300 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30"
                            : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="modulos_permitidos"
                          value={modulo.id}
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateSelectedModulos([...createSelectedModulos, modulo.id]);
                            } else {
                              setCreateSelectedModulos(createSelectedModulos.filter((id) => id !== modulo.id));
                            }
                          }}
                          className="mt-0.5 h-3.5 w-3.5 rounded text-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white text-[11px] truncate">
                              {modulo.label}
                            </span>
                            <span className="rounded bg-slate-100 px-1 text-[9px] text-slate-500 dark:bg-slate-700">
                              {modulo.categoria}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight line-clamp-1">{modulo.desc}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
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
