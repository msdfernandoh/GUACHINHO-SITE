import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TemplateWorkspace, type TemplateDetail } from "@/components/platform/template-workspace";

export default async function PlatformTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();

  const [templateRes, empresasRes, historicoRes] = await Promise.all([
    db
      .from("site_modelos")
      .select("id,codigo,nome,descricao,status,versao,identidade_visual,catalogo_menus,secoes_home,configuracao_footer,codigo_customizado,permite_logo_propria,logo_padrao_url,modelo_origem_id,updated_at")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("empresas")
      .select("id,nome_fantasia")
      .eq("status", "ATIVA")
      .order("nome_fantasia"),
    db
      .from("plataforma_auditoria")
      .select("id,acao,entidade_tipo,entidade_id,campos_alterados,created_at")
      .eq("entidade_tipo", "site_modelos")
      .eq("entidade_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!templateRes.data) notFound();

  return (
    <TemplateWorkspace
      template={templateRes.data as unknown as TemplateDetail}
      empresas={empresasRes.data ?? []}
      historico={(historicoRes.data ?? []) as never[]}
    />
  );
}
