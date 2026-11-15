import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({micro:vi.fn(),auth:vi.fn(),duplicate:false,perfil:true,queries:[] as Array<[string,string,unknown]>}));
vi.mock("server-only",()=>({}));vi.mock("./access",()=>({obterMicrofranquia:m.micro}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:()=>({auth:{admin:{createUser:m.auth}},from:(table:string)=>{
 const data=()=>table==="participantes_comerciais"?(m.duplicate?[{id:"existente"}]:[]):table==="usuarios"?[]:table==="papeis"?{id:"consultor"}:m.perfil?[{id:"perfil",papel_base:"INDICADOR"}]:[];
 const q={select:()=>q,eq:(k:string,v:unknown)=>{m.queries.push([table,k,v]);return q;},ilike:()=>q,is:()=>q,limit:()=>q,single:async()=>({data:data()}),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({data:data()}).then(resolve)};return q;
}})}));
import {cadastrarColaborador} from "./cadastro";
const input={nome:"Pessoa Teste",cpf:"54337066055",telefone:"66999999999",email:"teste@example.com",senha:"senha1234",perfil:"GERADOR_NEGOCIOS" as const,pix:"teste@example.com"};
describe("Cadastro delegado da microfranquia",()=>{
 beforeEach(()=>{vi.clearAllMocks();m.queries=[];m.duplicate=false;m.perfil=true;m.micro.mockResolvedValue({id:"micro"});});
 it("nega microfranquia inativa antes de criar credencial",async()=>{m.micro.mockResolvedValue(null);await expect(cadastrarColaborador("empresa","micro",input)).rejects.toThrow("indisponível");expect(m.auth).not.toHaveBeenCalled();});
 it("não toma posse de CPF existente",async()=>{m.duplicate=true;await expect(cadastrarColaborador("empresa","micro",input)).rejects.toThrow("Já existe");expect(m.auth).not.toHaveBeenCalled();});
 it("não inventa perfil financeiro ausente",async()=>{m.perfil=false;await expect(cadastrarColaborador("empresa","micro",input)).rejects.toThrow("configurar um perfil");expect(m.auth).not.toHaveBeenCalled();expect(m.queries).toContainEqual(["comissao_perfis","empresa_id","empresa"]);});
 it("não aceita promoção para microfranqueado pelo cadastro de colaborador",async()=>{await expect(cadastrarColaborador("empresa","micro",{...input,perfil:"MICROFRANQUEADO" as never})).rejects.toThrow("dois perfis");expect(m.auth).not.toHaveBeenCalled();});
 it("valida CPF antes de qualquer criação",async()=>{await expect(cadastrarColaborador("empresa","micro",{...input,cpf:"11111111111"})).rejects.toThrow("CPF válido");expect(m.auth).not.toHaveBeenCalled();});
});
