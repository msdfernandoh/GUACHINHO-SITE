import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({guard:vi.fn(),allowed:vi.fn(),list:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/erp/erp-acesso-server',()=>({requireErpRouteAccess:mocks.guard}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:mocks.from})}));
vi.mock('@/lib/grupos/catalogo-autorizado-service',()=>({assertEmpresaPodeAcessarGrupo:mocks.allowed,listGruposAutorizadosForEmpresa:mocks.list}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/grupos-sorteio/buscar-resultado-federal',()=>({buscarPrimeiroPremioFederalPorData:vi.fn()}));
import { fetchContemplacoesGrupoAction, fetchContemplacoesMesAction } from '@/app/erp/assembleias/actions';
const ranges:number[]=[];
beforeEach(()=>{
 vi.clearAllMocks();ranges.length=0;
 mocks.guard.mockResolvedValue({empresaAtiva:{id:'empresa'},usuario:{id:'usuario'}});
 mocks.allowed.mockResolvedValue({id:'grupo'});mocks.list.mockResolvedValue([{id:'grupo',codigo_grupo:'1473'}]);
 mocks.from.mockImplementation((table:string)=>{
  let start=0;const q={select:vi.fn(()=>q),in:vi.fn(()=>q),eq:vi.fn(()=>q),order:vi.fn(()=>q),gte:vi.fn(()=>q),lt:vi.fn(()=>q),range:vi.fn((s:number)=>{start=s;ranges.push(s);return q}),single:vi.fn(async()=>({data:{id:'grupo',ultima_assembleia_numero:1001,dados_estatisticos:{cotas_ativas:2000}},error:null})),then:(resolve:(value:unknown)=>unknown)=>resolve({error:null,data:table==='grupo_assembleias_resultados'?Array.from({length:Math.min(500,1001-start)},(_,i)=>({id:String(start+i),grupo_id:'grupo',assembleia_numero:start+i+1,assembleia_data:'2026-10-15',criado_em:'2026-10-22',cotas:[{cota:String(start+i).padStart(4,'0')+'-00',modalidade:'SORTEIO',situacao_cota:'ATIVA',percentual_lance:0}]})):[]})};return q;
 });
});
describe('consultas de contemplações',()=>{
 it('busca além de mil registros com concessão validada antes da consulta',async()=>{
  const res=await fetchContemplacoesGrupoAction('grupo');
  expect(mocks.allowed).toHaveBeenCalledWith('empresa','grupo');
  expect(ranges).toEqual([0,500,1000]);expect(res.contemplacoes).toHaveLength(1001);expect(res.grupo.cotas_entregues).toBe(1001);
 });
 it('nega UUID fora da concessão sem buscar resultados',async()=>{
  mocks.allowed.mockRejectedValueOnce(new Error('Grupo não autorizado'));
  await expect(fetchContemplacoesGrupoAction('outro')).rejects.toThrow('não autorizado');expect(mocks.from).not.toHaveBeenCalled();
 });
 it('nega sessão sem acesso antes da consulta',async()=>{
  mocks.guard.mockRejectedValueOnce(new Error('Acesso negado'));
  await expect(fetchContemplacoesGrupoAction('grupo')).rejects.toThrow('Acesso negado');expect(mocks.from).not.toHaveBeenCalled();
 });
 it('valida mês e evita consulta global sem grupos autorizados',async()=>{
  await expect(fetchContemplacoesMesAction('2026-13')).rejects.toThrow('inválido');
  mocks.list.mockResolvedValueOnce([]);expect(await fetchContemplacoesMesAction('2026-10')).toEqual({contemplacoes:[],grupos_sem_resultado:[]});expect(mocks.from).not.toHaveBeenCalled();
 });
 it('zero oficial antes da primeira assembleia não vira alerta de coleta incompleta',async()=>{
  mocks.list.mockResolvedValueOnce([
   {id:'novo',codigo_grupo:'1563',data_primeira_assembleia:'2026-12-14',contemplacoes_resumo:{versao:2,sem_assembleias_realizadas:true}},
   {id:'pendente',codigo_grupo:'9999'},
  ]);
  const res=await fetchContemplacoesMesAction('2026-10');
  expect(res.grupos_sem_resultado).toEqual(['9999']);
 });
});
