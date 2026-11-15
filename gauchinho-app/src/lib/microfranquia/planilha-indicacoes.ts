import { normalizePhoneForLead, isValidBrazilianPhone } from "@/lib/crm/upsert-lead";
export const CABECALHOS_INDICACOES=["Nome do cliente","Telefone","Email","Valor do imovel","Nome do imovel"];
export type LinhaIndicacaoPlanilha={linha:number;nome:string;telefone:string;email:string;valorImovel:number;nomeImovel:string;erro?:string};
export const MAX_LINHAS_INDICACOES=500;
export function valorMonetario(value:unknown){if(typeof value==="number")return value;const text=String(value??"").trim().replace(/R\$\s*/g,"").replace(/\s/g,"");if(!text)return NaN;if(text.includes(","))return Number(text.replace(/\./g,"").replace(",","."));return Number(text);}
export function validarLinhaIndicacao(input:Partial<LinhaIndicacaoPlanilha>,linha:number):LinhaIndicacaoPlanilha{
 const item={linha,nome:String(input.nome??"").trim(),telefone:normalizePhoneForLead(String(input.telefone??"")),email:String(input.email??"").trim().toLowerCase(),valorImovel:Number(input.valorImovel),nomeImovel:String(input.nomeImovel??"").trim()};
 const erro=item.nome.length<3||item.nome.length>160?"Informe o nome do cliente.":!isValidBrazilianPhone(item.telefone)?"Telefone inválido; inclua o DDD.":item.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)?"E-mail inválido.":!Number.isFinite(item.valorImovel)||item.valorImovel<=0||item.valorImovel>1e12?"Valor do imóvel inválido.":!item.nomeImovel||item.nomeImovel.length>200?"Informe o nome do imóvel (até 200 caracteres).":undefined;
 return {...item,erro};
}
const chave=(s:unknown)=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
export function interpretarLinhasPlanilha(rows:unknown[][]){
 if(!rows.length)throw new Error("A planilha está vazia.");
 const header=rows[0].map(chave);const indices=CABECALHOS_INDICACOES.map(h=>header.indexOf(chave(h)));if(indices.some(i=>i<0))throw new Error("Use o modelo com as cinco colunas: nome do cliente, telefone, email, valor do imóvel e nome do imóvel.");
 const preenchidas=rows.slice(1).map((cells,i)=>({cells,linha:i+2})).filter(r=>r.cells.some(c=>c!==null&&c!==undefined&&String(c).trim()!==""));if(preenchidas.length>MAX_LINHAS_INDICACOES)throw new Error("Importe até 500 contatos por arquivo.");
 const vistos=new Set<string>();return preenchidas.map(({cells,linha})=>{const item=validarLinhaIndicacao({nome:String(cells[indices[0]]??""),telefone:String(cells[indices[1]]??""),email:String(cells[indices[2]]??""),valorImovel:valorMonetario(cells[indices[3]]),nomeImovel:String(cells[indices[4]]??"")},linha);if(vistos.has(item.telefone))return {...item,erro:"Telefone repetido nesta planilha."};vistos.add(item.telefone);return item;});
}
