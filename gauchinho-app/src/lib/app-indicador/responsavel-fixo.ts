import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { resolveIndicadorAppSession } from "@/lib/parceiros/indicador-app-session";
import { obterPerfilAcessoApp } from "./perfil-acesso";
export async function obterResponsavelFixo(empresaId:string,participanteId:string){
 const db=createAdminClient({noStore:true});const {data:p,error}=await db.from("participantes_comerciais").select("id,nome,usuario_id,status").eq("empresa_id",empresaId).eq("id",participanteId).eq("status","ATIVO").maybeSingle();if(error||!p?.usuario_id)return null;
 const {data:link,error:le}=await db.from("empresa_usuarios").select("id").eq("empresa_id",empresaId).eq("usuario_id",p.usuario_id).eq("ativo",true).maybeSingle();if(le||!link)return null;
 const {data:i,error:ie}=await db.from("programa_indicadores").select("id").eq("empresa_id",empresaId).eq("participante_id",p.id).eq("ativo",true).maybeSingle();if(ie||!i)return null;
 if(await obterPerfilAcessoApp(empresaId,p.usuario_id)==="PRODUCAO")return null;return p;
}
export async function requireResponsavelFixo(){const {empresaAtiva,usuario}=await getCurrentTenantContext();if(!empresaAtiva||!usuario)throw new Error("Entre no app.");const {participante}=await resolveIndicadorAppSession(empresaAtiva.id,usuario.id);const responsavel=participante?await obterResponsavelFixo(empresaAtiva.id,participante.id):null;if(!responsavel)throw new Error("Perfil sem acesso à gestão de colaboradores.");return {empresaId:empresaAtiva.id,usuarioId:usuario.id,responsavel};}
