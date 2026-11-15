"use server";
import { revalidatePath } from "next/cache";
import { requireCurrentTenantContext } from "@/lib/tenant/context";
import { resolveIndicadorAppSession } from "@/lib/parceiros/indicador-app-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertLeadPorTelefone } from "@/lib/crm/upsert-lead";
import { digitsOnlyPhone } from "@/lib/utils/format";
import { validarLinhaIndicacao, type LinhaIndicacaoPlanilha } from "@/lib/microfranquia/planilha-indicacoes";
export async function importarIndicacoesPlanilhaAction(inputs:LinhaIndicacaoPlanilha[]){
 const {empresaAtiva,usuario}=await requireCurrentTenantContext();const {participante,indicador}=await resolveIndicadorAppSession(empresaAtiva.id,usuario.id);if(!participante||!indicador)throw new Error("Seu acesso ao programa não está ativo.");
 if(!Array.isArray(inputs)||!inputs.length||inputs.length>25)throw new Error("Envie até 25 contatos por lote.");
 const db=createAdminClient();const resultados:Array<{linha:number;ok:boolean;mensagem:string}>=[];const vistos=new Set<string>();
 for(const [idx,input] of inputs.entries()){
  const item=validarLinhaIndicacao(input,Number.isInteger(input.linha)?input.linha:idx+2);if(item.erro||vistos.has(item.telefone)){resultados.push({linha:item.linha,ok:false,mensagem:item.erro??"Telefone repetido na planilha."});continue;}vistos.add(item.telefone);
  try{
   // Contatos preexistentes nunca são atualizados nem reatribuídos pela importação.
   const {data:existentes,error:buscaError}=await db.from("leads").select("id").eq("empresa_id",empresaAtiva.id).eq("telefone_normalizado",item.telefone).limit(1);if(buscaError)throw new Error("Não foi possível conferir contatos existentes.");
   if(existentes?.length){resultados.push({linha:item.linha,ok:false,mensagem:"Telefone já cadastrado no CRM; contato preservado."});continue;}
   const observacao="Imóvel: "+item.nomeImovel+". Valor do imóvel: "+item.valorImovel.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})+". Importado pelo app de parceiros. Capacidade mensal não informada.";
   // Mantém a consolidação canônica de telefone do CRM.
   const lead=await upsertLeadPorTelefone(db,{empresa_id:empresaAtiva.id,nome:item.nome,whatsapp:item.telefone,email:item.email||null,origem:"indicacao",origem_detalhe:"Importação de planilha pelo app do indicador",tipo_interesse:"imovel",tipo_credito:"IMOVEL",dados_simulacao:{nome_imovel:item.nomeImovel,valor_imovel:item.valorImovel,origem:"IMPORTACAO_XLS_APP"},observacoes:observacao,status:"Novo",participante_comercial_id:participante.id});if(!lead.ok||!lead.lead_id)throw new Error("Não foi possível cadastrar; confira se o contato já existe.");
   const {error:indicacaoError}=await db.from("programa_indicacoes").insert({empresa_id:empresaAtiva.id,indicador_id:indicador.id,indicador_nome_snapshot:participante.nome,indicador_telefone_snapshot:digitsOnlyPhone(participante.whatsapp||participante.telefone||""),lead_id:lead.lead_id,produto_interesse:"IMOVEL",observacao_indicado:observacao});
   if(indicacaoError){resultados.push({linha:item.linha,ok:false,mensagem:"Contato criado no CRM, mas o vínculo de indicação falhou. Peça ao gestor para revisar antes de repetir."});continue;}
   resultados.push({linha:item.linha,ok:true,mensagem:"Indicação cadastrada."});
  }catch(e){resultados.push({linha:item.linha,ok:false,mensagem:e instanceof Error?e.message:"Não foi possível importar esta linha."});}
 }
 revalidatePath("/app-indicador");revalidatePath("/app-indicador/equipe");revalidatePath("/admin/leads");return resultados;
}
