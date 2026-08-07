import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form-primitives";
import { MENU_CATALOGO } from "@/lib/parceiros/menus";
import { PARCEIRO_CANAIS, PARCEIRO_SITE_STATUS, WHATSAPP_MODOS } from "@/lib/parceiros/constants";
import { TEMPLATE_CODIGOS, SITE_TEMPLATES } from "@/lib/parceiros/templates";
import {
  canAccessParceiroSitesAdmin,
  createParceiroSiteAction,
  fetchOrgsAtivasParaSite,
} from "../actions";
import { isFase3ParceiroSitesAdminReady, fase3SitesAdminDisabledMessage } from "@/lib/parceiros/schema-ready";

export default async function NovoParceiroSitePage() {
  const allowed = await canAccessParceiroSitesAdmin();
  if (!allowed) redirect("/admin");

  const ready = await isFase3ParceiroSitesAdminReady();
  if (!ready) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
        {fase3SitesAdminDisabledMessage()}
      </div>
    );
  }

  const { empresaId, orgs } = await fetchOrgsAtivasParaSite();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/parceiro-sites" className="text-sm text-amber-600 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Novo site de parceiro</h1>
        <p className="text-sm text-zinc-500">
          Somente organização ATIVA da empresa tenant. Sem segundo site ativo no MVP.
        </p>
      </div>

      {orgs.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nenhuma organização ATIVA. Cadastre/ative em Organizações parceiras antes.
        </p>
      ) : (
        <form action={createParceiroSiteAction} className="space-y-4 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <input type="hidden" name="empresa_id" value={empresaId} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="organizacao_parceira_id">Organização *</Label>
              <Select id="organizacao_parceira_id" name="organizacao_parceira_id" required>
                <option value="">Selecione…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome_fantasia}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="nome_site">Nome do site *</Label>
              <Input id="nome_site" name="nome_site" required />
            </div>
            <div>
              <Label htmlFor="slug">Slug *</Label>
              <Input id="slug" name="slug" required placeholder="parceiro-exemplo" />
            </div>
            <div>
              <Label htmlFor="template_codigo">Template *</Label>
              <Select id="template_codigo" name="template_codigo" defaultValue="institucional_v1">
                {TEMPLATE_CODIGOS.map((t) => (
                  <option key={t} value={t}>
                    {SITE_TEMPLATES[t].nome}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="canal_principal">Canal principal</Label>
              <Select id="canal_principal" name="canal_principal" defaultValue="ROTA">
                {PARCEIRO_CANAIS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="status_publicacao">Status</Label>
              <Select id="status_publicacao" name="status_publicacao" defaultValue="RASCUNHO">
                {PARCEIRO_SITE_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-zinc-500">
                PUBLICADO nesta rodada é apenas status administrativo — rota pública desligada.
              </p>
            </div>
            <div>
              <Label htmlFor="whatsapp_modo">WhatsApp</Label>
              <Select id="whatsapp_modo" name="whatsapp_modo" defaultValue="EMPRESA">
                {WHATSAPP_MODOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="whatsapp">WhatsApp (se próprio)</Label>
              <Input id="whatsapp" name="whatsapp" />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea id="descricao" name="descricao" rows={3} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Menus liberados</legend>
            <div className="flex flex-wrap gap-3">
              {MENU_CATALOGO.map((m) => (
                <label key={m.codigo} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="menus" value={m.codigo} defaultChecked={m.codigo === "INICIO" || m.codigo === "CONTATO"} />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-3 md:grid-cols-3">
            <legend className="mb-2 text-sm font-medium md:col-span-3">Branding</legend>
            <div>
              <Label htmlFor="cor_primaria">Cor primária</Label>
              <Input id="cor_primaria" name="cor_primaria" defaultValue="#0A1628" />
            </div>
            <div>
              <Label htmlFor="cor_secundaria">Cor secundária</Label>
              <Input id="cor_secundaria" name="cor_secundaria" defaultValue="#0D1F3C" />
            </div>
            <div>
              <Label htmlFor="cor_destaque">Cor destaque</Label>
              <Input id="cor_destaque" name="cor_destaque" defaultValue="#C9A84C" />
            </div>
            <div>
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input id="logo_url" name="logo_url" />
            </div>
            <div>
              <Label htmlFor="banner_url">Banner URL</Label>
              <Input id="banner_url" name="banner_url" />
            </div>
            <div>
              <Label htmlFor="texto_hero">Texto hero</Label>
              <Input id="texto_hero" name="texto_hero" />
            </div>
          </fieldset>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="seo_titulo">SEO título</Label>
              <Input id="seo_titulo" name="seo_titulo" />
            </div>
            <div>
              <Label htmlFor="seo_descricao">SEO descrição</Label>
              <Input id="seo_descricao" name="seo_descricao" />
            </div>
          </div>

          <Button type="submit">Criar site</Button>
        </form>
      )}
    </div>
  );
}
