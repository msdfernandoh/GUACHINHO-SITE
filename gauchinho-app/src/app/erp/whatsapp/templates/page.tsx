import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { listarInstancias } from "@/lib/whatsapp/cloud-api/conexoes";
import { listarTemplates } from "@/lib/whatsapp/cloud-api/templates";
import { uuid } from "@/lib/whatsapp/cloud-api/validation";
import type { TemplateView } from "@/lib/whatsapp/cloud-api/templates-shared";
import WhatsappNav, { SeletorInstancia } from "../nav";
import TemplatesClient from "./ui";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ instancia_id?: string }> }) {
  const a = await requireErpRouteAccess("whatsapp");
  const instancias = await listarInstancias(a.empresaAtiva.id);
  const sp = await searchParams;
  const sel = instancias.find((i) => i.id === uuid.safeParse(sp.instancia_id).data) || instancias.find((i) => i.status === "conectado") || instancias[0];
  let templates: TemplateView[] = [];
  let erro: string | null = null;
  if (sel?.waba_id) {
    try {
      templates = await listarTemplates(a.empresaAtiva.id, sel.waba_id);
    } catch (e) {
      erro = e instanceof Error ? e.message : "Falha ao carregar.";
    }
  }
  return (
    <>
      <WhatsappNav atual="templates" instanciaId={sel?.id} />
      <div className="mx-auto max-w-5xl space-y-4 text-slate-950">
        <SeletorInstancia instancias={instancias} selecionada={sel?.id ?? ""} base="/erp/whatsapp/templates" />
        {!sel ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6">WhatsApp ainda não liberado para esta empresa.</p>
        ) : sel.status !== "conectado" || !sel.waba_id ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">Conecte o número <strong>{sel.nome}</strong> na aba Conexão e conversas para ver e criar templates.</p>
        ) : (
          <TemplatesClient instanciaId={sel.id} templates={templates} erro={erro} compartilhada={instancias.filter((i) => i.waba_id === sel.waba_id).length > 1} />
        )}
      </div>
    </>
  );
}
