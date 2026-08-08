import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { formatDate } from "@/lib/utils/format";
import type { EmpresaAdministradoraConcessaoRow } from "@/lib/administradoras/concessoes";
import type { Administradora } from "@/lib/administradoras/types";

type Candidata = Pick<Administradora, "id" | "nome" | "slug" | "status">;

type Props = {
  empresaId: string;
  empresaNome: string;
  concessoes: EmpresaAdministradoraConcessaoRow[];
  candidatas: Candidata[];
  grantAction: (formData: FormData) => void | Promise<void>;
  updateAction: (vinculoId: string, formData: FormData) => void | Promise<void>;
  setStatusAction: (
    vinculoId: string,
    status: "ATIVA" | "INATIVA" | "SUSPENSA",
  ) => void | Promise<void>;
};

export function EmpresaAdministradorasSection({
  empresaNome,
  concessoes,
  candidatas,
  grantAction,
  updateAction,
  setStatusAction,
}: Props) {
  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Administradoras autorizadas</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Administradoras globais credenciadas/autorizadas para a empresa/franqueada{" "}
          <strong className="font-medium text-zinc-700 dark:text-zinc-300">{empresaNome}</strong>.
          Isto não transforma a empresa em administradora.
        </p>
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Alterações de acesso ao catálogo comercial serão refletidas pelos módulos que utilizam a
          concessão (E5/E6). Nesta etapa a gestão é estrutural — grupos/simulador/APIs públicas ainda
          não filtram por concessão.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-800/50">
            <tr>
              <th className="px-3 py-2">Administradora</th>
              <th className="px-3 py-2">Status vínculo</th>
              <th className="px-3 py-2">Cód. franquia</th>
              <th className="px-3 py-2">Cód. comercial</th>
              <th className="px-3 py-2">Atualização</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {concessoes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-zinc-500">
                  Nenhuma administradora autorizada para esta empresa.
                </td>
              </tr>
            ) : (
              concessoes.map((c) => {
                const update = updateAction.bind(null, c.id);
                const suspend = setStatusAction.bind(null, c.id, "SUSPENSA");
                const activate = setStatusAction.bind(null, c.id, "ATIVA");
                const inactivate = setStatusAction.bind(null, c.id, "INATIVA");
                const globalInativa = c.administradora.status === "INATIVA";
                return (
                  <tr key={c.id} className="border-t dark:border-zinc-800 align-top">
                    <td className="px-3 py-3">
                      <p className="font-medium">{c.administradora.nome}</p>
                      <p className="text-xs text-zinc-500">
                        slug: {c.administradora.slug}
                        {globalInativa ? " · global INATIVA" : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3">{c.status}</td>
                    <td className="px-3 py-3" colSpan={2}>
                      <form action={update} className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">Código franquia</Label>
                          <Input
                            name="codigo_franquia"
                            defaultValue={c.codigo_franquia ?? ""}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Código comercial</Label>
                          <Input
                            name="codigo_comercial"
                            defaultValue={c.codigo_comercial ?? ""}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Contato interno</Label>
                          <Input
                            name="contato_interno"
                            defaultValue={c.contato_interno ?? ""}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Observações</Label>
                          <Input
                            name="observacoes"
                            defaultValue={c.observacoes ?? ""}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Button type="submit" size="sm" variant="outline">
                            Salvar dados do vínculo
                          </Button>
                        </div>
                      </form>
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-500">{formatDate(c.updated_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        {c.status !== "ATIVA" ? (
                          <form action={activate}>
                            <Button
                              type="submit"
                              size="sm"
                              variant="outline"
                              disabled={globalInativa}
                            >
                              Ativar
                            </Button>
                          </form>
                        ) : null}
                        {c.status !== "SUSPENSA" ? (
                          <form action={suspend}>
                            <Button type="submit" size="sm" variant="outline">
                              Suspender
                            </Button>
                          </form>
                        ) : null}
                        {c.status !== "INATIVA" ? (
                          <form action={inactivate}>
                            <Button type="submit" size="sm" variant="outline">
                              Inativar
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-dashed p-4 dark:border-zinc-700">
        <h3 className="mb-2 text-sm font-semibold">Adicionar administradora</h3>
        <p className="mb-3 text-xs text-zinc-500">
          Somente o PLATFORM_SUPERADMIN credencia administradoras para esta empresa. A empresa não
          escolhe administradoras.
        </p>
        {candidatas.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Não há administradoras globais ATIVAS disponíveis para nova concessão.
          </p>
        ) : (
          <form action={grantAction} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="administradora_id">Administradora global</Label>
              <Select id="administradora_id" name="administradora_id" required defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {candidatas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} ({a.slug})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="codigo_franquia_new">Código da franquia</Label>
              <Input id="codigo_franquia_new" name="codigo_franquia" />
            </div>
            <div>
              <Label htmlFor="codigo_comercial_new">Código comercial</Label>
              <Input id="codigo_comercial_new" name="codigo_comercial" />
            </div>
            <div>
              <Label htmlFor="contato_interno_new">Contato interno</Label>
              <Input id="contato_interno_new" name="contato_interno" />
            </div>
            <div>
              <Label htmlFor="observacoes_new">Observações</Label>
              <Textarea id="observacoes_new" name="observacoes" rows={2} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Adicionar administradora</Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
