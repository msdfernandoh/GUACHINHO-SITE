import { describe, expect, it } from "vitest";
import { indicadoresContemplacoes, resultadosVigentes, contempladasAtivas, situacaoContemplacao, type ResultadoAssembleia, type ResultadoCota } from "./contemplacoes";
const c = (cota: string, modalidade = "SORTEIO", situacao_cota = "ATIVA", percentual_lance = 0): ResultadoCota => ({cota,modalidade,situacao_cota,percentual_lance});
const a = (numero: number, cotas: ResultadoCota[], criado_em = "2026-10-22T12:00:00Z"): ResultadoAssembleia => ({id:String(numero)+criado_em,grupo_id:"grupo",assembleia_numero:numero,assembleia_data:"2026-10-15",criado_em,cotas});
describe("resultados verificados de assembleias", () => {
 it("1473 conta apenas 0645 ativa e preserva sorteio de canceladas",()=>{
  const cotas=[c("0645-00"),c("0657-01","SORTEIO","CANCELADA")];
  expect(contempladasAtivas(cotas)).toBe(1);
  expect(indicadoresContemplacoes([a(1,cotas)],1,100)).toMatchObject({cotas_entregues:1,cotas_a_entregar:99,media_lance_1m:null});
  expect(situacaoContemplacao(cotas[0])).toBe("Sorteada");
 });
 it("exclui fixos, sorteios, canceladas e desclassificadas da média",()=>{
  const cotas=[c("0001-00","LANCE_LIVRE","ATIVA",52.4979),c("0002-00","LANCE_LIVRE","ATIVA",60),c("0003-00","LANCE_FIXO","ATIVA",25),c("0004-00","LANCE_LIVRE","CANCELADA",80),c("0005-00","LANCE_LIVRE","DESCLASSIFICADA",90),c("0006-00","SORTEIO","ATIVA",1)];
  expect(indicadoresContemplacoes([a(1,cotas)],1,100).media_lance_1m).toBe(56.249);
  expect(contempladasAtivas(cotas)).toBe(4);
  expect(situacaoContemplacao(cotas[4])).toBe("Desclassificada");
 });
 it("deduplica reimportações pela última versão e cotas pelo número",()=>{
  const rows=[a(1,[c("0001-00"),c("0001-00")]),a(1,[c("0002-00")],"2026-10-23T12:00:00Z")];
  expect(resultadosVigentes(rows)).toHaveLength(1);
  expect(indicadoresContemplacoes(rows,1,10).cotas_entregues).toBe(1);
 });
 it("não afirma total entregue com histórico incompleto e não desloca janelas",()=>{
  const dados=indicadoresContemplacoes([a(3,[c("0001-00","LANCE_LIVRE","ATIVA",50)])],3,100);
  expect(dados).toMatchObject({media_lance_1m:50,media_lance_3m:null,cotas_entregues:null,cotas_a_entregar:null,assembleias_faltantes:[1,2]});
 });
 it("reconhece assembleia verificada sem contemplação e não inventa saldo",()=>{
  expect(indicadoresContemplacoes([a(1,[])],1,null)).toMatchObject({historico_completo:true,cotas_entregues:0,cotas_a_entregar:null});
  expect(indicadoresContemplacoes([a(1,[c("0001-00")])],1,0).cotas_a_entregar).toBeNull();
 });
 it("arredonda a média em unidades inteiras de quatro casas como numeric do Postgres",()=>{
  expect(indicadoresContemplacoes([a(1,[c('0001-00','LANCE_LIVRE','ATIVA',49.1100),c('0002-00','LANCE_LIVRE','ATIVA',49.1101)])],1,10).media_lance_1m).toBe(49.1101);
 });
 it("zero assembleias exige confirmação explícita do portal",()=>{
  expect(indicadoresContemplacoes([],0,218).cotas_entregues).toBeNull();
  expect(indicadoresContemplacoes([],0,218,true)).toMatchObject({historico_completo:true,cotas_entregues:0,cotas_a_entregar:218,media_lance_1m:null});
 });
 it("não mistura grupos com assembleia de mesmo número",()=>{
  expect(resultadosVigentes([a(1,[]),{...a(1,[]),grupo_id:"outro"}])).toHaveLength(2);
 });
});
