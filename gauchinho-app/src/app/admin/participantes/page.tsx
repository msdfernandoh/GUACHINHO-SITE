import { redirect } from "next/navigation";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { PARTICIPANTE_STATUS, PARTICIPANTE_TIPOS } from "@/lib/parceiros/constants";
import {
  canAccessParticipantesAdmin,
  createParticipanteAction,
  fetchParticipantesList,
  updateParticipanteStatusAction,
} from "./actions";

export default async function ParticipantesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const allowed = await canAccessParticipantesAdmin();
  if (!allowed) redirect("/admin");

  const params = await searchParams;
  const { ready, message, rows, empresaId } = await fetchParticipantesList({
    status: params.status,
    q: params.q,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Participantes comerciais</h1>
        <p className="text-sm text-zinc-500">
          Identidades operacionais por empresa (Fase 3). Login opcional; tipos múltiplos.
        </p>
      </div>

      {!ready ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Módulo em preparação</p>
          <p className="mt-1">{message}</p>
          <p className="mt-2 text-xs opacity-80">
            Rotas existem, mas não estão no menu e não escrevem em produção até a migration 045
            ser autorizada/aplicada e a flag FASE3_ADMIN_PARTICIPANTES_ENABLED=true.
          </p>
        </div>
      ) : (
        <>
          <form
            method="get"
            className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div>
              <Label htmlFor="q">Busca</Label>
              <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Nome, e-mail…" />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={params.status ?? ""}>
                <option value="">Todos</option>
                {PARTICIPANTE_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="outline">
              Filtrar
            </Button>
          </form>

          <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Tipos</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Contato</th>
                  <th className="px-3 py-2">Login</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                      Nenhum participante cadastrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b dark:border-zinc-800">
                      <td className="px-3 py-2 font-medium">{row.nome}</td>
                      <td className="px-3 py-2 text-xs text-zinc-500">{row.tipos.join(", ")}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2 text-zinc-500">{row.whatsapp || row.telefone || "—"}</td>
                      <td className="px-3 py-2">{row.usuario_id ? "Sim" : "Não"}</td>
                      <td className="px-3 py-2">
                        <form action={updateParticipanteStatusAction} className="flex items-center gap-2">
                          <input type="hidden" name="empresa_id" value={empresaId ?? ""} />
                          <input type="hidden" name="id" value={row.id} />
                          <Select name="status" defaultValue={row.status} className="text-xs">
                            {PARTICIPANTE_STATUS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Select>
                          <Button type="submit" size="sm" variant="outline">
                            Salvar
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <form
            action={createParticipanteAction}
            className="space-y-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold">Novo participante</h2>
            <input type="hidden" name="empresa_id" value={empresaId ?? ""} />
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input id="nome" name="nome" required />
              </div>
              <div>
                <Label htmlFor="nome_exibicao">Nome de exibição</Label>
                <Input id="nome_exibicao" name="nome_exibicao" />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" name="whatsapp" />
              </div>
              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" name="telefone" />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div>
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" name="cpf" />
              </div>
              <div>
                <Label htmlFor="status_new">Status</Label>
                <Select id="status_new" name="status" defaultValue="RASCUNHO">
                  {PARTICIPANTE_STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="cargo">Cargo</Label>
                <Input id="cargo" name="cargo" />
              </div>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Tipos *</legend>
              <div className="flex flex-wrap gap-3">
                {PARTICIPANTE_TIPOS.map((t) => (
                  <label key={t} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="tipos" value={t} />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <Label htmlFor="observacoes">Observações</Label>
              <Input id="observacoes" name="observacoes" />
            </div>
            <Button type="submit">Cadastrar</Button>
          </form>
        </>
      )}
    </div>
  );
}
