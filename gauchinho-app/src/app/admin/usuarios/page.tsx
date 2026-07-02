import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageUsers } from "@/lib/auth/permissions";
import { createUsuarioAction, fetchUsuarios, toggleUsuarioAtivoAction, toggleUsuarioConsultorAction } from "./actions";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { PERFIS } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/utils/format";

export default async function UsuariosPage() {
  const current = await getUsuarioNegocio();
  if (!canManageUsers(current?.perfil)) {
    redirect("/admin");
  }
  const usuarios = await fetchUsuarios();

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
        <p className="text-xs text-zinc-500">
          Usuários marcados como consultores aparecem nas agendas e nos compromissos com leads.
        </p>
        <Button type="submit">Criar usuário</Button>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">E-mail</th>
              <th className="px-3 py-2">Perfil</th>
              <th className="px-3 py-2">Consultor</th>
              <th className="px-3 py-2">Ativo</th>
              <th className="px-3 py-2">Desde</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => {
              const toggle = toggleUsuarioAtivoAction.bind(null, u.id, !u.ativo);
              const toggleConsultor = toggleUsuarioConsultorAction.bind(null, u.id, !(u as { is_consultor?: boolean }).is_consultor);
              const isConsultor = Boolean((u as { is_consultor?: boolean }).is_consultor);
              return (
                <tr key={u.id} className="border-b dark:border-zinc-800">
                  <td className="px-3 py-2">{u.nome}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">{u.perfil}</td>
                  <td className="px-3 py-2">
                    <form action={toggleConsultor}>
                      <Button type="submit" size="sm" variant={isConsultor ? "default" : "outline"}>
                        {isConsultor ? "Sim" : "Não"}
                      </Button>
                    </form>
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
