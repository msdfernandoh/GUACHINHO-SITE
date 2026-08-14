"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
export async function decidirGovernancaGrupoAction(formData:FormData){
 if(!(await isPlatformSuperadmin())) throw new Error("Somente Platform Superadmin.");
 const grupoId=String(formData.get("grupo_id")??""); const decisao=String(formData.get("decisao")??""); const observacao=String(formData.get("observacao")??"")||null;
 const db=await createClient(); const {error}=await db.rpc("rpc_decidir_governanca_grupo",{p_grupo_id:grupoId,p_decisao:decisao,p_observacao:observacao}); if(error) throw new Error(error.message); revalidatePath("/platform/grupos");
}
