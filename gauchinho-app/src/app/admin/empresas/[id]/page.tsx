import { redirect, notFound } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { EmpresaAdministradorasSection } from "@/components/admin/empresa-administradoras-section";
import {
  fetchEmpresaComDetalhes,
  updateEmpresaStatusAction,
  upsertBrandingAction,
  createDominioAction,
  deleteDominioAction,
  verifyDominioAction,
  updateErpSistemaAction,
} from "../actions";
import { ERP_MODULES, getErpSistemaConfig } from "@/lib/erp/erp-modulos";
import {
  fetchAdministradorasCandidatasAction,
  fetchEmpresaAdministradorasAction,
  grantAdministradoraAction,
  setEmpresaAdministradoraStatusAction,
  updateEmpresaAdministradoraAction,
} from "../administradoras-actions";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";

export default async function EditarEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const superadmin = await isPlatformSuperadmin();
  if (!superadmin) redirect("/admin");

  const { id } = await params;
  const detalhes = await fetchEmpresaComDetalhes(id).catch(() => null);
  if (!detalhes) notFound();
  const { empresa, branding, dominios } = detalhes;

  const [concessoes, candidatas] = await Promise.all([
    fetchEmpresaAdministradorasAction(id),
    fetchAdministradorasCandidatasAction(id),
  ]);

  const updateStatus = updateEmpresaStatusAction.bind(null, id);
  const upsertBranding = upsertBrandingAction.bind(null, id);
  const createDominio = createDominioAction.bind(null, id);
  const grantAdmin = grantAdministradoraAction.bind(null, id);
  const updateVinculo = (vinculoId: string, formData: FormData) =>
    updateEmpresaAdministradoraAction(vinculoId, id, formData);
  const setVinculoStatus = (
    vinculoId: string,
    status: "ATIVA" | "INATIVA" | "SUSPENSA",
  ) => setEmpresaAdministradoraStatusAction(vinculoId, id, status);
  const updateErp = updateErpSistemaAction.bind(null, id);
  const erpConfig = getErpSistemaConfig(empresa.configuracoes);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{empresa.nome_fantasia}</h1>
        <p className="text-sm text-zinc-500">
          Slug: {empresa.slug} · {empresa.razao_social}
        </p>
      </div>

      <EmpresaAdministradorasSection
        empresaId={id}
        empresaNome={empresa.nome_fantasia}
        concessoes={concessoes}
        candidatas={candidatas}
        grantAction={grantAdmin}
        updateAction={updateVinculo}
        setStatusAction={setVinculoStatus}
      />

      <Card>
        <h2 className="mb-1 text-lg font-semibold">ERP Sistema</h2>
        <p className="mb-4 text-sm text-zinc-500">Disponibilidade definida exclusivamente pela plataforma para esta empresa.</p>
        <form action={updateErp} className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="erp_habilitado" defaultChecked={erpConfig.habilitado} /> ERP habilitado</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {ERP_MODULES.map((module) => <label key={module.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name={`erp_${module.id}`} defaultChecked={erpConfig.modulos.includes(module.id)} />{module.label}</label>)}
          </div>
          <Button type="submit">Salvar ERP Sistema</Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Status da empresa</h2>
        <form action={updateStatus} className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={empresa.status}>
              <option value="ativo">ativo</option>
              <option value="suspenso">suspenso</option>
              <option value="cancelado">cancelado</option>
              <option value="em_treinamento">em_treinamento</option>
            </Select>
          </div>
          <Button type="submit">Salvar status</Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Domínios e subdomínios</h2>
        <table className="mb-4 min-w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="py-1 pr-3">Valor</th>
              <th className="py-1 pr-3">Tipo</th>
              <th className="py-1 pr-3">Principal</th>
              <th className="py-1 pr-3">Ativo</th>
              <th className="py-1 pr-3">Verificado</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {dominios.length === 0 && (
              <tr>
                <td colSpan={6} className="py-2 text-zinc-500">
                  Nenhum domínio cadastrado.
                </td>
              </tr>
            )}
            {dominios.map((d) => {
              const remove = deleteDominioAction.bind(null, d.id, id);
              const verify = verifyDominioAction.bind(null, d.id, id);
              return (
                <tr key={d.id} className="border-t dark:border-zinc-800">
                  <td className="py-1.5 pr-3 font-mono">{d.valor}</td>
                  <td className="py-1.5 pr-3">{d.tipo}</td>
                  <td className="py-1.5 pr-3">{d.principal ? "Sim" : "Não"}</td>
                  <td className="py-1.5 pr-3">{d.ativo ? "Sim" : "Não"}</td>
                  <td className="py-1.5 pr-3">{d.verificado ? "Sim" : "Não"}</td>
                  <td className="py-1.5">
                    <div className="flex gap-2">
                      {!d.verificado ? (
                        <form action={verify}>
                          <Button type="submit" size="sm">
                            Verificar
                          </Button>
                        </form>
                      ) : null}
                      <form action={remove}>
                        <Button type="submit" size="sm" variant="danger">
                          Remover
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <form action={createDominio} className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="valor">Domínio ou subdomínio</Label>
            <Input id="valor" name="valor" placeholder="empresa.com.br" required />
          </div>
          <div>
            <Label htmlFor="tipo">Tipo</Label>
            <Select id="tipo" name="tipo" defaultValue="DOMINIO_CUSTOMIZADO">
              <option value="DOMINIO_CUSTOMIZADO">Domínio próprio</option>
              <option value="SUBDOMINIO">Subdomínio</option>
            </Select>
          </div>
          <label className="mb-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="principal" /> Principal
          </label>
          <Button type="submit">Adicionar domínio</Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Branding</h2>
        <form action={upsertBranding} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nome_site">Nome do site</Label>
            <Input id="nome_site" name="nome_site" defaultValue={branding?.nome_site ?? ""} required />
          </div>
          <div>
            <Label htmlFor="subtitulo">Subtítulo</Label>
            <Input id="subtitulo" name="subtitulo" defaultValue={branding?.subtitulo ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="descricao_institucional">Descrição institucional</Label>
            <Textarea
              id="descricao_institucional"
              name="descricao_institucional"
              defaultValue={branding?.descricao_institucional ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="cor_primaria">Cor primária</Label>
            <Input id="cor_primaria" name="cor_primaria" defaultValue={branding?.cor_primaria ?? ""} />
          </div>
          <div>
            <Label htmlFor="cor_secundaria">Cor secundária</Label>
            <Input
              id="cor_secundaria"
              name="cor_secundaria"
              defaultValue={branding?.cor_secundaria ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="cor_destaque">Cor de destaque</Label>
            <Input id="cor_destaque" name="cor_destaque" defaultValue={branding?.cor_destaque ?? ""} />
          </div>
          <div>
            <Label htmlFor="status_publicacao">Status de publicação</Label>
            <Select
              id="status_publicacao"
              name="status_publicacao"
              defaultValue={branding?.status_publicacao ?? "RASCUNHO"}
            >
              <option value="RASCUNHO">Rascunho</option>
              <option value="PUBLICADO">Publicado</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" name="telefone" defaultValue={branding?.telefone ?? ""} />
          </div>
          <div>
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" name="whatsapp" defaultValue={branding?.whatsapp ?? ""} />
          </div>
          <div>
            <Label htmlFor="email_contato">E-mail de contato</Label>
            <Input
              id="email_contato"
              name="email_contato"
              defaultValue={branding?.email_contato ?? ""}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Salvar branding</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
