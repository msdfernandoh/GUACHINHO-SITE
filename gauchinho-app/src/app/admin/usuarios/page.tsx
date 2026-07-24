import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageUsers } from "@/lib/auth/permissions";
import {
  createUsuarioAction,
  fetchUsuarios,
  toggleUsuarioAtivoAction,
  toggleUsuarioConsultorAction,
  toggleUsuarioGoogleAgendaSyncAction,
  toggleUsuarioLeadsApenasPropriosAction,
  updateUsuarioPerfilAction,
} from "./actions";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { PERFIS } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/utils/format";
import { ADMIN_MENU_ITEMS, resolveAdminMenus, type AdminMenuKey } from "@/lib/admin/admin-menus";

export default async function UsuariosPage() {
  const current = await getUsuarioNegocio();
  if (!canManageUsers(current?.perfil)) {
    redirect("/admin");
  }
  const usuarios = await fetchUsuarios();
  const defaultMenus = resolveAdminMenus("srd", null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-sm text-zinc-500">Master — Supabase Auth + perfil</p>
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
              const toggleConsultor = toggleUsuarioConsultorAction.bind(null, u.id, !isConsultor);
              const toggleLeadsProprios = toggleUsuarioLeadsApenasPropriosAction.bind(
                null,
                u.id,
                !leadsApenasProprios,
              );
              const googleAgendaSync = Boolean(
                (u as { google_agenda_sync?: boolean }).google_agenda_sync,
              );
              const googleConnected = Boolean(
                (u as { google_calendar_connected_at?: string | null }).google_calendar_connected_at,
              );
              const toggleGoogleAgenda = toggleUsuarioGoogleAgendaSyncAction.bind(null, u.id, !googleAgendaSync);
              return (
                <tr key={u.id} className="border-b dark:border-zinc-800">
                  <td className="px-3 py-2">{u.nome}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">
                    <form action={updateUsuarioPerfilAction} className="flex items-center gap-2">
                      <input type="hidden" name="usuario_id" value={u.id} />
                      <Select name="perfil" defaultValue={u.perfil} className="min-w-[8.5rem]">
                        {PERFIS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" size="sm" variant="outline">
                        Salvar
                      </Button>
                    </form>
                  </td>
                  <td className="px-3 py-2">
                    <form action={toggleConsultor}>
                      <Button type="submit" size="sm" variant={isConsultor ? "default" : "outline"}>
                        {isConsultor ? "Sim" : "Não"}
                      </Button>
                    </form>
                  </td>
                  <td className="px-3 py-2">
                    <form action={toggleLeadsProprios}>
                      <Button
                        type="submit"
                        size="sm"
                        variant={leadsApenasProprios ? "default" : "outline"}
                        title="Se ativo, o usuário só vê leads em que for o consultor responsável"
                      >
                        {leadsApenasProprios ? "Sim" : "Não"}
                      </Button>
                    </form>
                  </td>
                  <td className="px-3 py-2">
                    <form action={toggleGoogleAgenda}>
                      <Button type="submit" size="sm" variant={googleAgendaSync ? "default" : "outline"}>
                        {googleAgendaSync ? "Habilitado" : "Desligado"}
                      </Button>
                    </form>
                    {googleAgendaSync ? (
                      <p className="mt-1 text-[10px] text-zinc-500">
                        {googleConnected ? "Conectado ao Google" : "Aguardando conexão na Agenda"}
                      </p>
                    ) : null}
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
