"use server";
import { obterPerfilAcessoApp } from "@/lib/app-indicador/perfil-acesso";
import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCurrentTenantContext } from "@/lib/tenant/context";
import { requireGerenciarParticipantes } from "@/lib/parceiros/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveIndicadorAppSession } from "@/lib/parceiros/indicador-app-session";

export async function salvarTermoAction(form: FormData) {
 const {empresaAtiva}=await requireCurrentTenantContext();await requireGerenciarParticipantes(empresaAtiva.id);
 const texto=String(form.get("termo")??"").trim();if(texto.length>100000)throw new Error("Termo muito longo.");
 const db=createAdminClient();const {data:empresa,error}=await db.from("empresas").select("configuracoes").eq("id",empresaAtiva.id).single();if(error)throw new Error(error.message);
 const anterior=empresa.configuracoes??{};const versao=createHash("sha256").update(texto).digest("hex");
 let query=db.from("empresas").update({configuracoes:{...anterior,termo_parceria:{texto,versao,publicado_em:new Date().toISOString()}}}).eq("id",empresaAtiva.id);
 query=empresa.configuracoes==null?query.is("configuracoes",null):query.eq("configuracoes",JSON.stringify(empresa.configuracoes));
 const {data,error:e}=await query.select("id");if(e||!data?.length)throw new Error("Configuração alterada por outro usuário. Recarregue antes de salvar.");
 revalidatePath("/app-indicador/parceria");redirect("/admin/participantes/programa?salvo=1");
}
export async function aceitarTermoAction(form: FormData) {
 const {empresaAtiva,usuario}=await requireCurrentTenantContext();if(await obterPerfilAcessoApp(empresaAtiva.id,usuario.id)==="PRODUCAO")throw new Error("Perfil sem acesso ao termo de parceria.");const db=createAdminClient();
 const {participante,indicador}=await resolveIndicadorAppSession(empresaAtiva.id,usuario.id);if(!participante||!indicador)throw new Error("Acesso ao programa não habilitado.");
 const {data:empresa,error}=await db.from("empresas").select("configuracoes").eq("id",empresaAtiva.id).single();if(error)throw new Error(error.message);
 const termo=empresa.configuracoes?.termo_parceria;
 if(!termo?.texto||form.get("aceito")!=="sim"||form.get("versao")!==termo.versao)throw new Error("Leia o termo atual e marque Li e aceito.");
 const {error:e}=await db.from("participante_auditoria").insert({empresa_id:empresaAtiva.id,participante_id:participante.id,actor_usuario_id:usuario.id,acao:"ATUALIZAR",motivo:"Aceite do termo de parceria",payload:{tipo:"ACEITE_TERMO_PARCERIA",versao:termo.versao,texto:termo.texto,aceito_em:new Date().toISOString()}});if(e)throw new Error("Não foi possível registrar o aceite.");
 revalidatePath("/app-indicador/parceria");redirect("/app-indicador/parceria?aceito=1");
}
