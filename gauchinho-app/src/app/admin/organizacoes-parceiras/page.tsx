import { redirect } from "next/navigation";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { ORGANIZACAO_STATUS, ORGANIZACAO_TIPOS } from "@/lib/parceiros/constants";
import {
  canAccessOrganizacoesAdmin,
  createOrganizacaoAction,
  fetchOrganizacoesList,
  updateOrganizacaoStatusAction,
} from "./actions";

export default async function OrganizacoesParceirasAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const allowed = await canAccessOrganizacoesAdmin();
  if (!allowed) redirect("/admin");

  const params = await searchParams;
  const { ready, message, rows, empresaId } = await fetchOrganizacoesList({
    status: params.status,
    q: params.q,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Organizações parceiras</h1>
        <p className="text-sm text-zinc-500">
          Pré-requisito de sites de parceiros. Não é tenant SaaS. CMS legado permanece intacto.
        </p>
      </div>

      {!ready ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Módulo em preparação</p>
          <p className="mt-1">{message}</p>
          <p className="mt-2 text-xs opacity-80">
            Sem menu lateral nesta rodada. Ative somente após migration 045 + flag
            FASE3_ADMIN_PARTICIPANTES_ENABLED=true.
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
              <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Nome, CNPJ…" />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={params.status ?? ""}>
                <option value="">Todos</option>
                {ORGANIZACAO_STATUS.map((s) => (
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
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">CNPJ</th>
                  <th className="px-3 py-2">Cidade</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                      Nenhuma organização cadastrada.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b dark:border-zinc-800">
                      <td className="px-3 py-2 font-medium">{row.nome_fantasia}</td>
                      <td className="px-3 py-2 text-xs">{row.tipo}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2 text-zinc-500">{row.cnpj || "—"}</td>
                      <td className="px-3 py-2 text-zinc-500">
                        {[row.cidade, row.estado].filter(Boolean).join("/") || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <form action={updateOrganizacaoStatusAction} className="flex items-center gap-2">
                          <input type="hidden" name="empresa_id" value={empresaId ?? ""} />
                          <input type="hidden" name="id" value={row.id} />
                          <Select name="status" defaultValue={row.status} className="text-xs">
                            {ORGANIZACAO_STATUS.map((s) => (
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
            action={createOrganizacaoAction}
            className="space-y-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold">Nova organização parceira</h2>
            <input type="hidden" name="empresa_id" value={empresaId ?? ""} />
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="nome_fantasia">Nome fantasia *</Label>
                <Input id="nome_fantasia" name="nome_fantasia" required />
              </div>
              <div>
                <Label htmlFor="tipo">Tipo *</Label>
                <Select id="tipo" name="tipo" defaultValue="PARCEIRO_COMERCIAL">
                  {ORGANIZACAO_TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="razao_social">Razão social</Label>
                <Input id="razao_social" name="razao_social" />
              </div>
              <div>
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" name="cnpj" />
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
                <Label htmlFor="status_new">Status</Label>
                <Select id="status_new" name="status" defaultValue="RASCUNHO">
                  {ORGANIZACAO_STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" name="cidade" />
              </div>
              <div>
                <Label htmlFor="estado">Estado</Label>
                <Input id="estado" name="estado" maxLength={2} placeholder="RS" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="regioes_atuacao">Regiões de atuação (separadas por vírgula)</Label>
                <Input id="regioes_atuacao" name="regioes_atuacao" placeholder="Serra, Litoral…" />
              </div>
            </div>
            <Button type="submit">Cadastrar</Button>
          </form>
        </>
      )}
    </div>
  );
}
