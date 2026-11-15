import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({aprovado:false,perfil:false,queries:[] as Array<[string,string,unknown]>}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/tenant/context",()=>({getCurrentTenantContext:vi.fn()}));vi.mock("@/lib/parceiros/indicador-app-session",()=>({resolveIndicadorAppSession:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({from:(table:string)=>{
 const data=()=>table==="participantes_comerciais"?{id:"micro",nome:"Micro",status:"ATIVO"}:table==="programa_indicadores"?{id:"indicador",modelo_interesse:"MICROFRANQUEADO",status_solicitacao_modelo:m.aprovado?"APROVADO":"EM_ANALISE"}:table==="participante_comissao_perfis"&&m.perfil?[{id:"perfil"}]:[];
 const q={select:()=>q,eq:(k:string,v:unknown)=>{m.queries.push([table,k,v]);return q;},maybeSingle:async()=>({data:data()}),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:data()}).then(resolve)};return q;
}})}));
import {obterMicrofranquia} from "./access";
describe("Autorização real de microfranquia",()=>{
 beforeEach(()=>{m.aprovado=false;m.perfil=false;m.queries=[];});
 it("pedido de microfranquia em análise não concede gestão de equipe",async()=>{expect(await obterMicrofranquia("empresa","micro")).toBeNull();});
 it("microfranquia aprovada obtém somente dados do tenant indicado",async()=>{m.aprovado=true;expect(await obterMicrofranquia("empresa","micro")).toMatchObject({id:"micro"});for(const table of ["participantes_comerciais","participante_tipos","participante_comissao_perfis","programa_indicadores"])expect(m.queries).toContainEqual([table,"empresa_id","empresa"]);});
 it("reconhece microfranquias legadas pelo perfil comercial ativo",async()=>{m.perfil=true;expect(await obterMicrofranquia("empresa","micro")).toMatchObject({id:"micro"});expect(m.queries).toContainEqual(["participante_comissao_perfis","papel_tipo","MICROFRANQUIA"]);});
});
