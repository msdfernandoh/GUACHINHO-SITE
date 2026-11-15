export type IndicacaoProducao={id:string;nome:string;etapa:string;fechado:boolean;valorFechado:number|null;produto:string|null;creditoDesejado:number|null};
type Lead={nome:string|null;empresa_id:string;etapa_id:string|null;status:string|null;fechado?:boolean|null};
type Venda={empresa_id:string;status:string|null;valor_credito:number|string|null};
export function resumirIndicacao(empresaId:string,input:{id:string;status:string;produto_interesse?:string|null;credito_desejado?:number|null;lead:Lead|Lead[]|null;venda:Venda|Venda[]|null},etapas:Map<string,string>):IndicacaoProducao{
 const l=Array.isArray(input.lead)?input.lead[0]:input.lead;const v=Array.isArray(input.venda)?input.venda[0]:input.venda;
 const lead=l?.empresa_id===empresaId?l:null;const venda=v?.empresa_id===empresaId?v:null;
 const cancelada=venda&&["cancelada","cancelado","estornada","estornado"].includes(String(venda.status).toLowerCase());
 const vendaRealizada=Boolean(venda&&!cancelada&&!["rascunho","pendente"].includes(String(venda.status).toLowerCase()));
 const fechado=!cancelada&&(vendaRealizada||Boolean(lead?.fechado&&!["perdido","cancelado"].includes(String(lead.status).toLowerCase()))||["ganho","fechado"].includes(String(lead?.status).toLowerCase()));
 const valor=vendaRealizada&&venda?.valor_credito!=null?Number(venda.valor_credito):null;
 return {id:input.id,nome:lead?.nome??"Indicado",etapa:cancelada?"Venda cancelada":fechado?"Fechado":(lead?.etapa_id?etapas.get(lead.etapa_id):null)||lead?.status||"Novo",fechado,valorFechado:valor!=null&&Number.isFinite(valor)&&valor>=0?valor:null,produto:input.produto_interesse??null,creditoDesejado:input.credito_desejado??null};
}
