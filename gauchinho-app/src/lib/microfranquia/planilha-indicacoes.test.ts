import { describe,it,expect } from "vitest";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lerPlanilhaIndicacoes } from "./planilha-excel";
import { CABECALHOS_INDICACOES, interpretarLinhasPlanilha } from "./planilha-indicacoes";
const linha=["Cliente Teste","(66) 99999-9999","teste@example.com",350000,"Residencial Teste"];
function arquivo(rows:unknown[][],tipo:"xls"|"xlsx"="xlsx"){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),"Indicacoes");return XLSX.write(wb,{type:"array",bookType:tipo==="xls"?"biff8":"xlsx"}) as ArrayBuffer;}
describe("Importação de Excel",()=>{
 for(const tipo of ["xls","xlsx"] as const)it("lê "+tipo+" e preserva os campos",()=>{const [l]=lerPlanilhaIndicacoes(arquivo([CABECALHOS_INDICACOES,linha],tipo));expect(l).toMatchObject({nome:"Cliente Teste",telefone:"66999999999",email:"teste@example.com",valorImovel:350000,nomeImovel:"Residencial Teste"});expect(l.erro).toBeUndefined();});
 it("aceita cabeçalhos acentuados e reais",()=>{const [l]=interpretarLinhasPlanilha([["Nome do cliente","Telefone","Email","Valor do imóvel","Nome do imóvel"],[...linha.slice(0,3),"R$ 350.000,50","Casa"]]);expect(l.valorImovel).toBe(350000.5);});
 it("marca telefones repetidos e inválidos",()=>{const r=interpretarLinhasPlanilha([CABECALHOS_INDICACOES,linha,linha,["Cliente","123","",1,"Casa"]]);expect(r[1].erro).toContain("repetido");expect(r[2].erro).toContain("Telefone");});
 it("rejeita cabeçalho incorreto e excesso de linhas",()=>{expect(()=>interpretarLinhasPlanilha([["Nome"],linha])).toThrow("modelo");expect(()=>lerPlanilhaIndicacoes(arquivo([CABECALHOS_INDICACOES,...Array(504).fill(linha)]))).toThrow("500");});
 it("rejeita fórmulas",()=>{const wb=XLSX.utils.book_new();const sheet=XLSX.utils.aoa_to_sheet([CABECALHOS_INDICACOES,linha]);sheet.D2={t:"n",v:350000,f:"1+1"};XLSX.utils.book_append_sheet(wb,sheet,"Indicacoes");expect(()=>lerPlanilhaIndicacoes(XLSX.write(wb,{type:"array",bookType:"xlsx"}))).toThrow("fórmulas");});
 for(const ext of ["xls","xlsx"])it("modelo "+ext+" está vazio e tem os cabeçalhos",()=>{const b=readFileSync(resolve(process.cwd(),"public/modelos/indicacoes-imoveis."+ext));expect(lerPlanilhaIndicacoes(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))).toEqual([]);});
});
