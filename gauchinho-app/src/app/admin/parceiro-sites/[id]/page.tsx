import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { MENU_CATALOGO } from "@/lib/parceiros/menus";
import {
  PARCEIRO_CANAIS,
  PARCEIRO_DOMINIO_TIPOS,
  PARCEIRO_SITE_STATUS,
  WHATSAPP_MODOS,
} from "@/lib/parceiros/constants";
import { SITE_TEMPLATES } from "@/lib/parceiros/templates";
import type { DnsInstrucoesE5 } from "@/lib/parceiros/domain-e5";
import {
  buildAdminPreviewFacts,
  previewPartnerChannels,
} from "@/lib/parceiros/partner-admin-preview";
import {
  addParceiroSiteDominioAction,
  canAccessParceiroSitesAdmin,
  fetchParceiroSiteDetalhe,
  reconciliarDominioAction,
  setDominioPrincipalAction,
  softRemoveDominioAction,
  suspenderDominioAction,
  updateParceiroSiteAction,
  verificarDominioAction,
} from "../actions";

function DnsCell({ dns }: { dns: Record<string, unknown> }) {
  const d = dns as DnsInstrucoesE5;
  const regs = d.registros ?? [];
  if (!regs.length) {
    return <span className="text-xs text-zinc-500">{d.nota ?? "—"}</span>;
  }
  return (
    <ul className="space-y-1 text-xs">
      {regs.slice(0, 4).map((r, i) => (
        <li key={`${r.tipo}-${r.host}-${i}`}>
          <span className="font-medium">{r.tipo}</span> {r.host} → {r.valor}
        </li>
      ))}
      {regs.length > 4 ? <li>+{regs.length - 4} registro(s)</li> : null}
    </ul>
  );
}

export default async function EditarParceiroSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const allowed = await canAccessParceiroSitesAdmin();
  if (!allowed) redirect("/admin");

  const { id } = await params;
  let detalhe;
  try {
    detalhe = await fetchParceiroSiteDetalhe(id);
  } catch {
    notFound();
  }

  const {
    empresaId,
    site,
    organizacao,
    dominios,
    templates,
    vercelReady,
    vercelDisabledReason,
    vercelProject,
    publicationGates,
  } = detalhe;
  const branding = (site.branding ?? {}) as Record<string, string | null>;
  const seo = (site.seo ?? {}) as Record<string, string | null>;
  const menusAtivos = new Set(
    (Array.isArray(site.menus) ? site.menus : [])
      .map((m: { codigo?: string; habilitado?: boolean }) =>
        m?.habilitado === false ? null : m?.codigo
      )
      .filter(Boolean) as string[]
  );

  const previewFacts = buildAdminPreviewFacts({
    empresaId,
    empresaSlug: "gauchinho",
    tenantOfficialHost: "gauchinhoconsorcios.com.br",
    site,
    orgEmpresaId: empresaId,
    orgStatus: organizacao?.status ?? "ATIVA",
    dominios,
  });
  const channelPreview = previewPartnerChannels({
    facts: previewFacts,
    siteSlug: site.slug,
    tenantHost: "gauchinhoconsorcios.com.br",
  });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/parceiro-sites" className="text-sm text-amber-600 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Editar site</h1>
        <p className="text-sm text-zinc-500">
          Org: {organizacao?.nome_fantasia ?? "—"} · Status org: {organizacao?.status ?? "—"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Domínio → empresa tenant → site do parceiro. Domínios de parceiro não criam tenant.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/40">
        <h2 className="font-semibold">Preview de resolução (E6 — admin)</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Autenticado · não publica · FASE3_PARCEIRO_PUBLIC_SITE_ENABLED=false. Não é URL pública.
        </p>
        <ul className="mt-2 space-y-1 text-xs">
          <li>
            Rota /parceiro/{site.slug}:{" "}
            {channelPreview.path.ok
              ? `OK (${channelPreview.path.partner.source}) · public_eligible=${channelPreview.path.partner.public_eligible}`
              : `— ${channelPreview.path.reason}`}
          </li>
          <li>
            Subdomínio:{" "}
            {channelPreview.subdomain
              ? channelPreview.subdomain.ok
                ? `OK (${channelPreview.subdomain.partner.source})`
                : channelPreview.subdomain.reason
              : "sem domínio SUBDOMINIO_EMPRESA"}
          </li>
          <li>
            Domínio próprio:{" "}
            {channelPreview.customDomain
              ? channelPreview.customDomain.ok
                ? `OK (${channelPreview.customDomain.partner.source})`
                : channelPreview.customDomain.reason
              : "sem DOMINIO_PROPRIO/ALIAS"}
          </li>
        </ul>
      </section>

      {!publicationGates.ok ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Gates de publicação (canal {site.canal_principal})</p>
          <ul className="mt-1 list-disc pl-5">
            {publicationGates.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Rota pública permanece atrás de FASE3_PARCEIRO_PUBLIC_SITE_ENABLED (E8) — não ativada nesta
            rodada.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
          Gates de publicação satisfeitos para status PUBLICADO (ainda sem site público E8).
        </div>
      )}

      <form
        action={updateParceiroSiteAction}
        className="space-y-4 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input type="hidden" name="empresa_id" value={empresaId} />
        <input type="hidden" name="id" value={site.id} />
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="nome_site">Nome do site *</Label>
            <Input id="nome_site" name="nome_site" defaultValue={site.nome_site} required />
          </div>
          <div>
            <Label htmlFor="slug">Slug *</Label>
            <Input id="slug" name="slug" defaultValue={site.slug} required />
          </div>
          <div>
            <Label htmlFor="template_codigo">Template</Label>
            <Select id="template_codigo" name="template_codigo" defaultValue={site.template_codigo}>
              {templates.map((t) => (
                <option key={t} value={t}>
                  {SITE_TEMPLATES[t].nome}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="canal_principal">Canal principal</Label>
            <Select id="canal_principal" name="canal_principal" defaultValue={site.canal_principal}>
              {PARCEIRO_CANAIS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="status_publicacao">Status</Label>
            <Select
              id="status_publicacao"
              name="status_publicacao"
              defaultValue={site.status_publicacao}
            >
              {PARCEIRO_SITE_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="whatsapp_modo">WhatsApp modo</Label>
            <Select id="whatsapp_modo" name="whatsapp_modo" defaultValue={site.whatsapp_modo}>
              {WHATSAPP_MODOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" name="whatsapp" defaultValue={site.whatsapp ?? ""} />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ativo" defaultChecked={site.ativo} />
              Site ativo
            </label>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" name="descricao" rows={3} defaultValue={site.descricao} />
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Menus</legend>
          <div className="flex flex-wrap gap-3">
            {MENU_CATALOGO.map((m) => (
              <label key={m.codigo} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  name="menus"
                  value={m.codigo}
                  defaultChecked={menusAtivos.has(m.codigo)}
                />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-3 md:grid-cols-3">
          <legend className="mb-2 text-sm font-medium md:col-span-3">Branding</legend>
          <div>
            <Label htmlFor="cor_primaria">Cor primária</Label>
            <Input id="cor_primaria" name="cor_primaria" defaultValue={branding.cor_primaria ?? ""} />
          </div>
          <div>
            <Label htmlFor="cor_secundaria">Cor secundária</Label>
            <Input
              id="cor_secundaria"
              name="cor_secundaria"
              defaultValue={branding.cor_secundaria ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="cor_destaque">Cor destaque</Label>
            <Input id="cor_destaque" name="cor_destaque" defaultValue={branding.cor_destaque ?? ""} />
          </div>
          <div>
            <Label htmlFor="logo_url">Logo</Label>
            <Input id="logo_url" name="logo_url" defaultValue={branding.logo_url ?? ""} />
          </div>
          <div>
            <Label htmlFor="logo_claro_url">Logo clara</Label>
            <Input id="logo_claro_url" name="logo_claro_url" defaultValue={branding.logo_claro_url ?? ""} />
          </div>
          <div>
            <Label htmlFor="logo_escuro_url">Logo escura</Label>
            <Input
              id="logo_escuro_url"
              name="logo_escuro_url"
              defaultValue={branding.logo_escuro_url ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="favicon_url">Favicon</Label>
            <Input id="favicon_url" name="favicon_url" defaultValue={branding.favicon_url ?? ""} />
          </div>
          <div>
            <Label htmlFor="banner_url">Banner</Label>
            <Input id="banner_url" name="banner_url" defaultValue={branding.banner_url ?? ""} />
          </div>
          <div>
            <Label htmlFor="texto_hero">Texto hero</Label>
            <Input id="texto_hero" name="texto_hero" defaultValue={branding.texto_hero ?? ""} />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="texto_sobre">Texto sobre</Label>
            <Textarea id="texto_sobre" name="texto_sobre" rows={2} defaultValue={branding.texto_sobre ?? ""} />
          </div>
          <div>
            <Label htmlFor="telefone_site">Telefone (site)</Label>
            <Input id="telefone_site" name="telefone_site" defaultValue={branding.telefone ?? ""} />
          </div>
          <div>
            <Label htmlFor="whatsapp_site">WhatsApp (site)</Label>
            <Input id="whatsapp_site" name="whatsapp_site" defaultValue={branding.whatsapp ?? ""} />
          </div>
          <div>
            <Label htmlFor="email_site">E-mail (site)</Label>
            <Input id="email_site" name="email_site" defaultValue={branding.email ?? ""} />
          </div>
          <div>
            <Label htmlFor="instagram_site">Instagram</Label>
            <Input id="instagram_site" name="instagram_site" defaultValue={branding.instagram ?? ""} />
          </div>
        </fieldset>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="seo_titulo">SEO título</Label>
            <Input id="seo_titulo" name="seo_titulo" defaultValue={seo.titulo ?? ""} />
          </div>
          <div>
            <Label htmlFor="seo_descricao">SEO descrição</Label>
            <Input id="seo_descricao" name="seo_descricao" defaultValue={seo.descricao ?? ""} />
          </div>
        </div>

        <Button type="submit">Salvar alterações</Button>
      </form>

      <section className="space-y-4 rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">DOMÍNIO DO PARCEIRO</h2>
            <p className="text-xs text-zinc-500">
              Separado de{" "}
              <Link href="/admin/empresas" className="text-amber-600 hover:underline">
                DOMÍNIOS DA EMPRESA
              </Link>
              . Deny-list absoluta sobre empresa_dominios.
            </p>
          </div>
          <div className="rounded border px-3 py-2 text-xs dark:border-zinc-700">
            <p>
              Vercel:{" "}
              <span className="font-medium">{vercelReady ? "integração pronta" : "desligada"}</span>
            </p>
            <p className="text-zinc-500">
              Projeto: {vercelProject.projectName} ({vercelProject.projectId.slice(0, 12)}…)
            </p>
            {!vercelReady && vercelDisabledReason ? (
              <p className="mt-1 text-amber-700 dark:text-amber-300">{vercelDisabledReason}</p>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-2 py-1">Host</th>
                <th className="px-2 py-1">Tipo</th>
                <th className="px-2 py-1">Principal</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">SSL</th>
                <th className="px-2 py-1">DNS</th>
                <th className="px-2 py-1">Última verif.</th>
                <th className="px-2 py-1">Erro</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {dominios.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-4 text-zinc-500">
                    Nenhum domínio de parceiro cadastrado.
                  </td>
                </tr>
              ) : (
                dominios.map((d) => {
                  const instr = (d.dns_instrucoes ?? {}) as DnsInstrucoesE5;
                  return (
                    <tr key={d.id} className="border-b align-top dark:border-zinc-800">
                      <td className="px-2 py-2 font-medium">
                        {d.valor}
                        {instr.principal_variant === "www" ? (
                          <span className="ml-1 text-xs text-zinc-500">(www principal)</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 text-xs">{d.tipo}</td>
                      <td className="px-2 py-2">{d.principal ? "Sim" : "Não"}</td>
                      <td className="px-2 py-2">{d.status}</td>
                      <td className="px-2 py-2">{d.ssl_status}</td>
                      <td className="px-2 py-2">
                        <DnsCell dns={d.dns_instrucoes ?? {}} />
                      </td>
                      <td className="px-2 py-2 text-xs text-zinc-500">
                        {d.ultima_verificacao_em
                          ? new Date(d.ultima_verificacao_em).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-xs text-red-600">
                        {d.ultima_mensagem_erro ?? "—"}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          {!d.principal && d.status !== "SUSPENSO" ? (
                            <form action={setDominioPrincipalAction}>
                              <input type="hidden" name="empresa_id" value={empresaId} />
                              <input type="hidden" name="parceiro_site_id" value={site.id} />
                              <input type="hidden" name="dominio_id" value={d.id} />
                              <Button type="submit" size="sm" variant="outline">
                                Principal
                              </Button>
                            </form>
                          ) : null}
                          <form action={verificarDominioAction}>
                            <input type="hidden" name="empresa_id" value={empresaId} />
                            <input type="hidden" name="parceiro_site_id" value={site.id} />
                            <input type="hidden" name="dominio_id" value={d.id} />
                            <Button type="submit" size="sm" variant="outline" disabled={!vercelReady}>
                              Verificar
                            </Button>
                          </form>
                          <form action={reconciliarDominioAction}>
                            <input type="hidden" name="empresa_id" value={empresaId} />
                            <input type="hidden" name="parceiro_site_id" value={site.id} />
                            <input type="hidden" name="dominio_id" value={d.id} />
                            <Button type="submit" size="sm" variant="outline" disabled={!vercelReady}>
                              Reconciliar
                            </Button>
                          </form>
                          {d.status !== "SUSPENSO" ? (
                            <form action={suspenderDominioAction}>
                              <input type="hidden" name="empresa_id" value={empresaId} />
                              <input type="hidden" name="parceiro_site_id" value={site.id} />
                              <input type="hidden" name="dominio_id" value={d.id} />
                              <Button type="submit" size="sm" variant="outline">
                                Suspender
                              </Button>
                            </form>
                          ) : null}
                          <form action={softRemoveDominioAction}>
                            <input type="hidden" name="empresa_id" value={empresaId} />
                            <input type="hidden" name="parceiro_site_id" value={site.id} />
                            <input type="hidden" name="dominio_id" value={d.id} />
                            <Button type="submit" size="sm" variant="danger">
                              Remover
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <form
          action={addParceiroSiteDominioAction}
          className="grid gap-3 border-t pt-4 md:grid-cols-6"
        >
          <input type="hidden" name="empresa_id" value={empresaId} />
          <input type="hidden" name="parceiro_site_id" value={site.id} />
          <div className="md:col-span-2">
            <Label htmlFor="valor">Host / label</Label>
            <Input
              id="valor"
              name="valor"
              placeholder="parceiro.exemplo.com.br ou label"
              required
            />
          </div>
          <div>
            <Label htmlFor="tipo">Tipo</Label>
            <Select id="tipo" name="tipo" defaultValue="DOMINIO_PROPRIO">
              {PARCEIRO_DOMINIO_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="principal_variant">Principal (apex/www)</Label>
            <Select id="principal_variant" name="principal_variant" defaultValue="apex">
              <option value="apex">apex</option>
              <option value="www">www</option>
            </Select>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="principal" />
              Principal
            </label>
            <Button type="submit" size="sm">
              Adicionar
            </Button>
          </div>
          <p className="md:col-span-6 text-xs text-zinc-500">
            Domínio próprio: apex+www como conjunto (valor local = apex; www não é persistido).
            Subdomínio: {"{slug}"}.gauchinhoconsorcios.com.br (sem wildcard). Com flag Vercel off,
            permanece cadastro local PENDENTE_DNS.
          </p>
        </form>
      </section>
    </div>
  );
}
