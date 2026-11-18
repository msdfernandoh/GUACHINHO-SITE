import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listarInstancias } from "@/lib/whatsapp/cloud-api/conexoes";
import { uuid } from "@/lib/whatsapp/cloud-api/validation";
import { variaveisDoTemplate, type ComponenteMeta } from "@/lib/whatsapp/cloud-api/templates-shared";
import WhatsappNav, { SeletorInstancia } from "../nav";
import EnviosClient, { type CampanhaView } from "./ui";

export const dynamic = "force-dynamic";

export default async function EnviosPage({ searchParams }: { searchParams: Promise<{ instancia_id?: string }> }) {
  const a = await requireErpRouteAccess("whatsapp");
  const empresa = a.empresaAtiva.id;
  const instancias = await listarInstancias(empresa);
  const sp = await searchParams;
  const sel = instancias.find((i) => i.id === uuid.safeParse(sp.instancia_id).data) || instancias.find((i) => i.status === "conectado") || instancias[0];
  const db = createAdminClient();
  const [camp, resumo, tpl, leads, sairam] = await Promise.all([
    db.from("whatsapp_campanhas").select("id,instancia_id,nome,tipo,template_nome,status,agendada_para,atraso_minutos,ritmo_por_minuto,hora_inicio,hora_fim,ultimo_erro,created_at,publico").eq("empresa_id", empresa).order("created_at", { ascending: false }).limit(100),
    db.rpc("whatsapp_campanha_resumo", { p_empresa: empresa }),
    sel?.waba_id ? db.from("whatsapp_templates").select("nome,idioma,componentes,header_midia_url").eq("empresa_id", empresa).eq("waba_id", sel.waba_id).eq("status", "APPROVED").order("nome") : Promise.resolve({ data: [] }),
    db.from("leads").select("status,origem").eq("empresa_id", empresa).limit(5000),
    db.from("whatsapp_descadastros").select("numero", { count: "exact", head: true }).eq("empresa_id", empresa),
  ]);
  const porId = new Map(((resumo.data ?? []) as { campanha_id: string }[]).map((r) => [r.campanha_id, r]));
  const campanhas = ((camp.data ?? []) as Omit<CampanhaView, "resumo" | "instancia">[]).map((c) => ({
    ...c, resumo: porId.get(c.id) as CampanhaView["resumo"], instancia: instancias.find((i) => i.id === c.instancia_id)?.nome ?? "",
  }));
  const unicos = (k: "status" | "origem") => [...new Set((leads.data ?? []).map((l) => l[k]).filter(Boolean) as string[])].sort();
  return (
    <>
      <WhatsappNav atual="envios" instanciaId={sel?.id} />
      <div className="mx-auto max-w-5xl space-y-4 text-slate-950">
        <SeletorInstancia instancias={instancias} selecionada={sel?.id ?? ""} base="/erp/whatsapp/envios" />
        {!sel ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6">WhatsApp ainda não liberado para esta empresa.</p>
        ) : (
          <EnviosClient
            instancia={{ id: sel.id, nome: sel.nome, conectada: sel.status === "conectado" }}
            campanhas={campanhas}
            templates={(tpl.data ?? []).map((t) => ({ nome: t.nome as string, idioma: t.idioma as string, variaveis: variaveisDoTemplate(t.componentes as ComponenteMeta[]), corpo: ((t.componentes as ComponenteMeta[]).find((c) => c.type === "BODY")?.text) ?? "" }))}
            statusLeads={unicos("status")}
            origensLeads={unicos("origem")}
            descadastrados={sairam.count ?? 0}
            erro={camp.error ? "Não foi possível carregar os envios. Confira a migration 349 no Supabase." : null}
          />
        )}
      </div>
    </>
  );
}
