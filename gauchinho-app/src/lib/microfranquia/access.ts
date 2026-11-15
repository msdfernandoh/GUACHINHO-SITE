import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { resolveIndicadorAppSession } from "@/lib/parceiros/indicador-app-session";

export async function obterMicrofranquia(empresaId:string, participanteId:string){
 const db=createAdminClient({noStore:true});
 const {data:p,error}=await db.from("participantes_comerciais").select("id,nome,status").eq("empresa_id",empresaId).eq("id",participanteId).eq("status","ATIVO").maybeSingle();
 if(error||!p)return null;
 const [{data:tipos,error:e1},{data:perfis,error:e2},{data:indicador,error:e3}]=await Promise.all([
  db.from("participante_tipos").select("tipo_codigo").eq("empresa_id",empresaId).eq("participante_id",p.id).eq("tipo_codigo","MICROFRANQUIA"),
  db.from("participante_comissao_perfis").select("id").eq("empresa_id",empresaId).eq("participante_id",p.id).eq("papel_tipo","MICROFRANQUIA").eq("ativo",true),
  db.from("programa_indicadores").select("id,codigo_indicacao_curto,modelo_interesse,status_solicitacao_modelo").eq("empresa_id",empresaId).eq("participante_id",p.id).eq("ativo",true).maybeSingle()
 ]);
 if(e1||e2||e3)return null;
 if(!tipos?.length&&!perfis?.length&&!(indicador?.modelo_interesse==="MICROFRANQUEADO"&&indicador.status_solicitacao_modelo==="APROVADO"))return null;
 return {...p,indicador};
}
export async function requireMicrofranquia(){
 const {empresaAtiva,usuario}=await getCurrentTenantContext();if(!empresaAtiva||!usuario)throw new Error("Entre no app para gerenciar sua equipe.");
 const {participante}=await resolveIndicadorAppSession(empresaAtiva.id,usuario.id);if(!participante)throw new Error("Participante não localizado.");
 const micro=await obterMicrofranquia(empresaAtiva.id,participante.id);if(!micro)throw new Error("Esta função é exclusiva para microfranquias ativas e aprovadas.");
 return {empresaId:empresaAtiva.id,usuarioId:usuario.id,micro};
}
export async function microfranquiaPorConvite(empresaId:string,codigo:string){
 if(!/^[A-Za-z0-9]{6,40}$/.test(codigo))return null;
 const {data:i,error}=await createAdminClient({noStore:true}).from("programa_indicadores").select("participante_id").eq("empresa_id",empresaId).eq("codigo_indicacao_curto",codigo.toUpperCase()).eq("ativo",true).maybeSingle();
 return !error&&i?obterMicrofranquia(empresaId,i.participante_id):null;
}
