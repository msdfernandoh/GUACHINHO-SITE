"use server";
import { redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createClient } from "@/lib/supabase/server";

export async function createMasterFranquiaAction(formData:FormData) {
 if(!(await isPlatformSuperadmin())) throw new Error("Acesso restrito ao Platform Superadmin.");
 const nome=String(formData.get("nome_fantasia")??"").trim(); const razao=String(formData.get("razao_social")??"").trim(); const slug=String(formData.get("slug")??"").trim().toLowerCase();
 if(!nome||!razao||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Dados da empresa ou slug inválidos.");
 const db=await createClient(); const {data,error}=await db.from("empresas").insert({nome_fantasia:nome,razao_social:razao,slug,cnpj:String(formData.get("cnpj")??"").trim()||null,status:"em_treinamento",ativo:false,configuracoes:{}}).select("id").single();
 if(error) throw new Error(error.message); redirect(`/platform/empresas/${data.id}`);
}
