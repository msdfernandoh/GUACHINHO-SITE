// Reparação explícita do vínculo legado afetado pela reconciliação da Fase 160.
// Dry-run por padrão. Não altera modelo, paleta, dados comerciais ou outro tenant.
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: empresa, error } = await db.from("empresas")
  .select("id,slug,configuracoes,empresa_site_modelos(status,modelo_id,menus_habilitados,site_modelos(codigo,catalogo_menus))")
  .eq("slug", "gauchinho").single();
if (error) throw error;
const link = empresa.empresa_site_modelos;
if (link?.status !== "PUBLICADO" || link.site_modelos?.codigo !== "gauchinho_default") {
  throw new Error("Vínculo inesperado; reparação cancelada.");
}
if (link.menus_habilitados?.length) {
  console.log("Menus já configurados; nenhuma alteração.");
  process.exit(0);
}
const menus = link.site_modelos.catalogo_menus
  .filter(menu => menu.ativo !== false && (menu.obrigatorio || menu.ativo_padrao))
  .map(menu => menu.id);
if (!menus.includes("grupos") || !menus.includes("simulador")) throw new Error("Catálogo inesperado.");
console.log(JSON.stringify({ empresa_id: empresa.id, modelo: link.site_modelos.codigo, menus_antes: [], menus_depois: menus }));
if (process.argv.includes("--apply")) {
  // Compare-and-set: não sobrescrever uma edição concorrente ou escolha explícita.
  const { data, error: updateError } = await db.from("empresa_site_modelos")
    .update({ menus_habilitados: menus, updated_at: new Date().toISOString() })
    .eq("empresa_id", empresa.id).eq("modelo_id", link.modelo_id)
    .eq("status", "PUBLICADO").eq("menus_habilitados", "[]")
    .select("empresa_id");
  if (updateError) throw updateError;
  if (data.length !== 1) throw new Error("Estado alterado concorrentemente; nenhuma reparação aplicada.");
  const { data: after, error: readError } = await db.from("empresas")
    .select("configuracoes").eq("id", empresa.id).single();
  if (readError) throw readError;
  if (after.configuracoes?.site_publico?.operacional_habilitado !== true) throw new Error("Entitlement não sincronizado.");
  console.log("Menus legados restaurados e entitlement sincronizado pelo trigger existente.");
}
