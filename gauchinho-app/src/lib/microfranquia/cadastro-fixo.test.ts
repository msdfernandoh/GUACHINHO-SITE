import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({writes:[] as Array<[string,unknown]>,auth:vi.fn(),micro:vi.fn(),owner:vi.fn()}));
vi.mock("./access",()=>({obterMicrofranquia:m.micro}));
vi.mock("@/lib/app-indicador/responsavel-fixo",()=>({obterResponsavelFixo:m.owner}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({auth:{admin:{createUser:m.auth}},from:(table:string)=>{
 let created=false;const result=()=>({data:created?{id:table+"-id"}:table==="papeis"?{id:"papel"}:[],error:null});
 const q={select:()=>q,eq:()=>q,ilike:()=>q,is:()=>q,limit:()=>q,insert:(data:unknown)=>{created=true;m.writes.push([table,data]);return q;},upsert:(data:unknown)=>{m.writes.push([table,data]);return q;},single:async()=>result(),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)};return q;
}})}));
import {cadastrarColaborador} from "./cadastro";
const input={nome:"Pessoa Teste",cpf:"54337066055",telefone:"66999999999",email:"pessoa@example.com",senha:"senha1234",perfil:"GERADOR_NEGOCIOS" as const,pix:"pessoa@example.com"};
describe("Cadastro exclusivo pelo convite fixo",()=>{
 beforeEach(()=>{m.writes=[];vi.clearAllMocks();m.owner.mockResolvedValue({id:"responsavel"});m.auth.mockResolvedValue({data:{user:{id:"auth"}},error:null});});
 it("marca politica protegida sem criar perfil de comissao",async()=>{expect(await cadastrarColaborador("empresa","responsavel",input,undefined,{somenteProducao:true})).toMatchObject({ok:true});expect(m.auth).toHaveBeenCalledWith(expect.objectContaining({app_metadata:{perfis_app_parceiros:{empresa:"PRODUCAO"}}}));expect(m.writes.some(([t])=>t==="participante_comissao_perfis")).toBe(false);expect(m.writes.find(([t])=>t==="programa_indicadores")?.[1]).toMatchObject({origem_cadastro:"COLABORADOR_FIXO_LINK"});expect(m.micro).not.toHaveBeenCalled();});
 it("nao aceita cadastro direto autenticado ou responsavel inativo",async()=>{await expect(cadastrarColaborador("empresa","responsavel",input,"ator",{somenteProducao:true})).rejects.toThrow("link específico");m.owner.mockResolvedValue(null);await expect(cadastrarColaborador("empresa","responsavel",input,undefined,{somenteProducao:true})).rejects.toThrow("indisponível");expect(m.auth).not.toHaveBeenCalled();});
});
