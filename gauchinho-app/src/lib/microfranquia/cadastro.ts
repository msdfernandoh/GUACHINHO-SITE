import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarCpf, validarEmail } from "@/lib/contratacoes-online/validacao";
import { normalizePhoneForLead, isValidBrazilianPhone } from "@/lib/crm/upsert-lead";
import { obterMicrofranquia } from "./access";
import { NOMES_PERFIL, type CadastroColaborador } from "./types";

export async function cadastrarColaborador(empresaId:string, microId:string, input:CadastroColaborador, actorId?:string){
 const micro=await obterMicrofranquia(empresaId,microId);if(!micro)throw new Error("Microfranquia indisponível.");
 const nome=String(input.nome??"").trim().slice(0,160),cpf=String(input.cpf??"").replace(/\D/g,"");
 const email=String(input.email??"").trim().toLowerCase(),telefone=normalizePhoneForLead(String(input.telefone??""));const pix=String(input.pix??"").trim();
 if(nome.length<3||!validarCpf(cpf)||!validarEmail(email)||!isValidBrazilianPhone(telefone)||pix.length<3||pix.length>140)throw new Error("Preencha nome, CPF válido, telefone com DDD, e-mail e PIX.");
 if(typeof input.senha!=="string"||input.senha.length<8||input.senha.length>128)throw new Error("A senha deve ter de 8 a 128 caracteres.");
 if(input.perfil!=="GERADOR_NEGOCIOS"&&input.perfil!=="GERADOR_OPORTUNIDADES")throw new Error("Escolha um dos dois perfis disponíveis.");
 const db=createAdminClient();
 const [{data:cpfExistente,error:ce},{data:usuarioExistente,error:ue},{data:papel,error:pe},{data:perfis,error:pre}]=await Promise.all([
 db.from("participantes_comerciais").select("id").eq("empresa_id",empresaId).eq("cpf",cpf).limit(1),
 db.from("usuarios").select("id").ilike("email",email).limit(1),
 db.from("papeis").select("id").eq("escopo","COMPANY").eq("codigo","consultor").is("empresa_id",null).single(),
 db.from("comissao_perfis").select("id,papel_base").eq("empresa_id",empresaId).eq("ativo",true).eq("nome",NOMES_PERFIL[input.perfil])]);
 if(ce||ue||pe||pre)throw new Error("Não foi possível validar o cadastro agora.");
 if(cpfExistente?.length||usuarioExistente?.length)throw new Error("Já existe um cadastro com esses dados. Peça ao gestor para revisar o vínculo; não será criada outra conta.");
 if(!papel||perfis?.length!==1||!["INDICADOR","SDR"].includes(perfis[0].papel_base))throw new Error("O gestor precisa configurar um perfil de comissão único para esta modalidade antes do cadastro.");
 const perfil=perfis[0];let authId:string|undefined,usuarioId:string|undefined,participanteId:string|undefined,indicadorId:string|undefined;
 try{
 const {data:auth,error:ae}=await db.auth.admin.createUser({email,password:input.senha,email_confirm:true,user_metadata:{cpf}});if(ae||!auth.user)throw new Error("Não foi possível criar o login. Verifique o e-mail informado.");authId=auth.user.id;
 const {data:u,error:e1}=await db.from("usuarios").insert({auth_user_id:authId,nome,email,telefone,perfil:"parceiro",ativo:true,is_consultor:true,leads_apenas_proprios:true}).select("id").single();if(e1||!u)throw new Error("Falha ao criar o acesso do colaborador.");usuarioId=u.id;
 const {data:p,error:e2}=await db.from("participantes_comerciais").insert({empresa_id:empresaId,usuario_id:usuarioId,nome,nome_exibicao:nome,cpf,email,telefone,whatsapp:telefone,status:"ATIVO",gestor_participante_id:micro.id,escopo_visualizacao:"VINCULADOS",modulos_permitidos:[]}).select("id").single();if(e2||!p)throw new Error("Não foi possível vincular o colaborador à microfranquia.");participanteId=p.id;
 const {error:e3}=await db.from("empresa_usuarios").insert({empresa_id:empresaId,usuario_id:usuarioId,papel_id:papel.id,ativo:true,origem:"APP_MICROFRANQUIA",erp_modulos_visiveis:[]});if(e3)throw new Error("Não foi possível vincular o login à empresa.");
 const {error:e4}=await db.from("participante_tipos").upsert([...new Set(["CONSULTOR","INDICADOR",perfil.papel_base])].map(tipo_codigo=>({empresa_id:empresaId,participante_id:participanteId,tipo_codigo})),{onConflict:"participante_id,tipo_codigo",ignoreDuplicates:true});if(e4)throw new Error("Não foi possível definir o perfil comercial.");
 const {data:i,error:e5}=await db.from("programa_indicadores").insert({empresa_id:empresaId,participante_id:participanteId,cpf,telefone,chave_pix:pix,modelo_interesse:input.perfil==="GERADOR_NEGOCIOS"?"GERADOR_NEGOCIOS":"GERADOR_POSSIBILIDADES",status_solicitacao_modelo:"APROVADO",origem_cadastro:"EQUIPE_MICROFRANQUIA"}).select("id").single();if(e5||!i)throw new Error("Não foi possível concluir o programa de parceiros.");indicadorId=i.id;
 const {error:e6}=await db.from("participante_comissao_perfis").insert({empresa_id:empresaId,participante_id:participanteId,papel_tipo:perfil.papel_base,perfil_id:perfil.id,ativo:true,vigencia_inicio:new Date().toISOString().slice(0,10)});if(e6)throw new Error("Não foi possível vincular o perfil de comissão.");
 const {error:e7}=await db.from("participante_auditoria").insert({empresa_id:empresaId,participante_id:participanteId,actor_usuario_id:actorId??null,acao:"CRIAR",motivo:"Colaborador cadastrado na microfranquia",payload:{gestor_participante_id:micro.id,perfil:input.perfil,origem:actorId?"APP_MICROFRANQUIA":"CONVITE_MICROFRANQUIA"}});if(e7)throw new Error("Não foi possível registrar o cadastro.");
 return {ok:true,participanteId};
 }catch(error){
 // Compensa somente as identidades criadas nesta tentativa. Nunca remove cadastros preexistentes.
 if(participanteId){await db.from("participante_comissao_perfis").delete().eq("empresa_id",empresaId).eq("participante_id",participanteId);if(indicadorId)await db.from("programa_indicadores").delete().eq("empresa_id",empresaId).eq("id",indicadorId);await db.from("participante_tipos").delete().eq("empresa_id",empresaId).eq("participante_id",participanteId);}
 if(usuarioId)await db.from("empresa_usuarios").delete().eq("empresa_id",empresaId).eq("usuario_id",usuarioId);
 if(participanteId)await db.from("participantes_comerciais").delete().eq("empresa_id",empresaId).eq("id",participanteId);
 if(usuarioId)await db.from("usuarios").delete().eq("id",usuarioId);
 if(authId)await db.auth.admin.deleteUser(authId);
 throw error;
 }
}
