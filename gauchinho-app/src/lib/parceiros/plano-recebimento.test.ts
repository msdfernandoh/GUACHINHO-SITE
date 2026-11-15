import { describe, expect, it } from "vitest";
import { calcularPlano, TABELAS_FRANQUIA } from "./plano-recebimento";
describe("Planos de recebimento",()=>{
 for(const produto of ["IMOVEIS","VEICULOS"] as const) for(const faixa of ["INTEGRAL","60_99","ABAIXO_59"] as const){
  it(produto+faixa+" soma a tabela",()=>{expect(TABELAS_FRANQUIA[produto][faixa].reduce((s,e)=>s+e[1],0)).toBe(produto==="IMOVEIS"?4:3.5);});
  for(const modelo of ["MICROFRANQUEADO","GERADOR_NEGOCIOS","GERADOR_POSSIBILIDADES"] as const) it(modelo+produto+faixa+" fecha líquido e parcelas",()=>{const p=calcularPlano(modelo,produto,faixa,123456.78);expect(Math.round(p.etapas.reduce((s,e)=>s+e.valor,0)*100)).toBe(Math.round(p.total*100));expect(p.impostos).toBeCloseTo(p.bruto*.175,2);if(modelo!=="MICROFRANQUEADO"){expect(p.etapas.length).toBe(modelo==="GERADOR_NEGOCIOS"?8:4);expect(Math.max(...p.etapas.map(e=>e.valor))-Math.min(...p.etapas.map(e=>e.valor))).toBeLessThan(.011);}});
 }
 it("Micro imóveis 2% bruto e 1,65% líquido",()=>{const p=calcularPlano("MICROFRANQUEADO","IMOVEIS","ABAIXO_59",100000);expect(p.bruto).toBe(2000);expect(p.total).toBe(1650);expect(p.etapas.find(e=>e.etapa==="Contemplação")?.percentualBruto).toBe(.625);});
 it("Micro veículos líquido",()=>{expect(calcularPlano("MICROFRANQUEADO","VEICULOS","INTEGRAL",100000).total).toBe(1443.75);});
 it("Rejeita crédito inválido",()=>{expect(()=>calcularPlano("MICROFRANQUEADO","IMOVEIS","INTEGRAL",-1)).toThrow();});
});
