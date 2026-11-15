import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
export type PerfilAcessoApp = "PADRAO" | "PRODUCAO";
/** Política em app_metadata: o próprio usuário não pode alterá-la. */
export async function obterPerfilAcessoApp(empresaId:string,usuarioId:string):Promise<PerfilAcessoApp>{
 const db=createAdminClient({noStore:true});const {data:u,error}=await db.from("usuarios").select("auth_user_id,ativo").eq("id",usuarioId).single();
 if(error||!u?.ativo||!u.auth_user_id)throw new Error("Não foi possível validar o perfil do app.");
 const {data,error:authError}=await db.auth.admin.getUserById(u.auth_user_id);if(authError||!data.user)throw new Error("Não foi possível validar o perfil do app.");
 const perfis=data.user.app_metadata?.perfis_app_parceiros;const perfil=perfis&&typeof perfis==="object"?perfis[empresaId]:undefined;
 if(perfil==null||perfil==="PADRAO")return "PADRAO";
 // Valores desconhecidos falham fechados, sem liberar dados financeiros.
 return "PRODUCAO";
}
export function metadataColaboradorProducao(empresaId:string){return {perfis_app_parceiros:{[empresaId]:"PRODUCAO"}};}
