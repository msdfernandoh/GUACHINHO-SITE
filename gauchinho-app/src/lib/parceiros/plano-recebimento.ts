import type { ModeloParceiroId } from "./modelos-programa";
export type ProdutoParceria = "IMOVEIS" | "VEICULOS";
export type FaixaParceria = "INTEGRAL" | "60_99" | "ABAIXO_59";
export const TABELAS_FRANQUIA: Record<ProdutoParceria, Record<FaixaParceria, [string, number][]>> = {
 IMOVEIS: {
 INTEGRAL: [["1ª",1],["2ª",.5],["3ª",.5],["4ª",.5],["5ª",.25],["6ª",.25],["12ª",.25],["18ª",.5],["27ª",.25]],
 "60_99": [["1ª",.75],["2ª",.5],["3ª",.5],["4ª",.5],["5ª",.25],["6ª",.25],["12ª",.25],["18ª",.5],["24ª",.25],["30ª",.25]],
 ABAIXO_59: [["1ª",.5],["2ª",.25],["3ª",.25],["4ª",.25],["5ª",.25],["6ª",.25],["12ª",.5],["18ª",.5],["Contemplação",1.25]] },
 VEICULOS: {
 INTEGRAL: [["1ª",.75],["2ª",.5],["3ª",.5],["4ª",.25],["5ª",.25],["6ª",.25],["12ª",.5],["18ª",.25],["30ª",.25]],
 "60_99": [["1ª",.5],["2ª",.25],["3ª",.5],["4ª",.5],["5ª",.25],["6ª",.25],["12ª",.5],["18ª",.25],["30ª",.5]],
 ABAIXO_59: [["1ª",.5],["2ª",.25],["4ª",.25],["5ª",.25],["6ª",.25],["12ª",.5],["18ª",.25],["Contemplação",1.25]] }
};
export function calcularPlano(modelo: ModeloParceiroId, produto: ProdutoParceria, faixa: FaixaParceria, credito: number){
 if(!Number.isFinite(credito)||credito<0||credito>1e12)throw new Error("Crédito inválido");
 const participacao=modelo==="MICROFRANQUEADO"?.5:modelo==="GERADOR_NEGOCIOS"?.25:.125;
 const percentualFranquia=produto==="IMOVEIS"?4:3.5;
 const bruto=credito*percentualFranquia/100*participacao;
 const totalCentavos=Math.round(bruto*.825*100);
 if(modelo==="MICROFRANQUEADO"){
  let alocado=0;
  const tabela=TABELAS_FRANQUIA[produto][faixa];
  const etapas=tabela.map(([etapa,percentual],index)=>{const centavos=index===tabela.length-1?totalCentavos-alocado:Math.round(credito*percentual/100*.5*.825*100);alocado+=centavos;return {etapa,percentualBruto:percentual*.5,valor:centavos/100};});
  return {bruto,impostos:bruto-totalCentavos/100,total:totalCentavos/100,etapas};
 }
 const quantidade=modelo==="GERADOR_NEGOCIOS"?8:4;
 const base=Math.floor(totalCentavos/quantidade),resto=totalCentavos%quantidade;
 return {bruto,impostos:bruto-totalCentavos/100,total:totalCentavos/100,etapas:Array.from({length:quantidade},(_,i)=>({etapa:`${i+1}ª parcela mensal`,percentualBruto:percentualFranquia*participacao/quantidade,valor:(base+(i<resto?1:0))/100}))};
}
