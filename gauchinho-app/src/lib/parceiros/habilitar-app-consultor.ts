import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { resolveIndicadorAppSession } from "./indicador-app-session";

// Invocado apenas após autorização do gestor no tenant.
export async function habilitarAppConsultor(empresaId: string, participanteId: string, senha?: string) {
 const db=createAdminClient();
 const {data:p,error}=await db.from("participantes_comerciais").select("id,nome,cpf,email,telefone,whatsapp,usuario_id,status").eq("empresa_id",empresaId).eq("id",participanteId).single();
 if(error||!p||p.status!=="ATIVO")throw new Error("Consultor ativo não encontrado.");
 const cpf=String(p.cpf??"").replace(/\D/g,"");const telefone=String(p.whatsapp||p.telefone||"").replace(/\D/g,"");
 if(cpf.length!==11||telefone.length<10||telefone.length>13)throw new Error("Complete CPF e WhatsApp do consultor para habilitar o app.");
 if(senha&&senha.length<8)throw new Error("A nova senha deve ter pelo menos 8 caracteres.");
 let usuarioId=p.usuario_id;
 if(usuarioId && !(await isPlatformSuperadmin())){const {data:vinculos,error:e}=await db.from("empresa_usuarios").select("empresa_id,papel:papeis(codigo)").eq("usuario_id",usuarioId).eq("ativo",true);if(e)throw new Error("Não foi possível verificar a autorização da conta.");if(vinculos?.some(v=>v.empresa_id!==empresaId||[v.papel].flat().some(p=>p&&["super_admin","admin_empresa"].includes(p.codigo))))throw new Error("Esta conta possui acesso administrativo ou a outras empresas. A senha deve ser alterada pelo próprio usuário ou pelo administrador da plataforma.");}
 const {data:u}=usuarioId?await db.from("usuarios").select("id,auth_user_id").eq("id",usuarioId).single():{data:null};
 if(!u?.auth_user_id){
  const email=String(p.email??"").trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Informe um e-mail válido para criar o acesso.");
  const {data:existente}=await db.from("usuarios").select("id").ilike("email",email).limit(1);
  if(existente?.some(item=>item.id!==usuarioId))throw new Error("Este e-mail já pertence a outro usuário. Revise o vínculo antes de habilitar o acesso.");
  if(!senha)throw new Error("Defina uma nova senha para criar o acesso ao app.");
  const {data:auth,error:authError}=await db.auth.admin.createUser({email,password:senha,email_confirm:true,user_metadata:{cpf}});
  if(authError||!auth.user)throw new Error("Não foi possível criar o login; verifique se o e-mail já possui acesso.");
  if(usuarioId){const {error:e}=await db.from("usuarios").update({auth_user_id:auth.user.id}).eq("id",usuarioId);if(e){await db.auth.admin.deleteUser(auth.user.id);throw new Error(e.message);}}
  else {const {data:novo,error:e}=await db.from("usuarios").insert({nome:p.nome,email,telefone,auth_user_id:auth.user.id,perfil:"parceiro",ativo:true,is_consultor:true,leads_apenas_proprios:true}).select("id").single();if(e||!novo){await db.auth.admin.deleteUser(auth.user.id);throw new Error(e?.message??"Falha ao criar usuário");}usuarioId=novo.id;}
  const {error:linkError}=await db.from("participantes_comerciais").update({usuario_id:usuarioId}).eq("empresa_id",empresaId).eq("id",p.id);if(linkError)throw new Error(linkError.message);
 }else if(senha){const {error:e}=await db.auth.admin.updateUserById(u.auth_user_id,{password:senha});if(e)throw new Error("Não foi possível alterar a senha.");}
 if(!usuarioId)throw new Error("Usuário não vinculado.");
 const {data:link}=await db.from("empresa_usuarios").select("ativo").eq("empresa_id",empresaId).eq("usuario_id",usuarioId).maybeSingle();
 if(link&&!link.ativo)throw new Error("Vínculo de usuário inativo; reative-o em Usuários antes de habilitar o app.");
 if(!link){const {data:papel}=await db.from("papeis").select("id").eq("escopo","COMPANY").eq("codigo","consultor").is("empresa_id",null).single();if(!papel)throw new Error("Papel consultor não encontrado.");const {error:e}=await db.from("empresa_usuarios").insert({empresa_id:empresaId,usuario_id:usuarioId,papel_id:papel.id,ativo:true,origem:"APP_INDICADOR_CONSULTOR",erp_modulos_visiveis:[]});if(e)throw new Error(e.message);}
 const {indicador}=await resolveIndicadorAppSession(empresaId,usuarioId);if(!indicador)throw new Error("Não foi possível habilitar o programa. Verifique CPF e telefone duplicados.");
 const {error:auditoriaError}=await db.from("participante_auditoria").insert({empresa_id:empresaId,participante_id:p.id,acao:"ATUALIZAR",motivo:"Acesso ao app habilitado pelo gestor",payload:{origem:"CONSULTORES",senha_alterada:Boolean(senha)}});
 if(auditoriaError)throw new Error("Acesso habilitado, mas houve falha no registro de auditoria.");
}
