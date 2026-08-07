import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { PARCEIRO_SITE_STATUS } from "@/lib/parceiros/constants";
import { TEMPLATE_CODIGOS } from "@/lib/parceiros/templates";
import { canAccessParceiroSitesAdmin, fetchParceiroSitesList } from "./actions";

export default async function ParceiroSitesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    organizacaoId?: string;
    status?: string;
    template?: string;
    comDominio?: string;
    publicado?: string;
    q?: string;
  }>;
}) {
  const allowed = await canAccessParceiroSitesAdmin();
  if (!allowed) redirect("/admin");

  const params = await searchParams;
  const { ready, message, rows, organizacoes } = await fetchParceiroSitesList(params);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sites de parceiros</h1>
          <p className="text-sm text-zinc-500">
            Administração exclusiva da empresa tenant. Sem Vercel/DNS real nesta rodada (E4).
          </p>
        </div>
        {ready ? (
          <Link href="/admin/parceiro-sites/novo">
            <Button type="button">Novo site</Button>
          </Link>
        ) : null}
      </div>

      {!ready ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Módulo em preparação</p>
          <p className="mt-1">{message}</p>
          <p className="mt-2 text-xs opacity-80">
            Fora do menu. Ative FASE3_PARCEIRO_SITES_ADMIN_ENABLED=true apenas em ambiente autorizado.
            Site público e área comercial permanecem desligados.
          </p>
        </div>
      ) : (
        <>
          <form
            method="get"
            className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div>
              <Label htmlFor="q">Busca</Label>
              <Input id="q" name="q" defaultValue={params.q ?? ""} placeholder="Nome, slug, domínio…" />
            </div>
            <div>
              <Label htmlFor="organizacaoId">Organização</Label>
              <Select id="organizacaoId" name="organizacaoId" defaultValue={params.organizacaoId ?? ""}>
                <option value="">Todas</option>
                {organizacoes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome_fantasia}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={params.status ?? ""}>
                <option value="">Todos</option>
                {PARCEIRO_SITE_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="template">Template</Label>
              <Select id="template" name="template" defaultValue={params.template ?? ""}>
                <option value="">Todos</option>
                {TEMPLATE_CODIGOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="comDominio">Domínio configurado</Label>
              <Select id="comDominio" name="comDominio" defaultValue={params.comDominio ?? ""}>
                <option value="">Todos</option>
                <option value="1">Com domínio</option>
                <option value="0">Sem domínio</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="publicado">Publicado</Label>
              <Select id="publicado" name="publicado" defaultValue={params.publicado ?? ""}>
                <option value="">Todos</option>
                <option value="1">Somente PUBLICADO</option>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Button type="submit" variant="outline">
                Filtrar
              </Button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-xl border bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="min-w-full text-sm">
              <thead className="border-b bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-3 py-2">Organização</th>
                  <th className="px-3 py-2">Site</th>
                  <th className="px-3 py-2">Slug</th>
                  <th className="px-3 py-2">Template</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Canal</th>
                  <th className="px-3 py-2">Domínio</th>
                  <th className="px-3 py-2">SSL</th>
                  <th className="px-3 py-2">Ativo</th>
                  <th className="px-3 py-2">Atualizado</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-zinc-500">
                      Nenhum site cadastrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b dark:border-zinc-800">
                      <td className="px-3 py-2">{row.organizacao_nome ?? "—"}</td>
                      <td className="px-3 py-2 font-medium">{row.nome_site}</td>
                      <td className="px-3 py-2 text-zinc-500">{row.slug}</td>
                      <td className="px-3 py-2 text-xs">{row.template_codigo}</td>
                      <td className="px-3 py-2">{row.status_publicacao}</td>
                      <td className="px-3 py-2">{row.canal_principal}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.dominio_principal ? (
                          <>
                            {row.dominio_principal}
                            <br />
                            <span className="text-zinc-500">{row.dominio_status}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{row.dominio_ssl ?? "—"}</td>
                      <td className="px-3 py-2">{row.ativo ? "Sim" : "Não"}</td>
                      <td className="px-3 py-2 text-xs text-zinc-500">
                        {new Date(row.updated_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/parceiro-sites/${row.id}`}
                          className="text-amber-600 hover:underline"
                        >
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
