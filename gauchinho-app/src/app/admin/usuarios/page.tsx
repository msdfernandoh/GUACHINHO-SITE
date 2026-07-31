import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageUsers } from "@/lib/auth/permissions";
import {
  createUsuarioAction,
  fetchUsuarios,
  toggleUsuarioAtivoAction,
  updateUsuarioEdicaoAction,
} from "./actions";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { UsuarioEdicaoForm } from "@/components/admin/usuarios/usuario-edicao-form";
import { UsuarioAdminFlashBanner } from "@/components/admin/usuarios/usuario-admin-flash-banner";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { PERFIS } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/utils/format";
import { ADMIN_MENU_ITEMS, resolveAdminMenus, type AdminMenuKey } from "@/lib/admin/admin-menus";

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string }>;
}) {
  const current = await getUsuarioNegocio();
  if (!canManageUsers(current?.perfil)) {
    redirect("/admin");
  }
  const sp = await searchParams;
  const usuarios = await fetchUsuarios();
  const defaultMenus = resolveAdminMenus("srd", null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-sm text-zinc-500">Master — Supabase Auth + perfil</p>
      </div>
      <UsuarioAdminFlashBanner codigo={sp.flash} />
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/50">
        <p className="font-semibold text-zinc-800 dark:text-zinc-100">Como funciona o Google Agenda</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
          <li>
            <strong className="font-medium text-zinc-700 dark:text-zinc-300">Master</strong> marca
            &quot;Sincronizar agenda com Google Agenda&quot; ao criar ou em <em>Editar usuário</em> (só
            contas @gmail.com).
          </li>
          <li>
            O <strong className="font-medium text-zinc-700 dark:text-zinc-300">consultor</strong> entra
            no painel com esse e-mail Gmail, abre <strong>Admin → Agenda</strong> e clica em{" "}
            <strong>Conectar Google Agenda</strong> (login Google uma vez).
          </li>
          <li>
            Depois disso, compromissos <strong>novos</strong> em que ele for o consultor responsável são
            criados também no Google Calendar dele. Cancelamentos removem o evento correspondente.
          </li>
        </ol>
        <p className="mt-2 text-xs text-zinc-500">
          É necessário configurar no servidor{" "}
          <code className="text-[11px]">GOOGLE_CALENDAR_CLIENT_ID</code> e{" "}
          <code className="text-[11px]">GOOGLE_CALENDAR_CLIENT_SECRET</code> e rodar a migration{" "}
          <code className="text-[11px]">033</code> e{" "}
          <code className="text-[11px]">035</code> no Supabase.
        </p>
      </div>
      <form action={createUsuarioAction} className="grid max-w-xl gap-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Novo usuário</h2>
        <div>
          <Label>Nome</Label>
          <Input name="nome" required />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input name="email" type="email" required />
        </div>
        <div>
          <Label>Senha inicial</Label>
          <Input name="password" type="password" required minLength={8} />
        </div>
        <div>
          <Label>Perfil</Label>
          <Select name="perfil" defaultValue="srd">
            {PERFIS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Telefone</Label>
          <Input name="telefone" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_consultor" />
          Consultor comercial
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="leads_apenas_proprios" />
          Ver apenas leads em que for consultor responsável
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="agenda_acesso_todos" />
          Ver e gerenciar a agenda de todos os consultores
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="google_agenda_sync" />
          Sincronizar agenda com Google Agenda (e-mail @gmail.com)
        </label>
        <p className="text-xs text-zinc-500">
          Após criar, o usuário Gmail deve abrir Admin → Agenda e clicar em &quot;Conectar Google Agenda&quot;.
        </p>
        <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="text-sm font-semibold">Menus do painel</p>
          <p className="text-xs text-zinc-500">
            Marque o que este usuário pode acessar. Se nenhum for marcado, usa o padrão do perfil.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ADMIN_MENU_ITEMS.map((m) => (
              <label key={m.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="admin_menu"
                  value={m.key}
                  defaultChecked={defaultMenus.includes(m.key as AdminMenuKey)}
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Usuários marcados como consultores aparecem nas agendas e nos compromissos com leads.
        </p>
        <AdminFormSubmitButton label="Criar usuário" pendingLabel="Criando…" />
      </form>
      <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">E-mail</th>
              <th className="px-3 py-2">Perfil / Função</th>
              <th className="px-3 py-2">Consultor</th>
              <th className="px-3 py-2">Só leads próprios</th>
              <th className="px-3 py-2">Agenda todos</th>
              <th className="px-3 py-2">Google Agenda</th>
              <th className="px-3 py-2">Ativo</th>
              <th className="px-3 py-2">Desde</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const toggle = toggleUsuarioAtivoAction.bind(null, u.id, !u.ativo);
              const isConsultor = Boolean((u as { is_consultor?: boolean }).is_consultor);
              const leadsApenasProprios = Boolean(
                (u as { leads_apenas_proprios?: boolean }).leads_apenas_proprios,
              );
              const agendaAcessoTodos = Boolean(
                (u as { agenda_acesso_todos?: boolean }).agenda_acesso_todos,
              );
              const googleAgendaSync = Boolean(
                (u as { google_agenda_sync?: boolean }).google_agenda_sync,
              );
              const googleConnected = Boolean(
                (u as { google_calendar_connected_at?: string | null }).google_calendar_connected_at,
              );
              const googleAccountEmail = (u as { google_calendar_email?: string | null }).google_calendar_email;
              const googleConnectedAt = (u as { google_calendar_connected_at?: string | null })
                .google_calendar_connected_at;
              const adminMenusRaw = (u as { admin_menus?: AdminMenuKey[] | null }).admin_menus;
              const menuKeysAtivos = resolveAdminMenus(u.perfil, adminMenusRaw);
              return (
                <tr key={u.id} className="border-b dark:border-zinc-800">
                  <td className="px-3 py-2">{u.nome}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{u.perfil}</span>
                    <div className="mt-1">
                      <UsuarioEdicaoForm
                        usuarioId={u.id}
                        nome={u.nome}
                        email={u.email}
                        telefone={u.telefone ?? null}
                        perfil={u.perfil}
                        isConsultor={isConsultor}
                        leadsApenasProprios={leadsApenasProprios}
                        agendaAcessoTodos={agendaAcessoTodos}
                        googleAgendaSync={googleAgendaSync}
                        googleConnected={googleConnected}
                        menuKeysAtivos={menuKeysAtivos}
                        updateAction={updateUsuarioEdicaoAction}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">{isConsultor ? "Sim" : "Não"}</td>
                  <td className="px-3 py-2">{leadsApenasProprios ? "Sim" : "Não"}</td>
                  <td className="px-3 py-2">{agendaAcessoTodos ? "Sim" : "Não"}</td>
                  <td className="px-3 py-2">
                    {googleAgendaSync ? (
                      <>
                        <span className="text-emerald-600 dark:text-emerald-400">Habilitado</span>
                        <p className="mt-0.5 text-[10px] text-zinc-500">
                          {googleConnected
                            ? `Conectado${googleAccountEmail ? `: ${googleAccountEmail}` : ""}${
                                googleConnectedAt ? ` (${formatDate(googleConnectedAt)})` : ""
                              }`
                            : "Aguardando conexão na Agenda"}
                        </p>
                      </>
                    ) : (
                      <span className="text-zinc-500">Desligado</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{u.ativo ? "Sim" : "Não"}</td>
                  <td className="px-3 py-2">{formatDate(u.created_at)}</td>
                  <td className="px-3 py-2">
                    <form action={toggle}>
                      <Button type="submit" size="sm" variant="outline">
                        {u.ativo ? "Desativar" : "Ativar"}
                      </Button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
